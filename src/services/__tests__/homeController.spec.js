import { describe, expect, it } from "vitest";
import { homeControllerFromLocation } from "../homeController";

describe("home controller URL parameter", () => {
  it("accepts an IPv4 address or hostname", () => {
    expect(homeControllerFromLocation({ search: "?home=192.168.1.15" })).toBe("192.168.1.15");
    expect(homeControllerFromLocation({ search: "?home=lamp.local" })).toBe("lamp.local");
    expect(homeControllerFromLocation({ search: "" })).toBeNull();
  });

  it.each(["", "http://lamp.local", "lamp.local:80", "lamp.local/path", "user@lamp.local", "256.0.0.1", "127.1", "a..b"])(
    "rejects an invalid address (%s) instead of falling back",
    (value) => {
      expect(() => homeControllerFromLocation({ search: `?home=${encodeURIComponent(value)}` })).toThrow("Invalid home controller address");
    },
  );
});
