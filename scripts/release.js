// Usage: npm run release -- 1.2.0
// Bumps the web + desktop versions, commits "v1.2.0" and tags it. Push with:
//   git push --follow-tags
// The Release workflow then builds installers and publishes the GitHub release.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const version = (process.argv[2] || "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    console.error("Give a semver version, e.g. npm run release -- 1.2.0");
    process.exit(1);
}
const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (execSync("git status --porcelain").toString().trim()) {
    console.error("Working tree has uncommitted changes. Commit or stash them first.");
    process.exit(1);
}
for (const file of ["package.json", "desktop/package.json"]) {
    const p = path.join(__dirname, "..", file);
    const json = JSON.parse(fs.readFileSync(p, "utf8"));
    json.version = version;
    fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
}
run("git add package.json desktop/package.json");
run(`git commit -m "v${version}"`);
run(`git tag -a v${version} -m "v${version}"`);
console.log(`\nTagged v${version}. Publish it with:\n  git push --follow-tags`);
