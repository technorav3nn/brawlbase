import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const stagedFiles = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], {
	encoding: "utf8",
})
	.split("\0")
	.filter(Boolean)
	.filter(existsSync);

if (stagedFiles.length === 0) throw new Error("No staged files found.");

const formatExtensions = new Set([".css", ".html", ".js", ".json", ".jsonc", ".md", ".scss", ".ts", ".vue", ".yaml", ".yml"]);
const lintExtensions = new Set([".js", ".mjs", ".ts", ".vue"]);
const extension = (file) => file.slice(file.lastIndexOf("."));
const formatFiles = stagedFiles.filter((file) => formatExtensions.has(extension(file)));
const lintFiles = stagedFiles.filter((file) => lintExtensions.has(extension(file)));

if (formatFiles.length > 0) {
	execFileSync("yarn", ["exec", "prettier", "--write", "--", ...formatFiles], { stdio: "inherit" });
	execFileSync("git", ["add", "--", ...formatFiles], { stdio: "inherit" });
}

if (lintFiles.length > 0) {
	execFileSync("yarn", ["exec", "eslint", "--", ...lintFiles], { stdio: "inherit" });
}
