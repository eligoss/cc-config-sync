import { describe, it, expect, vi } from "vitest";
import { filterConfigFiles } from "../filter.js";
import type { ConfigFile } from "../types.js";

function makeFile(label: string): ConfigFile {
  return { label, localPath: `/local/${label}`, repoPath: `/repo/${label}` };
}

const files: ConfigFile[] = [
  makeFile("global/CLAUDE.md"),
  makeFile("global/settings.json"),
  makeFile("projects/app/CLAUDE.md"),
  makeFile("projects/app/.claude/settings.json"),
  makeFile("projects/other/CLAUDE.md"),
];

describe("filterConfigFiles", () => {
  it("returns all files when no filter is set", () => {
    expect(filterConfigFiles(files, {})).toEqual(files);
  });

  it("filters to global only", () => {
    const result = filterConfigFiles(files, { globalOnly: true });
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.label.startsWith("global/"))).toBe(true);
  });

  it("filters to a specific project", () => {
    const result = filterConfigFiles(files, { project: "app" });
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.label.startsWith("projects/app/"))).toBe(true);
  });

  it("exits when both project and globalOnly are set", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    expect(() =>
      filterConfigFiles(files, { project: "app", globalOnly: true })
    ).toThrow("process.exit");
    mockExit.mockRestore();
  });

  it("exits when project has no matching files", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    expect(() =>
      filterConfigFiles(files, { project: "nonexistent" })
    ).toThrow("process.exit");
    mockExit.mockRestore();
  });
});
