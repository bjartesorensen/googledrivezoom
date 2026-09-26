(function () {
  var modifier = document.getElementById("modifier");
  var step = document.getElementById("step");
  var invert = document.getElementById("invert");
  var status = document.getElementById("status");
  var statusTimer = 0;

  chrome.storage.sync.get(GDZ_DEFAULTS, function (s) {
    modifier.value = s.modifier;
    step.value = s.step;
    invert.checked = s.invert;
  });

  function save() {
    var n = Math.max(1, Math.min(100, parseInt(step.value, 10) || GDZ_DEFAULTS.step));
    step.value = n;
    chrome.storage.sync.set({modifier: modifier.value, step: n, invert: invert.checked}, function () {
      status.textContent = "Saved";
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () { status.textContent = ""; }, 1200);
    });
  }

  modifier.addEventListener("change", save);
  step.addEventListener("change", save);
  invert.addEventListener("change", save);
})();
