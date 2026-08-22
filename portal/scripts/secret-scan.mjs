import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "portal", ".github"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean);
const signatures = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
];
const findings = [];

for (const file of files) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const content = readFileSync(path);
  if (content.includes(0)) continue;
  const text = content.toString("utf8");
  if (signatures.some((signature) => signature.test(text))) findings.push(file);
}

if (findings.length > 0) {
  process.stderr.write(`Potential secret material found in:\n${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Secret scan passed (${files.length} tracked files checked).\n`);
}
