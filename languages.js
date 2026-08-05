(function () {

  // ==========================================================================
  // languages.js — 4 animation cards, two rigs split at MOBILE_BP.
  //
  // DESKTOP (≥992px): scroll-list index. Cards stacked in one spot in the sticky .lang_card--wrap; the
  // text block nearest the viewport centre is active → its card crossfades in and autoplays.
  // MOBILE (≤991px): scroll-list off, card wrap + text column hidden. Each .lang_stack-wrap gets a CLONE
  // of its card in .lang_anim-wrap and loops it while in view.
  //
  // DOM contract (Webflow):
  //   [data-lang="section"]
  //   [data-lang-anim="0"]          card 0 — language switcher
  //       [data-lang-name]          the curved string — tag the <textPath>, NOT the <text> (we set
  //                                  .textContent; tagging <text> would nuke the textPath + the curve)
  //       [data-lang-label]         visible language name — optional
  //       [data-lang-flag]          one el per language (data-lang-flag="us|de|es|in"), OR a single
  //                                  <img> (src swapped), OR a single text el (emoji — breaks on Windows)
  //   [data-lang-anim="1|2|3"]      cards 1–3
  //   .lang_text-anim-wrap > .lang_anim-text-wrap ×4    desktop text blocks, SAME ORDER as the cards
  //   .lang_mobile-wrap > .lang_stack-wrap ×4 > .lang_anim-wrap    mobile stack; block order picks the
  //                                  card (override with data-lang-play="N"). A card already pasted in a
  //                                  slot is driven as-is, nothing cloned.
  // ==========================================================================

  //   text = the sentence (JS owns the SVG string; authored text is overwritten)
  //   name = visible label · code = flag country code · flag = emoji fallback
  var FLAG_URL = 'https://flagcdn.com/w80/{code}.png';   // {code} → country code
  var SEP      = '   ';                                  // gap between languages in the joined line
  // keep these within a few characters of each other: the sweep runs at a constant speed and each
  // language's share of the CHARACTER count is its share of the card's time (see MID_FRAC). they were
  // 35–104 chars, which is why the switches landed unevenly.
  var SEGS = [
    { text: 'I’m getting started with the project. Here are a few options.',  name: 'English',  code: 'us', flag: '🇺🇸' },
    { text: 'Wie möchten Sie die Datei einrichten? Hier sind ein paar Optionen für Sie.', name: 'Deutsch', code: 'de', flag: '🇩🇪' },
    { text: 'Estoy empezando con el proyecto. Aquí van algunas opciones.',   name: 'Español',  code: 'es', flag: '🇪🇸' },
    // longer than the others ON PURPOSE: the sweep is linear in characters but moves in rendered px,
    // and Devanagari packs more characters into less width — at equal counts it flashes past.
    { text: 'प्रोजेक्ट पर काम शुरू हो गया। आप इसे कैसे सेट करना चाहेंगे? यहाँ कुछ विकल्प हैं।', name: 'हिन्दी',   code: 'in', flag: '🇮🇳' }
  ];

  // ---- config ----
  var SCRUB_LERP = 0.08;    // scrub easing — lower = more trailing glide (1 = instant)
  var ANCHOR     = 0.5;     // point along the curve (0..1) each language parks at
  // pad the line's ends with the neighbouring languages so the curve is never bare past the first or
  // last one. filler only — the sweep and the flags ignore it.
  var EDGE_FILL = true;
  // how far past the first/last centre the sweep runs, as a fraction of half a gap. 1 = every language
  // gets an equal dwell; 0 = the old behaviour, where the end languages got half. needs EDGE_FILL.
  var EDGE_LEAD = 1;
  var LANG_DEBUG = false;   // logs each language's RENDERED width + the time it actually holds
  // fix the language wrap to its widest content so it stops resizing per word
  var LABEL_FIXED_W = true;
  var LABEL_W_PAD   = 0;    // px added to the measured widest width
  var LANG_PATH_FONT = '36px';   // switcher curved-text size ('' = leave to CSS)
  var LANG_PATH_HARD = true;

  // ---- cards (desktop stacking) ----
  var CARD_FADE_MS = 220;   // crossfade between cards (ms)
  var CARD_STACK   = true;  // JS overlays the cards so they can crossfade; false = you stack them yourself

  // ---- card 1 (Add to vocabulary) ----
  var VOCAB_WORD = 'Wispr Flow';   // the word typed into the input (JS owns it)
  var TOG_OFF    = '#d8d6cc';      // toggle track colour OFF
  var TOG_ON     = '#1a1a1a';      // toggle track colour ON
  var C1_SCROLL_EXTRA = 20;        // px the inner track lifts BEYOND the form's own overflow, so the
                                   // toggle + Add button sit clear of the bottom edge

  // ---- card 2 (snippets) ----
  var SNIP_RISE = 46;              // px the pills sit above/below the line while outside it

  // ---- card 3 (tone) ----
  var TONES = [
    { key: 'formal', text: 'Hey, are you free for lunch tomorrow?\nLet’s do 12 if that works for you.' },
    { key: 'casual', text: 'Hey are you free for lunch tomorrow?\nLet’s do 12 if that works for you' },
    { key: 'very',   text: 'hey are you free for lunch tomorrow?\nlet’s do 12 if that works for you' }
  ];

  // ---- triggered beats: each fires when progress crosses its threshold, then plays over TRIG_MS ----
  var TRIG_MS  = 300;                          // beat play duration (ms)
  var TYPE_MS  = 650;                          // card 1 typewriter duration
  var CHIP_MS  = 220;                          // new-word chip pop
  // beat 1 must stay held long enough for the form's full ~2600ms TIMED sequence (type → toggle → move →
  // Add click) to finish before beat 2 flips to done — else the Add gets cut. Hence the wide window here
  // plus the long LANG_AUTOPLAY_MS[1].
  var C1_BEATS = [0.1, 0.55, 0.85];            // chips · form plays · done(+new word) · animate out
  var C2_LIFT  = 0.30;                         // card 2: trigger lifts out, slot makes room, URL below
  var C2_RISE  = 0.58;                         // card 2: URL rises into the slot
  var C2_OUT   = 0.82;                         // card 2: the whole row — side text and URL — fades out
                                               // where it stands, then the card restarts from empty
  var C2_FADE_MS = 420;                        // that fade
  var ACTIVE_CLASS = 'is-active';              // marks the active tone button (card 3)
  var WAVE_STAGGER = 45;                       // card 3: ms delay per word, incoming message only
  var TONE_OUT_MS  = 150;                      // card 3: the old message clears in one go, no wave —
                                               // staggering it too is what made the two texts overlap
  var TONE_IN_LAG  = 60;                       // card 3: gap after it's gone before the new one starts
  var TONE_IN_MS   = 320;                      // card 3: per-word fade of the incoming message
  var EASE     = 'cubic-bezier(.4,0,.2,1)';
  var BACK     = 'cubic-bezier(.34,1.56,.64,1)';

  // ---- playback (both modes) ----
  // per-card duration (ms); card 1 longest, see C1_BEATS. with EDGE_LEAD the switcher covers one full
  // pass of the list, so seconds-per-language = this / SEGS.length — 8000/4 = 2s each.
  var LANG_AUTOPLAY_MS = [16000, 9000, 4500, 5000];
  var LANG_START       = { 0: 0.3 };   // per-card starting progress (switcher enters 30% in)

  // ---- MOBILE (≤ MOBILE_BP) ----
  var MOBILE_BP        = 991;
  var MOBILE_SEL       = '.lang_mobile-wrap, [data-lang="mobile"]';
  var MOBILE_BLOCK_SEL = '.lang_stack-wrap, [data-lang-play]';
  var MOBILE_SLOT_SEL  = '.lang_anim-wrap, [data-lang-slot]';
  var MOBILE_MS        = [];     // per-card duration override (ms); empty = LANG_AUTOPLAY_MS
  var MOBILE_LOOP      = true;   // loop while the block is in view
  var MOBILE_IO_MARGIN = '-15%'; // bottom rootMargin — how far up the viewport the block must be to start
  var MOBILE_PATH_FONT = '';     // card 0 curved-text size. '' = inherit the embed CSS. Setting it writes
                                 // inline on the <textPath>, the only way to beat #marquee-text-lang.
  var MOBILE_SNIP_FIT  = false;  // card 2: true = cut the URL pill to card width (gradient covers the cut)
  var MOBILE_FIT_W     = 0;      // px design width; JS scales each card by slotW/this and reserves the
                                 // scaled height → proportions hold at any width. 0 = off, fill the slot.

  var ATTR = 'data-lang';

  function langStart(i) { return (LANG_START && LANG_START[i]) || 0; }

  // how many thresholds tp has crossed (ascending array)
  function beatOf(tp, ths) {
    var b = 0;
    for (var i = 0; i < ths.length; i++) { if (tp >= ths[i]) { b++; } }
    return b;
  }

  // rAF typewriter — real time, so speed is independent of scroll
  function makeTyper(el) {
    var raf = 0, startT = 0, full = '', dur = 600, done = false;
    function step(now) {
      if (!startT) { startT = now; }
      var k = Math.min(1, (now - startT) / dur);
      el.textContent = full.slice(0, Math.round(k * full.length)) + (k < 1 ? '|' : '');
      if (k < 1) { raf = window.requestAnimationFrame(step); } else { done = true; }
    }
    return {
      play: function (text, ms) {
        if (done && full === text) { return; }     // already typed — don't restart
        window.cancelAnimationFrame(raf);
        full = text; dur = ms || 600; startT = 0; done = false;
        raf = window.requestAnimationFrame(step);
      },
      reset: function () { window.cancelAnimationFrame(raf); startT = 0; done = false; el.textContent = ''; }
    };
  }

  // per-word spans with staggered transition-delay → left-to-right wave. whitespace (incl. newlines under
  // white-space:pre-line) stays as text nodes.
  function waveWrap(el, staggerMs) {
    var parts = el.textContent.split(/(\s+)/);
    el.textContent = '';
    var spans = [], wi = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === '') { continue; }
      if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); continue; }
      var s = document.createElement('span');
      s.textContent = p;
      s.style.display = 'inline-block';
      s.style.willChange = 'opacity, transform';
      s.style.transition = 'opacity 320ms ease, transform 320ms cubic-bezier(.4,0,.2,1)';
      s.style.transitionDelay = (wi * staggerMs) + 'ms';
      el.appendChild(s);
      spans.push(s); wi++;
    }
    return spans;
  }

  // GOTCHA (mobile clones): a cloned <textPath href="#curve"> still resolves to the FIRST #curve in the
  // document (the desktop one) → the curve breaks. So suffix every id in the clone and rewrite every ref.
  function uniqIds(root, sfx) {
    var map = {}, all = [root];
    if (root.id) { map[root.id] = root.id + '-' + sfx; root.id = map[root.id]; }
    Array.prototype.forEach.call(root.querySelectorAll('[id]'), function (el) {
      map[el.id] = el.id + '-' + sfx; el.id = map[el.id];
    });
    Array.prototype.push.apply(all, root.querySelectorAll('*'));
    var keys = Object.keys(map);
    if (!keys.length) { return; }
    var XL = 'http://www.w3.org/1999/xlink';
    var REFS = ['href', 'fill', 'stroke', 'clip-path', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end'];
    var res = keys.map(function (k) {
      return { re: new RegExp('#' + k.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '(?![\\w-])', 'g'), to: '#' + map[k] };
    });
    function swap(v) {
      for (var i = 0; i < res.length; i++) { v = v.replace(res[i].re, res[i].to); }
      return v;
    }
    Array.prototype.forEach.call(all, function (el) {
      if (!el.getAttribute) { return; }
      // the embed ships its own <style> keyed off #svg-trail / #marquee-text-lang — rewrite those
      // selectors too, else the clone loses fill:transparent (black blob) + the text styling
      if (el.tagName && el.tagName.toLowerCase() === 'style') {
        if (el.textContent && el.textContent.indexOf('#') !== -1) { el.textContent = swap(el.textContent); }
        return;
      }
      for (var a = 0; a < REFS.length; a++) {
        var v = el.getAttribute(REFS[a]);
        if (v && v.indexOf('#') !== -1) { el.setAttribute(REFS[a], swap(v)); }
      }
      var xv = el.getAttributeNS ? el.getAttributeNS(XL, 'href') : null;
      if (xv && xv.indexOf('#') !== -1) { el.setAttributeNS(XL, 'href', swap(xv)); }
    });
  }

  // WebKit answers getComputedTextLength() with 0 on a <text> that wraps a <textPath>, which left
  // span at 0 — and render() guards on span > 0, so card 0 never moved a pixel in Safari. Fall
  // through to measurements that don't depend on SVG text metrics. Canvas comes before the cloned
  // <text> ON PURPOSE: measure() runs from a ScrollTrigger refresh, and touching the DOM in there is
  // what caused the scroll glitch last time. Canvas touches nothing.
  var spanCache = {};
  function measureSpan(textEl, tp) {
    if (!textEl) { return 0; }
    var str = (tp || textEl).textContent || '';
    var cs  = window.getComputedStyle(tp || textEl);
    var key = [str, cs.fontSize, cs.fontFamily, cs.fontWeight, cs.letterSpacing].join('|');
    if (spanCache[key] > 0) { return spanCache[key]; }

    var n = 0;
    try { n = textEl.getComputedTextLength ? textEl.getComputedTextLength() : 0; } catch (e) { n = 0; }
    if (!(n > 0) && tp) {
      try { n = tp.getComputedTextLength ? tp.getComputedTextLength() : 0; } catch (e2) { n = 0; }
      if (!(n > 0) && str.length) {
        try { n = tp.getSubStringLength ? tp.getSubStringLength(0, str.length) : 0; } catch (e3) { n = 0; }
      }
    }
    if (!(n > 0)) { n = measureOnCanvas(str, cs); }

    if (n > 0) { spanCache[key] = n; }
    return n || 0;
  }

  var canvasCtx = null;
  function measureOnCanvas(str, cs) {
    if (!str) { return 0; }
    try {
      if (!canvasCtx) {
        var c = document.createElement('canvas');
        canvasCtx = c.getContext ? c.getContext('2d') : null;
      }
      if (!canvasCtx) { return 0; }
      canvasCtx.font = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].join(' ');
      return canvasCtx.measureText(str).width || 0;
    } catch (e) { return 0; }
  }

  // card-0's joined line + each segment's centre as a fraction of it (shared by desktop card + clones)
  var LINE = '', MID_FRAC = [];
  (function buildLine() {
    var starts = [];
    // FILLER: the sweep only ever travels segment 0 → segment N-1, but the path is wider than that
    // run, so past either end there was bare curve — the gap after the last language. padding the
    // line with the neighbouring segments keeps text under the whole path. it is never swept, never
    // flagged: purely what you see either side of the active language.
    var head = EDGE_FILL ? (SEGS[SEGS.length - 1].text + SEP) : '';
    LINE = head;
    for (var s = 0; s < SEGS.length; s++) {
      starts[s] = LINE.length;
      LINE += SEGS[s].text;
      if (s < SEGS.length - 1) { LINE += SEP; }
    }
    if (EDGE_FILL) { LINE += SEP + SEGS[0].text; }
    var totalLen = LINE.length || 1;
    for (var s2 = 0; s2 < SEGS.length; s2++) {
      MID_FRAC[s2] = (starts[s2] + SEGS[s2].text.length / 2) / totalLen;
    }
  }());

  // ==========================================================================
  // card factories — each takes the card ROOT and returns { render(tp), measure(), destroy() }.
  // Desktop card and each mobile clone get their OWN instance.
  // ==========================================================================

  // ---- card 0: language switcher — the line streams along the curve, flag swaps on arrival ----
  function buildCard0(root, fontSize, hardFont) {
    if (!root) { return null; }
    var nameEl  = root.querySelector('[' + ATTR + '-name]');    // the <textPath>
    var labelEl = root.querySelector('[' + ATTR + '-label]');
    var flagEls = root.querySelectorAll('[' + ATTR + '-flag]');

    // only a NON-EMPTY code counts as a per-language flag, so a wrapper with a bare data-lang-flag is
    // ignored rather than hidden. >1 coded flag = MULTI mode (show active, hide rest).
    var coded = [];
    Array.prototype.forEach.call(flagEls, function (el) {
      if (el.getAttribute(ATTR + '-flag')) { coded.push(el); }
    });
    var flagMulti   = coded.length > 1;
    var singleFlag  = coded[0] || (flagEls.length ? flagEls[0] : null);
    var singleIsImg = singleFlag && singleFlag.tagName && singleFlag.tagName.toLowerCase() === 'img';

    function setActive(seg) {
      if (labelEl && labelEl.textContent !== seg.name) { labelEl.textContent = seg.name || ''; }
      if (flagMulti) {
        for (var g = 0; g < coded.length; g++) {
          coded[g].style.display = (coded[g].getAttribute(ATTR + '-flag') === seg.code) ? '' : 'none';
        }
      } else if (singleIsImg) {
        var src = FLAG_URL.replace('{code}', seg.code || '');
        if (singleFlag.getAttribute('src') !== src) { singleFlag.setAttribute('src', src); }
      } else if (singleFlag && singleFlag.textContent !== seg.flag) {
        singleFlag.textContent = seg.flag || '';
      }
    }

    // the <text> owns the x attr we move; nameEl is its <textPath> child (holds the string)
    var textEl = null, tpEl = null;
    if (nameEl) {
      var isTp = !!(nameEl.tagName && nameEl.tagName.toLowerCase() === 'textpath');
      textEl = isTp ? nameEl.parentNode : nameEl;
      tpEl   = isTp ? nameEl : (textEl.querySelector ? textEl.querySelector('textPath') : null);
    }
    var fs = (fontSize === undefined) ? LANG_PATH_FONT : fontSize;
    if (textEl && fs) { textEl.style.fontSize = fs; }
    // the embed's #marquee-text-lang rule outranks the <text> inline size, so a hard override must go on
    // the <textPath> itself
    if (hardFont && fs && nameEl && nameEl !== textEl) { nameEl.style.fontSize = fs; }
    // take the svg that OWNS the text — card 0 also holds the flag svgs
    var svgEl  = nameEl ? (nameEl.closest && nameEl.closest('svg')) : null;
    if (!svgEl) { svgEl = root.querySelector('svg'); }
    var pathEl = svgEl && (svgEl.querySelector('[id^="curve"]') || svgEl.querySelector('path'));

    if (nameEl && nameEl.textContent !== LINE) { nameEl.textContent = LINE; }

    // lock the wrap to the widest language so it stops resizing as the word changes. measured by
    // swapping each name in and reading the box — offsetWidth, not a rect, so a scaled mobile clone
    // still reports layout px.
    var labelWrap = labelEl ? (labelEl.parentElement || labelEl) : null;
    function fitLabelWrap() {
      if (!LABEL_FIXED_W || !labelEl || !labelWrap) { return; }
      var prevText = labelEl.textContent;
      labelWrap.style.width = 'auto';
      var widest = 0;
      for (var i = 0; i < SEGS.length; i++) {
        labelEl.textContent = SEGS[i].name || '';
        if (labelWrap.offsetWidth > widest) { widest = labelWrap.offsetWidth; }
      }
      labelEl.textContent = prevText;
      labelWrap.style.width = (Math.ceil(widest) + LABEL_W_PAD) + 'px';
    }

    // span = rendered length of the line, in arc units. Re-measured after webfonts load + on resize.
    var span = 0, anchorArc = 0;
    function measure() {
      try { fitLabelWrap(); } catch (eW) {}     // must never abort the span measure below
      span = measureSpan(textEl, tpEl);
      var pathLen = 0;
      try { pathLen = pathEl && pathEl.getTotalLength ? pathEl.getTotalLength() : 0; } catch (e2) {}
      if (!pathLen && svgEl && svgEl.viewBox && svgEl.viewBox.baseVal) { pathLen = svgEl.viewBox.baseVal.width; }
      anchorArc = ANCHOR * pathLen;
      if (LANG_DEBUG) { reportPacing(); }
    }
    measure();

    // read-only: what each language ACTUALLY costs. the sweep is linear in CHARACTERS but moves the
    // line in RENDERED px, and Devanagari packs very differently from Latin — so equal char counts
    // don't mean equal time on screen. this prints both so the copy can be tuned against real numbers.
    function reportPacing() {
      if (reportPacing._done || !nameEl) { return; }
      try {
        var meas = nameEl.getSubStringLength ? nameEl : textEl;
        if (!meas || !meas.getSubStringLength || !span) { return; }
        var head = EDGE_FILL ? (SEGS[SEGS.length - 1].text + SEP).length : 0;
        var at = head, rows = [], i, total = 0;
        for (i = 0; i < SEGS.length; i++) {
          var w = meas.getSubStringLength(at, SEGS[i].text.length);
          rows.push({ n: SEGS[i].name, chars: SEGS[i].text.length, px: w });
          total += w;
          at += SEGS[i].text.length + SEP.length;
        }
        if (!total) { return; }
        reportPacing._done = true;
        var dur = LANG_AUTOPLAY_MS[0] || 6000, charTotal = 0;
        for (i = 0; i < rows.length; i++) { charTotal += rows[i].chars; }
        console.log('[languages] card 0 pacing — dur ' + dur + 'ms, span ' + Math.round(span) + 'px');
        for (i = 0; i < rows.length; i++) {
          console.log('  ' + rows[i].n +
            '  chars ' + rows[i].chars + ' (' + Math.round(rows[i].chars / charTotal * 100) + '%)' +
            '  rendered ' + Math.round(rows[i].px) + 'px (' + Math.round(rows[i].px / total * 100) + '%)' +
            '  holds ~' + Math.round(rows[i].chars / charTotal * dur) + 'ms' +
            '  reads as ~' + Math.round(rows[i].px / total * dur) + 'ms');
        }
        console.log('  → to even it, match the RENDERED px column, not the chars');
      } catch (e) {}
    }

    // ---- the sweep runs on SMIL; JS is left with the flag ----
    // Writing x every frame is affordable in Blink and is not in WebKit: this line is ~250 chars
    // across four scripts, and re-solving every glyph against the curve 60 times a second is what
    // made the card stutter there. The motion is a plain constant-speed loop, so the browser can own
    // it outright — the same <animate> the homepage hero has always used. JS still runs per frame,
    // but only to decide which flag is showing, which changes four times a loop.
    var SMIL_OK = (function () {
      try {
        var el = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        return typeof el.beginElement === 'function';
      } catch (e) { return false; }
    }());
    var sweepAnim = null;

    function sweepX(p) {
      var N = SEGS.length;
      var a = MID_FRAC[0], b = MID_FRAC[N - 1];
      if (EDGE_LEAD && EDGE_FILL && N > 1) {
        var half = ((b - a) / (N - 1)) * 0.5 * EDGE_LEAD;
        a -= half; b += half;
      }
      return anchorArc - (a + (b - a) * p) * span;
    }

    function attachSweep() {
      if (!SMIL_OK || !textEl || !(span > 0)) { return false; }
      if (sweepAnim && sweepAnim.parentNode) { sweepAnim.parentNode.removeChild(sweepAnim); }
      var dur = (LANG_AUTOPLAY_MS[0] || 16000) / 1000;
      var a = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      a.setAttribute('attributeName', 'x');
      a.setAttribute('values', sweepX(0) + '; ' + sweepX(1));
      a.setAttribute('dur', dur + 's');
      a.setAttribute('repeatCount', 'indefinite');
      // negative begin starts the loop part-way in, which is what LANG_START used to do
      a.setAttribute('begin', (-(langStart(0) * dur)).toFixed(2) + 's');
      textEl.appendChild(a);
      sweepAnim = a;
      return true;
    }
    attachSweep();

    var lastFlagI = -1;
    function render(progress) {
      if (SEGS.length === 0) { return; }
      var N = SEGS.length;
      var p = Math.max(0, Math.min(1, progress));

      // linear along the STRING (not per-segment), so the sweep keeps a constant speed regardless of how
      // long each language's text is
      var a = MID_FRAC[0], b = MID_FRAC[N - 1];
      // ...but ending ON the last centre gives the first and last language only HALF a dwell each —
      // the loop restarts the instant the last one lands. run half a gap past both ends so every
      // language gets the same time. only safe because EDGE_FILL puts text out there.
      if (EDGE_LEAD && EDGE_FILL && N > 1) {
        var half = ((b - a) / (N - 1)) * 0.5 * EDGE_LEAD;
        a -= half; b += half;
      }
      var ff = a + (b - a) * p;
      // SMIL owns x once attached; writing it here would fight the animation
      if (!sweepAnim && textEl && span > 0) {
        textEl.setAttribute('x', String(anchorArc - ff * span));
      }

      // flag = whichever language's centre is nearest the anchor
      var flagIdx = 0, bestD = Infinity;
      for (var s = 0; s < N; s++) {
        var d = Math.abs(MID_FRAC[s] - ff);
        if (d < bestD) { bestD = d; flagIdx = s; }
      }
      if (flagIdx !== lastFlagI) { setActive(SEGS[flagIdx]); lastFlagI = flagIdx; }
    }

    return {
      render: render,
      // span changes with the breakpoint and after webfonts land, so the keyframes are rebuilt
      measure: function () { measure(); attachSweep(); },
      destroy: function () {
        if (sweepAnim && sweepAnim.parentNode) { sweepAnim.parentNode.removeChild(sweepAnim); }
        sweepAnim = null;
      }
    };
  }

  // ---- card 1: chips → form in → word types → scrolls to the toggles + Add word → form out → chips +1 ----
  function buildCard1(root) {
    if (!root) { return null; }
    var oneV = function (v) { return root.querySelector('[data-vocab="' + v + '"]'); };
    var formEl    = oneV('form');
    var trackEl   = (oneV('track') || (formEl && formEl.querySelector('.lang_inner-card-wrap'))) || null;
    var inputEl   = oneV('input');
    var inputTxt  = inputEl ? (inputEl.querySelector('.lang_input-text') || inputEl) : null;
    var togSpell  = oneV('toggle-spell');
    var knobSpell = togSpell && togSpell.querySelector('[data-vocab-knob]');
    var addBtn    = oneV('add-word');
    // authored in Webflow as a bare add-btn="add-btn", so accept that too — else the click pulse is a
    // silent no-op
    var addNewBtn = oneV('add-btn') || root.querySelector('[add-btn]');
    var listEl    = oneV('list');
    var newChip   = oneV('new-chip');

    // CSS transitions = the "play" of each beat
    if (formEl)  { formEl.style.transformOrigin = 'center bottom'; formEl.style.willChange = 'opacity, transform';
                   formEl.style.transition = 'opacity ' + TRIG_MS + 'ms ease, transform ' + TRIG_MS + 'ms ' + EASE; }
    if (trackEl)   { trackEl.style.transition = 'transform ' + TRIG_MS + 'ms ' + EASE; }
    if (togSpell)  { togSpell.style.transition = 'color ' + TRIG_MS + 'ms ease'; }
    if (knobSpell) { knobSpell.style.transition = 'transform ' + TRIG_MS + 'ms ' + EASE; }
    if (listEl)    { listEl.style.transition = 'opacity ' + TRIG_MS + 'ms ease'; }
    if (newChip)   { newChip.style.transformOrigin = 'center';
                     newChip.style.transition = 'opacity ' + CHIP_MS + 'ms ease, transform ' + CHIP_MS + 'ms ' + BACK; }
    if (addBtn)    { addBtn.style.transition = 'transform 180ms ' + EASE; }
    if (addNewBtn) { addNewBtn.style.transition = 'transform 180ms ' + EASE; }

    var typer = inputTxt ? makeTyper(inputTxt) : null;

    // how far the inner track scrolls — 0 if the form is auto-height instead of a clip window
    var maxScroll = 0;
    function measure() {
      maxScroll = formEl ? Math.max(0, formEl.scrollHeight - formEl.clientHeight) : 0;
    }
    measure();

    // ---- state setters ----
    function setForm(shown, y) {
      if (!formEl) { return; }
      formEl.style.opacity = shown ? '1' : '0';
      formEl.style.transform = 'translateY(' + y + 'px) scale(' + (shown ? 1 : 0.98) + ')';
      formEl.style.pointerEvents = shown ? '' : 'none';
    }
    function setTrack(scrolled) {
      // maxScroll only covers the form's own overflow — C1_SCROLL_EXTRA pushes past it so the toggle
      // row and the Add button clear the bottom edge properly
      var lift = maxScroll + C1_SCROLL_EXTRA;
      if (trackEl && lift > 0) { trackEl.style.transform = 'translateY(' + (scrolled ? -lift : 0) + 'px)'; }
    }
    function setToggle(on) {
      if (!togSpell) { return; }
      togSpell.style.color = on ? TOG_ON : TOG_OFF;
      if (knobSpell) { knobSpell.style.transform = on ? 'translateX(16px)' : 'translateX(0px)'; }
    }
    function setList(vis) { if (listEl) { listEl.style.opacity = vis ? '1' : '0'; } }
    function pulse(el, s) {
      if (!el) { return; }
      el.style.transform = 'scale(' + s + ')';
      window.requestAnimationFrame(function () { el.style.transform = 'scale(1)'; });
    }
    // fast press down, springy release — reads as a real click
    function clickBtn(el) {
      if (!el) { return; }
      el.style.transition = 'transform 90ms ' + EASE;
      el.style.transform = 'scale(0.85)';
      at(120, function () {
        el.style.transition = 'transform 340ms ' + BACK;
        el.style.transform = 'scale(1)';
      });
    }
    function setNewChip(inN) {
      if (!newChip) { return; }
      if (inN) {
        if (!newChip.style.display || newChip.style.display === 'none') {
          newChip.style.display = ''; newChip.style.opacity = '0'; newChip.style.transform = 'scale(0.4) translateY(-6px)';
          window.requestAnimationFrame(function () { newChip.style.opacity = '1'; newChip.style.transform = 'scale(1) translateY(0px)'; });
        } else { newChip.style.opacity = '1'; newChip.style.transform = 'scale(1) translateY(0px)'; }
      } else {
        newChip.style.display = 'none'; newChip.style.opacity = '0'; newChip.style.transform = 'scale(0.6)';
      }
    }

    // ---- timeline: at beat 1 the form SELF-PLAYS on timers, not on scroll ----
    var timers = [];
    function clearSeq() { for (var i = 0; i < timers.length; i++) { window.clearTimeout(timers[i]); } timers = []; }
    function at(ms, fn) { timers.push(window.setTimeout(fn, ms)); }
    function exitY() { return -((formEl ? formEl.offsetHeight : 400) * 1.25 + 60); }

    function toRest() {          // beat 0: chips
      clearSeq();
      setList(true); setForm(false, 40); setToggle(false); setTrack(false); setNewChip(false);
      if (typer) { typer.reset(); }
    }
    function playForm() {        // beat 1: plays itself
      clearSeq();
      setNewChip(false); setList(true); setForm(false, 40); setToggle(false); setTrack(false);
      pulse(addNewBtn, 0.92);                                                   // "Add a new word" click
      at(300,                     function () { setList(false); setForm(true, 0); });    // chips out, form in
      at(650,                     function () { if (typer) { typer.play(VOCAB_WORD, TYPE_MS); } });
      at(650 + TYPE_MS + 250,     function () { setToggle(true); });
      at(650 + TYPE_MS + 800,     function () { setTrack(true); });             // scroll down to the buttons
      at(650 + TYPE_MS + 1300,    function () { clickBtn(addBtn); });
    }
    function toDone() {          // beat 2: form out, chips return with the new word
      clearSeq();
      if (typer) { typer.play(VOCAB_WORD, 1); }
      setToggle(true); setTrack(true);
      setForm(false, exitY());
      setList(true); setNewChip(true);
    }
    function toExit() {          // beat 3: everything out before the loop restarts
      clearSeq();
      setList(false);
      if (newChip) { newChip.style.opacity = '0'; newChip.style.transform = 'scale(0.4) translateY(-6px)'; }
    }

    var lastBeat = -1;
    function render(tp) {
      var beat = beatOf(tp, C1_BEATS);
      if (beat === lastBeat) { return; }
      lastBeat = beat;
      if (beat <= 0) { toRest(); }
      else if (beat === 1) { playForm(); }
      else if (beat === 2) { toDone(); }
      else { toExit(); }
    }

    return { render: render, measure: measure, destroy: clearSeq };
  }

  // ---- card 2: the trigger pill lifts out, the URL rises into its slot, the sentence reflows ----
  function buildCard2(root, clampW) {
    if (!root) { return null; }
    var oneS = function (v) { return root.querySelector('[data-snip="' + v + '"]'); };
    var lineEl = oneS('line');
    var slot = oneS('slot');
    var trig = oneS('trigger');
    var exp  = oneS('expand');
    if (!slot) { return null; }

    // centre the line so the growing slot pushes both sides out equally. NOT text-align centre — the
    // URL inside the pill stays left-aligned.
    if (lineEl) {
      lineEl.style.justifyContent = 'center';
      lineEl.style.flexWrap = 'nowrap';
      // side text gets pushed OUT past the card edge, never shrunk or re-wrapped — else the widening
      // pill lands on top of it
      Array.prototype.forEach.call(lineEl.children, function (ch) {
        if (ch === slot) { return; }
        ch.style.flex = '0 0 auto';
        ch.style.whiteSpace = 'nowrap';
      });
    }

    // the fade overlay must be absolute — in flow it pushes the URL text off-centre
    var grad = exp && exp.querySelector('.lang_gradient');
    if (grad) {
      grad.style.position = 'absolute'; grad.style.top = '0'; grad.style.right = '0'; grad.style.bottom = '0';
      grad.style.pointerEvents = 'none';
    }

    slot.style.position = 'relative';
    slot.style.display = 'inline-block';
    slot.style.verticalAlign = 'middle';
    // GOTCHA: as a flex item the slot shrinks back below the width we set, but the pill inside is
    // absolute and can't shrink with it → the pill overflows the squashed slot and covers the side text.
    slot.style.flex = '0 0 auto';
    slot.style.transition = 'width ' + TRIG_MS + 'ms ' + EASE;   // slot grows → reflow plays
    // both pills centred, so the swap is a straight vertical rise with no diagonal drift
    [trig, exp].forEach(function (el) {
      if (!el) { return; }
      el.style.position = 'absolute';
      el.style.top = '50%'; el.style.left = '50%';
      el.style.whiteSpace = 'nowrap';
      el.style.willChange = 'opacity, transform';
      el.style.transition = 'opacity ' + TRIG_MS + 'ms ease, transform ' + TRIG_MS + 'ms ' + EASE;
    });

    // the whole row fades at the end — side text included, not just the pill. NOT root: the desktop
    // stack owns root's opacity for the card crossfade, and the two would fight.
    var fadeEl = lineEl || slot;
    if (fadeEl) { fadeEl.style.transition = 'opacity ' + C2_FADE_MS + 'ms ease'; }

    // coming back from the fade, the pills have to be put back WITHOUT animating — otherwise the
    // trigger visibly slides down and the slot visibly narrows while the row is fading back in
    var trigTrans = trig ? trig.style.transition : '';
    var expTrans  = exp  ? exp.style.transition  : '';
    var slotTrans = slot ? slot.style.transition : '';
    function resetInstant() {
      if (trig) { trig.style.transition = 'none'; }
      if (exp)  { exp.style.transition  = 'none'; }
      if (slot) { slot.style.transition = 'none'; }
      if (trig) { trig.style.transform = 'translate(-50%,-50%) translateY(0px)'; trig.style.opacity = '1'; }
      if (exp)  { exp.style.transform = 'translate(-50%,-50%) translateY(' + SNIP_RISE + 'px)'; exp.style.opacity = '0'; }
      if (slot && trigW) { slot.style.width = trigW + 'px'; }
      if (slot) { void slot.offsetWidth; }                       // flush, then hand the transitions back
      if (trig) { trig.style.transition = trigTrans; }
      if (exp)  { exp.style.transition  = expTrans; }
      if (slot) { slot.style.transition = slotTrans; }
    }

    // each pill's natural width — the slot sizes to the active one, which drives the reflow
    var trigW = 0, expW = 0, slotH = 0, lastBeat = -1;
    function measure() {
      slotH = 0;
      if (trig) { trigW = trig.offsetWidth; slotH = Math.max(slotH, trig.offsetHeight); }
      if (exp) {
        var d = exp.style.display, o = exp.style.opacity;   // reveal briefly to measure
        exp.style.display = ''; exp.style.opacity = '0';
        if (clampW) { exp.style.maxWidth = 'none'; }
        expW = exp.offsetWidth; slotH = Math.max(slotH, exp.offsetHeight);
        if (clampW) {
          var avail = root.clientWidth || 0;
          if (avail && expW > avail) { expW = avail; }
          exp.style.maxWidth = expW + 'px';
          exp.style.overflow = 'hidden';
        }
        exp.style.display = d; exp.style.opacity = o;
      }
      if (slotH) { slot.style.height = slotH + 'px'; }
      if (lastBeat >= 0 && (trigW || expW)) { slot.style.width = (lastBeat >= 1 ? expW : trigW) + 'px'; }
    }
    measure();

    // beat 0 = rest · 1 = trigger out, room made, URL waiting below · 2 = URL risen into the slot ·
    // 3 = everything fades out where it stands, so the loop restarts from empty rather than cutting
    function render(tp) {
      var beat = beatOf(tp, [C2_LIFT, C2_RISE, C2_OUT]);
      var wasBeat = lastBeat;
      lastBeat = beat;
      // beat 3 fades the ROW — the pills hold their pose underneath it, so nothing moves while it goes
      if (fadeEl) { fadeEl.style.opacity = (beat === 3) ? '0' : '1'; }
      if (beat === 0 && wasBeat === 3) { resetInstant(); }        // restart: pose back, invisibly
      if (beat === 3) { return; }                                 // leave everything as the fade found it

      var urlIn = (beat === 2);
      if (trig) {
        trig.style.transform = 'translate(-50%,-50%) translateY(' + (beat === 0 ? 0 : -SNIP_RISE) + 'px)';
        trig.style.opacity = urlIn ? '0' : '1';
      }
      if (exp) {
        exp.style.transform = 'translate(-50%,-50%) translateY(' + (urlIn ? 0 : SNIP_RISE) + 'px)';
        exp.style.opacity = (beat >= 1) ? '1' : '0';
      }
      // the slot grows at beat 1, BEFORE the URL rises, so the URL lands straight instead of from the right
      if (trigW || expW) { slot.style.width = (beat >= 1 ? expW : trigW) + 'px'; }
    }

    return {
      render: render,
      measure: measure,
      destroy: function () {
        slot.style.width = ''; slot.style.height = '';
        if (exp && clampW) { exp.style.maxWidth = ''; exp.style.overflow = ''; }
      }
    };
  }

  // ---- card 3: cycle Formal → Casual → Very casual; message waves in, active button takes is-active ----
  function buildCard3(root) {
    if (!root) { return null; }
    var btns = root.querySelectorAll('[data-tone]');
    Array.prototype.forEach.call(btns, function (b) {
      b.style.transition = 'background-color ' + TRIG_MS + 'ms ease, color ' + TRIG_MS + 'ms ease';
    });
    if (!btns.length) { console.warn('[languages] card 3: no [data-tone] buttons found'); }

    // one el per tone, [data-tone-msg="0|1|2"] or the tone key, so the copy stays editable in Webflow.
    // Fallback: a single untagged [data-tone-msg] → JS swaps its text from TONES.
    var msgList = root.querySelectorAll('[data-tone-msg]');
    var msgByTone = [];
    Array.prototype.forEach.call(msgList, function (el) {
      var v = el.getAttribute('data-tone-msg');
      var idx = parseInt(v, 10);
      if (isNaN(idx)) { for (var k = 0; k < TONES.length; k++) { if (TONES[k].key === v) { idx = k; break; } } }
      if (idx >= 0 && !isNaN(idx)) { msgByTone[idx] = el; }
    });
    var authored = msgByTone.filter(Boolean).length >= 2;
    var single = (!authored && msgList.length === 1) ? msgList[0] : null;
    var wrap = null, msgSpans = [], measure = function () {};

    if (authored) {
      // stack the messages in ONE GRID CELL so they can crossfade. Grid, not absolute: the wrapper keeps
      // sizing itself (width = its normal box, height = the tallest message, padding native). Absolute
      // collapsed the wrapper, which forced px locks and shrank the box to a text column when narrow.
      var kept = msgByTone.filter(Boolean);
      wrap = kept[0].parentNode;
      if (wrap) {
        wrap.style.display = 'grid';
        wrap.style.boxSizing = 'border-box';
      }
      msgByTone.forEach(function (el, t) {
        if (!el) { return; }
        el.style.gridArea = '1 / 1';
        el.style.whiteSpace = 'pre-line';
        msgSpans[t] = waveWrap(el, WAVE_STAGGER);
      });
    } else if (single) {
      single.style.whiteSpace = 'pre-line'; single.style.willChange = 'opacity, transform';
      single.style.transition = 'opacity ' + TRIG_MS + 'ms ease';
    }

    var lastActive = -1;
    // active tone = which third of the slice we're in
    function render(tp) {
      var N = TONES.length;
      var active = Math.max(0, Math.min(N - 1, Math.floor(Math.max(0, Math.min(1, tp)) * N)));

      if (authored) {
        // the messages share one grid cell, so an outgoing word and an incoming word occupy the same
        // spot. staggering BOTH left the two texts legible on top of each other — the old one clears
        // fast and all at once, and only then does the new one wave in.
        var lag = (lastActive === -1) ? 0 : (TONE_OUT_MS + TONE_IN_LAG);
        for (var t = 0; t < N; t++) {
          var spans = msgSpans[t];
          if (!spans) { continue; }
          var on = (t === active);
          for (var w = 0; w < spans.length; w++) {
            var sp = spans[w];
            if (on) {
              sp.style.transitionDuration = TONE_IN_MS + 'ms, ' + TONE_IN_MS + 'ms';
              sp.style.transitionDelay = (lag + w * WAVE_STAGGER) + 'ms';
            } else {
              sp.style.transitionDuration = TONE_OUT_MS + 'ms, ' + TONE_OUT_MS + 'ms';
              sp.style.transitionDelay = '0ms';                  // no wave on the way out
            }
            sp.style.opacity = on ? '1' : '0';
            sp.style.transform = on ? 'translateY(0px)' : 'translateY(8px)';
          }
        }
      } else if (single) {
        if (active !== lastActive) { single.textContent = TONES[active].text; }
        single.style.opacity = '1';
      }

      if (active !== lastActive) {
        for (var b = 0; b < btns.length; b++) {
          var v = btns[b].getAttribute('data-tone');
          // match by ORDER as well as value/key, so a mistagged button still activates
          btns[b].classList.toggle(ACTIVE_CLASS, b === active || v === String(active) || v === TONES[active].key);
        }
        lastActive = active;
      }
    }

    return {
      render: render,
      measure: measure,
      destroy: function () { if (wrap) { wrap.style.display = ''; } }
    };
  }

  function buildCard(idx, root, opts) {
    opts = opts || {};
    if (idx === 0) { return buildCard0(root, opts.pathFont, opts.hardFont); }
    if (idx === 1) { return buildCard1(root); }
    if (idx === 2) { return buildCard2(root, opts.clampW); }
    if (idx === 3) { return buildCard3(root); }
    return null;
  }

  // ==========================================================================
  // DESKTOP driver — scroll list index (mwg effect105). The .lang_card--wrap stays put (sticky in
  // Webflow; untouched here) while the .lang_anim-text-wrap blocks scroll past. Nearest block to the
  // viewport centre is active → its card crossfades in and plays. Runs off getBoundingClientRect each
  // frame, no pin or spacer.
  // ==========================================================================

  // ---- desktop layout config ----
  var FORCE_TIGHT = true;  // collapse per-block 100vh → natural height, so blocks stack tight. false =
                           // respect the authored heights (strip the 100vh in Webflow yourself)
  var LEAD_TOP_VH    = 0.15;  // blank scroll before the first block
  var LEAD_BOTTOM_VH = 0.02;   // blank scroll after the last. lower = section ends earlier with the last
                              // text still visible → next section peeks in
  var START_LIFT_VH  = 0.72;
  var END_ALIGN      = true;
  var END_LINE_VH    = 0.5;
  var GAP_VH     = 0;      // extra gap between blocks, in viewports. 0 = tight Webflow stacking. raise it
                           // to give each card a longer reign at centre
  var GAP_PX     = 24;     // fixed px gap between blocks — takes precedence over GAP_VH. 0 = use GAP_VH
  var STATIC_BLOCKS = true;
  var LAST_STICK  = true;
  var FIRST_STICK = true;
  var DRIFT_FRAC = 0.12;   // sideways drift at centre, as a fraction of column width. 0 = off, negative
                           // flips the side. this pushes the block AWAY from the card at centre, so it's
                           // the main control on how big that gap reads
  // entry sweep: a block starts this far LEFT of its slot and swings in, reaching the DRIFT_FRAC spot at
  // centre — so the landing position is unchanged, only the travel into it grows.
  var ENTER_FRAC  = 0.16;  // how far left, as a fraction of column width. 0 = off (old symmetric drift)
  var ENTER_Y_VH  = 0.06;  // extra downward offset at entry, in viewports — makes the path diagonal
  var ENTER_CURVE = 2.2;   // >1 holds the offset low in the viewport, so the path swings in late
  var ENTER_FIRST = 0;     // multiplier for block 0 — it's already near centre when the section arrives,
                           // so a full sweep has nowhere to travel from and just pops
  var ENTER_LAST  = 0.6;
  var DRIFT_RIGID = true;
  var FIRST_X_HOLD = true;
  var LAST_X_HOLD  = true;
  var CARD_CLEAR  = 12;    // px a block must keep clear of the card's right edge. it may NEVER cross —
                           // this is the hard floor on the gap, so it's what stops an overlap
  var DIM_ALPHA  = 0.35;   // opacity of the non-active text blocks
  // when a block takes over (card swap + un-dim). the handover line sits at the CARD's centre, so the
  // two are level at the moment it fires — not at the viewport centre, which can be somewhere else.
  var ACTIVE_LINE_CARD = true;
  var ACTIVE_DELAY_VH  = 0.08;  // viewports LATER than that line. bigger = the block rises further first
  var POP_SCALE  = 1.04;      // scale-pop of the card wrap on swap (1 = off; try 1.04)
  var LANG_AUTOPLAY = true;   // cards play on a timer when active instead of scrubbing to scroll
  var LANG_REPLAY   = true;   // replay from the start whenever a block becomes active again
  var LANG_LOOP     = true;   // active card loops while active
  var LANG_SCRUB    = [];     // card indices kept scrubbed to scroll ([] = all autoplay)

  function langIsAuto(i) { return LANG_AUTOPLAY && LANG_SCRUB.indexOf(i) === -1; }

  // triangle 0→1→0 peaking at p=0.5, smoothstepped so the drift eases in/out
  function easeTri(p) {
    var t = 1 - Math.abs(2 * p - 1);
    return t * t * (3 - 2 * t);
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function initDesktop(section, cardEls) {
    var cards = [], renderers = {};
    for (var ci = 0; ci < cardEls.length; ci++) {
      var built = buildCard(ci, cardEls[ci], { hardFont: LANG_PATH_HARD });
      if (built) { cards[ci] = built; renderers[ci] = built.render; }
    }

    var cardWrap = cardEls[0] ? cardEls[0].parentNode : section;
    if (CARD_STACK) {
      // overlay the cards so they can crossfade. Width spans the column, height stays natural — NOT
      // stretched to fill, which would blow the card up to the whole 100vh column.
      for (var c = 0; c < cardEls.length; c++) {
        var ce = cardEls[c];
        if (!ce) { continue; }
        ce.style.position  = 'absolute';
        ce.style.left = '0'; ce.style.right = '0';
        ce.style.top = '50%';
        ce.style.transform = 'translateY(-50%)';
        ce.style.transition = 'opacity ' + CARD_FADE_MS + 'ms ease';
        ce.style.willChange = 'opacity';
      }
    }

    // seed the switcher so its text is there the moment you scroll in, never an unseeded frame
    if (renderers[0]) { renderers[0](langStart(0)); }
    if (cardEls[0]) { cardEls[0].style.opacity = '1'; }

    var textWrap = section.querySelector('.lang_text-anim-wrap');
    var blocks   = textWrap
      ? Array.prototype.slice.call(textWrap.querySelectorAll('.lang_anim-text-wrap'))
      : [];

    // pad the track so the first block can reach the centre and the last can leave it, while the blocks
    // themselves stay tightly stacked (GAP_VH 0) with several visible at once
    function layout() {
      if (!textWrap || !blocks.length) { return; }
      var vh = window.innerHeight;
      textWrap.style.paddingTop = (vh * LEAD_TOP_VH) + 'px';
      textWrap.style.paddingBottom = (vh * LEAD_BOTTOM_VH) + 'px';
      textWrap.style.transform = 'translateY(' + (-vh * START_LIFT_VH) + 'px)';
      if (END_ALIGN && section) {
        var lineY = vh * END_LINE_VH;
        var secR  = section.getBoundingClientRect();
        var lastR = blocks[blocks.length - 1].getBoundingClientRect();
        var relLast = (lastR.top + lastR.height / 2) - secR.top;
        var curPB = parseFloat(window.getComputedStyle(textWrap).paddingBottom) || 0;
        var curMB = parseFloat(window.getComputedStyle(textWrap).marginBottom) || 0;
        var pb = relLast - lineY + vh - secR.height + curPB + curMB;
        textWrap.style.paddingBottom = (pb > 0 ? pb : 0) + 'px';
        textWrap.style.marginBottom  = (pb < 0 ? pb : 0) + 'px';
        if (LANG_DEBUG) {
          console.log('[languages] end align: relLast=' + Math.round(relLast) + ' sectionH=' +
            Math.round(secR.height) + ' line=' + Math.round(lineY) +
            ' -> ' + (pb < 0 ? ('trim ' + Math.round(-pb) + 'px') : ('pad ' + Math.round(pb) + 'px')));
        }
      }
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        b.style.position = 'relative';
        b.style.willChange = 'transform, opacity';
        if (FORCE_TIGHT) {
          b.style.minHeight = '0';
          b.style.height = 'auto';
        }
        if (i < blocks.length - 1) {
          b.style.marginBottom = GAP_PX > 0 ? (GAP_PX + 'px')
            : (GAP_VH > 0 ? (vh * GAP_VH) + 'px' : '');
        }
      }
    }
    layout();

    // smoothed per-block scalars so the drift glides and settles on stop. Active detection stays on the
    // RAW rect so the card swap never lags behind.
    var driftCur = [], yCur = [], tpCur = [], natOff = [], natH_ = [], lastActive = -1;
    for (var bi = 0; bi < blocks.length; bi++) { driftCur[bi] = 0; yCur[bi] = 0; tpCur[bi] = 0; }
    function measureNatural() {
      if (!textWrap || !blocks.length) { return; }
      var saved = [];
      for (var m = 0; m < blocks.length; m++) { saved[m] = blocks[m].style.transform; blocks[m].style.transform = 'none'; }
      var wt = textWrap.getBoundingClientRect().top;
      for (var q = 0; q < blocks.length; q++) {
        var br = blocks[q].getBoundingClientRect();
        natOff[q] = br.top - wt;
        natH_[q]  = br.height;
      }
      for (var z = 0; z < blocks.length; z++) { blocks[z].style.transform = saved[z]; }
    }
    measureNatural();
    var autoTp = 0, autoDone = {};

    function update() {
      if (!blocks.length) { if (renderers[0]) { renderers[0](0); } return; }
      var vh = window.innerHeight, cY = vh / 2;
      var colW   = textWrap.clientWidth || 0;
      var offset = DRIFT_FRAC * colW;
      var enter  = ENTER_FRAC * colW;
      var lerp = (SCRUB_LERP >= 1) ? 1 : (1 - Math.pow(1 - SCRUB_LERP, gsap.ticker.deltaRatio()));
      // the visible CARD, not its wrap: the wrap is the sticky column and can be a full viewport tall,
      // which would clamp blocks that are nowhere near the card
      var cardR = null;
      var cardBox = cardEls[lastActive >= 0 ? lastActive : 0] || cardWrap;
      if (cardBox) {
        var cwr = cardBox.getBoundingClientRect();
        if (cwr.width && cwr.height) { cardR = cwr; }
      }

      // the line a block has to reach to take over. anchored to the CARD's own centre rather than the
      // viewport's (the sticky column can put them at different heights), then pushed up by
      // ACTIVE_DELAY_VH — blocks travel upward, so a higher line means they take over later.
      var lineY = (ACTIVE_LINE_CARD && cardR ? (cardR.top + cardR.height / 2) : cY) - ACTIVE_DELAY_VH * vh;

      var wrapTop = textWrap.getBoundingClientRect().top;
      var lerpOn = !STATIC_BLOCKS;
      var closest = -1, closestDist = Infinity;
      for (var i = 0; i < blocks.length; i++) {
        var natTop = wrapTop + (natOff[i] || 0);
        var natH   = natH_[i] || blocks[i].offsetHeight;
        var r = { top: natTop, height: natH };
        var prog = clamp01((vh - r.top) / (vh + r.height));            // 0 entering the bottom, 1 exiting the top
        var tpT  = r.height ? clamp01((cY - r.top) / r.height) : 0;    // 0 at the block's top, 1 at its bottom

        // prog 0 = entering the bottom, 0.5 = centred, 1 = gone off the top. the entry term is spent by
        // 0.5, so from centre onward the motion is exactly the old drift.
        var inT  = clamp01(prog / 0.5);
        var ramp = Math.pow(1 - inT, ENTER_CURVE);
        var enterI = (i === 0) ? ENTER_FIRST : ((i === blocks.length - 1) ? ENTER_LAST : 1);
        var xE = DRIFT_RIGID ? 1 : easeTri(prog);
        if (FIRST_X_HOLD && i === 0 && prog < 0.5) { xE = 1; }
        if (LAST_X_HOLD && i === blocks.length - 1 && prog > 0.5) { xE = 1; }
        var xT  = offset * xE - enter * enterI * ramp;
        var yT  = ENTER_Y_VH * vh * enterI * ramp;
        var prevX = driftCur[i];
        if (lerpOn) {
          driftCur[i] += (xT - prevX) * lerp;
          yCur[i]     += (yT - yCur[i]) * lerp;
        }
        tpCur[i]    += (tpT - tpCur[i]) * lerp;
        if (Math.abs(tpT - tpCur[i]) < 0.0002) { tpCur[i] = tpT; }

        // hard limit on the PAINTED value, not the target: on a fast scroll the eased value trails the
        // target, which is how the text got on top of the card. only while level with it, so the
        // bottom-left entry stays free.
        if (cardR && r.bottom > cardR.top && r.top < cardR.bottom) {
          var minX = (cardR.right + CARD_CLEAR) - (r.left - prevX);
          if (minX > 0) { minX = 0; }                       // never push a block right of its slot
          if (driftCur[i] < minX) { driftCur[i] = minX; }
        }

        var yOut = yCur[i];
        if (STATIC_BLOCKS) {
          if (blocks[i].style.transform) { blocks[i].style.transform = ''; }
        } else {
        if (cardR && (LAST_STICK && i === blocks.length - 1 || FIRST_STICK && i === 0)) {
          var natural = natTop + natH / 2;
          var hold = (cardR.top + cardR.height / 2) - natural;
          if (i === 0 ? hold < 0 : hold > 0) { yOut = yCur[i] + hold; }
        }
        blocks[i].style.transform = 'translate(' + driftCur[i] + 'px,' + yOut + 'px)';
        }
        // scrubbed cards follow their block's scroll progress, offset by langStart
        if (renderers[i] && !langIsAuto(i)) { renderers[i](langStart(i) + (1 - langStart(i)) * tpCur[i]); }

        // nearest block midpoint to the ALIGNMENT LINE = active (see activeLine)
        var d = Math.abs(r.top + r.height / 2 - lineY);
        if (d < closestDist) { closestDist = d; closest = i; }
      }

      if (closest !== lastActive) {
        for (var k = 0; k < cardEls.length; k++) {          // crossfade to the matching card
          var el = cardEls[k];
          if (!el) { continue; }
          el.style.opacity = (k === closest) ? '1' : '0';
          el.style.pointerEvents = (k === closest) ? '' : 'none';
        }
        for (var b2 = 0; b2 < blocks.length; b2++) {         // dim everything but the active block
          gsap.set(blocks[b2], { autoAlpha: b2 === closest ? 1 : DIM_ALPHA });
        }
        if (POP_SCALE !== 1 && cardWrap) {
          gsap.fromTo(cardWrap, { scale: POP_SCALE }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
        }
        for (var rr = 0; rr < cardEls.length; rr++) {         // rewind the autoplay cards
          if (renderers[rr] && langIsAuto(rr)) { renderers[rr](langStart(rr)); }
        }
        autoTp = (!LANG_REPLAY && autoDone[closest]) ? 1 : langStart(closest);
        lastActive = closest;
      }

      // the active card plays on a timer; scrubbed cards were handled in the loop above
      if (closest >= 0 && langIsAuto(closest) && renderers[closest]) {
        if (autoTp < 1 || LANG_LOOP) {
          var dur = LANG_AUTOPLAY_MS[closest] || 2500;
          autoTp += (gsap.ticker.deltaRatio() * (1000 / 60)) / dur;
          if (autoTp >= 1) { if (LANG_LOOP) { autoTp = langStart(closest); } else { autoTp = 1; autoDone[closest] = true; } }
        }
        renderers[closest](autoTp);
      }
    }
    window.langStatic = function (v) {
      STATIC_BLOCKS = !!v;
      console.log('[languages] STATIC_BLOCKS =', STATIC_BLOCKS);
    };
    gsap.ticker.add(update);

    // re-space + re-measure on viewport/webfont changes
    function refreshAll() {
      layout();
      measureNatural();
      for (var m = 0; m < cards.length; m++) { if (cards[m]) { cards[m].measure(); } }
      lastActive = -1;
    }
    ScrollTrigger.addEventListener('refresh', refreshAll);
    var fontsHook = function () { refreshAll(); };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(fontsHook); }

    window.Languages = { render: update, relayout: layout, remeasure: refreshAll };

    update();

    return function cleanup() {
      gsap.ticker.remove(update);
      ScrollTrigger.removeEventListener('refresh', refreshAll);
      for (var d = 0; d < cards.length; d++) { if (cards[d]) { cards[d].destroy(); } }
      for (var cc = 0; cc < cardEls.length; cc++) {
        var e = cardEls[cc];
        if (!e) { continue; }
        e.style.position = ''; e.style.left = ''; e.style.right = ''; e.style.top = '';
        e.style.transform = ''; e.style.transition = ''; e.style.willChange = '';
        e.style.opacity = ''; e.style.pointerEvents = '';
      }
      if (textWrap) { textWrap.style.paddingTop = ''; textWrap.style.paddingBottom = ''; textWrap.style.transform = ''; }
      for (var bb = 0; bb < blocks.length; bb++) {
        var bl = blocks[bb];
        bl.style.transform = ''; bl.style.opacity = ''; bl.style.visibility = '';
        bl.style.minHeight = ''; bl.style.height = ''; bl.style.marginBottom = ''; bl.style.willChange = '';
      }
    };
  }

  // ==========================================================================
  // MOBILE driver — no scroll-list. Desktop card wrap + text column hidden; each block gets a CLONE of
  // its card and loops it while in view. Leaving the viewport rewinds, so scrolling back replays.
  // ==========================================================================
  function initMobile(section, cardEls) {
    var host = section.querySelector(MOBILE_SEL) || document.querySelector(MOBILE_SEL);
    if (!host) { console.warn('[languages] mobile: no ' + MOBILE_SEL + ' found'); return function () {}; }

    var playBlocks = Array.prototype.slice.call(host.querySelectorAll(MOBILE_BLOCK_SEL));
    if (!playBlocks.length) { console.warn('[languages] mobile: no ' + MOBILE_BLOCK_SEL + ' inside the mobile wrap'); }

    // hide the desktop rig. The clone SOURCE ends up inside a display:none ancestor, which is fine — the
    // clones live outside it and measure normally.
    var cardWrap = cardEls[0] ? cardEls[0].parentNode : null;
    var textWrap = section.querySelector('.lang_text-anim-wrap');
    var hidden = [];
    [cardWrap, textWrap].forEach(function (el) {
      if (!el) { return; }
      hidden.push([el, el.style.display]);
      el.style.display = 'none';
    });
    host.style.display = '';

    var items = [];
    playBlocks.forEach(function (block, order) {
      // index = data-lang-play if authored, else the block's position in the stack
      var attrI = parseInt(block.getAttribute(ATTR + '-play'), 10);
      var idx   = isNaN(attrI) ? order : attrI;
      var slot  = block.querySelector(MOBILE_SLOT_SEL) || block;

      // a card pasted into the slot by hand is driven as-is
      var pasted = slot.querySelector('[' + ATTR + '-anim]');
      var el = pasted, clone = null;
      if (!el) {
        var src = cardEls[idx];
        if (!src) { console.warn('[languages] mobile: no [' + ATTR + '-anim="' + idx + '"] to clone for block ' + order); return; }
        clone = src.cloneNode(true);
        uniqIds(clone, 'lm' + idx);
        clone.setAttribute(ATTR + '-anim-clone', String(idx));
        clone.removeAttribute(ATTR + '-anim');            // so nothing re-collects it as a desktop card
        // relative, not static: inner pieces (card 1's .lang_form-wrap) are absolute against the card,
        // which WAS absolute on desktop — static here would anchor them to some outer ancestor.
        clone.style.position = 'relative';
        clone.style.left = ''; clone.style.right = ''; clone.style.top = '';
        clone.style.transform = ''; clone.style.transition = ''; clone.style.opacity = '';
        clone.style.pointerEvents = '';
        slot.appendChild(clone);
        el = clone;
      }

      // set the design width BEFORE the card measures itself, so card 2's pill widths and card 3's
      // message box are measured in design space, not the live slot width
      if (MOBILE_FIT_W) { el.style.width = MOBILE_FIT_W + 'px'; }

      var card = buildCard(idx, el, {
        pathFont: MOBILE_PATH_FONT || LANG_PATH_FONT,
        hardFont: !!MOBILE_PATH_FONT,
        clampW:   MOBILE_SNIP_FIT
      });
      if (!card) { return; }
      card.render(langStart(idx));                      // seeded, so it never shows a blank frame
      items.push({ block: block, clone: clone, el: el, slot: slot, card: card, idx: idx, tp: langStart(idx), on: false });
    });

    // scale from design width to slot width, then reserve the SCALED height — a transform doesn't affect
    // layout, so the slot would otherwise keep the unscaled box
    function fit(it) {
      if (!MOBILE_FIT_W) { return; }
      var avail = it.slot.clientWidth || it.slot.offsetWidth || 0;
      if (!avail) { return; }
      var k = avail / MOBILE_FIT_W;
      it.el.style.width = MOBILE_FIT_W + 'px';
      it.el.style.transformOrigin = 'top left';         // so the scaled box starts at the slot's left edge
      it.el.style.transform = 'scale(' + k + ')';
      it.slot.style.height = (it.el.offsetHeight * k) + 'px';
    }
    items.forEach(fit);

    var io = null;
    if (window.IntersectionObserver && items.length) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          for (var i = 0; i < items.length; i++) {
            if (items[i].block !== en.target) { continue; }
            if (en.isIntersecting) {
              items[i].on = true;
            } else {                                    // out of view → rewind for the next entry
              items[i].on = false;
              items[i].tp = langStart(items[i].idx);
              items[i].card.render(items[i].tp);
            }
            break;
          }
        });
      }, { threshold: 0, rootMargin: '0px 0px ' + MOBILE_IO_MARGIN + ' 0px' });
      items.forEach(function (it) { io.observe(it.block); });
    } else {
      items.forEach(function (it) { it.on = true; });    // no IO → just play
    }

    function tick() {
      var step = gsap.ticker.deltaRatio() * (1000 / 60);
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.on) { continue; }
        var dur = MOBILE_MS[it.idx] || LANG_AUTOPLAY_MS[it.idx] || 2500;
        if (it.tp < 1 || MOBILE_LOOP) {
          it.tp += step / dur;
          if (it.tp >= 1) { it.tp = MOBILE_LOOP ? langStart(it.idx) : 1; }
        }
        it.card.render(it.tp);
      }
    }
    gsap.ticker.add(tick);

    function remeasure() {
      items.forEach(function (it) {
        if (MOBILE_FIT_W) { it.el.style.transform = ''; }   // measure unscaled, then re-fit
        it.card.measure();
        fit(it);
      });
    }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(remeasure); }
    ScrollTrigger.addEventListener('refresh', remeasure);

    window.Languages = { render: tick, relayout: remeasure, remeasure: remeasure };

    return function cleanup() {
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener('refresh', remeasure);
      if (io) { io.disconnect(); }
      items.forEach(function (it) {
        it.card.destroy();
        it.slot.style.height = '';
        if (it.clone && it.clone.parentNode) { it.clone.parentNode.removeChild(it.clone); }
        else { it.el.style.width = ''; it.el.style.transform = ''; it.el.style.transformOrigin = ''; }
      });
      hidden.forEach(function (pair) { pair[0].style.display = pair[1]; });
    };
  }

  // hide the mobile block on desktop from the first paint (before JS decides which mode runs)
  function injectCSS() {
    if (document.getElementById('lang-mode-css')) { return; }
    var st = document.createElement('style');
    st.id = 'lang-mode-css';
    st.textContent = '@media (min-width:' + (MOBILE_BP + 1) + 'px){' + MOBILE_SEL + '{display:none !important;}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[languages] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var section = document.querySelector('[' + ATTR + '="section"]');
    if (!section) { console.warn('[languages] no [data-lang="section"] found'); return; }
    injectCSS();

    // collect every [data-lang-anim] by its index (the clone source for mobile too)
    var cardWrap = section.querySelector('[' + ATTR + '-anim="0"]');
    cardWrap = cardWrap ? cardWrap.parentNode : section;
    var cardEls = [];
    Array.prototype.forEach.call(cardWrap.querySelectorAll('[' + ATTR + '-anim]'), function (el) {
      var idx = parseInt(el.getAttribute(ATTR + '-anim'), 10);
      if (!isNaN(idx)) { cardEls[idx] = el; }
    });

    // one rig at a time; crossing the breakpoint tears the old one down and builds the other
    var mm = gsap.matchMedia();
    mm.add('(min-width: ' + (MOBILE_BP + 1) + 'px)', function () { return initDesktop(section, cardEls); });
    mm.add('(max-width: ' + MOBILE_BP + 'px)',       function () { return initMobile(section, cardEls); });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

}());
