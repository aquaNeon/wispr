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
  var SEGS = [
    { text: 'I’m getting started with the project. Here are a few options.', name: 'English',  code: 'us', flag: '🇺🇸' },
    { text: 'Wie möchten Sie die Datei einrichten.',                          name: 'Deutsch',  code: 'de', flag: '🇩🇪' },
    { text: 'Ecco alcune opzioni. Sto iniziando.',                            name: 'Español',  code: 'es', flag: '🇪🇸' }, // NB text is Italian, flag/name=es per your list — fix one
    { text: 'प्रोजेक्ट पर काम शुरू हो गया, आप किस तरह से चाहेंगे। प्रोजेक्ट पर काम शुरू हो गया, आप किस तरह से चाहेंगे', name: 'हिन्दी',    code: 'in', flag: '🇮🇳' }
  ];

  // ---- config ----
  var SCRUB_LERP = 0.08;    // scrub easing — lower = more trailing glide (1 = instant)
  var ANCHOR     = 0.5;     // point along the curve (0..1) each language parks at
  var LANG_PATH_FONT = '14px';   // switcher curved-text size ('' = leave to CSS)

  // ---- cards (desktop stacking) ----
  var CARD_FADE_MS = 220;   // crossfade between cards (ms)
  var CARD_STACK   = true;  // JS overlays the cards so they can crossfade; false = you stack them yourself

  // ---- card 1 (Add to vocabulary) ----
  var VOCAB_WORD = 'Wispr Flow';   // the word typed into the input (JS owns it)
  var TOG_OFF    = '#d8d6cc';      // toggle track colour OFF
  var TOG_ON     = '#1a1a1a';      // toggle track colour ON

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
  var ACTIVE_CLASS = 'is-active';              // marks the active tone button (card 3)
  var WAVE_STAGGER = 45;                       // card 3: ms delay per word
  var EASE     = 'cubic-bezier(.4,0,.2,1)';
  var BACK     = 'cubic-bezier(.34,1.56,.64,1)';

  // ---- playback (both modes) ----
  var LANG_AUTOPLAY_MS = [6000, 9000, 4500, 5000];   // per-card duration (ms); card 1 longest, see C1_BEATS
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

  // card-0's joined line + each segment's centre as a fraction of it (shared by desktop card + clones)
  var LINE = '', MID_FRAC = [];
  (function buildLine() {
    var starts = [];
    for (var s = 0; s < SEGS.length; s++) {
      starts[s] = LINE.length;
      LINE += SEGS[s].text;
      if (s < SEGS.length - 1) { LINE += SEP; }
    }
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
    var textEl = null;
    if (nameEl) {
      textEl = (nameEl.tagName && nameEl.tagName.toLowerCase() === 'textpath') ? nameEl.parentNode : nameEl;
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

    // span = rendered length of the line, in arc units. Re-measured after webfonts load + on resize.
    var span = 0, anchorArc = 0;
    function measure() {
      try { span = textEl && textEl.getComputedTextLength ? textEl.getComputedTextLength() : 0; }
      catch (e) { span = 0; }
      var pathLen = 0;
      try { pathLen = pathEl && pathEl.getTotalLength ? pathEl.getTotalLength() : 0; } catch (e2) {}
      if (!pathLen && svgEl && svgEl.viewBox && svgEl.viewBox.baseVal) { pathLen = svgEl.viewBox.baseVal.width; }
      anchorArc = ANCHOR * pathLen;
    }
    measure();

    var lastFlagI = -1;
    function render(progress) {
      if (SEGS.length === 0) { return; }
      var N = SEGS.length;
      var p = Math.max(0, Math.min(1, progress));

      // linear along the STRING (not per-segment), so the sweep keeps a constant speed regardless of how
      // long each language's text is
      var ff = MID_FRAC[0] + (MID_FRAC[N - 1] - MID_FRAC[0]) * p;
      if (textEl && span > 0) {
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

    return { render: render, measure: measure, destroy: function () {} };
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
      if (trackEl && maxScroll > 0) { trackEl.style.transform = 'translateY(' + (scrolled ? -maxScroll : 0) + 'px)'; }
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

    // beat 0 = rest · 1 = trigger out, room made, URL waiting below · 2 = URL risen into the slot
    function render(tp) {
      var beat = beatOf(tp, [C2_LIFT, C2_RISE]);
      lastBeat = beat;
      if (trig) {
        trig.style.transform = 'translate(-50%,-50%) translateY(' + (beat === 0 ? 0 : -SNIP_RISE) + 'px)';
        trig.style.opacity = (beat >= 2) ? '0' : '1';
      }
      if (exp) {
        exp.style.transform = 'translate(-50%,-50%) translateY(' + (beat >= 2 ? 0 : SNIP_RISE) + 'px)';
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
        for (var t = 0; t < N; t++) {
          var spans = msgSpans[t];
          if (!spans) { continue; }
          var on = (t === active);
          for (var w = 0; w < spans.length; w++) {
            spans[w].style.opacity = on ? '1' : '0';
            spans[w].style.transform = on ? 'translateY(0px)' : 'translateY(8px)';
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
  var LEAD_BOTTOM_VH = 0.1;   // blank scroll after the last. lower = section ends earlier with the last
                              // text still visible → next section peeks in
  var START_LIFT_VH  = 0.45;  // lift the text column so block 0 enters near centre (higher = higher)
  var GAP_VH     = 0;      // extra gap between blocks, in viewports. 0 = tight Webflow stacking. raise it
                           // to give each card a longer reign at centre
  var DRIFT_FRAC = 0.2;    // sideways drift at centre, as a fraction of column width. 0 = off, negative
                           // flips the side
  // entry sweep: a block starts this far LEFT of its slot and swings in, reaching the DRIFT_FRAC spot at
  // centre — so the landing position is unchanged, only the travel into it grows.
  var ENTER_FRAC  = 0.22;  // how far left, as a fraction of column width. 0 = off (old symmetric drift)
  var ENTER_Y_VH  = 0.06;  // extra downward offset at entry, in viewports — makes the path diagonal
  var ENTER_CURVE = 2.2;   // >1 holds the offset low in the viewport, so the path swings in late
  var ENTER_FIRST = 0;     // multiplier for block 0 — it's already near centre when the section arrives,
                           // so a full sweep has nowhere to travel from and just pops
  var CARD_CLEAR  = 24;    // px a block must keep clear of the card's right edge. it may NEVER cross
  var DIM_ALPHA  = 0.35;   // opacity of the non-active text blocks
  var POP_SCALE  = 1;      // scale-pop of the card wrap on swap (1 = off; try 1.04)
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
      var built = buildCard(ci, cardEls[ci]);
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
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        b.style.position = 'relative';
        b.style.willChange = 'transform, opacity';
        if (FORCE_TIGHT) {
          b.style.minHeight = '0';
          b.style.height = 'auto';
        }
        if (i < blocks.length - 1) { b.style.marginBottom = (GAP_VH > 0 ? (vh * GAP_VH) + 'px' : ''); }
      }
    }
    layout();

    // smoothed per-block scalars so the drift glides and settles on stop. Active detection stays on the
    // RAW rect so the card swap never lags behind.
    var driftCur = [], yCur = [], tpCur = [], lastActive = -1;
    for (var bi = 0; bi < blocks.length; bi++) { driftCur[bi] = 0; yCur[bi] = 0; tpCur[bi] = 0; }
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

      var closest = -1, closestDist = Infinity;
      for (var i = 0; i < blocks.length; i++) {
        var r = blocks[i].getBoundingClientRect();
        var prog = clamp01((vh - r.top) / (vh + r.height));            // 0 entering the bottom, 1 exiting the top
        var tpT  = r.height ? clamp01((cY - r.top) / r.height) : 0;    // 0 at the block's top, 1 at its bottom

        // prog 0 = entering the bottom, 0.5 = centred, 1 = gone off the top. the entry term is spent by
        // 0.5, so from centre onward the motion is exactly the old drift.
        var inT  = clamp01(prog / 0.5);
        var ramp = Math.pow(1 - inT, ENTER_CURVE);
        var enterI = (i === 0 ? ENTER_FIRST : 1);
        var xT  = offset * easeTri(prog) - enter * enterI * ramp;
        var yT  = ENTER_Y_VH * vh * enterI * ramp;
        var prevX = driftCur[i];
        driftCur[i] += (xT - prevX) * lerp;
        yCur[i]     += (yT - yCur[i]) * lerp;
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

        blocks[i].style.transform = 'translate(' + driftCur[i] + 'px,' + yCur[i] + 'px)';
        // scrubbed cards follow their block's scroll progress, offset by langStart
        if (renderers[i] && !langIsAuto(i)) { renderers[i](langStart(i) + (1 - langStart(i)) * tpCur[i]); }

        // nearest block midpoint to the centre = active
        var d = Math.abs(r.top + r.height / 2 - cY);
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
    gsap.ticker.add(update);

    // re-space + re-measure on viewport/webfont changes
    function refreshAll() {
      layout();
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
