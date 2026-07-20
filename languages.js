(function () {

  // ==========================================================================
  // languages.js — the "languages" scroll-list animation cards.
  //
  // A pinned card stays centred while four text blocks scroll past it (the "scroll list index"
  // effect). The block nearest the viewport centre is active → its matching card crossfades in and
  // that card's inner animation scrubs as the block crosses. See MODEL below.
  //
  // DOM contract (author in Webflow):
  //   [data-lang="section"]                 the section (scroll driver spans it)
  //   [data-lang-anim="0"]                  card 0 — the language switcher (fixed card)
  //       [data-lang-name]                  the curved SVG string — put on the <textPath> el, NOT
  //                                          the <text> (we set .textContent; tagging <text> would
  //                                          nuke the <textPath> child + the curve). needs a sibling
  //                                          <path> (the curve) in the same <svg> for anchoring.
  //       [data-lang-label]                 the VISIBLE language name (English/Deutsch/…) — optional
  //       [data-lang-flag]                  the flag. THREE modes (auto-detected):
  //                                           • one el per language, each data-lang-flag="us|de|es|in"
  //                                             → active shown, rest hidden (custom assets — recommended)
  //                                           • a single <img data-lang-flag> → src swapped by code
  //                                           • a single text el → emoji (shows "DE" on Windows — avoid)
  //   [data-lang-anim="1|2|3"]              cards 1–3 — each its own animation (renderers below)
  //   .lang_text-anim-wrap                  the scrolling text column (holds the 4 blocks below)
  //     .lang_anim-text-wrap  ×4            the TEXT BLOCKS — one per card, IN THE SAME ORDER as the
  //                                          [data-lang-anim] cards (block 0 → card 0, block 1 → card 1…)
  //
  // MODEL: "scroll list index" (mwg effect105). The .lang_card--wrap STAYS PUT (sticky in Webflow) while
  // the 4 text blocks scroll past it. The block closest to the viewport CENTRE is ACTIVE → its matching
  // card crossfades in and that card's inner animation SCRUBS 0..1 as the block crosses the centre. Blocks
  // drift sideways (peak at centre) then settle, and dim while inactive. All cards are stacked in one spot
  // (JS, CARD_STACK) so they can crossfade. Blocks stay TIGHTLY stacked (several visible at once, like the
  // resource); JS only pads lead-in/out scroll (see LEAD_VH / GAP_VH in the driver).
  //
  // CARD 0 MODEL: one continuous line = all SEGS joined (JS OWNS it — authored SVG string is overwritten).
  // No scramble; it STREAMS along the curve (like the hero) as block 0 crosses the centre, parking each
  // segment's centre at the ANCHOR on the path; the flag/label swap as each arrives.
  //
  // The driver runs off getBoundingClientRect each frame (no pin/spacer). window.Languages.render() /
  // .relayout() / .remeasure() are exposed for manual repaints. For extra fluidity, drive with Lenis.
  // ==========================================================================

  // ---- card 0 content — ONE continuous line made of per-language segments, joined by SEP. The text
  // does NOT scramble: it just STREAMS along the curve on scroll (like the hero), and the flag swaps
  // as each language segment arrives at the anchor point on the path.
  //   text  = that language's sentence (edit freely; JS owns the string, the authored SVG text is ignored)
  //   code  = ISO country code → <img> flag src (renders everywhere, incl. Windows)
  //   flag  = emoji fallback if [data-lang-flag] is a text element (no flag emoji on Windows) ----
  var FLAG_URL = 'https://flagcdn.com/w80/{code}.png';   // {code} → country code; swap for your own asset host
  var SEP      = '   ';                                  // gap inserted between languages in the joined line
  // name = the visible language label (shown in [data-lang-label]); code = flag country code.
  var SEGS = [
    { text: 'I’m getting started with the project. Here are a few options.', name: 'English',  code: 'us', flag: '🇺🇸' },
    { text: 'Wie möchten Sie die Datei einrichten.',                          name: 'Deutsch',  code: 'de', flag: '🇩🇪' },
    { text: 'Ecco alcune opzioni. Sto iniziando.',                            name: 'Español',  code: 'es', flag: '🇪🇸' }, // NB text is Italian, flag/name=es per your list — fix one
    { text: 'प्रोजेक्ट पर काम शुरू हो गया, आप किस तरह से चाहेंगे',            name: 'हिन्दी',    code: 'in', flag: '🇮🇳' }
  ];

  // ---- config ----
  var SCRUB_LERP = 0.08;    // eases the driven progress so the drift glides + settles on stop (like flow)
                            // lower = slower, more trailing glide; higher = snappier (1 = instant)
  var ANCHOR     = 0.5;     // point along the PATH (0=start,1=end) where a segment counts as "in view";
                            // 0.5 = middle of the curve. the drift parks each segment's centre here.
  var FLAG_MID   = 0.5;     // within a seam (0..1 between two segments) where the flag flips to the next

  // ---- cards: all [data-lang-anim] cards are stacked in one spot and crossfade; the active one is
  // chosen by which text block is centred (see the driver at the bottom). ----
  var CARD_FADE_MS = 220;   // TRIGGERED crossfade duration between cards (ms) — quick + snappy, not scrubbed
  var CARD_STACK   = true;  // JS stacks the cards absolute+centered in one spot so they can crossfade;
                            // set false if you position/stack them yourself in Webflow

  // ---- card 1 (Add to vocabulary). beats are TRIGGERED (see C1_BEATS below); these tune the look ----
  var VOCAB_WORD = 'Wispr Flow';   // the word "typed" into the input (JS owns it)
  var TOG_OFF    = '#d8d6cc';      // toggle track colour OFF
  var TOG_ON     = '#1a1a1a';      // toggle track colour ON

  // ---- card 2 (snippets): trigger lifts up & out, URL appears below, then rises straight up into the slot ----
  var SNIP_RISE = 46;              // px the pills sit above/below the line while outside it

  // ---- card 3 (tone): one message per tone; active swaps as the slice crosses each third ----
  var TONES = [
    { key: 'formal', text: 'Hey, are you free for lunch tomorrow?\nLet’s do 12 if that works for you.' },
    { key: 'casual', text: 'Hey are you free for lunch tomorrow?\nLet’s do 12 if that works for you' },
    { key: 'very',   text: 'hey are you free for lunch tomorrow?\nlet’s do 12 if that works for you' }
  ];

  // ---- triggered play: cards 1–3 don't scrub continuously — each beat FIRES when scroll crosses its
  // threshold, then plays over TRIG_MS via CSS transition. reverses when you scroll back. ----
  var TRIG_MS  = 300;                          // beat play duration (ms) — snappy
  var TYPE_MS  = 650;                          // card 1 typewriter duration
  var CHIP_MS  = 220;                          // new-word chip pop — quicker than the rest
  // card1 = 3 SCROLL positions: chips · form-self-plays · chips+new. the form's internal order
  // (Add-new click → top → write → toggle → move to buttons → click) plays on TIMERS, not on scroll.
  var C1_BEATS = [0.22, 0.72];
  var C2_LIFT  = 0.30;                          // card2 beat1: trigger lifts out, slot makes room, URL shows below
  var C2_RISE  = 0.58;                          // card2 beat2: URL rises straight up into the (pre-sized) slot
  var ACTIVE_CLASS = 'is-active';              // combo class that marks the active tone button (card 3)
  var WAVE_STAGGER = 45;                       // card 3: ms delay per word → the wave-in of the message
  var EASE     = 'cubic-bezier(.4,0,.2,1)';    // shared snappy ease
  var BACK     = 'cubic-bezier(.34,1.56,.64,1)'; // playful overshoot (bounce) for the new-word chip

  var ATTR = 'data-lang';

  // beat index = how many thresholds tp has crossed (ascending array)
  function beatOf(tp, ths) {
    var b = 0;
    for (var i = 0; i < ths.length; i++) { if (tp >= ths[i]) { b++; } }
    return b;
  }

  // timed typewriter: types `text` into el over ms on play(); reset() clears. cancellable so scrubbing
  // back and forth re-triggers cleanly. uses real time (rAF), so play speed is independent of scroll.
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
        if (done && full === text) { return; }     // already fully typed — don't restart
        window.cancelAnimationFrame(raf);
        full = text; dur = ms || 600; startT = 0; done = false;
        raf = window.requestAnimationFrame(step);
      },
      reset: function () { window.cancelAnimationFrame(raf); startT = 0; done = false; el.textContent = ''; }
    };
  }

  // wrap an element's text into per-word spans with a staggered transition-delay → drive opacity/transform
  // for a left-to-right WAVE. whitespace (incl. newlines under white-space:pre-line) is kept as text nodes.
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

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[languages] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var section = document.querySelector('[' + ATTR + '="section"]');
    if (!section) { console.warn('[languages] no [data-lang="section"] found'); return; }

    // ---- card 0: language switcher (line streams along the curve, flag swaps on arrival) ----
    var card0   = section.querySelector('[' + ATTR + '-anim="0"]');
    var nameEl  = card0 && card0.querySelector('[' + ATTR + '-name]');    // the curved SVG string (<textPath>)
    var labelEl = card0 && card0.querySelector('[' + ATTR + '-label]');   // the VISIBLE language name text el
    var flagEls = card0 ? card0.querySelectorAll('[' + ATTR + '-flag]') : [];

    // flag has three authoring modes, auto-detected:
    //   MULTI  — author one flag el per language, each tagged  data-lang-flag="us|de|es|in"
    //            → JS shows the active one, hides the rest. best for custom flag assets + styling.
    //   IMG    — a single <img data-lang-flag> → JS swaps its src by country code (flagcdn).
    //   TEXT   — a single text el → JS sets the emoji (renders as letters "DE" on Windows — avoid).
    // only elements with a NON-EMPTY code count as per-language flags — so a wrapper carrying a bare
    // data-lang-flag (no value) is ignored, not hidden. >1 coded flag = MULTI mode.
    var coded = [];
    Array.prototype.forEach.call(flagEls, function (el) {
      if (el.getAttribute(ATTR + '-flag')) { coded.push(el); }
    });
    var flagMulti   = coded.length > 1;
    var singleFlag  = coded[0] || (flagEls.length ? flagEls[0] : null);
    var singleIsImg = singleFlag && singleFlag.tagName && singleFlag.tagName.toLowerCase() === 'img';

    function setActive(seg) {
      if (labelEl && labelEl.textContent !== seg.name) { labelEl.textContent = seg.name || ''; }
      if (flagMulti) {                                   // toggle authored per-language flag elements
        for (var g = 0; g < coded.length; g++) {
          coded[g].style.display = (coded[g].getAttribute(ATTR + '-flag') === seg.code) ? '' : 'none';
        }
      } else if (singleIsImg) {                          // swap the single <img> src
        var src = FLAG_URL.replace('{code}', seg.code || '');
        if (singleFlag.getAttribute('src') !== src) { singleFlag.setAttribute('src', src); }
      } else if (singleFlag && singleFlag.textContent !== seg.flag) {   // single text el → emoji
        singleFlag.textContent = seg.flag || '';
      }
    }

    // the <text> el owns the x attr the drift moves; nameEl is its <textPath> child (holds the string).
    var textEl = null;
    if (nameEl) {
      textEl = (nameEl.tagName && nameEl.tagName.toLowerCase() === 'textpath') ? nameEl.parentNode : nameEl;
    }
    // the marquee svg is the one that OWNS the text (card0 also holds the flag svgs — don't grab those)
    var svgEl  = nameEl ? (nameEl.closest && nameEl.closest('svg')) : null;
    if (!svgEl && card0) { svgEl = card0.querySelector('svg'); }
    var pathEl = svgEl && (svgEl.querySelector('#curve') || svgEl.querySelector('path'));   // the curve the text rides

    // build the ONE joined line + record each segment's centre as a fraction of the whole string,
    // so we can park that fraction at the anchor + swap the flag exactly as the segment arrives.
    var full = '', midFrac = [], starts = [];
    for (var s = 0; s < SEGS.length; s++) {
      starts[s] = full.length;
      full += SEGS[s].text;
      if (s < SEGS.length - 1) { full += SEP; }
    }
    var totalLen = full.length || 1;
    for (var s2 = 0; s2 < SEGS.length; s2++) {
      midFrac[s2] = (starts[s2] + SEGS[s2].text.length / 2) / totalLen;
    }
    if (nameEl && nameEl.textContent !== full) { nameEl.textContent = full; }   // set once; JS owns it

    // measured lengths (arc units): span = rendered length of the whole line; pathLen = the curve length.
    // re-measured after webfonts load (glyph widths change) + on resize.
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
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { measure(); }); }

    var lastFlagI = -1;
    function renderCard0(progress) {
      if (!card0 || SEGS.length === 0) { return; }
      var N = SEGS.length;
      var p = Math.max(0, Math.min(1, progress));
      var segF = p * (N - 1);
      var i    = Math.min(N - 1, Math.floor(segF));
      var frac = segF - i;                              // 0..1 across the current seam
      var next = Math.min(N - 1, i + 1);

      // focus fraction of the string that should sit at the anchor right now (seg i's centre at p=i/(N-1))
      var ff = midFrac[i] + (midFrac[next] - midFrac[i]) * frac;

      // drift the line so that focus fraction parks at the anchor along the path
      if (textEl && span > 0) {
        textEl.setAttribute('x', String(anchorArc - ff * span));
      }

      // flag flips to the next language once past the seam midpoint — i.e. as it comes into view
      var flagIdx = (frac >= FLAG_MID) ? next : i;
      if (flagIdx !== lastFlagI) { setActive(SEGS[flagIdx]); lastFlagI = flagIdx; }
    }

    // ---- cards: collect every [data-lang-anim] by its index, stack them in one spot, and give each
    // an animator. card 0 = the language switcher (renderCard0). cards 1–3 = add their renderers below. ----
    var cardWrap = card0 ? card0.parentNode : section;
    var cardEls  = [];
    Array.prototype.forEach.call((cardWrap || section).querySelectorAll('[' + ATTR + '-anim]'), function (el) {
      var idx = parseInt(el.getAttribute(ATTR + '-anim'), 10);
      if (!isNaN(idx)) { cardEls[idx] = el; }
    });
    if (CARD_STACK) {
      // overlay the cards in one spot so they can crossfade — natural height, vertically centred in the
      // sticky wrap. NOT stretched to fill (that would blow the card up to the whole 100vh column).
      for (var c = 0; c < cardEls.length; c++) {
        var ce = cardEls[c];
        if (!ce) { continue; }
        ce.style.position  = 'absolute';
        ce.style.left = '0'; ce.style.right = '0';        // span the column width; keep natural height
        ce.style.top = '50%';
        ce.style.transform = 'translateY(-50%)';          // vertical centre — cards stay put
        ce.style.transition = 'opacity ' + CARD_FADE_MS + 'ms ease';   // triggered crossfade
        ce.style.willChange = 'opacity';
      }
    }

    // per-card animators: local tp 0..1 across that card's slice. add renderCard2/3 as you build them.
    var renderers = { 0: renderCard0 };

    // ---- card 1: "Add to vocabulary" — chips → form slides in → word types → content scrolls up to
    // reveal the toggles + Add word → send pressed → form flies up and out → chips return (+1). ----
    var card1Measure = null;
    (function buildCard1() {
      var root = cardEls[1];
      if (!root) { return; }
      var oneV = function (v) { return root.querySelector('[data-vocab="' + v + '"]'); };
      var formEl    = oneV('form');
      var trackEl   = (oneV('track') || (formEl && formEl.querySelector('.lang_inner-card-wrap'))) || null;
      var inputEl   = oneV('input');
      var inputTxt  = inputEl ? (inputEl.querySelector('.lang_input-text') || inputEl) : null;
      var togSpell  = oneV('toggle-spell');
      var knobSpell = togSpell && togSpell.querySelector('[data-vocab-knob]');
      var addBtn    = oneV('add-word');
      var addNewBtn = oneV('add-btn');          // the "Add a new word" chip button (clicks before the form)
      var listEl    = oneV('list');
      var newChip   = oneV('new-chip');

      // CSS transitions = the "play" of each triggered beat
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

      // how far the inner track scrolls (only if the form is a clip window; 0 if auto-height)
      var maxScroll = 0;
      card1Measure = function () {
        maxScroll = formEl ? Math.max(0, formEl.scrollHeight - formEl.clientHeight) : 0;
      };
      card1Measure();

      // ---- state setters (each change plays via the CSS transitions set above) ----
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
      function setNewChip(inN) {
        if (!newChip) { return; }
        if (inN) {
          if (!newChip.style.display || newChip.style.display === 'none') {
            newChip.style.display = ''; newChip.style.opacity = '0'; newChip.style.transform = 'scale(0.6)';
            window.requestAnimationFrame(function () { newChip.style.opacity = '1'; newChip.style.transform = 'scale(1)'; });
          } else { newChip.style.opacity = '1'; newChip.style.transform = 'scale(1)'; }
        } else {
          newChip.style.display = 'none'; newChip.style.opacity = '0'; newChip.style.transform = 'scale(0.6)';
        }
      }

      // ---- timeline: the form SELF-PLAYS once you scroll into position 2 (no more scrolling needed) ----
      var timers = [];
      function clearSeq() { for (var i = 0; i < timers.length; i++) { window.clearTimeout(timers[i]); } timers = []; }
      function at(ms, fn) { timers.push(window.setTimeout(fn, ms)); }
      function exitY() { return -((formEl ? formEl.offsetHeight : 400) * 1.25 + 60); }

      function toRest() {          // POS1: chips
        clearSeq();
        setList(true); setForm(false, 40); setToggle(false); setTrack(false); setNewChip(false);
        if (typer) { typer.reset(); }
      }
      function playForm() {        // POS2: sequence plays on its own — top → type → toggle → move to buttons → click
        clearSeq();
        setNewChip(false); setList(true); setForm(false, 40); setToggle(false); setTrack(false);
        pulse(addNewBtn, 0.92);                                                   // "Add a new word" click
        at(300,                     function () { setList(false); setForm(true, 0); });    // chips out, form to TOP
        at(650,                     function () { if (typer) { typer.play(VOCAB_WORD, TYPE_MS); } }); // write
        at(650 + TYPE_MS + 250,     function () { setToggle(true); });            // THEN toggle
        at(650 + TYPE_MS + 800,     function () { setTrack(true); });             // THEN move down to buttons
        at(650 + TYPE_MS + 1300,    function () { pulse(addBtn, 0.9); });         // Add word click
      }
      function toDone() {          // POS3: form flies out, chips return with the new word
        clearSeq();
        if (typer) { typer.play(VOCAB_WORD, 1); }
        setToggle(true); setTrack(true);
        setForm(false, exitY());
        setList(true); setNewChip(true);
      }

      var lastBeat = -1;
      // 3 scroll positions: 0 = chips · 1 = form self-plays · 2 = chips + new word. edge-triggered.
      renderers[1] = function (tp) {
        var beat = beatOf(tp, C1_BEATS);
        if (beat === lastBeat) { return; }
        lastBeat = beat;
        if (beat <= 0) { toRest(); }
        else if (beat === 1) { playForm(); }
        else { toDone(); }
      };
    }());

    // ---- card 2: "snippets" — the short trigger lifts out, the full expansion rises into its slot,
    // and the sentence reflows around the wider pill. ----
    var card2Measure = null;
    (function buildCard2() {
      var root = cardEls[2];
      if (!root) { return; }
      var oneS = function (v) { return root.querySelector('[data-snip="' + v + '"]'); };
      var lineEl = oneS('line');
      var slot = oneS('slot');
      var trig = oneS('trigger');
      var exp  = oneS('expand');
      if (!slot) { return; }

      // centre the line so the slot growing pushes BOTH sides out equally (even open). NOT text-align
      // centre — the pill text (URL) stays LEFT-aligned.
      if (lineEl) { lineEl.style.justifyContent = 'center'; }

      // the fade overlay must be ABSOLUTE (right edge) — in-flow it pushes the URL text off-centre
      var grad = exp && exp.querySelector('.lang_gradient');
      if (grad) {
        grad.style.position = 'absolute'; grad.style.top = '0'; grad.style.right = '0'; grad.style.bottom = '0';
        grad.style.pointerEvents = 'none';
      }

      slot.style.position = 'relative';
      slot.style.display = 'inline-block';
      slot.style.verticalAlign = 'middle';
      slot.style.transition = 'width ' + TRIG_MS + 'ms ' + EASE;   // slot grows → reflow plays
      // pills centred in the slot so the swap is a STRAIGHT vertical rise (no diagonal drift)
      [trig, exp].forEach(function (el) {
        if (!el) { return; }
        el.style.position = 'absolute';
        el.style.top = '50%'; el.style.left = '50%';       // centred both axes; swap adds a vertical Y
        el.style.whiteSpace = 'nowrap';
        el.style.willChange = 'opacity, transform';
        el.style.transition = 'opacity ' + TRIG_MS + 'ms ease, transform ' + TRIG_MS + 'ms ' + EASE;
      });

      // measure each pill's natural width so the slot can size to the active one (drives the reflow)
      var trigW = 0, expW = 0, slotH = 0;
      card2Measure = function () {
        slotH = 0;
        if (trig) { trigW = trig.offsetWidth; slotH = Math.max(slotH, trig.offsetHeight); }
        if (exp) {
          var d = exp.style.display, o = exp.style.opacity;   // reveal briefly to measure
          exp.style.display = ''; exp.style.opacity = '0';
          expW = exp.offsetWidth; slotH = Math.max(slotH, exp.offsetHeight);
          exp.style.display = d; exp.style.opacity = o;
        }
        if (slotH) { slot.style.height = slotH + 'px'; }
      };
      card2Measure();

      // triggered: crossing C2_SWAP fires the whole swap; CSS transitions play it over TRIG_MS
      renderers[2] = function (tp) {
        // beat 0 = rest · 1 = trigger lifted out + room made + URL waiting below · 2 = URL risen into slot
        var beat = beatOf(tp, [C2_LIFT, C2_RISE]);
        if (trig) {   // centred; lifts straight UP and out, fades once the URL takes over
          trig.style.transform = 'translate(-50%,-50%) translateY(' + (beat === 0 ? 0 : -SNIP_RISE) + 'px)';
          trig.style.opacity = (beat >= 2) ? '0' : '1';
        }
        if (exp) {    // centred; waits below, then rises straight UP into the slot (already full width)
          exp.style.transform = 'translate(-50%,-50%) translateY(' + (beat >= 2 ? 0 : SNIP_RISE) + 'px)';
          exp.style.opacity = (beat >= 1) ? '1' : '0';
        }
        // slot grows to make room at beat 1 — BEFORE the URL rises — so it lands straight, not from the right
        if (trigW || expW) { slot.style.width = (beat >= 1 ? expW : trigW) + 'px'; }
      };
    }());

    // ---- card 3: "tone" — cycle Formal → Casual → Very casual; the message rewrites itself and the
    // active button takes the dark `is-action` state, with a quick fade on each switch. ----
    var card3Measure = null;
    (function buildCard3() {
      var root = cardEls[3];
      if (!root) { return; }
      var btns = root.querySelectorAll('[data-tone]');
      // smooth the active-button colour swap (is-action toggles the dark state)
      Array.prototype.forEach.call(btns, function (b) {
        b.style.transition = 'background-color ' + TRIG_MS + 'ms ease, color ' + TRIG_MS + 'ms ease';
      });
      if (!btns.length) { console.warn('[languages] card 3: no [data-tone] buttons found'); }

      // messages: tag one el per tone [data-tone-msg="0|1|2"] (or the tone key) so the CLIENT edits the
      // copy in Webflow. JS crossfades the active one. Fallback: a single untagged [data-tone-msg] → JS
      // swaps its text from the TONES array (old behaviour).
      var msgList = root.querySelectorAll('[data-tone-msg]');
      var msgByTone = [];
      Array.prototype.forEach.call(msgList, function (el) {
        var v = el.getAttribute('data-tone-msg');
        var idx = parseInt(v, 10);
        if (isNaN(idx)) { for (var k = 0; k < TONES.length; k++) { if (TONES[k].key === v) { idx = k; break; } } }
        if (idx >= 0 && !isNaN(idx)) { msgByTone[idx] = el; }
      });
      var authored = msgByTone.filter(Boolean).length >= 2;   // client authored per-tone messages
      var single = (!authored && msgList.length === 1) ? msgList[0] : null;

      if (authored) {
        // stack the messages in one spot so they can crossfade
        var kept = msgByTone.filter(Boolean);
        var wrap = kept[0].parentNode;
        // capture the wrapper's own box + padding BEFORE pulling the messages out of flow, then place
        // the messages INSIDE the padding (absolute positioning ignores padding, so we honour it manually)
        var cs = wrap ? getComputedStyle(wrap) : null;
        var padL = cs ? (parseFloat(cs.paddingLeft) || 0) : 0;
        var padT = cs ? (parseFloat(cs.paddingTop) || 0) : 0;
        var padR = cs ? (parseFloat(cs.paddingRight) || 0) : 0;
        var padB = cs ? (parseFloat(cs.paddingBottom) || 0) : 0;
        var wrapW  = wrap ? wrap.offsetWidth : 0;                       // full width incl. padding + border
        var innerW = wrap ? (wrap.clientWidth - padL - padR) : 0;       // content width (inside padding)
        if (wrap) {
          wrap.style.position = 'relative';
          wrap.style.boxSizing = 'border-box';
          if (wrapW) { wrap.style.width = wrapW + 'px'; }               // hold the design box (keeps padding)
        }
        var msgSpans = [];
        msgByTone.forEach(function (el, t) {
          if (!el) { return; }
          el.style.position = 'absolute';
          el.style.top = padT + 'px'; el.style.left = padL + 'px';      // sit inside the wrapper padding
          if (innerW) { el.style.width = innerW + 'px'; }
          el.style.whiteSpace = 'pre-line';
          msgSpans[t] = waveWrap(el, WAVE_STAGGER);                     // per-word spans → wave in/out
        });
        card3Measure = function () {
          var h = 0;
          msgByTone.forEach(function (el) {
            if (!el) { return; }
            var o = el.style.opacity; el.style.opacity = '0';
            h = Math.max(h, el.offsetHeight); el.style.opacity = o;
          });
          if (wrap && h) { wrap.style.minHeight = (h + padT + padB) + 'px'; }   // padding respected vertically too
        };
        card3Measure();
      } else if (single) {
        single.style.whiteSpace = 'pre-line'; single.style.willChange = 'opacity, transform';
        single.style.transition = 'opacity ' + TRIG_MS + 'ms ease';
      }

      var lastActive = -1;
      // triggered: active tone = which third of the slice we're in; CSS transitions play the crossfade
      renderers[3] = function (tp) {
        var N = TONES.length;
        var active = Math.max(0, Math.min(N - 1, Math.floor(Math.max(0, Math.min(1, tp)) * N)));

        if (authored) {
          for (var t = 0; t < N; t++) {
            var spans = msgSpans[t];
            if (!spans) { continue; }
            var on = (t === active);
            for (var w = 0; w < spans.length; w++) {                    // per-word wave: staggered opacity + rise
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
            // match by ORDER (b) as well as value/key, so a mistagged 3rd button still activates
            btns[b].classList.toggle(ACTIVE_CLASS, b === active || v === String(active) || v === TONES[active].key);
          }
          lastActive = active;
        }
      };
    }());

    // ==========================================================================
    // driver: SCROLL LIST INDEX (mwg effect105 model)
    //   The card wrap ([data-lang="section"] → .lang_card--wrap) STAYS PUT (sticky in Webflow —
    //   its position is untouched here). The four .lang_anim-text-wrap TEXT BLOCKS become a
    //   scrolling list beside it. Whichever block is closest to the viewport CENTRE is ACTIVE →
    //   its matching [data-lang-anim] card (1:1 by order) crossfades in, and that card's inner
    //   animation SCRUBS 0..1 as the block crosses the centre. Blocks drift sideways (peak at
    //   centre) then settle, and dim while not active. Replaces the old 400vh sticky/crossfade.
    // ==========================================================================

    // ---- config ----
    var FORCE_TIGHT = true;  // collapse any per-block 100vh (min-height/height) so the blocks stack
                             // TIGHT like the reference. set false if you strip the 100vh in Webflow
                             // yourself and want the authored heights respected.
    var LEAD_VH    = 0.5;    // blank scroll before the first / after the last block so each can reach
                             // the centre (like the resource's `padding: 100vh 0`, in viewports).
    var GAP_VH     = 0;      // EXTRA vertical gap between blocks, in viewports. 0 = keep the tight
                             // Webflow stacking (blocks sit next to each other, several visible at once,
                             // like the reference). Raise it to give each card a longer reign at centre.
    var DRIFT_FRAC = 0.2;    // sideways drift at centre, as a fraction of the text-column width (peaks at
                             // centre). reference ≈ 0.26. 0 = no drift; negative flips the side.
    var DIM_ALPHA  = 0.35;   // opacity of the non-active text blocks (active = 1)
    var POP_SCALE  = 1;      // quick scale-pop of the card wrap on active change (1 = off; try 1.04)

    var textWrap = section.querySelector('.lang_text-anim-wrap');
    var blocks   = textWrap
      ? Array.prototype.slice.call(textWrap.querySelectorAll('.lang_anim-text-wrap'))
      : [];

    // triangle 0→1→0 (peak at p=0.5), smoothstepped so the drift eases in/out like the resource
    function easeTri(p) {
      var t = 1 - Math.abs(2 * p - 1);
      return t * t * (3 - 2 * t);
    }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    // JS pads the track so the first block can reach the centre and the last can leave it (LEAD_VH),
    // but keeps the blocks tightly stacked (GAP_VH, default 0) so several are visible at once — the
    // drift + centre-detection do the rest, exactly like the resource's packed list.
    function layout() {
      if (!textWrap || !blocks.length) { return; }
      var vh = window.innerHeight;
      textWrap.style.paddingTop = (vh * LEAD_VH) + 'px';
      textWrap.style.paddingBottom = (vh * LEAD_VH) + 'px';
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        b.style.position = 'relative';
        b.style.willChange = 'transform, opacity';
        if (FORCE_TIGHT) {                                        // kill the Webflow 100vh → natural height
          b.style.minHeight = '0';
          b.style.height = 'auto';
        }
        if (i < blocks.length - 1) { b.style.marginBottom = (GAP_VH > 0 ? (vh * GAP_VH) + 'px' : ''); }
      }
    }
    layout();

    // smoothed per-block scalars so the drift + inner scrub GLIDE and settle on stop (like the flow).
    // active detection stays on the RAW rect (immediate) so the card swap never lags.
    var driftCur = [], tpCur = [], lastActive = -1;
    for (var bi = 0; bi < blocks.length; bi++) { driftCur[bi] = 0; tpCur[bi] = 0; }

    function update() {
      if (!blocks.length) { if (renderers[0]) { renderers[0](0); } return; }
      var vh = window.innerHeight, cY = vh / 2;
      var offset = DRIFT_FRAC * (textWrap.clientWidth || 0);
      var lerp = (SCRUB_LERP >= 1) ? 1 : (1 - Math.pow(1 - SCRUB_LERP, gsap.ticker.deltaRatio()));

      var closest = -1, closestDist = Infinity;
      for (var i = 0; i < blocks.length; i++) {
        var r = blocks[i].getBoundingClientRect();
        // block's progress through the viewport: 0 as its top enters the bottom, 1 as its bottom exits the top
        var prog = clamp01((vh - r.top) / (vh + r.height));
        // inner card scrub: 0 when the centre sits at the block's top, 1 at its bottom
        var tpT  = r.height ? clamp01((cY - r.top) / r.height) : 0;

        driftCur[i] += (offset * easeTri(prog) - driftCur[i]) * lerp;
        tpCur[i]    += (tpT - tpCur[i]) * lerp;
        if (Math.abs(tpT - tpCur[i]) < 0.0002) { tpCur[i] = tpT; }

        blocks[i].style.transform = 'translateX(' + driftCur[i] + 'px)';
        if (renderers[i]) { renderers[i](tpCur[i]); }

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
        if (POP_SCALE !== 1 && cardWrap) {                   // optional pop on swap (like the preview)
          gsap.fromTo(cardWrap, { scale: POP_SCALE }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
        }
        lastActive = closest;
      }
    }
    gsap.ticker.add(update);

    // re-space + re-measure on viewport/webfont changes, then repaint
    function refreshAll() {
      layout();
      measure();
      if (card1Measure) { card1Measure(); }
      if (card2Measure) { card2Measure(); }
      if (card3Measure) { card3Measure(); }
      lastActive = -1;
    }
    ScrollTrigger.addEventListener('refresh', refreshAll);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(refreshAll); }

    // public hook — kept for parity with the other sections
    window.Languages = {
      render: update,
      relayout: layout,
      remeasure: measure
    };

    update();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

}());
