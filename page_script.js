// Page script — MAIN world.
// Polls for the data attribute set by content_script.js (ISOLATED world)
// and for window.top.snuslashcommands set by SN Utils.
// Once both exist, merges our commands into snuslashcommands.

(function () {
  var attempts = 0;
  var check = setInterval(function () {
    attempts++;
    if (attempts > 50) {
      clearInterval(check);
      return;
    }

    // Wait for the ISOLATED script to write our commands.
    var attr = document.documentElement.getAttribute("data-sn-github-sync");
    if (!attr) return;

    // Wait for SN Utils to initialise the variable.
    if (typeof window.top.snuslashcommands === "undefined") return;

    clearInterval(check);
    document.documentElement.removeAttribute("data-sn-github-sync");

    var ours = JSON.parse(attr);
    Object.assign(window.top.snuslashcommands, ours);
  }, 200);
})();
