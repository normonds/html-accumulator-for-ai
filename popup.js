/**
 * HTML Multi-Page Accumulator for AI
 * popup.js - Controller for extension popup dashboard
 */

const extAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", async () => {
	const storage = extAPI.storage.local;

	// UI Elements
	const btnCapture = document.getElementById("btn-capture");
	const btnDownload = document.getElementById("btn-download");
	const btnCopy = document.getElementById("btn-copy");
	const btnClear = document.getElementById("btn-clear");
	const badgePageCount = document.getElementById("badge-page-count");
	const statPages = document.getElementById("stat-pages");
	const statSize = document.getElementById("stat-size");
	const statTokens = document.getElementById("stat-tokens");
	const formatButtons = document.querySelectorAll(".btn-format");
	const chkAutoClipboard = document.getElementById("chk-auto-clipboard");
	const pagesList = document.getElementById("pages-list");
	const pagesListCount = document.getElementById("pages-list-count");
	const togglePagesList = document.getElementById("toggle-pages-list");
	const pagesArrow = document.getElementById("pages-arrow");

	let currentState = {
		pages: [],
		settings: {
			format: "cleaned",
			autoClipboard: true
		}
	};

	// Load stored state
	async function loadState() {
		try {
			const data = await storage.get(["ai_html_accumulator_data"]);
			if (data && data.ai_html_accumulator_data) {
				currentState = data.ai_html_accumulator_data;
				if (!currentState.settings) {
					currentState.settings = { format: "cleaned", autoClipboard: true };
				}
			}
			renderUI();
		} catch (err) {
			console.error("Error loading state:", err);
		}
	}

	// Save state
	async function saveState() {
		try {
			await storage.set({ ai_html_accumulator_data: currentState });
			const count = currentState.pages.length;
			await extAPI.runtime.sendMessage({ action: "updateBadge", count });
		} catch (err) {
			console.error("Error saving state:", err);
		}
	}

	// Render UI components
	function renderUI() {
		const pages = currentState.pages || [];
		const count = pages.length;
		const format = currentState.settings?.format || "cleaned";

		// Update format buttons active state
		formatButtons.forEach(btn => {
			if (btn.getAttribute("data-format") === format) {
				btn.classList.add("active");
			} else {
				btn.classList.remove("active");
			}
		});
		chkAutoClipboard.checked = currentState.settings?.autoClipboard !== false;

		// Calculate combined size
		const combinedPayload = buildPayload(pages, format);
		const totalChars = combinedPayload.length;
		const totalKb = (totalChars / 1024).toFixed(1);
		const estTokens = Math.round(totalChars / 4);

		// Stats
		badgePageCount.textContent = `${count} Page${count === 1 ? "" : "s"}`;
		statPages.textContent = count;
		statSize.textContent = `${totalKb} KB`;
		statTokens.textContent = `~${estTokens.toLocaleString()}`;

		// Dynamic download button label based on active format
		const formatLabels = {
			cleaned: "💾 Download .html",
			markdown: "💾 Download .md",
			raw: "💾 Download Raw .html"
		};
		btnDownload.innerHTML = `<span>${formatLabels[format] || "💾 Download File"}</span>`;

		// Button states
		const hasPages = count > 0;
		btnDownload.disabled = !hasPages;
		btnCopy.disabled = !hasPages;
		btnClear.disabled = !hasPages;

		// Render pages list
		pagesListCount.textContent = count;
		pagesList.innerHTML = "";

		if (!hasPages) {
			const empty = document.createElement("div");
			empty.className = "empty-state";
			empty.innerHTML = "No pages captured yet.<br>Click \"Capture Active Page\" or press <strong>Alt+Shift+C</strong>.";
			pagesList.appendChild(empty);
		} else {
			pages.forEach((page, index) => {
				const item = document.createElement("div");
				item.className = "page-item";

				const timeStr = page.capturedAt ? new Date(page.capturedAt).toLocaleTimeString() : "";
				const sizeKb = ((page.cleanedHtml ? page.cleanedHtml.length : page.rawHtml.length) / 1024).toFixed(1);

				item.innerHTML = `
					<div class="page-item-info">
						<div class="page-item-title" title="${escapeHtml(page.title)}">${index + 1}. ${escapeHtml(page.title)}</div>
						<div class="page-item-meta">${timeStr} &bull; ${sizeKb} KB &bull; <a href="${escapeHtml(page.url)}" target="_blank" class="page-item-link" title="${escapeHtml(page.url)}">${escapeHtml(page.url)}</a></div>
					</div>
					<button class="page-item-delete" data-index="${index}" title="Remove this page">&times;</button>
				`;

				item.querySelector(".page-item-delete").addEventListener("click", async (e) => {
					e.stopPropagation();
					const idxToRemove = parseInt(e.currentTarget.getAttribute("data-index"), 10);
					currentState.pages.splice(idxToRemove, 1);
					await saveState();
					renderUI();
				});

				pagesList.appendChild(item);
			});
		}
	}

	// Payload generator matching content.js
	function buildPayload(pages, format) {
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

	function escapeHtml(str) {
		return (str || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	// Download file helper
	function triggerFileDownload(filename, content, mimeType) {
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

	// Event Handlers
	btnCapture.addEventListener("click", async () => {
		btnCapture.disabled = true;
		btnCapture.querySelector(".btn-text").textContent = "Capturing...";

		try {
			const [tab] = await extAPI.tabs.query({ active: true, currentWindow: true });
			if (tab && tab.id) {
				try {
					await extAPI.tabs.sendMessage(tab.id, { action: "capture" });
				} catch (e) {
					// Fallback to background injection if needed
					await extAPI.runtime.sendMessage({ action: "triggerCapture" });
				}
			} else {
				await extAPI.runtime.sendMessage({ action: "triggerCapture" });
			}

			// Short wait for storage persistence and UI update
			setTimeout(async () => {
				await loadState();
				btnCapture.disabled = false;
				btnCapture.querySelector(".btn-text").textContent = "Capture Active Page";
			}, 300);
		} catch (err) {
			console.error("Capture trigger failed:", err);
			btnCapture.disabled = false;
			btnCapture.querySelector(".btn-text").textContent = "Capture Active Page";
		}
	});

	btnDownload.addEventListener("click", () => {
		const pages = currentState.pages || [];
		if (pages.length === 0) return;

		const format = currentState.settings?.format || "cleaned";
		const payload = buildPayload(pages, format);
		const ext = format === "markdown" ? "md" : "html";
		const mimeType = format === "markdown" ? "text/markdown;charset=utf-8" : "text/html;charset=utf-8";

		// Construct smart filename based on first page domain
		let domain = "web";
		try {
			if (pages[0] && pages[0].url) {
				const urlObj = new URL(pages[0].url);
				domain = urlObj.hostname.replace(/^www\./, "");
			}
		} catch (e) {}

		const filename = `${domain}_products_pages_1-${pages.length}.${ext}`;
		triggerFileDownload(filename, payload, mimeType);
	});

	btnCopy.addEventListener("click", async () => {
		const pages = currentState.pages || [];
		if (pages.length === 0) return;

		const format = currentState.settings?.format || "cleaned";
		const payload = buildPayload(pages, format);

		try {
			await navigator.clipboard.writeText(payload);
			const originalHtml = btnCopy.innerHTML;
			btnCopy.innerHTML = "<span>✅ Copied!</span>";
			setTimeout(() => {
				btnCopy.innerHTML = originalHtml;
			}, 1800);
		} catch (err) {
			console.error("Copy failed:", err);
			alert("Copy to clipboard failed: " + err.message);
		}
	});

	btnClear.addEventListener("click", async () => {
		if (confirm("Are you sure you want to clear all accumulated pages?")) {
			currentState.pages = [];
			await saveState();
			renderUI();
		}
	});

	// Format button click listeners (always visible 3 buttons)
	formatButtons.forEach(btn => {
		btn.addEventListener("click", async () => {
			const newFormat = btn.getAttribute("data-format");
			if (!newFormat || newFormat === currentState.settings?.format) return;
			currentState.settings.format = newFormat;
			await saveState();
			renderUI();
		});
	});

	chkAutoClipboard.addEventListener("change", async () => {
		currentState.settings.autoClipboard = chkAutoClipboard.checked;
		await saveState();
	});

	togglePagesList.addEventListener("click", () => {
		pagesList.classList.toggle("collapsed");
		pagesArrow.innerHTML = pagesList.classList.contains("collapsed") ? "&#9656;" : "&#9662;";
	});

	// Initial load
	await loadState();
});
