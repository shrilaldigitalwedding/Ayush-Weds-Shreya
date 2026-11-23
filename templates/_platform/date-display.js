/*
 * Day-first display (dd/mm/yyyy) for every native date input on the page.
 *
 * <input type="date"> draws its text in the BROWSER's locale, so an en-US
 * browser shows 09/27/2026 whatever the page wants, and there is no attribute
 * to change that. This keeps the native input - its calendar, its ISO value
 * and every listener the editors bound to it - and lays a dd/mm/yyyy label
 * over its own (hidden) text.
 *
 * Editors re-render with innerHTML, so inputs added later are picked up by a
 * MutationObserver; values set from code (input.value = ...) are caught by a
 * per-input setter. While the host types into the field the native text is
 * shown instead, so they are never typing blind.
 */
(function () {
  'use strict';
  if (window.BalconyDateDisplay) return;

  var ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  var PLACEHOLDER = 'dd/mm/yyyy';
  var SELECTOR = 'input[type="date"]';
  var enhanced = [];

  function format(iso) {
    var m = ISO.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  var css =
    '.bdate{position:relative;display:inline-grid;max-width:100%;vertical-align:middle}' +
    '.bdate--block{display:grid}' +
    '.bdate>input[type="date"],.bdate>.bdate__text{grid-area:1/1}' +
    '.bdate>input[type="date"]{min-width:0}' +
    '.bdate__text{align-self:center;justify-self:start;pointer-events:none;white-space:nowrap;overflow:hidden;line-height:normal}' +
    '.bdate__text--empty{opacity:.55}' +
    '.bdate--typing>.bdate__text{visibility:hidden}' +
    '.bdate:not(.bdate--typing)>input[type="date"]::-webkit-datetime-edit{opacity:0}' +
    // Firefox has no ::-webkit-datetime-edit; hide the input's text colour instead.
    '@supports (-moz-appearance:none){.bdate:not(.bdate--typing)>input[type="date"]{color:transparent}}';

  function injectStyle() {
    if (document.getElementById('bdate-style')) return;
    var style = document.createElement('style');
    style.id = 'bdate-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function refresh(input) {
    var label = input.__bdateLabel;
    if (!label) return;
    var text = format(input.value);
    label.textContent = text || PLACEHOLDER;
    label.classList.toggle('bdate__text--empty', !text);

    // Match the input's own type and text inset, so the label sits exactly
    // where the native text was.
    var cs = getComputedStyle(input);
    label.style.fontFamily = cs.fontFamily;
    label.style.fontSize = cs.fontSize;
    label.style.fontWeight = cs.fontWeight;
    label.style.fontStyle = cs.fontStyle;
    label.style.letterSpacing = cs.letterSpacing;
    // Firefox's hiding rule makes the input's own colour transparent, so fall
    // back to the colour it had before it was wrapped.
    var color = cs.color;
    if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') color = input.__bdateColor;
    label.style.color = color;
    label.style.paddingLeft = (parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)) + 'px';
  }

  // Programmatic writes (input.value = '2026-09-27') fire no event - wrap the
  // setters on this one element so the label still follows them.
  function watchSetters(input) {
    ['value', 'valueAsDate', 'valueAsNumber'].forEach(function (prop) {
      var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, prop);
      if (!d || !d.set) return;
      Object.defineProperty(input, prop, {
        configurable: true,
        enumerable: d.enumerable,
        get: function () { return d.get.call(this); },
        set: function (v) { d.set.call(this, v); refresh(this); },
      });
    });
  }

  function enhance(input) {
    if (input.__bdateLabel || input.type !== 'date') return;

    // Captured before wrapping: a full-width (block) input keeps its width,
    // and the label keeps the text colour the hiding rule is about to clear.
    input.__bdateColor = getComputedStyle(input).color;
    var block = getComputedStyle(input).display === 'block' ||
      /\b(date-input|pf-field)\b/.test(input.className);

    var wrap = document.createElement('span');
    wrap.className = 'bdate' + (block ? ' bdate--block' : '');
    var label = document.createElement('span');
    label.className = 'bdate__text';
    label.setAttribute('aria-hidden', 'true');

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(label);
    input.__bdateLabel = label;

    watchSetters(input);

    input.addEventListener('input', function () { refresh(input); });
    input.addEventListener('change', function () { refresh(input); });

    // Keyboard entry edits the hidden native segments - show them meanwhile.
    input.addEventListener('keydown', function (e) {
      if (['Tab', 'Shift', 'Escape', 'Enter'].indexOf(e.key) !== -1) return;
      wrap.classList.add('bdate--typing');
    });
    input.addEventListener('blur', function () {
      wrap.classList.remove('bdate--typing');
      refresh(input);
    });

    // The visible text is ours, so a click anywhere on it opens the calendar
    // (Chrome would otherwise just focus an invisible segment).
    input.addEventListener('click', function () {
      if (wrap.classList.contains('bdate--typing') || input.disabled || input.readOnly) return;
      try { if (input.showPicker) input.showPicker(); } catch (_) { /* already open / not allowed */ }
    });

    enhanced.push(input);
    refresh(input);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(SELECTOR)) enhance(root);
    if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll(SELECTOR), enhance);
  }

  function refreshAll() {
    enhanced = enhanced.filter(function (i) { return i.isConnected; });
    enhanced.forEach(refresh);
  }

  injectStyle();
  scan(document.documentElement);
  document.addEventListener('DOMContentLoaded', function () { scan(document.documentElement); });

  new MutationObserver(function (records) {
    records.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes, scan); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // A form reset restores values without events; font sizes can follow the
  // viewport (clamp()), so re-measure after a resize.
  document.addEventListener('reset', function () { setTimeout(refreshAll, 0); }, true);
  var resizeQueued = false;
  window.addEventListener('resize', function () {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () { resizeQueued = false; refreshAll(); });
  });

  window.BalconyDateDisplay = { format: format, enhance: enhance };
})();
