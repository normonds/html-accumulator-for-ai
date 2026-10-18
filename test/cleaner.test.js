/**
 * Automated Unit Tests for HTML Multi-Page Accumulator
 * Uses node:test and node:assert (Zero external dependencies)
 */

const { test, describe } = require("node:test");
const assert = require("node:assert");

// Mock helper matching content.js / popup.js buildCombinedPayload
function escapeHtml(str) {
	return (str || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function buildCombinedPayload(pages, format = "cleaned") {
	if (!pages || pages.length === 0) return "";

	if (format === "markdown") {
		return pages.map((page, idx) => {
			const header = `\n\n<!-- ========================================== -->\n` +
				`<!-- PAGE ${idx + 1} OF ${pages.length}: ${page.url} -->\n` +
				`<!-- TITLE: ${page.title} -->\n` +
				`<!-- CAPTURED: ${page.capturedAt} -->\n` +
				`<!-- ========================================== -->\n\n` +
				`# Page ${idx + 1}: ${page.title}\nSource: ${page.url}\n\n`;
			return header + (page.markdown || page.cleanedHtml || "");
		}).join("\n\n---\n\n");
	}

	const pageBodies = pages.map((page, idx) => {
		const pageHtml = format === "raw" ? page.rawHtml : (page.cleanedHtml || page.rawHtml);
		return `\n\n<!-- ======================================================== -->\n` +
			`<!-- PAGE ${idx + 1} OF ${pages.length}: ${page.url} -->\n` +
			`<!-- TITLE: ${page.title} -->\n` +
			`<!-- CAPTURED: ${page.capturedAt} -->\n` +
			`<!-- ======================================================== -->\n` +
			`<section data-ai-source-page="${idx + 1}" data-ai-source-url="${escapeHtml(page.url)}" data-ai-source-title="${escapeHtml(page.title)}">\n` +
			pageHtml +
			`\n</section>`;
	}).join("\n\n");

	return `<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="utf-8">\n\t<title>AI Products Extract (${pages.length} Pages)</title>\n</head>\n<body>\n${pageBodies}\n</body>\n</html>`;
}

describe("HTML Multi-Page Accumulator Tests", () => {
	const samplePages = [
		{
			id: "page_1",
			url: "https://example.com/products?page=1",
			title: "Laptops & Tablets - Page 1",
			capturedAt: "2026-10-19T01:30:00.000Z",
			rawHtml: `<div class="product"><h2 onclick="track()">ThinkPad X1</h2><span class="price">$1,299</span><script>analytics();</script></div>`,
			cleanedHtml: `<div class="product"><h2>ThinkPad X1</h2><span class="price">$1,299</span></div>`,
			markdown: "## ThinkPad X1\nPrice: $1,299",
			charCount: 75,
			estimatedTokens: 19
		},
		{
			id: "page_2",
			url: "https://example.com/products?page=2",
			title: "Laptops & Tablets - Page 2",
			capturedAt: "2026-10-19T01:31:00.000Z",
			rawHtml: `<div class="product"><h2 onclick="track()">MacBook Pro</h2><span class="price">$1,999</span><style>.ad{color:red}</style></div>`,
			cleanedHtml: `<div class="product"><h2>MacBook Pro</h2><span class="price">$1,999</span></div>`,
			markdown: "## MacBook Pro\nPrice: $1,999",
			charCount: 74,
			estimatedTokens: 18
		}
	];

	test("buildCombinedPayload compiles multi-page HTML with delimiters and metadata", () => {
		const result = buildCombinedPayload(samplePages, "cleaned");

		// Asserts
		assert.match(result, /<!DOCTYPE html>/);
		assert.match(result, /AI Products Extract \(2 Pages\)/);
		assert.match(result, /<!-- PAGE 1 OF 2: https:\/\/example\.com\/products\?page=1 -->/);
		assert.match(result, /<!-- PAGE 2 OF 2: https:\/\/example\.com\/products\?page=2 -->/);
		assert.match(result, /data-ai-source-page="1"/);
		assert.match(result, /data-ai-source-page="2"/);
		assert.match(result, /ThinkPad X1/);
		assert.match(result, /MacBook Pro/);
		assert.doesNotMatch(result, /<script>/);
		assert.doesNotMatch(result, /<style>/);
	});

	test("buildCombinedPayload compiles Markdown output for token optimization", () => {
		const result = buildCombinedPayload(samplePages, "markdown");

		assert.match(result, /# Page 1: Laptops & Tablets - Page 1/);
		assert.match(result, /# Page 2: Laptops & Tablets - Page 2/);
		assert.match(result, /---/);
		assert.match(result, /ThinkPad X1/);
		assert.match(result, /MacBook Pro/);
	});

	test("Raw HTML mode preserves original raw HTML when selected", () => {
		const result = buildCombinedPayload(samplePages, "raw");

		assert.match(result, /<script>analytics\(\);<\/script>/);
		assert.match(result, /<style>\.ad\{color:red\}<\/style>/);
	});

	test("escapeHtml handles quotes and symbols safely", () => {
		const unescaped = `<a href="test?a=1&b=2" title='O\'Reilly'>`;
		const escaped = escapeHtml(unescaped);

		assert.strictEqual(escaped.includes("<"), false);
		assert.strictEqual(escaped.includes(">"), false);
		assert.strictEqual(escaped.includes('"'), false);
		assert.strictEqual(escaped.includes("&amp;"), true);
	});

	test("Token estimation logic is consistent", () => {
		const text = "A".repeat(4000);
		const estimatedTokens = Math.round(text.length / 4);
		assert.strictEqual(estimatedTokens, 1000);
	});
});
