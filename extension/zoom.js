// Runs in the page's MAIN world on docs.google.com / drive.google.com.
//
// Intercepts <modifier>+wheel before Chrome turns it into a page zoom, and
// instead drives the document's own zoom control, so only the document
// zooms and the toolbars stay the same size.
//
// It runs in the page world (not the isolated world) because Google's
// Closure-based widgets read `keyCode` from key events, and a patched
// `keyCode` on a synthetic event is only visible to page scripts when the
// patch is made from the page world.
(function () {
  if (window.__gdzInstalled) return;
  window.__gdzInstalled = true;

  var DEFAULTS = {modifier: "ctrlAlt", step: 10, invert: false};
  var MIN_ZOOM = 10;
  var MAX_ZOOM = 500;
  // Accumulated wheel delta (in pixels) needed for one zoom step. Mouse
  // wheels send ~100px per notch; touchpads send many small deltas.
  var WHEEL_THRESHOLD = 50;

  var isTop = window === window.top;
  var wheelAccum = 0;
  var wheelResetTimer = 0;

  function settings() {
    try {
      var raw = document.documentElement.getAttribute("data-gdz-settings");
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return DEFAULTS;
  }

  function modifierMatches(e, modifier) {
    switch (modifier) {
      case "alt":
        return e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey;
      case "ctrlShift":
        return e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
      case "altShift":
        return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey;
      case "ctrlAlt":
      default:
        return e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey;
    }
  }

  // ---- Helpers ------------------------------------------------------------

  function isVisible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // Synthetic keyboard event whose keyCode/which are readable by Closure.
  function keyEvent(type, key, keyCode, init) {
    var ev = new KeyboardEvent(type, Object.assign({
      key: key, bubbles: true, cancelable: true
    }, init || {}));
    Object.defineProperty(ev, "keyCode", {get: function () { return keyCode; }});
    Object.defineProperty(ev, "which", {get: function () { return keyCode; }});
    Object.defineProperty(ev, "charCode", {
      get: function () { return type === "keypress" ? keyCode : 0; }
    });
    return ev;
  }

  // Closure buttons usually act on mouseup, plain buttons on click.
  function press(el) {
    var r = el.getBoundingClientRect();
    var init = {
      bubbles: true, cancelable: true, view: window, button: 0,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    };
    el.dispatchEvent(new MouseEvent("mouseover", init));
    el.dispatchEvent(new MouseEvent("mousedown", init));
    el.dispatchEvent(new MouseEvent("mouseup", init));
    el.dispatchEvent(new MouseEvent("click", init));
  }

  // ---- Strategy 1: zoom combo box (Docs, Sheets) ---------------------------
  // The toolbar has an editable "100%" box; typing a value + Enter zooms.

  var COMBO_SELECTORS = [
    "#zoomSelect input",
    "#t-zoom input",
    "[id*='zoom' i] input.goog-toolbar-combo-button-input",
    "input.goog-toolbar-combo-button-input[aria-label*='zoom' i]"
  ];

  function findZoomInput() {
    for (var i = 0; i < COMBO_SELECTORS.length; i++) {
      var list = document.querySelectorAll(COMBO_SELECTORS[i]);
      for (var j = 0; j < list.length; j++) {
        if (isVisible(list[j])) return list[j];
      }
    }
    return null;
  }

  // Remembers the value we last asked for, so fast consecutive wheel steps
  // build on each other even if the app hasn't re-rendered the box yet.
  var pending = {value: null, time: 0};

  function zoomViaInput(dir, step) {
    var input = findZoomInput();
    if (!input) return false;

    var current = parseInt(input.value, 10);
    if (pending.value !== null && Date.now() - pending.time < 400) {
      current = pending.value;
    }
    if (!isFinite(current)) current = 100; // e.g. "Fit"

    // Snap to the step grid so values stay tidy (e.g. 90 -> 100 -> 110).
    var next = dir > 0
      ? Math.floor(current / step) * step + step
      : Math.ceil(current / step) * step - step;
    next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (next === current) return true;

    var prevFocus = document.activeElement;
    input.focus();
    input.value = next + "%";
    input.dispatchEvent(new Event("input", {bubbles: true}));
    input.dispatchEvent(keyEvent("keydown", "Enter", 13));
    input.dispatchEvent(keyEvent("keypress", "Enter", 13));
    input.dispatchEvent(keyEvent("keyup", "Enter", 13));
    input.dispatchEvent(new Event("change", {bubbles: true}));

    pending = {value: next, time: Date.now()};

    // Give keyboard focus back to the document (Docs keeps it in an iframe).
    if (prevFocus && prevFocus !== input && typeof prevFocus.focus === "function") {
      try { prevFocus.focus(); } catch (e) {}
    }
    return true;
  }

  // ---- Strategy 2: "Zoom in" / "Zoom out" buttons (Drive PDF viewer, …) ----

  var ZOOM_IN_RE = /zoom\s*in|zoom\s*inn|forstørr|förstora|forstør|vergr[öo]ßern|vergroten|zoom avant|ampliar|acercar|aumentar zoom|ingrandisci|powiększ/i;
  var ZOOM_OUT_RE = /zoom\s*out|zoom\s*ut|forminsk|förminska|verkleinern|verkleinen|zoom arrière|reducir|alejar|diminuir zoom|riduci|pomniejsz/i;

  function labelOf(el) {
    return (el.getAttribute("aria-label") || "") + " " +
      (el.getAttribute("data-tooltip") || "") + " " +
      (el.getAttribute("title") || "");
  }

  function findZoomButton(dir) {
    var re = dir > 0 ? ZOOM_IN_RE : ZOOM_OUT_RE;
    var candidates = document.querySelectorAll(
      "[role='button'][aria-label], button[aria-label], " +
      "[role='button'][data-tooltip], button[data-tooltip], " +
      "[role='button'][title], button[title]");
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.getAttribute("aria-disabled") === "true" || el.disabled) continue;
      if (re.test(labelOf(el)) && isVisible(el)) return el;
    }
    return null;
  }

  function zoomViaButton(dir) {
    var btn = findZoomButton(dir);
    if (!btn) return false;
    press(btn);
    return true;
  }

  // ---- Strategy 3: app keyboard shortcut (Slides: Ctrl+Alt+= / Ctrl+Alt+-) -

  function zoomViaShortcut(dir) {
    if (!/\/presentation\//.test(location.pathname)) return false;
    var iframe = document.querySelector(".docs-texteventtarget-iframe");
    var target = null;
    try {
      target = iframe && iframe.contentDocument &&
        (iframe.contentDocument.activeElement || iframe.contentDocument.body);
    } catch (e) {}
    target = target || document.activeElement || document.body;

    var key = dir > 0 ? "=" : "-";
    var code = dir > 0 ? 187 : 189;
    var mods = {ctrlKey: true, altKey: true};
    target.dispatchEvent(keyEvent("keydown", key, code, mods));
    target.dispatchEvent(keyEvent("keyup", key, code, mods));
    return true;
  }

  // ---- Dispatch -------------------------------------------------------------

  function zoom(dir) {
    var s = settings();
    var step = Math.max(1, Math.min(100, parseInt(s.step, 10) || DEFAULTS.step));
    if (zoomViaInput(dir, step)) return;
    if (zoomViaButton(dir)) return;
    if (zoomViaShortcut(dir)) return;
    if (window.console) console.debug("[Drive Document Zoom] no zoom control found on this page");
  }

  function onWheel(e) {
    var s = settings();
    if (!modifierMatches(e, s.modifier)) return;

    // This is what stops Chrome's own Ctrl+wheel page zoom.
    e.preventDefault();
    e.stopImmediatePropagation();

    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 40;       // lines
    else if (e.deltaMode === 2) delta *= 800; // pages
    if (!delta) return;

    // Reset partial accumulation if the user changes direction or pauses.
    if ((wheelAccum > 0 && delta < 0) || (wheelAccum < 0 && delta > 0)) wheelAccum = 0;
    wheelAccum += delta;
    clearTimeout(wheelResetTimer);
    wheelResetTimer = setTimeout(function () { wheelAccum = 0; }, 300);

    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
    var dir = wheelAccum < 0 ? 1 : -1; // wheel up (negative deltaY) = zoom in
    wheelAccum = 0;
    if (s.invert) dir = -dir;

    if (isTop) {
      zoom(dir);
    } else {
      // Zoom controls live in the top frame; forward the request there.
      window.top.postMessage({__gdz: "zoom", dir: dir}, "*");
    }
  }

  window.addEventListener("wheel", onWheel, {capture: true, passive: false});

  if (isTop) {
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (d && d.__gdz === "zoom" && (d.dir === 1 || d.dir === -1)) zoom(d.dir);
    });
  }
})();
