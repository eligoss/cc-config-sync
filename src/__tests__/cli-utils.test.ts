import { describe, it, expect, afterEach } from "vitest";

describe("isNonInteractive", () => {
  const originalCI = process.env.CI;

  afterEach(() => {
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
  });

  it("returns false when flag is false and CI is not set", async () => {
    delete process.env.CI;
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({ nonInteractive: false })).toBe(false);
  });

  it("returns false when options is empty and CI is not set", async () => {
    delete process.env.CI;
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({})).toBe(false);
  });

  it("returns true when flag is true", async () => {
    delete process.env.CI;
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({ nonInteractive: true })).toBe(true);
  });

  it("returns true when CI=true", async () => {
    process.env.CI = "true";
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({})).toBe(true);
  });

  it("returns true when CI=1", async () => {
    process.env.CI = "1";
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({})).toBe(true);
  });

  it("returns true when both flag and CI are set", async () => {
    process.env.CI = "true";
    const { isNonInteractive } = await import("../cli-utils.js");
    expect(isNonInteractive({ nonInteractive: true })).toBe(true);
  });
});
