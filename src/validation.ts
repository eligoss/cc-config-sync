/** Validate a project name: must be non-empty and must not contain path traversal chars. */
export function isValidProjectName(name: string): boolean {
  if (!name || !name.trim()) return false;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return false;
  return true;
}
