import { describe, it, expect, vi, beforeEach } from "vitest";

describe("machine", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("getMachineName", () => {
    it("returns a non-empty string", async () => {
      const { getMachineName } = await import("../machine.js");
      const name = getMachineName();
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe("getCurrentMachineConfig", () => {
    it("returns null when machine is not registered", async () => {
      vi.doMock("../config.js", () => ({
        loadConfig: () => ({ machines: {} }),
        getConfigsDir: () => "/fake",
        setSyncRepoPath: () => {},
        getSyncRepoPath: () => "/fake",
        getConfigFile: () => "/fake/sync.config.json",
      }));

      const { getCurrentMachineConfig } = await import("../machine.js");
      expect(getCurrentMachineConfig()).toBeNull();
    });

    it("returns config when machine is registered", async () => {
      const { hostname } = await import("node:os");
      const host = hostname();

      vi.doMock("../config.js", () => ({
        loadConfig: () => ({
          machines: {
            [host]: {
              globalConfigPath: "/Users/me/.claude",
              projects: { app: "/Users/me/app" },
            },
          },
        }),
        getConfigsDir: () => "/fake",
        setSyncRepoPath: () => {},
        getSyncRepoPath: () => "/fake",
        getConfigFile: () => "/fake/sync.config.json",
      }));

      const { getCurrentMachineConfig } = await import("../machine.js");
      const result = getCurrentMachineConfig();

      expect(result).not.toBeNull();
      expect(result!.name).toBe(host);
      expect(result!.config.globalConfigPath).toBe("/Users/me/.claude");
      expect(result!.config.projects).toEqual({ app: "/Users/me/app" });
    });
  });
});
