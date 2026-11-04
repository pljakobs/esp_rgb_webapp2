import semver from "semver";

function normalizedVersion(value = "") {
  const clean = value.replace(/^[Vv]/, "");
  const legacy = /^(\d+)\.(\d+)(?:\.(\d+))?-(\d+)(?:-.*)?$/.exec(clean);
  if (legacy) return `${legacy[1]}.${legacy[2]}.${legacy[3] || 0}-${legacy[4]}`;
  return semver.valid(clean);
}

export function compareFirmwareVersions(left, right) {
  const first = normalizedVersion(left);
  const second = normalizedVersion(right);
  return first && second ? semver.compare(first, second) : 0;
}

export function firmwareApiBaseUrl(configuredUrl) {
  const url = new URL(configuredUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Firmware server must use HTTP or HTTPS");
  }
  const apiIndex = url.pathname.indexOf("/api/");
  url.pathname = apiIndex >= 0
    ? url.pathname.slice(0, apiIndex + 4)
    : `${url.pathname.slice(0, url.pathname.lastIndexOf("/"))}/api`;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function firmwareIdentity(version = "", branch = "") {
  if (typeof version !== "string" || typeof branch !== "string") {
    return { release_line: null, stage: null };
  }
  const match = /^[Vv]?(\d+)\.(\d+)(?:\.|-|$)/.exec(version);
  const release_line = match ? `${Number(match[1])}.${Number(match[2])}` : null;
  const suffix = (branch || version.replace(/^[Vv]?\d+\.\d+(?:\.\d+)?-\d+-/, "")).trim().toLowerCase();
  const qualified = /^(\d+\.\d+)[/-](develop|devel|testing|test|stable|prod|experimental)$/.exec(suffix);
  const stages = { develop: "develop", devel: "develop", experimental: "develop", test: "testing", testing: "testing", stable: "prod", prod: "prod" };
  const stage = stages[qualified ? qualified[2] : suffix] || null;
  if (qualified && qualified[1] !== release_line) {
    return { release_line: null, stage: null };
  }
  return { release_line, stage };
}

function normalizeFirmware(entry, baseUrl) {
  const version = entry.version || entry.fw_version;
  const identity = firmwareIdentity(version, entry.branch);
  const release_line = entry.release_line || identity.release_line;
  const stage = entry.stage || identity.stage;
  const type = entry.build_type || entry.type;
  if (entry.product && entry.product !== "controller") throw new Error("Firmware belongs to a different product");
  if (release_line !== identity.release_line || (identity.stage && stage !== identity.stage) ||
    (entry.type && entry.build_type && entry.type !== entry.build_type)) {
    throw new Error("Inconsistent firmware API identity");
  }
  const artifactUrl = entry.url || entry.files?.rom?.url;
  if (!artifactUrl) throw new Error("Firmware API record has no binary URL");
  const romUrl = new URL(artifactUrl, `${baseUrl}/`).toString();
  if (!version || !release_line || !stage || !["debug", "release"].includes(type) || !/^https?:/.test(romUrl)) {
    throw new Error("Invalid firmware API record");
  }
  return {
    ...entry,
    product: "controller",
    release_line,
    stage,
    type,
    build_type: type,
    version,
    fw_version: version,
    id: String(entry.id ?? `${entry.soc}/${release_line}/${stage}/${type}/${version}`),
    files: { rom: { url: romUrl } },
  };
}

export async function fetchFirmwareVersions(configuredUrl, soc, selection = null) {
  if (!soc) throw new Error("Controller SoC is unknown");
  const baseUrl = firmwareApiBaseUrl(configuredUrl);
  const parameters = new URLSearchParams({ soc: soc.toLowerCase(), product: "controller" });
  let endpoint;
  if (selection) {
    for (const key of ["release_line", "stage", "build_type"]) {
      if (!selection[key]) throw new Error(`Missing firmware selection: ${key}`);
      parameters.set(key, selection[key]);
    }
    endpoint = `${baseUrl}/v2/firmware/versions?${parameters}`;
  } else {
    endpoint = `${baseUrl}/v2/firmware/options?${parameters}`;
  }
  let response = await fetch(endpoint);
  let records;
  let legacyResponse = false;
  if ([404, 405].includes(response.status)) {
    legacyResponse = true;
    response = await fetch(`${baseUrl}/firmware/versions?${new URLSearchParams({ soc: soc.toLowerCase() })}`);
    if (!response.ok) throw new Error(`Firmware API error: HTTP ${response.status}`);
    records = await response.json();
  } else {
    if (!response.ok) throw new Error(`Firmware API error: HTTP ${response.status}`);
    const data = await response.json();
    if (selection) {
      records = data;
    } else {
      if (!Array.isArray(data.combinations) || (data.product && data.product !== "controller")) throw new Error("Invalid firmware options response");
      if (data.combinations.some((entry) => !entry || !/^\d+\.\d+$/.test(entry.release_line) ||
        !["develop", "testing", "prod"].includes(entry.stage) || !["debug", "release"].includes(entry.build_type))) {
        throw new Error("Invalid firmware option combination");
      }
      const groups = await Promise.all(data.combinations.map((combination) =>
        fetchFirmwareVersions(configuredUrl, soc, combination),
      ));
      return groups.flat().sort((left, right) => compareFirmwareVersions(right.version, left.version));
    }
  }
  if (!Array.isArray(records)) throw new Error("Invalid firmware versions response");
  return records
    .filter((entry) => entry && typeof entry.soc === "string" && entry.soc.toLowerCase() === soc.toLowerCase())
    .filter((entry) => !entry.product || entry.product === "controller")
    .filter((entry) => !legacyResponse || firmwareIdentity(entry.version || entry.fw_version, entry.branch).stage)
    .map((entry) => normalizeFirmware(entry, baseUrl))
    .filter((entry) => (soc.toLowerCase() !== "esp8266" || entry.release_line === "5.0") &&
      (!selection || (entry.release_line === selection.release_line && entry.stage === selection.stage && entry.type === selection.build_type)))
    .sort((left, right) => compareFirmwareVersions(right.version, left.version));
}

export async function revalidateFirmware(configuredUrl, candidate) {
  const records = await fetchFirmwareVersions(configuredUrl, candidate.soc, candidate);
  const current = records.find((entry) => entry.id === candidate.id && entry.version === candidate.version);
  if (!current || current.files.rom.url !== candidate.files.rom.url || current.sha256 !== candidate.sha256 ||
    current.size !== candidate.size || current.branch !== candidate.branch ||
    (candidate.product && candidate.product !== "controller")) {
    throw new Error("Selected firmware has changed or is no longer available");
  }
  return current;
}

export function isAutomaticFirmwareCandidate(candidate, controllerInfo) {
  const app = controllerInfo?.app || {};
  const installedVersion = app.git_version || controllerInfo?.git_version || "";
  const identity = firmwareIdentity(installedVersion);
  const soc = controllerInfo?.device?.soc?.toLowerCase();
  const buildType = app.build_type?.toLowerCase();
  if (!identity.release_line || !identity.stage || !normalizedVersion(installedVersion) ||
    candidate.product !== "controller" || candidate.soc?.toLowerCase() !== soc ||
    candidate.release_line !== identity.release_line || candidate.stage !== identity.stage ||
    candidate.type !== buildType || compareFirmwareVersions(candidate.version, installedVersion) <= 0 ||
    (app.release_line && app.release_line !== identity.release_line) ||
    (app.stage && app.stage !== identity.stage)) return false;
  const branches = { develop: "develop", devel: "develop", experimental: "experimental",
    test: "testing", testing: "testing", stable: "prod", prod: "prod" };
  const branchName = (value) => branches[value.replace(/^\d+\.\d+[/-]/, "").toLowerCase()] || null;
  const suffix = installedVersion.replace(/^[Vv]?\d+\.\d+(?:\.\d+)?-\d+-/, "");
  return (branchName(suffix) || identity.stage) ===
    (branchName(candidate.branch || "") || candidate.stage);
}

export async function findAutomaticFirmwareUpdate(configuredUrl, controllerInfo) {
  const app = controllerInfo?.app || {};
  const installedVersion = app.git_version || controllerInfo?.git_version || "";
  const soc = controllerInfo?.device?.soc?.toLowerCase();
  const build_type = app.build_type?.toLowerCase();
  const identity = firmwareIdentity(installedVersion);
  if (!soc || !["debug", "release"].includes(build_type) || !identity.release_line || !identity.stage ||
    !normalizedVersion(installedVersion)) {
    return { firmware: null, reason: "Installed firmware identity is unknown; automatic update skipped" };
  }
  const target = { ...identity, build_type };
  if ((app.release_line && app.release_line !== target.release_line) ||
    (app.stage && app.stage !== target.stage)) {
    return { firmware: null, reason: "Installed firmware metadata disagrees; automatic update skipped" };
  }
  const records = await fetchFirmwareVersions(configuredUrl, soc, target);
  const firmware = records.find((entry) => isAutomaticFirmwareCandidate(entry, controllerInfo));
  return { firmware: firmware || null, target,
    reason: firmware ? "" : `No newer firmware in ${soc}/${target.release_line}/${target.stage}/${build_type}; automatic update skipped` };
}

export async function ensureFirmwareTransition(configuredUrl, candidate, installedVersion, installedWebappVersion = "") {
  const installed = firmwareIdentity(installedVersion);
  if (!installed.release_line) throw new Error("Installed firmware identity is unknown; cannot safely select an upgrade path");
  if (installed.release_line === candidate.release_line) return;
  const query = new URLSearchParams({ soc: candidate.soc, installed_version: installedVersion,
    target_id: candidate.id, installed_webapp_version: installedWebappVersion, product: "controller" });
  const response = await fetch(`${firmwareApiBaseUrl(configuredUrl)}/v2/firmware/transition?${query}`);
  if (!response.ok) {
    throw new Error("Cross-line updates require the version-aware server and a verified bridge webapp; same-line updates remain available");
  }
  const transition = await response.json();
  if (transition.status !== "ready") throw new Error(transition.reason || "A verified bridge webapp is required before changing firmware line");
}