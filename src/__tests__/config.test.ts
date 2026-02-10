import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("config", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cc-config-"));
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  async function importConfig() {
    const mod = await import("../config.js");
    mod.setSyncRepoPath(tmp);
    return mod;
  }

  it("loadConfig returns empty machines when file is missing", async () => {
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config).toEqual({ machines: {} });
  });

  it("loadConfig parses valid JSON", async () => {
    const data = {
      machines: {
        "my-mac": {
          globalConfigPath: "/Users/me/.claude",
          projects: { app: "/Users/me/app" },
        },
      },
    };
    writeFileSync(join(tmp, "sync.config.json"), JSON.stringify(data));

    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config).toEqual(data);
  });

  it("saveConfig writes formatted JSON with trailing newline", async () => {
    const { saveConfig } = await importConfig();
    const data = {
      machines: {
        host: {
          globalConfigPath: "/home/user/.claude",
          projects: {},
        },
      },
    };
    saveConfig(data);

    const raw = readFileSync(join(tmp, "sync.config.json"), "utf-8");
    expect(raw).toBe(JSON.stringify(data, null, 2) + "\n");
  });
});
