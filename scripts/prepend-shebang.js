import { readFileSync, writeFileSync, chmodSync } from "node:fs";

const file = "dist/cli.js";
writeFileSync(file, "#!/usr/bin/env node\n" + readFileSync(file, "utf8"));
chmodSync(file, 0o755);
