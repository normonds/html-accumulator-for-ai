/**
 * HTML Multi-Page Accumulator for AI
 * content.js - Rendered DOM Extraction, Cleaning, Formatting, HUD & Export
 */

(function () {
	// Prevent duplicate initialization
	if (window.__AI_HTML_ACCUMULATOR_LOADED__) return;
	window.__AI_HTML_ACCUMULATOR_LOADED__ = true;

	const extAPI = typeof browser !== "undefined" ? browser : chrome;

	/**
	 * Cleans a cloned DOM element to optimize token usage for LLMs.
	 * Removes scripts, styles, SVGs, base64 blobs, inline styles, and tracking attributes.
	 */
	function cleanDomForAI(rootElement, options = {}) {
		const clone = rootElement.cloneNode(true);

		// 1. Remove non-content and media-heavy elements
		const tagsToRemove = [
			"script", "style", "noscript", "template",
			"svg", "canvas", "iframe", "object", "embed",
			"audio", "video", "link", "meta"
		];
		tagsToRemove.forEach(tag => {
			const elements = clone.querySelectorAll(tag);
			elements.forEach(el => el.remove());
		});

		// 2. Remove hidden elements
		const hiddenElements = clone.querySelectorAll("[hidden], [aria-hidden='true'], [style*='display: none'], [style*='display:none']");
		hiddenElements.forEach(el => el.remove());

		// 3. Remove our own HUD if present in clone
		const hud = clone.querySelector("#ai-html-accumulator-hud");
		if (hud) hud.remove();

		// 4. Clean attributes across all elements
		const allNodes = clone.querySelectorAll("*");
		const allowedAttrs = new Set([
			"href", "src", "alt", "title", "class", "id",
			"role", "type", "name", "value", "placeholder"
		]);
		const preservedDataAttrPrefixes = [
			"data-asin", "data-sku", "data-product", "data-id",
			"data-price", "data-item", "data-name", "data-brand"
		];

		allNodes.forEach(el => {
			const attrs = Array.from(el.attributes);
			attrs.forEach(attr => {
				const attrName = attr.name.toLowerCase();

				// Strip all inline event handlers (onclick, onload, etc.)
				if (attrName.startsWith("on")) {
					el.removeAttribute(attr.name);
					return;
				}

				// Strip inline styles to save tokens
				if (attrName === "style") {
					el.removeAttribute(attr.name);
					return;
				}

				// Strip base64 image data URLs to save tokens
				if (attrName === "src" && attr.value.startsWith("data:")) {
					el.setAttribute("src", "[inline-image-stripped]");
					return;
				}

				// Check data- attributes: keep high-value product attributes, strip noisy tracking ones
				if (attrName.startsWith("data-")) {
					const isPreserved = preservedDataAttrPrefixes.some(prefix => attrName.startsWith(prefix));
					if (!isPreserved) {
						el.removeAttribute(attr.name);
					}
					return;
				}

				// Strip attributes not in allowlist
				if (!allowedAttrs.has(attrName)) {
					el.removeAttribute(attr.name);
				}
			});
		});

		// 5. Remove HTML comment nodes
		const removeComments = (node) => {
			for (let i = node.childNodes.length - 1; i >= 0; i--) {
				const child = node.childNodes[i];
				if (child.nodeType === Node.COMMENT_NODE) {
					node.removeChild(child);
				} else if (child.nodeType === Node.ELEMENT_NODE) {
					removeComments(child);
				}
			}
		};
		removeComments(clone);

		return clone;
	}

	/**
	 * Converts an element's text/DOM into compact Markdown.
	 */
	function domToMarkdown(element) {
		let md = "";
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
		let currentNode = walker.currentNode;

		// Simple semantic Markdown converter for common layout tags
		function processNode(node) {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent.replace(/\s+/g, " ");
				return text.trim() ? text : " ";
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return "";

			const tag = node.tagName.toLowerCase();
			let inner = "";
			for (const child of node.childNodes) {
				inner += processNode(child);
			}
			inner = inner.trim();
			if (!inner && !["img", "hr", "br"].includes(tag)) return "";

			switch (tag) {
				case "h1": return `\n\n# ${inner}\n\n`;
				case "h2": return `\n\n## ${inner}\n\n`;
				case "h3": return `\n\n### ${inner}\n\n`;
				case "h4": return `\n\n#### ${inner}\n\n`;
				case "h5":
				case "h6": return `\n\n##### ${inner}\n\n`;
				case "p": return `\n\n${inner}\n\n`;
				case "li": return `\n- ${inner}`;
				case "ul":
				case "ol": return `\n${inner}\n`;
				case "strong":
				case "b": return `**${inner}**`;
				case "em":
				case "i": return `*${inner}*`;
				case "a": {
					const href = node.getAttribute("href") || "";
					return href ? `[${inner}](${href})` : inner;
				}
				case "img": {
					const alt = node.getAttribute("alt") || "Image";
					const src = node.getAttribute("src") || "";
					return `![${alt}](${src})`;
				}
				case "table": return `\n\n${inner}\n\n`;
				case "tr": return `\n| ${inner} |`;
				case "th":
				case "td": return ` ${inner} |`;
				case "div":
				case "section":
				case "article": return `\n${inner}\n`;
				default: return inner ? ` ${inner} ` : "";
			}
		}

		return processNode(element).replace(/\n{3,}/g, "\n\n").trim();
	}

	/**
	 * Generates combined payload based on desired format.
	 */
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
				return header + page.markdown;
			}).join("\n\n---\n\n");
		}

		// HTML format
		const pageBodies = pages.map((page, idx) => {
			const pageHtml = format === "raw" ? page.rawHtml : page.cleanedHtml;
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

	function escapeHtml(str) {
		return (str || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	/**
	 * Downloads text content as a file using an in-memory virtual Blob URL.
	 */
	function downloadTextFile(filename, content, mimeType = "text/html;charset=utf-8") {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 2000);
	}

	/**
	 * Copies text to system clipboard.
	 */
	async function copyToClipboard(text) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (err) {
			console.error("Clipboard write error:", err);
			// Fallback using textarea
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			const success = document.execCommand("copy");
			document.body.removeChild(textarea);
			return success;
		}
	}

	/**
	 * Injects or updates the floating HUD toast.
	 */
	function showHudToast(pageNumber, totalPages, totalChars, approxTokens, pages, activeFormat) {
		let hud = document.getElementById("ai-html-accumulator-hud");
		if (!hud) {
			hud = document.createElement("div");
			hud.id = "ai-html-accumulator-hud";
			document.body.appendChild(hud);
		}

		const sizeKb = (totalChars / 1024).toFixed(1);
		const domain = window.location.hostname.replace(/^www\./, "");
		const filenameBase = `${domain}_products_pages_1-${totalPages}`;

		hud.innerHTML = `
			<div class="ai-hud-card">
				<div class="ai-hud-header">
					<div class="ai-hud-title">
						<span class="ai-hud-badge">${totalPages}</span>
						<span>Page ${pageNumber} Captured!</span>
					</div>
					<button class="ai-hud-close" id="ai-hud-btn-close">&times;</button>
				</div>
				<div class="ai-hud-body">
					<div class="ai-hud-stats">
						<span><strong>${totalPages}</strong> page${totalPages > 1 ? "s" : ""}</span> &bull;
						<span><strong>${sizeKb}</strong> KB</span> &bull;
						<span>~<strong>${approxTokens.toLocaleString()}</strong> tokens</span>
					</div>
					<div class="ai-hud-actions">
						<button class="ai-hud-btn ai-hud-btn-primary" id="ai-hud-btn-save-html" title="Save as HTML file for AI upload">
							💾 Save .html
						</button>
						<button class="ai-hud-btn" id="ai-hud-btn-save-md" title="Save as clean Markdown file">
							📝 Save .md
						</button>
						<button class="ai-hud-btn" id="ai-hud-btn-copy" title="Copy combined payload to clipboard">
							📋 Copy
						</button>
						<button class="ai-hud-btn ai-hud-btn-danger" id="ai-hud-btn-clear" title="Clear buffer">
							🗑️
						</button>
					</div>
				</div>
			</div>
		`;

		// Event listeners for HUD buttons
		hud.querySelector("#ai-hud-btn-close").onclick = () => hud.remove();

		hud.querySelector("#ai-hud-btn-save-html").onclick = () => {
			const payload = buildCombinedPayload(pages, "cleaned");
			downloadTextFile(`${filenameBase}.html`, payload, "text/html;charset=utf-8");
			showNotification("File downloaded!");
		};

		hud.querySelector("#ai-hud-btn-save-md").onclick = () => {
			const payload = buildCombinedPayload(pages, "markdown");
			downloadTextFile(`${filenameBase}.md`, payload, "text/markdown;charset=utf-8");
			showNotification("Markdown downloaded!");
		};

		hud.querySelector("#ai-hud-btn-copy").onclick = async () => {
			const payload = buildCombinedPayload(pages, activeFormat || "cleaned");
			const success = await copyToClipboard(payload);
			if (success) {
				showNotification("Copied to clipboard!");
			} else {
				showNotification("Copy failed!", true);
			}
		};

		hud.querySelector("#ai-hud-btn-clear").onclick = async () => {
			const storage = extAPI.storage.local;
			await storage.remove("ai_html_accumulator_data");
			await extAPI.runtime.sendMessage({ action: "updateBadge", count: 0 });
			hud.remove();
		};

		// Auto dismiss timer (hover resets timer)
		let dismissTimer = setTimeout(() => {
			if (hud && hud.parentElement) hud.remove();
		}, 7000);

		hud.onmouseenter = () => clearTimeout(dismissTimer);
		hud.onmouseleave = () => {
			dismissTimer = setTimeout(() => {
				if (hud && hud.parentElement) hud.remove();
			}, 4000);
		};
	}

	function showNotification(text, isError = false) {
		const toast = document.createElement("div");
		toast.className = `ai-hud-mini-toast ${isError ? "ai-hud-error" : ""}`;
		toast.textContent = text;
		document.body.appendChild(toast);
		setTimeout(() => toast.remove(), 2500);
	}

	/**
	 * Main capture function executed when action is clicked or message received.
	 */
	async function captureCurrentPage() {
		try {
			const storage = extAPI.storage.local;
			const data = await storage.get(["ai_html_accumulator_data"]);
			let state = data.ai_html_accumulator_data || { pages: [], settings: { format: "cleaned", autoClipboard: true } };

			// Extract Rendered Body
			const rawHtml = document.body.innerHTML;
			const cleanedDom = cleanDomForAI(document.body);
			const cleanedHtml = cleanedDom.innerHTML;
			const markdown = domToMarkdown(cleanedDom);

			const newPage = {
				id: "page_" + Date.now(),
				url: window.location.href,
				title: document.title || "Untitled Page",
				capturedAt: new Date().toISOString(),
				rawHtml: rawHtml,
				cleanedHtml: cleanedHtml,
				markdown: markdown,
				charCount: cleanedHtml.length,
				estimatedTokens: Math.round(cleanedHtml.length / 4)
			};

			state.pages.push(newPage);
			await storage.set({ ai_html_accumulator_data: state });

			const totalPages = state.pages.length;
			const activeFormat = state.settings?.format || "cleaned";
			const combinedPayload = buildCombinedPayload(state.pages, activeFormat);
			const totalChars = combinedPayload.length;
			const totalTokens = Math.round(totalChars / 4);

			// Automatically update clipboard if enabled
			if (state.settings?.autoClipboard !== false) {
				await copyToClipboard(combinedPayload);
			}

			// Notify background to update badge
			await extAPI.runtime.sendMessage({ action: "updateBadge", count: totalPages });

			// Show floating toast
			showHudToast(totalPages, totalPages, totalChars, totalTokens, state.pages, activeFormat);

			return { success: true, count: totalPages };
		} catch (err) {
			console.error("Failed to capture page:", err);
			showNotification("Capture failed: " + err.message, true);
			return { success: false, error: err.message };
		}
	}

	// Listen for messages from background script or popup
	extAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === "capture") {
			captureCurrentPage().then(sendResponse);
			return true;
		}
		if (request.action === "downloadFile") {
			downloadTextFile(request.filename, request.content, request.mimeType);
			sendResponse({ success: true });
			return true;
		}
		if (request.action === "copyPayload") {
			copyToClipboard(request.content).then(success => sendResponse({ success }));
			return true;
		}
	});

	// In-page keyboard shortcut listener (Alt+C or Alt+Shift+C)
	window.addEventListener("keydown", (e) => {
		// Ignore if user is actively typing in an input, textarea, or contenteditable
		const activeEl = document.activeElement;
		const tag = activeEl ? activeEl.tagName.toLowerCase() : "";
		const isEditable = activeEl && (activeEl.isContentEditable || ["input", "textarea", "select"].includes(tag));
		if (isEditable) return;

		const isKeyC = e.code === "KeyC" || e.key === "c" || e.key === "C";
		const isAltC = e.altKey && !e.ctrlKey && !e.metaKey && isKeyC;
		const isAltShiftC = e.altKey && e.shiftKey && isKeyC;

		if (isAltC || isAltShiftC) {
			e.preventDefault();
			captureCurrentPage();
		}
	}, true);

	// Expose globally for testing/debugging
	window.__AI_HTML_ACCUMULATOR__ = {
		cleanDomForAI,
		domToMarkdown,
		buildCombinedPayload,
		captureCurrentPage
	};
})();
