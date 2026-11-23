// Balcony platform adapter - bridges the invitation to the Balcony website
// when mounted through the platform (see RoyaleRuntime and
// config/templates.php). The same message contract as papercut's and
// rose-invitation's platform-adapter.js.
//
// The runtime loads this page in an iframe with the event payload in the URL
// hash (#platform=<base64url JSON>). This script runs after config.js and
// BEFORE render.js, so the config it assembles here is what the template
// renders on first paint - no flash of demo defaults, no async handshake.
//
// Outbound messages to the parent page:
//   { type: 'balcony:ready' }
//   { type: 'balcony:rsvp', status, headcount, message }
//   { type: 'balcony:save', config }
//   { type: 'balcony:mode', mode }
//   { type: 'balcony:finalize' }
(function () {
  const RY = window.Royale;
  if (!RY) return;

  const match = /[#&]platform=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!match) return; // stand-alone mode - the template behaves as before

  let payload;
  try {
    const b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch (_) {
    return; // malformed payload - render the template defaults rather than break
  }

  function deepMerge(base, over) {
    if (Array.isArray(base) || Array.isArray(over)) return over !== undefined ? over : base;
    if (typeof base !== 'object' || base === null) return over !== undefined ? over : base;
    if (typeof over !== 'object' || over === null) return base;
    const out = {};
    Object.keys(base).forEach((k) => { out[k] = deepMerge(base[k], over[k]); });
    Object.keys(over).forEach((k) => { if (!(k in base)) out[k] = over[k]; });
    return out;
  }

  const event = payload.event || {};
  const overrides = payload.sectionOverrides || {};

  // The no-guest "common link" of a Personalised event drops the guest-name
  // spots entirely - the gate's greeting and the closing board.
  RY.commonLink = !!event.commonLink;

  // Whether this invitation has ever been published - drives the toolbar's
  // "Make it Live" vs "Push to live" label (see editor.js's mount).
  RY.hasPublished = event.status !== 'draft';

  // RSVP's "Your name" field is asked for unless a specific guest is already
  // in the payload.
  RY.hideNameField = !!(payload.guest && (payload.guest.name || payload.guest.greeting));

  // Platform mode never trusts this browser's localStorage - the host's edits
  // arrive in the payload (sectionOverrides.__templateConfig).
  const cfg = deepMerge(RY.DEFAULTS, overrides.__templateConfig || {});

  // Rewrite remote upload URLs to local relative paths so it works offline
  if (cfg.gallery && Array.isArray(cfg.gallery.items)) {
    cfg.gallery.items.forEach(function (item) {
      if (item && typeof item.image === 'string') {
        item.image = item.image.replace(/https?:\/\/[^\/]+\/uploads\//, '../../uploads/');
      }
    });
  }

  // Generic EventData fills the names on a brand-new event, before the host
  // has ever saved this template's own config.
  if (!overrides.__templateConfig) {
    if (Array.isArray(event.hostNames) && event.hostNames.length >= 2) {
      cfg.brideName = event.hostNames[0];
      cfg.groomName = event.hostNames[1];
    }
    if (event.date) cfg.eventISO = event.date;
  }

  RY.config = cfg;
  RY.platform = true;
  RY.syncDerived();

  // Re-encode the payload with the CURRENT config - the editor's Preview /
  // Back navigation carries in-progress edits across the page change.
  RY.platformHash = function () {
    const next = Object.assign({}, payload, {
      sectionOverrides: Object.assign({}, overrides, {
        __templateConfig: JSON.parse(JSON.stringify(RY.config)),
      }),
    });
    const json = JSON.stringify(next);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return '#platform=' + b64;
  };

  // Tell the platform which mode this load is in - the template navigates
  // itself between ?edit=1 and ?preview=1, so the parent has no other way to
  // know, and needs to, to offer device viewports while previewing.
  window.parent.postMessage({ type: 'balcony:mode', mode: RY.mode }, '*');

  // ---- Edit mode: the template's editor, saving to the platform ----------
  if (RY.mode === 'edit') {
    RY.save = function () {
      RY.syncDerived();
      window.parent.postMessage(
        { type: 'balcony:save', config: JSON.parse(JSON.stringify(RY.config)) }, '*'
      );
      return true;
    };
    // Real gallery-photo uploads (see editor.js): a same-origin endpoint, so
    // the iframe posts to it directly. Only set when the payload carries a
    // real event id - the trial editor has no event to upload against and
    // keeps the kit's data-URL fallback.
    RY.uploadUrl = event.id ? ('/host/events/' + event.id + '/media') : null;
    // The same idea for the background-music "upload your own" control.
    RY.audioUploadUrl = event.id ? ('/host/events/' + event.id + '/audio') : null;
    // Resetting in platform mode returns to the template defaults (the
    // platform draft is replaced on the next autosave).
    RY.reset = function () {};
    window.parent.postMessage({ type: 'balcony:ready' }, '*');
    return; // the guests-only wiring below does not apply while editing
  }

  cfg.finalized = true;

  // Guests cannot persist config edits from platform mode.
  RY.save = function () { return false; };

  // Personalised greeting: on the platform a guest's name arrives in the
  // payload's guest record, not as ?to=, so it replaces guestName() here -
  // before render.js puts it under the invocation and on the closing board.
  // The same rule as papercut's adapter: the host's own greeting if they
  // wrote one, else the guest's name, with their family name if they have one.
  const guest = payload.guest;
  if (guest && (guest.greeting || guest.name)) {
    const name = guest.greeting ||
      (guest.familyName ? guest.name + ' & ' + guest.familyName : guest.name);
    RY.guestName = function () { return String(name).trim().slice(0, 80); };
  }

  window.parent.postMessage({ type: 'balcony:ready' }, '*');
})();
