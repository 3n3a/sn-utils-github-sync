/* global chrome, browser */
"use strict";

const api = typeof browser !== "undefined" ? browser : chrome;

// ── DOM refs ────────────────────────────────────────────────────────
const tabButtons = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");
const settingsStatus = document.getElementById("settings-status");
const versionEl = document.getElementById("version");

// Source radios & panels
const syncRadios = document.querySelectorAll('input[name="syncMode"]');
const sourcePanels = {
  manual: document.getElementById("panel-manual"),
  github: document.getElementById("panel-github"),
  url: document.getElementById("panel-url"),
};

// Manual
const commandsJson = document.getElementById("commands-json");
const btnSaveManual = document.getElementById("btn-save-manual");
const btnFormat = document.getElementById("btn-format");

// GitHub
const ghRepo = document.getElementById("gh-repo");
const ghPath = document.getElementById("gh-path");
const ghBranch = document.getElementById("gh-branch");
const btnSaveGithub = document.getElementById("btn-save-github");
const btnSyncGithub = document.getElementById("btn-sync-github");
const ghSyncInfo = document.getElementById("gh-sync-info");

// Custom URL
const customUrl = document.getElementById("custom-url");
const btnSaveUrl = document.getElementById("btn-save-url");
const btnSyncUrl = document.getElementById("btn-sync-url");
const urlSyncInfo = document.getElementById("url-sync-info");

// ── Default commands ────────────────────────────────────────────────
const DEFAULT_COMMANDS = {
  test: { url: "https://example.com", hint: "Test command", fields: "", order: 1, overwriteurl: "" },
};

// ── Tab switching ───────────────────────────────────────────────────
tabButtons.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabButtons.forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// ── Version ─────────────────────────────────────────────────────────
versionEl.textContent = api.runtime.getManifest().version;

// ── Source mode switching ───────────────────────────────────────────
function showSourcePanel(mode) {
  Object.entries(sourcePanels).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== mode);
  });
}

syncRadios.forEach((radio) => {
  radio.addEventListener("change", () => showSourcePanel(radio.value));
});

// ── Load all settings ───────────────────────────────────────────────
function loadSettings() {
  api.storage.local.get(
    ["syncMode", "slashCommands", "githubRepo", "githubPath", "githubBranch", "customUrl", "lastSync"],
    (data) => {
      // Source mode
      const mode = data.syncMode || "manual";
      const radio = document.querySelector(`input[name="syncMode"][value="${mode}"]`);
      if (radio) radio.checked = true;
      showSourcePanel(mode);

      // Manual
      const cmds = data.slashCommands || DEFAULT_COMMANDS;
      commandsJson.value = JSON.stringify(cmds, null, 2);

      // GitHub
      ghRepo.value = data.githubRepo || "";
      ghPath.value = data.githubPath || "";
      ghBranch.value = data.githubBranch || "main";

      // Custom URL
      customUrl.value = data.customUrl || "";

      // Last sync info
      updateSyncInfo(data.lastSync);
    }
  );
}

function updateSyncInfo(ts) {
  const text = ts ? "Last synced: " + formatAgo(ts) : "Never synced";
  ghSyncInfo.textContent = text;
  urlSyncInfo.textContent = text;
}

function formatAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}

// ── Helpers ─────────────────────────────────────────────────────────
function getSelectedMode() {
  return document.querySelector('input[name="syncMode"]:checked').value;
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status ${type}`;
  setTimeout(() => el.classList.add("hidden"), 5000);
}

function parseJson(str) {
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "Must be a JSON object." };
    }
    return { value: parsed };
  } catch (e) {
    return { error: "Invalid JSON: " + e.message };
  }
}

function triggerSync(force, callback) {
  api.runtime.sendMessage({ action: "sync", force }, (result) => {
    if (api.runtime.lastError) {
      callback({ error: api.runtime.lastError.message });
      return;
    }
    callback(result || {});
  });
}

// ── Manual: save / format ───────────────────────────────────────────
btnSaveManual.addEventListener("click", () => {
  const result = parseJson(commandsJson.value);
  if (result.error) {
    showStatus(settingsStatus, result.error, "error");
    return;
  }
  api.storage.local.set({ syncMode: "manual", slashCommands: result.value }, () => {
    const n = Object.keys(result.value).length;
    showStatus(settingsStatus, `Saved ${n} command(s). Reload any ServiceNow tab to apply.`, "success");
  });
});

btnFormat.addEventListener("click", () => {
  const result = parseJson(commandsJson.value);
  if (result.error) {
    showStatus(settingsStatus, result.error, "error");
    return;
  }
  commandsJson.value = JSON.stringify(result.value, null, 2);
  showStatus(settingsStatus, "Formatted.", "success");
});

// ── GitHub: save / sync ─────────────────────────────────────────────
btnSaveGithub.addEventListener("click", () => {
  const repo = ghRepo.value.trim();
  const path = ghPath.value.trim();
  const branch = ghBranch.value.trim() || "main";
  if (!repo || !path) {
    showStatus(settingsStatus, "Repository and file path are required.", "error");
    return;
  }
  api.storage.local.set({
    syncMode: "github",
    githubRepo: repo,
    githubPath: path,
    githubBranch: branch,
  }, () => {
    showStatus(settingsStatus, "GitHub source saved.", "success");
  });
});

btnSyncGithub.addEventListener("click", () => {
  // Save first, then force-sync.
  btnSaveGithub.click();
  setTimeout(() => {
    showStatus(settingsStatus, "Syncing...", "success");
    triggerSync(true, (result) => {
      if (result.error) {
        showStatus(settingsStatus, result.error, "error");
      } else if (result.ok) {
        showStatus(settingsStatus, `Synced ${result.count} command(s).`, "success");
        updateSyncInfo(Date.now());
      }
    });
  }, 100);
});

// ── Custom URL: save / sync ─────────────────────────────────────────
btnSaveUrl.addEventListener("click", () => {
  const url = customUrl.value.trim();
  if (!url) {
    showStatus(settingsStatus, "URL is required.", "error");
    return;
  }
  api.storage.local.set({ syncMode: "url", customUrl: url }, () => {
    showStatus(settingsStatus, "Custom URL saved.", "success");
  });
});

btnSyncUrl.addEventListener("click", () => {
  btnSaveUrl.click();
  setTimeout(() => {
    showStatus(settingsStatus, "Syncing...", "success");
    triggerSync(true, (result) => {
      if (result.error) {
        showStatus(settingsStatus, result.error, "error");
      } else if (result.ok) {
        showStatus(settingsStatus, `Synced ${result.count} command(s).`, "success");
        updateSyncInfo(Date.now());
      }
    });
  }, 100);
});

// ── Init ────────────────────────────────────────────────────────────
loadSettings();
