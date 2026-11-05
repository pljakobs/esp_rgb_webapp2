import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compareFirmwareVersions,
  ensureFirmwareTransition,
  fetchFirmwareVersions,
  findAutomaticFirmwareUpdate,
  firmwareApiBaseUrl,
  firmwareIdentity,
  isAutomaticFirmwareCandidate,
  revalidateFirmware,
} from "../firmwareApi.js";

afterEach(() => vi.unstubAllGlobals());

const record = {
  version: "V5.1.0-2-5.1-develop",
  branch: "5.1-develop",
  soc: "esp32",
  type: "release",
  url: "https://example.test/rom.bin",
};

describe("firmware API selection", () => {
  it("orders full versions and historical build suffixes", () => {
    expect(compareFirmwareVersions("V5.1.0", "V5.1.0-rc.10")).toBeGreaterThan(
      0,
    );
    expect(compareFirmwareVersions("V5.10.0", "V5.9.9")).toBeGreaterThan(0);
    expect(
      compareFirmwareVersions("V5.0-100-develop", "V5.0-99-develop"),
    ).toBeGreaterThan(0);
    expect(
      compareFirmwareVersions("V5.0.0-1016-develop", "V5.0.0-966-develop"),
    ).toBeGreaterThan(0);
  });
  it("derives API roots without treating version.json as discovery", () => {
    expect(firmwareApiBaseUrl("https://example.test/version.json")).toBe(
      "https://example.test/api",
    );
    expect(
      firmwareApiBaseUrl("https://example.test/api/firmware/versions"),
    ).toBe("https://example.test/api");
  });

  it("retains numeric release lines and normalizes stage aliases", () => {
    expect(firmwareIdentity(record.version)).toEqual({
      release_line: "5.1",
      stage: "develop",
    });
    expect(firmwareIdentity("V5.0-4-experimental")).toEqual({
      release_line: "5.0",
      stage: "develop",
    });
    expect(firmwareIdentity("V5.10.0", "5.10/stable")).toEqual({
      release_line: "5.10",
      stage: "prod",
    });
    expect(firmwareIdentity("V5.0.0", "5.1/develop").release_line).toBeNull();
    expect(firmwareIdentity("V5.0-341-devel")).toEqual({
      release_line: "5.0",
      stage: "develop",
    });
  });

  it("uses API options and filtered versions", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          combinations: [
            { release_line: "5.1", stage: "develop", build_type: "release" },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [record] });
    vi.stubGlobal("fetch", request);
    const result = await fetchFirmwareVersions(
      "https://example.test/version.json",
      "esp32",
    );
    expect(result[0].files.rom.url).toBe(record.url);
    expect(request.mock.calls[0][0]).toContain(
      "/api/v2/firmware/options?soc=esp32",
    );
    expect(request.mock.calls[1][0]).toContain("release_line=5.1");
    expect(request.mock.calls[1][0]).toContain("product=controller");
    expect(
      request.mock.calls.every(([url]) => !url.includes("version.json")),
    ).toBe(true);
  });

  it("falls back only to legacy API and rejects a different release line", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ ok: true, json: async () => [record] }),
    );
    expect(
      await fetchFirmwareVersions(
        "https://example.test/version.json",
        "esp32",
        { release_line: "5.0", stage: "develop", build_type: "release" },
      ),
    ).toEqual([]);
  });

  it("does not fall back on API failure", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", request);
    await expect(
      fetchFirmwareVersions("https://example.test/version.json", "esp32"),
    ).rejects.toThrow("HTTP 500");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects a stale selected artifact before flashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
    await expect(
      revalidateFirmware("https://example.test/version.json", {
        ...record,
        release_line: "5.1",
        stage: "develop",
        build_type: "release",
        files: { rom: { url: record.url } },
      }),
    ).rejects.toThrow("no longer available");
  });

  it("keeps same-line upgrades working without the new transition API", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await ensureFirmwareTransition(
      "https://example.test/version.json",
      { release_line: "5.0" },
      "V5.0-40-develop",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("allows cross-line upgrades without a bridge or transition API", async () => {
    const request = vi.fn().mockRejectedValue(new Error("Server unavailable"));
    vi.stubGlobal("fetch", request);
    await ensureFirmwareTransition(
      "https://example.test/version.json",
      { ...record, id: "2", release_line: "5.1" },
      "V5.0.0-1022-develop",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("compares release lines numerically for upgrades", async () => {
    await ensureFirmwareTransition(
      "https://example.test/version.json",
      { release_line: "5.10" },
      "V5.9.0-2-develop",
    );
  });

  it("keeps cross-line downgrades separate pending ConfigDB review", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(
      ensureFirmwareTransition(
        "https://example.test/version.json",
        { release_line: "5.0" },
        "V5.1.0-2-develop",
      ),
    ).rejects.toThrow("ConfigDB schema compatibility review");
    expect(request).not.toHaveBeenCalled();
  });

  it("ignores unrelated unknown records in an older API", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            record,
            { ...record, version: "unknown", branch: "feature/custom" },
          ],
        }),
    );
    expect(
      await fetchFirmwareVersions("https://example.test/version.json", "esp32"),
    ).toHaveLength(1);
  });

  it("rejects contradictory structured metadata instead of trusting version suffixes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { ...record, release_line: "5.0", stage: "develop" },
        ],
      }),
    );
    await expect(
      fetchFirmwareVersions("https://example.test/version.json", "esp32", {
        release_line: "5.1",
        stage: "develop",
        build_type: "release",
      }),
    ).rejects.toThrow("Inconsistent");
  });

  it("excludes a different product even when the SoC matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ ...record, product: "wallpanel" }],
      }),
    );
    expect(
      await fetchFirmwareVersions(
        "https://example.test/version.json",
        "esp32",
        { release_line: "5.1", stage: "develop", build_type: "release" },
      ),
    ).toEqual([]);
  });
});

