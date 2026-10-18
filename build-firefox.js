/**
 * Build script for packaging the Firefox extension variant
 * Zero external dependencies (uses Node.js built-in fs and path)
 */

const fs = require("node:fs");
const path = require("node:path");

const rootDir = __dirname;
const outDir = path.join(rootDir, "dist-firefox");

console.log("Building Firefox extension package in:", outDir);

// Re-create output directory
if (fs.existsSync(outDir)) {
	fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Files and directories to copy
const filesToCopy = [
	"background.js",
	"content.js",
	"popup.html",
	"popup.js",
	"styles.css",
	"README.md"
];

// Copy manifest.firefox.json as manifest.json
fs.copyFileSync(
	path.join(rootDir, "manifest.firefox.json"),
	path.join(outDir, "manifest.json")
);
console.log("  ✔ Copied manifest.firefox.json -> manifest.json");

// Copy standard files
filesToCopy.forEach(file => {
	const src = path.join(rootDir, file);
	if (fs.existsSync(src)) {
		fs.copyFileSync(src, path.join(outDir, file));
		console.log(`  ✔ Copied ${file}`);
	}
});

// Copy icons directory
const srcIcons = path.join(rootDir, "icons");
const destIcons = path.join(outDir, "icons");
fs.mkdirSync(destIcons, { recursive: true });
fs.readdirSync(srcIcons).forEach(iconFile => {
	fs.copyFileSync(path.join(srcIcons, iconFile), path.join(destIcons, iconFile));
});
console.log("  ✔ Copied icons/");

console.log("\nFirefox build completed successfully!");
console.log("To test in Firefox: open about:debugging#/runtime/this-firefox and load 'dist-firefox/manifest.json'.");
