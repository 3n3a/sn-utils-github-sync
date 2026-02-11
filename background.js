/* global chrome, browser */
"use strict";

const api = typeof browser !== "undefined" ? browser : chrome;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ALARM_NAME = "sync-slash-commands";

// ── Sync logic ──────────────────────────────────────────────────────

async function syncIfNeeded(force) {
  const data = await api.storage.local.get([
    "syncMode", "githubRepo", "githubPath", "githubBranch",
    "customUrl", "lastSync",
  ]);

  const mode = data.syncMode || "manual";
  if (mode === "manual") return { skipped: true, reason: "manual mode" };

  if (!force && data.lastSync && Date.now() - data.lastSync < SYNC_INTERVAL_MS) {
    return { skipped: true, reason: "synced recently" };
  }

  let url;
  if (mode === "github") {
    const repo = (data.githubRepo || "").trim();
    const path = (data.githubPath || "").trim();
    const branch = (data.githubBranch || "main").trim();
    if (!repo || !path) return { error: "GitHub repo or path not configured." };
    url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
  } else if (mode === "url") {
    url = (data.customUrl || "").trim();
    if (!url) return { error: "Custom URL not configured." };
  } else {
    return { skipped: true, reason: "unknown mode" };
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) return { error: `HTTP ${resp.status}: ${resp.statusText}` };

    const text = await resp.text();
    let commands;
    try {
      commands = JSON.parse(text);
    } catch (e) {
      return { error: "Response is not valid JSON." };
    }

    if (typeof commands !== "object" || commands === null || Array.isArray(commands)) {
      return { error: "Response must be a JSON object." };
    }

    await api.storage.local.set({ slashCommands: commands, lastSync: Date.now() });
    return { ok: true, count: Object.keys(commands).length };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Alarm for periodic sync ─────────────────────────────────────────

api.alarms.create(ALARM_NAME, { periodInMinutes: 60 });

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) syncIfNeeded(false);
});

// ── Sync on install / update ────────────────────────────────────────

api.runtime.onInstalled.addListener(() => {
  syncIfNeeded(false);
});

// ── Messages from popup / content scripts ───────────────────────────

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "sync") {
    syncIfNeeded(msg.force).then(sendResponse);
    return true; // keep channel open for async response
  }
});
