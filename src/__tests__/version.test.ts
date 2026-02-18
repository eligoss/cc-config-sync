import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { version } from "../version.js";

describe("version", () => {
  it("matches package.json version", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    expect(version).toBe(packageJson.version);
  });

  it("is a valid semver string", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
