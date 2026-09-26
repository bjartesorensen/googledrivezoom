// Runs in the extension's isolated world. Reads the user's settings from
// chrome.storage and publishes them on <html data-gdz-settings="..."> so the
// page-world script (zoom.js) can read them.
(function () {
  function publish(settings) {
    var root = document.documentElement;
    if (root) root.setAttribute("data-gdz-settings", JSON.stringify(settings));
  }

  function load() {
    chrome.storage.sync.get(GDZ_DEFAULTS, publish);
  }

  load();
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "sync") load();
  });
})();
