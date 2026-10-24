import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const versionPath = path.join(publicDir, "version.json");
const packageJsonPath = path.join(rootDir, "package.json");

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const buildId = `${pkg.name || "app"}-${pkg.version || "0.0.0"}-${Date.now().toString(36)}`;
const builtAt = new Date().toISOString();

const payload = {
  buildId,
  builtAt,
};

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(versionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log("Generated version.json:");
console.log(JSON.stringify(payload, null, 2));