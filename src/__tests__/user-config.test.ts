import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We redirect the config path by mocking node:os homedir
let fakeHome: string;

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => fakeHome,
    hostname: () => "test-machine",
  };
});

describe("user-config", () => {
  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), "cc-home-"));
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("getUserConfigRepo_noFile_returnsNull", async () => {
    const { getUserConfigRepo } = await import("../user-config.js");
    expect(getUserConfigRepo()).toBeNull();
  });

  it("getUserConfigRepo_validFile_returnsRepo", async () => {
    writeFileSync(
      join(fakeHome, ".cc-config-sync.json"),
      JSON.stringify({ repo: "/some/path" }) + "\n",
    );
    const { getUserConfigRepo } = await import("../user-config.js");
    expect(getUserConfigRepo()).toBe("/some/path");
  });

  it("getUserConfigRepo_malformedJson_returnsNull", async () => {
    writeFileSync(join(fakeHome, ".cc-config-sync.json"), "not-json");
    const { getUserConfigRepo } = await import("../user-config.js");
    expect(getUserConfigRepo()).toBeNull();
  });

  it("getUserConfigRepo_missingRepoKey_returnsNull", async () => {
    writeFileSync(
      join(fakeHome, ".cc-config-sync.json"),
      JSON.stringify({ other: "value" }) + "\n",
    );
    const { getUserConfigRepo } = await import("../user-config.js");
    expect(getUserConfigRepo()).toBeNull();
  });

  it("setUserConfigRepo_newFile_createsFile", async () => {
    const { setUserConfigRepo, USER_CONFIG_PATH } = await import("../user-config.js");
    setUserConfigRepo("/my/repo");
    expect(existsSync(USER_CONFIG_PATH)).toBe(true);
    const content = JSON.parse(readFileSync(USER_CONFIG_PATH, "utf-8")) as { repo: string };
    expect(content.repo).toBe("/my/repo");
  });

  it("setUserConfigRepo_existingFile_updatesRepoPreservingOtherKeys", async () => {
    const configPath = join(fakeHome, ".cc-config-sync.json");
    writeFileSync(configPath, JSON.stringify({ repo: "/old", extra: "keep" }) + "\n");
    const { setUserConfigRepo } = await import("../user-config.js");
    setUserConfigRepo("/new/repo");
    const content = JSON.parse(readFileSync(configPath, "utf-8")) as {
      repo: string;
      extra: string;
    };
    expect(content.repo).toBe("/new/repo");
    expect(content.extra).toBe("keep");
  });

  it("setUserConfigRepo_malformedExistingFile_overwritesSafely", async () => {
    const configPath = join(fakeHome, ".cc-config-sync.json");
    writeFileSync(configPath, "not-valid-json");
    const { setUserConfigRepo } = await import("../user-config.js");
    // Should not throw — falls back to {} and writes the new repo path
    setUserConfigRepo("/new/repo");
    const content = JSON.parse(readFileSync(configPath, "utf-8")) as { repo: string };
    expect(content.repo).toBe("/new/repo");
  });
});
