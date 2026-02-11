/* global chrome, browser */
"use strict";

// Content script — ISOLATED world.
// Triggers a sync check via the background service worker, then reads
// commands from storage and passes them to page_script.js via a data
// attribute on <html>.

(function () {
  const api = typeof browser !== "undefined" ? browser : chrome;

  // Ask background to sync if stale, then load commands.
  api.runtime.sendMessage({ action: "sync", force: false }, () => {
    // Ignore response — whether sync ran or was skipped, read storage.
    if (api.runtime.lastError) { /* background may not be ready yet */ }

    api.storage.local.get("slashCommands", (result) => {
      const commands = result.slashCommands;
      if (!commands || Object.keys(commands).length === 0) return;

      document.documentElement.setAttribute(
        "data-sn-github-sync",
        JSON.stringify(commands)
      );
    });
  });
})();
