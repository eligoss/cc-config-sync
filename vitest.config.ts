import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/**", // exclude stale worktrees inside .claude/
    ],
  },
});
