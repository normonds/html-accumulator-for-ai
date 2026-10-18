/**
 * HTML Multi-Page Accumulator for AI
 * background.js - Service Worker / Event Script for Commands, Badges & Sync
 */

const extAPI = typeof browser !== "undefined" ? browser : chrome;

// Update badge count and styling
function updateBadge(count) {
	const text = count > 0 ? count.toString() : "";
	extAPI.action.setBadgeText({ text: text });
	extAPI.action.setBadgeBackgroundColor({ color: "#10b981" });
}

// Restore badge on browser startup / extension load
async function restoreBadgeState() {
	try {
		const storage = extAPI.storage.local;
		const data = await storage.get(["ai_html_accumulator_data"]);
		const count = data?.ai_html_accumulator_data?.pages?.length || 0;
		updateBadge(count);
	} catch (e) {
		console.warn("Could not restore badge state:", e);
	}
}

// Initialize on install or startup
extAPI.runtime.onInstalled.addListener(() => {
	restoreBadgeState();
});

extAPI.runtime.onStartup?.addListener(() => {
	restoreBadgeState();
});

// Trigger capture in active tab
async function triggerCaptureInActiveTab() {
	try {
		const [tab] = await extAPI.tabs.query({ active: true, currentWindow: true });
		if (!tab || !tab.id) return;

		// Skip browser-internal schemes
		if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") || tab.url.startsWith("chrome-extension://"))) {
			return;
		}

		// Inject styles and content script if not already injected
		try {
			await extAPI.scripting.insertCSS({
				target: { tabId: tab.id },
				files: ["styles.css"]
			});
		} catch (e) {
			// CSS injection might fail if already injected or restricted; proceed
		}

		try {
			await extAPI.scripting.executeScript({
				target: { tabId: tab.id },
				files: ["content.js"]
			});
		} catch (e) {
			// Content script might already be injected; proceed to message
		}

		// Send capture message
		await extAPI.tabs.sendMessage(tab.id, { action: "capture" });
	} catch (err) {
		console.error("Failed to trigger capture:", err);
	}
}

// Listen for keyboard command (Alt+Shift+C)
extAPI.commands.onCommand.addListener((command) => {
	if (command === "capture-page") {
		triggerCaptureInActiveTab();
	}
});

// Listen for messages from content script or popup
extAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "updateBadge") {
		updateBadge(request.count);
		sendResponse({ success: true });
		return true;
	}
	if (request.action === "triggerCapture") {
		triggerCaptureInActiveTab().then(() => sendResponse({ success: true }));
		return true;
	}
});

// Initial badge check
restoreBadgeState();