describe("Update All channel policy", () => {
  const info = (version, soc = "esp32", build_type = "release") => ({
    device: { soc },
    app: { git_version: version, build_type },
  });
  const firmware = (version, branch, soc = "esp32", type = "release") => ({
    version,
    branch,
    soc,
    type,
    url: `https://example.test/${version}/${soc}/${type}/app.bin`,
    product: "controller",
  });

  it("keeps ESP32 on 5.0/testing when 5.1/testing is available", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        firmware("V5.1.5", "5.1/testing"),
        firmware("V5.0.4", "5.0/testing"),
        firmware("V5.0.9", "5.0/develop"),
        firmware("V5.0.8", "5.0/testing", "esp32", "debug"),
      ],
    });
    vi.stubGlobal("fetch", request);
    const result = await findAutomaticFirmwareUpdate(
      "https://example.test/version.json",
      info("V5.0.3-1-5.0-testing"),
    );
    expect(result.firmware.version).toBe("V5.0.4");
    const query = new URL(request.mock.calls[0][0]).searchParams;
    expect(Object.fromEntries(query)).toEqual({
      soc: "esp32",
      product: "controller",
      release_line: "5.0",
      stage: "testing",
      build_type: "release",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("skips rather than falling back when only a different minor line exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [firmware("V5.1.5", "5.1/testing")],
      }),
    );
    const result = await findAutomaticFirmwareUpdate(
      "https://example.test/version.json",
      info("V5.0.3-1-testing"),
    );
    expect(result.firmware).toBeNull();
    expect(result.reason).toContain("5.0/testing/release");
  });

  it("does not reinstall the same version or downgrade a newer controller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          firmware("V5.0.0-1016-develop", "develop"),
          firmware("V5.0.0-966-develop", "develop"),
        ],
      }),
    );
    expect(
      (
        await findAutomaticFirmwareUpdate(
          "https://example.test/version.json",
          info("V5.0.0-1016-develop"),
        )
      ).firmware,
    ).toBeNull();
    expect(
      (
        await findAutomaticFirmwareUpdate(
          "https://example.test/version.json",
          info("V5.0.0-1100-develop"),
        )
      ).firmware,
    ).toBeNull();
    expect(
      (
        await findAutomaticFirmwareUpdate(
          "https://example.test/version.json",
          info("V5.0.0-966-develop"),
        )
      ).firmware.version,
    ).toBe("V5.0.0-1016-develop");
  });

  it("keeps historical experimental controllers off the develop feed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          firmware("V5.0.0-1100-5.0-develop", "5.0/develop"),
          firmware("V5.0.0-1000-develop", "develop"),
          firmware("V5.0.0-950-experimental", "experimental"),
        ],
      }),
    );
    expect(
      (
        await findAutomaticFirmwareUpdate(
          "https://example.test/version.json",
          info("V5.0.0-900-experimental"),
        )
      ).firmware.version,
    ).toBe("V5.0.0-950-experimental");
  });

  it("rejects a stale automatic selection if the controller changes channel", () => {
    const candidate = {
      ...firmware("V5.0.4", "5.0/testing"),
      release_line: "5.0",
      stage: "testing",
    };
    expect(
      isAutomaticFirmwareCandidate(candidate, info("V5.0.3-1-testing")),
    ).toBe(true);
    expect(
      isAutomaticFirmwareCandidate(candidate, info("V5.1.0-1-testing")),
    ).toBe(false);
    expect(
      isAutomaticFirmwareCandidate(candidate, info("V5.0.3-1-develop")),
    ).toBe(false);
    expect(
      isAutomaticFirmwareCandidate(
        candidate,
        info("V5.0.3-1-testing", "esp32", "debug"),
      ),
    ).toBe(false);
    expect(
      isAutomaticFirmwareCandidate(candidate, info("V5.0.5-1-testing")),
    ).toBe(false);
  });

  it("resolves a mixed fleet independently and preserves debug builds", async () => {
    const request = vi.fn().mockImplementation(async (url) => {
      const query = new URL(url).searchParams;
      return {
        ok: true,
        json: async () => [
          firmware(
            query.get("release_line") === "5.0" ? "V5.0.4" : "V5.1.4",
            `${query.get("release_line")}/${query.get("stage")}`,
            query.get("soc"),
            query.get("build_type"),
          ),
        ],
      };
    });
    vi.stubGlobal("fetch", request);
    const results = await Promise.all(
      [
        info("V5.0.3-1-testing", "esp8266"),
        info("V5.0.3-1-testing", "esp32"),
        info("V5.1.3-1-testing", "esp32c3", "debug"),
      ].map((controller) =>
        findAutomaticFirmwareUpdate(
          "https://example.test/version.json",
          controller,
        ),
      ),
    );
    expect(
      results.map((result) => [
        result.firmware.soc,
        result.firmware.release_line,
        result.firmware.type,
      ]),
    ).toEqual([
      ["esp8266", "5.0", "release"],
      ["esp32", "5.0", "release"],
      ["esp32c3", "5.1", "debug"],
    ]);
  });

  it("skips unknown identities without querying or guessing a feed", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(
      (
        await findAutomaticFirmwareUpdate(
          "https://example.test/version.json",
          info("unknown"),
        )
      ).firmware,
    ).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
