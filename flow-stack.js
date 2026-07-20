(function () {

  // ---- corners: scroll-scrubbed corner radius (same module as stack.js — load ONE of the two scripts per page) ----

  var ATTR        = 'data-corners';
  var DEFAULT_MAX = 80;
  var SMOOTH      = 0.16;  // per-frame ease toward target radius; higher = snappier
  var DEBUG       = false;

  var els = [];

  function scan() {
    var found = document.querySelectorAll('[' + ATTR + ']');
    for (var i = 0; i < found.length; i++) {
      var el = found[i], known = false;
      for (var j = 0; j < els.length; j++) { if (els[j].el === el) { known = true; break; } }
      if (!known) {
        els.push({ el: el, max: parseFloat(el.getAttribute(ATTR)) || DEFAULT_MAX, t: -1, b: -1, wt: -1, wb: -1 });
        if (DEBUG) { console.log('[corners] tracking', el); }
      }
    }
  }
  window.Corners = { scan: scan };

  function frame(dt) {
    var vh = window.innerHeight;
    var k  = 1 - Math.pow(1 - SMOOTH, dt);
    for (var i = 0; i < els.length; i++) {
      var s = els[i];
      var r = s.el.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }                     // display:none
      var tT = Math.max(0, Math.min(s.max, r.top));
      var tB = Math.max(0, Math.min(s.max, vh - r.bottom));
      if (s.t < 0) { s.t = tT; s.b = tB; }                         // first frame: snap
      else {
        s.t += (tT - s.t) * k; if (Math.abs(tT - s.t) < 0.1) { s.t = tT; }
        s.b += (tB - s.b) * k; if (Math.abs(tB - s.b) < 0.1) { s.b = tB; }
      }
      if (s.t === s.wt && s.b === s.wb) { continue; }              // settled
      s.wt = s.t; s.wb = s.b;
      s.el.style.setProperty('border-top-left-radius',     s.t + 'px', 'important');
      s.el.style.setProperty('border-top-right-radius',    s.t + 'px', 'important');
      s.el.style.setProperty('border-bottom-left-radius',  s.b + 'px', 'important');
      s.el.style.setProperty('border-bottom-right-radius', s.b + 'px', 'important');
    }
  }

  function cornersStart() {
    scan();
    if (window.gsap) {
      // register ST first so its pin correction runs before our rect reads each frame
      if (window.ScrollTrigger) { gsap.registerPlugin(ScrollTrigger); }
      gsap.ticker.add(function () { try { frame(gsap.ticker.deltaRatio()); } catch (e) {} });
    } else {
      var last = performance.now();
      (function loop(now) {
        var dt = (now - last) / (1000 / 60); last = now;
        try { frame(dt || 1); } catch (e) {}
        requestAnimationFrame(loop);
      }(last));
    }
    window.addEventListener('load', scan);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', cornersStart); }
  else { cornersStart(); }

}());

(function () {

  // flow page: pinned green section — marquee scrubs in, photo card grows over the keyboard
  // card, shrinks to its final size, rides down to the tabs, then the tabs phase runs.
  //
  // attributes: data-stack section/card/green/desktop/mobile (as stack.js)
  //             data-flow="stage" (morph area) / "kb" (keyboard card) / "marquee" (svg wrapper)
  //             data-speed="4.9" on a marquee wrapper = drift multiplier

  // ---- config ----
  // pin phases, in viewport-heights of scroll
  var IN_VH        = 0.6;    // P0: slow marquee scrubs in
  var GROW_VH      = 0.8;    // P1: photo card grows right -> left to full stage width
  var FULL_HOLD_VH = 0.25;   // beat at full bleed
  var SHRINK_VH    = 0.7;    // P2: sides shrink in to the final card
  var TAB_STEP_VH  = 1.0;    // fallback scroll length per tab (used if CH_VH doesn't fit numTabs)
  var END_HOLD_VH  = 1.0;    // fallback hold on the last tab
  // weighted chapter scroll lengths (vh) — chapter 1 (typing) longest. one entry per tab.
  var CH_VH        = [2.6, 1.8, 1.6];
  var TYPE_END     = 0.9;    // fraction of chapter 1's slice by which the transcript finishes typing
  // tab click: CROSSFADE the card scene between tabs instead of scrubbing through every chapter.
  // fade the current chapter out, jump to the target (hidden), settle it, fade the target in — so
  // clicking 1→3 shows tab 3, not a fast-forward through tab 2.
  var TAB_FADE_MS  = 220;         // ms each half of the crossfade (out, then in)
  var INDICATOR_MS = 500;         // ms the tab indicator slides/resizes to the active tab

  // chapter 2 (polish), in fractions of tab-1's scroll slice (gradient itself loops via CSS):
  var POLISH_GRAD   = [0.0, 0.38];  // the gradient waves ONTO the text word-by-word over this range
  var POLISH_RAWOUT = [0.38, 0.66]; // raw transcript waves OUT here — its OWN window, BEFORE the box
  var POLISH_DROP   = [0.62, 1.0];  // box grow + polished-in — after the raw-out so it never covers the fade
  var POLISH_BAND   = 0.22;  // width of each word's fade within the wave (bigger = softer wave edge)
  var POLISH_GAP    = 0.12;  // how far the polished-in lags behind the raw-out at the wavefront
  var POLISH_RISE   = 16;    // px the polished text lifts up to sit where the "Message…" placeholder was
  var GRAD_WORD_MS  = 350;   // ms each word's colour→gradient fade plays through as the wavefront passes
                             // it (a CSS transition — TRIGGERED per word, so it never scrubs word-by-word)

  var INTRO_FADE_MS   = 250; // 220 wpm + marquee: timed fade in (at scroll-in) and out (at shrink start)
  var MSG_FADE_MS     = 450; // timed fade-IN of the message/composer content — TRIGGERED, not scrubbed
  var BG_FADE_MS      = 500; // crossfade between the card's chapter background images (data-bg="0/1/2")
  var MSG_TRIGGER     = 0.8; // where in the card ride (pC→pHold fraction) the message fade fires — near
                             // the end so the message frame animates in just before the raw text types
  // chapter-3 pill "voice mode": the done pill shows a cream waveform — bars that animate OUT to
  // varying heights (left→right ripple). shape = per-bar height fractions; count = its length.
  var BAR_COLOR = '#FFFFEB';
  var BAR_W      = 3;        // px width of each bar
  var BAR_GAP    = 3;        // px gap between bars
  var BAR_MIN    = 3;        // px shortest bar (the tiny end dots)
  var BAR_MAX    = 18;       // px tallest bar — the row locks to this height so the pill never resizes
  var PILL_WAVE_H = 24;      // px the waveform row occupies; vert padding = (PILL_WAVE_H-BAR_MAX)/2 = 3px
  var PILL_OUT_MS = 240;     // ms the spinner+label take to fade/shrink out before the waveform comes in
  var BULLET_MS  = 300;      // ms the bullets wave in + row grows BEFORE they grow out to the audio heights
  var BAR_SHAPE  = [0.12, 0.28, 0.5, 0.42, 0.72, 0.88, 1, 0.8, 0.62, 0.48, 0.34, 0.22, 0.12];

  // audio pill: authored at its LANDED spot; recording pose is a transform offset (lifts it up)
  var PILL_REC_SCALE = 1.8;  // recording size relative to the landed size (>1 = bigger at start)
  // recording lift is a FRACTION of the stage (full-bleed card) height so it scales with the
  // screen instead of a fixed px — on short screens −180px overshot and the pill sat too high.
  var PILL_REC_VH    = 0.22; // lift toward the card centre = this × stage height (tune)
  var PILL_REC_Y_MAX = 200;  // px cap so it never lifts too far on very tall screens
  var PILL_ICONS_AT  = 0.55; // handoff fraction (0..1) at which the 2 extra icons start scaling in
  var PILL_ICON_SIZE = 18;   // px the extra icons scale out to
  var PILL_LERP      = 0.16; // audio-pill handoff: eased follow (trails scroll, settles soft). higher = quicker settle
  var POLISH_PILL_Y  = 25;   // px nudge the polishing pill DOWN onto the audio-pill spot (+down / −up)

  // chapter 3 (Distribute) — the destination cards arc through centre like a hand of cards.
  // pivot is BELOW the card so rotateZ swings them on an arc (＼ ｜ ／). scrubbed by the tab's tp.
  var FAN_ANGLE = 45;          // deg a card is rotated at its off (left/right) position
  var FAN_TX    = 300;         // px a card is translated sideways at its off position
  var FAN_SCALE = 1;           // scale of an off card (1 = no shrink; cards just swing + clip)
  var FAN_PIVOT = '50% 100%';  // transform-origin at the card's bottom-middle → swings on that hinge
  var FAN_FADE  = 0.6;         // card-units past ±1 over which an off card fades fully out
  var FAN_CENTER_NUDGE = 0;    // px fine-tune for the centred slack note (— = up, + = down)
  var FAN_LIFT_END = 0.15;     // fraction of ch3 spent lifting the note up to centre before swinging
  // ch3 rhythm: each card gets a PARKED beat (centred, logo full) then a fast eased swing to the
  // next. FAN_HOLD = fraction of ch3's swing range spent parked vs moving. 0 = old linear scrub,
  // →1 = near-instant snaps between centred cards. the swing itself keeps its ease (smooth()).
  var FAN_HOLD     = 0.6;
  // ch3 easing: the fan RENDER chases the scrubbed beat instead of tracking raw scroll 1:1, so it
  // glides in and settles on each card instead of feeling coupled to every scroll tick. lower =
  // smoother / floatier, 1 = instant (raw scrub, old behaviour). same idea as SCRUB_LERP.
  var FAN_LERP     = 0.12;
  // ch2 (message box open): eased follow for the polished-text wave-in, raw-text wipe-out and box
  // grow — the render chases the scrubbed tp instead of tracking raw scroll 1:1. same as FAN_LERP.
  var POLISH_LERP  = 0.12;
  var SLACK_PAD    = 48;       // px white space below the slack text in ch3 (eases in after the type-in)
  var LOGO_ROT     = 90;       // deg a logo rotates in as it centres (same direction as the swing; flip to reverse)
  var LOGO_FADE    = 1;        // card-units over which a logo fades + rotates in/out around centre
  var LOGO_SCALE   = 0.6;      // scale of a logo when off-centre (pops up to 1 as it centres)

  var CARD_TARGET  = 0.5;    // viewport fraction the card centres on during the ride
  var CARD_W       = 400;    // px final card width after the shrink (clamped to stage)
  var CARD_H       = 'auto'; // px number, or 'auto' to fit the in-flow content of [data-flow="screen"]
  var CARD_H_FALLBACK = 560; // used when 'auto' but no screen wrapper is found to measure
  var CARD_H_MAX   = 0.92;   // never let the card exceed this fraction of the stage height
  var CARD_PAD_BOTTOM = 42;  // px added below the measured content (breathing room under the pills)
  var HEAD_TOP     = 0.16;   // fraction of card height both wpm headings are pinned to (keeps them level)
  var MQ_TOP       = 0.48;   // fraction of card height both marquees are pinned to
  var MQ_NUDGE_KB   = 0;     // px fine-tune, kb marquee only (+ down / − up)
  var MQ_NUDGE_CARD = -35;   // px fine-tune, flow marquee only
  var CARD_DIP     = 70;     // px the card sags below centre mid-ride (0 at start and landing)
  var RADIUS_FULL  = 40;     // px card radius before/at full bleed (matches the Webflow class)
  var RADIUS_END   = 16;     // px card radius after the shrink
  var CARD_GAP     = 0;      // px gap between the two cards while both are visible
  // 20% width threshold shared by both comparison cards: below it the keyboard card collapses
  // smoothly to 0 width (no thin sliver of spilling text), and the flow card's "220 wpm" only
  // shows once the card is at least this wide (so the label never spills a too-narrow card).
  var CARD_MIN_W   = 0.20;
  // final close-up: near the end of the grow, a TIMED (not scrubbed) tween pulls the last of the
  // split to 0 — kb slides out + the flow card fills — so it always completes and you can never
  // stop-scroll on a half-open sliver. hysteresis (AT vs OFF) stops chatter at the seam.
  var FILL_AT      = 0.80;   // gt (grow progress) at which the close-up latches on
  var FILL_OFF     = 0.68;   // gt below which it releases again
  var FILL_MS      = 340;    // ms the triggered close takes
  var SNAP_W       = 0.15;   // fraction of the grow travel that snaps at each end (sliver zones)
  var SNAP_S       = 0.05;   // fraction of the grow scroll spent on each snap; smaller = snappier

  // marquee (svg <text> x attribute) — pure function of pin progress, so fully scrubbed
  // both directions and frozen when scroll stops. NOT a raw-scroll delta: travel is tied
  // to the pin length, so movement is precise and guaranteed visible across the section.
  var MQ_DIR       = -1;     // -1 = text streams left over the pin, 1 = right
  var MQ_TRAVEL    = 10000;  // SCREEN px a data-speed="1" string travels across the WHOLE pin.
                             // normalized by the svg's rendered scale, so pace is identical no
                             // matter how wide the parent is / how the card width animates.
                             // (speed = MQ_TRAVEL × data-speed; period only wraps the loop, not speed)
  var MQ_PAD       = 60;     // extra viewBox units the text starts beyond the right edge

  // audio recorder: <rect> bars inside [data-anim="audio"] pulse in height on scroll (pure
  // scrub, like the marquee). each bar grows from its own centre; a per-bar phase offset
  // makes the set ripple like a live waveform.
  var AUDIO_SEL    = '[data-anim="audio"]';
  var AUDIO_MIN    = 0.10;   // shortest a bar ever gets, as a fraction of the svg viewBox height
  var AUDIO_MAX    = 0.94;   // tallest a bar can reach, as a fraction of the viewBox height
  var AUDIO_CYCLES = 8;      // base activity rate across the WHOLE pin (higher = busier)
  var AUDIO_ENV    = 0.72;   // 0 = per-bar jitter only, 1 = strong syllable bursts (loud/quiet swells)

  // slight lerp on the scrub: marquee + audio ease toward the scroll position instead of
  // snapping to it, so motion feels smooth and settles gently when scroll stops. 1 = no lerp
  // (instant), smaller = more trailing. morph/card position stay 1:1 with scroll (not lerped).
  var SCRUB_LERP   = 0.18;

  var GREEN_RADIUS = '80px'; // auto-tags the green panel for the corners module. '' = off
  var BG_SMOOTH    = 0.12;
  var SNAP         = false;
  var SNAP_DUR     = 0.3;

  var ATTR  = 'data-stack';
  var FLOW  = 'data-flow';

  var DESKTOP_SEL = '[' + ATTR + '="desktop"]';
  var MOBILE_SEL  = '[' + ATTR + '="mobile"]';
  var TABS_SEL    = '.meeting_tabs_contain';
  var DESKTOP_DISPLAY = 'block';
  var MOBILE_DISPLAY  = 'block';

  var COPY_SEL       = '.tab_copy';
  var COPY_NARROW_BP = 1180;
  var COPY_NARROW_MAXW = '30ch';

  var DEBUG = false;

  // ---- helpers ----
  function one(root, name)  { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function oneF(root, name) { return root.querySelector('[' + FLOW + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }
  function phaseT(p, a, b) { return b > a ? smooth((p - a) / (b - a)) : (p >= b ? 1 : 0); }
  // races through the first/last SNAP_W of travel in SNAP_S of the scroll: card slivers
  // never linger at either end of the grow, but everything stays fully scrubbed
  function snapEnds(t) {
    if (t <= 0) { return 0; }
    if (t >= 1) { return 1; }
    if (t < SNAP_S)     { return SNAP_W * (t / SNAP_S); }
    if (t > 1 - SNAP_S) { return 1 - SNAP_W * ((1 - t) / SNAP_S); }
    return SNAP_W + ((t - SNAP_S) / (1 - 2 * SNAP_S)) * (1 - 2 * SNAP_W);
  }
  // ch3 fan rhythm: map t (0..1) -> f (0..count-1) with a PARKED beat at each integer and a
  // fast eased swing between. count holds + (count-1) transitions share the axis; FAN_HOLD sets
  // how much of the axis is spent parked. bigger FAN_HOLD = shorter, snappier swings.
  function fanStep(t, count) {
    if (count <= 1) { return 0; }
    var wH = FAN_HOLD / count;                 // width of each hold beat
    var wT = (1 - FAN_HOLD) / (count - 1);     // width of each swing
    var x = 0;
    for (var i = 0; i < count; i++) {
      if (t <= x + wH) { return i; }           // parked on beat i
      x += wH;
      if (i < count - 1) {
        if (t <= x + wT) { return i + smooth((t - x) / wT); }   // swinging i -> i+1
        x += wT;
      }
    }
    return count - 1;
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[flow-stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // runtime-only CSS (same id/rules as stack.js so the Designer embeds keep working)
    if (!document.getElementById('stack-mode-style')) {
      var ms = document.createElement('style');
      ms.id = 'stack-mode-style';
      ms.textContent =
        'html[data-stack-mode="desktop"] ' + MOBILE_SEL  + '{display:none !important;}' +
        'html[data-stack-mode="mobile"] '  + DESKTOP_SEL + '{display:none !important;}' +
        (COPY_SEL ? ('@media (max-width:' + COPY_NARROW_BP + 'px){' + COPY_SEL +
          '{max-width:' + COPY_NARROW_MAXW + ';}}') : '') +
        '[data-tab-anim],[data-tab-text]{opacity:0;visibility:hidden;transition:opacity .4s ease;}' +
        '[data-tab-anim].is-active,[data-tab-text].is-active{opacity:1;visibility:visible;}' +
        '[data-tab-text] .meeting_tabs_heading,[data-tab-text] .meeting_tabs_paragraph{' +
          'opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease;}' +
        '[data-tab-text].is-active .meeting_tabs_heading{opacity:1;transform:none;transition-delay:.06s;}' +
        '[data-tab-text].is-active .meeting_tabs_paragraph{opacity:1;transform:none;transition-delay:.16s;}' +
        // indicator always glides to the active tab (any distance), independent of Webflow authoring
        '[data-tab-indicator]{transition:transform ' + INDICATOR_MS + 'ms cubic-bezier(.4,0,.2,1),' +
          'height ' + INDICATOR_MS + 'ms cubic-bezier(.4,0,.2,1);}' +
        '.flow_w{transition:opacity .12s linear;}' +
        // pills: grow out on X (playful overshoot), then the label ripples in per-character.
        // baton-pass — the outgoing collapses while the next grows at the shared anchor.
        '[data-pill]{opacity:0;transform:scaleX(0);transform-origin:center;' +
          'transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .18s ease;}' +
        '[data-pill].is-on{opacity:1;transform:scaleX(1);}' +
        '[data-pill] .pill-ch{display:inline-block;opacity:0;transform:translateY(.4em);' +
          'transition:opacity .2s ease,transform .28s cubic-bezier(.34,1.56,.64,1);}' +
        '[data-pill].is-on .pill-ch{opacity:1;transform:none;}' +
        // spinner: a 4-point sparkle SVG (injected in build) that rotates smoothly
        '[data-flow="spinner"]{box-sizing:border-box;display:inline-flex;align-items:center;' +
          'justify-content:center;flex:0 0 auto;width:1em;height:1em;color:#71716e;' +
          'animation:flowSpin 1.6s linear infinite;}' +
        '[data-flow="spinner"] svg{width:100%;height:100%;display:block;}' +
        '@keyframes flowSpin{to{transform:rotate(360deg);}}' +
        '@media (prefers-reduced-motion:reduce){[data-flow="spinner"]{animation-duration:4s;}}' +
        // polishing pill: a gradient orbits the border (angle animates via @property; ring stays put)
        '@property --flowang{syntax:"<angle>";inherits:false;initial-value:0deg;}' +
        // ring lives on the pill wrap and inherits its radius, so it hugs the real edge
        '[data-pill="polishing"] .flow_pill-polish_wrap,[data-pill="polishing"]{position:relative;}' +
        // don't let the flex column stretch it full-width — hug content, stay centred
        '[data-pill="polishing"]{align-self:center;}' +
        '[data-pill="polishing"] .flow_pill-polish_wrap::before,' +
        '[data-pill="polishing"]:not(:has(.flow_pill-polish_wrap))::before{' +
          'content:"";position:absolute;inset:0;border-radius:inherit;padding:2px;' +
          'background:conic-gradient(from var(--flowang),transparent 0deg,#FF6C4C 90deg,#FFA946 170deg,#FFBCF2 250deg,#7232A6 320deg,transparent 360deg);' +
          '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;' +
          'mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;' +
          'animation:flowBorder 2.2s linear infinite;pointer-events:none;z-index:2;}' +
        // pill inner content sits under the ring so the 2px edge is never covered
        '[data-pill="polishing"] .flow_pill-polish_wrap>*,[data-pill="polishing"]>*{position:relative;z-index:1;}' +
        '@keyframes flowBorder{to{--flowang:360deg;}}' +
        '@media (prefers-reduced-motion:reduce){[data-pill="polishing"] .flow_pill-polish_wrap::before,[data-pill="polishing"]::before{animation:none;}}' +
        // ---- voice mode (.is-done): the SAME single border recolours from the rainbow gradient to a
        // clean white/cream ring. one element only → it can never draw twice. the orbit keeps a subtle
        // shimmer. (no separate ::after ring, no draw-sweep — that was the double-paint.)
        '[data-pill="polishing"].is-done .flow_pill-polish_wrap::before,' +
        '[data-pill="polishing"].is-done:not(:has(.flow_pill-polish_wrap))::before{' +
          'background:conic-gradient(from var(--flowang),#EEEBE3 0deg,#FFFFEB 120deg,#EEEBE3 240deg,#FFFFEB 360deg);}' +
        // ---- cleaning-up → voice-mode choreography ----
        // STAGE 1 (is-done): spinner + label fade + shrink OUT (in flow, no jump) while the ring draws.
        '[data-pill="polishing"] .flow_pill-polish_wrap>*:not(.flow_pill-dots),' +
        '[data-pill="polishing"]:not(:has(.flow_pill-polish_wrap))>*:not(.flow_pill-dots){' +
          'transition:opacity .24s ease,transform .24s ease;transform-origin:center;}' +
        '[data-pill="polishing"].is-done .flow_pill-polish_wrap>*:not(.flow_pill-dots),' +
        '[data-pill="polishing"].is-done:not(:has(.flow_pill-polish_wrap))>*:not(.flow_pill-dots){' +
          'opacity:0;transform:scale(.4);}' +
        // STAGE 2 (is-in): they leave the flow so the pill hugs the waveform; the row bounces taller.
        '[data-pill="polishing"].is-in .flow_pill-polish_wrap>*:not(.flow_pill-dots),' +
        '[data-pill="polishing"].is-in:not(:has(.flow_pill-polish_wrap))>*:not(.flow_pill-dots){display:none;}' +
        // centred "voice mode" waveform row. resting height is FIXED (BAR_MAX + auto vertical padding =
        // PILL_WAVE_H) so bars growing inside it never resize the pill. content-box for exact math.
        '.flow_pill-dots{display:none;align-items:center;justify-content:center;box-sizing:content-box;' +
          'height:' + BAR_MAX + 'px;padding:' + ((PILL_WAVE_H - BAR_MAX) / 2) + 'px 16px;' +
          'gap:' + BAR_GAP + 'px;pointer-events:none;position:relative;z-index:1;}' +
        // STAGE 2 (is-in): row appears. its bouncy height GROW is driven by a JS transition (not a
        // keyframe) so a ScrollTrigger re-pin / re-insert can't restart it — keyframes replay on
        // re-insertion, transitions don't. see setPillDone.
        '[data-pill="polishing"].is-in .flow_pill-dots{display:flex;}' +
        // each bar is a cream pill. entrance uses TRANSFORM (rise + pop) so it never fights the
        // height-based grow. per-bar transition-delay ripples both phases left→right.
        '.flow_pill-dot{width:' + BAR_W + 'px;height:0;border-radius:999px;background:' + BAR_COLOR + ';' +
          'opacity:0;flex:0 0 auto;transform:translateY(4px) scale(.6);transform-origin:center;' +
          'transition:opacity .22s ease,transform .38s cubic-bezier(.34,1.56,.64,1),height .45s cubic-bezier(.34,1.56,.64,1);}' +
        // STAGE 2 (is-in): bullets wave + fade in (rise + pop to a round dot), with the row grow
        '[data-pill="polishing"].is-in .flow_pill-dot{opacity:1;transform:none;height:' + BAR_W + 'px;}' +
        // STAGE 3 (is-wave): the audio animation — bars grow OUT to their waveform heights
        '[data-pill="polishing"].is-in.is-wave .flow_pill-dot{height:var(--h);}' +
        '@media (prefers-reduced-motion:reduce){[data-pill="polishing"].is-in .flow_pill-dots{animation:none;}}' +
        '@media (prefers-reduced-motion:reduce){[data-pill="polishing"].is-done .flow_pill-dot{transition-duration:.01ms;}}' +
        // intro (220 wpm): a quick TIMED fade — in as the scroll-in starts, out at the shrink (see
        // sceneUpdate). nowrap keeps the label on one line so it never reflows (2 lines↔1) as the
        // card changes width — that reflow was the jank. the marquee svg positions text via its x
        // attr, so let it wrap freely. the keyboard card (45 wpm) gets the same one-line treatment.
        '[data-flow="intro"]{transition:opacity ' + INTRO_FADE_MS + 'ms ease;}' +
        '[data-flow="intro"]{white-space:nowrap;}' +
        '[data-flow="intro"] [data-flow="marquee"]{white-space:normal;}' +
        '[data-flow="kb"]{white-space:nowrap;overflow:hidden;}' +
        '[data-flow="kb"] [data-flow="marquee"]{white-space:normal;}' +
        // message/composer content fades IN on a trigger (see sceneUpdate) — a timed fade, no scrub
        '[data-flow="screen"],[data-flow="composer"]{transition:opacity ' + MSG_FADE_MS + 'ms ease;}' +
        '[data-flow="pill-audio"]{transition:opacity .3s ease;}' +
        // chapter 2: the whole transcript recolours to a looping gradient while "polishing".
        // background-clip:text on the container + transparent glyphs = one gradient over all text.
        '[data-type="raw"].is-polishing{background-image:linear-gradient(100deg,' +
          '#F0D7FF 0%,#FFA946 23%,#FF6C4C 39%,#FFBCF2 67%,#7232A6 91%);background-size:220% 100%;' +
          '-webkit-background-clip:text;background-clip:text;' +
          'animation:flowPolish 3.2s ease-in-out infinite alternate;}' +
        // per-word colour is driven in JS (the eased wavefront), but each word's colour→gradient
        // flip TWEENS via this transition, so it fades in on trigger instead of popping / scrubbing
        '[data-type="raw"].is-polishing .flow_w{transition:color ' + GRAD_WORD_MS + 'ms ease;}' +
        '@keyframes flowPolish{0%{background-position:0% 0;}100%{background-position:100% 0;}}' +
        '@media (prefers-reduced-motion:reduce){[data-type="raw"].is-polishing{animation:none;}' +
          '[data-type="raw"].is-polishing .flow_w{transition:none;}}';
      document.head.appendChild(ms);
    }

    // anchor scroll restoration across a breakpoint cross
    var prevStart = null, prevEnd = null;
    var anchorY = null, anchorStart = null, anchorEnd = null;
    var bpMQ = window.matchMedia('(min-width: 992px)');
    function captureAnchor() {
      anchorY = window.pageYOffset || window.scrollY || 0;
      anchorStart = prevStart; anchorEnd = prevEnd;
    }
    if (bpMQ.addEventListener) { bpMQ.addEventListener('change', captureAnchor); }
    else if (bpMQ.addListener) { bpMQ.addListener(captureAnchor); }

    var builtOnce = false;
    var mm = gsap.matchMedia();
    mm.add({ isDesktop: '(min-width: 992px)', isMobile: '(max-width: 991px)' }, function (ctx) {
      var isDesktop = ctx.conditions.isDesktop;
      var isRebuild = builtOnce; builtOnce = true;

      var teardown = [];
      function guardStyle(el) {
        if (!el) { return el; }
        var prev = el.getAttribute('style');
        teardown.push(function () {
          if (prev === null) { el.removeAttribute('style'); }
          else { el.setAttribute('style', prev); }
        });
        return el;
      }

      var section = one(document, 'section');
      if (!section) { console.warn('[flow-stack] no data-stack="section" found'); return; }

      var card  = one(section, 'card');
      var stage = oneF(section, 'stage');
      var kb    = oneF(section, 'kb');
      if (!card || !stage) { console.warn('[flow-stack] need data-stack="card" and data-flow="stage"'); return; }

      guardStyle(section);
      if (window.getComputedStyle(section).position === 'static') {
        section.style.position = 'relative';
      }
      if (isDesktop) {
        section.style.height   = 'calc(100vh + 2px)';   // bottom seam offscreen while pinned
        section.style.overflow = 'hidden';
      }

      // ---- marquees: drift the svg <text> x attr; loop like the old SMIL animate ----
      // each entry: text el, start x (loop point), data-speed multiplier, current pos
      // each marquee starts fully off-screen right, streams in leftward with scroll, then loops.
      // the authored x attr (e.g. -4000) sets the LOOP PERIOD — how far the text travels
      // before repeating; match it roughly to the length of one repetition of the string.
      var marquees = [];
      Array.prototype.forEach.call(section.querySelectorAll('[' + FLOW + '="marquee"]'), function (wrapEl) {
        var textEl = wrapEl.querySelector('text');
        var svgEl  = wrapEl.querySelector('svg');
        if (!textEl) { return; }
        var period = Math.abs(parseFloat(textEl.getAttribute('x'))) || 4000;
        var vbw    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width)  || 928;
        var vbh    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.height) || 76;
        marquees.push({
          text: textEl, svg: svgEl, period: period, start: vbw + MQ_PAD,
          vbw: vbw, vbh: vbh, len: 0,
          rand: Math.random(),                  // per-pageload loop offset: different words each visit
          mult: parseFloat(wrapEl.getAttribute('data-speed')) || 1
        });
        textEl.setAttribute('x', String(vbw + MQ_PAD));        // initial paint: off-screen right
      });

      // marquee position = pure function of pin progress p (driven from applyScroll). Every
      // string runs off the SAME clock (p) so the two text lines stay locked together; their
      // data-speed is a PURE speed knob (higher = faster), independent of each string's period
      // — period only sets where the loop wraps below. Speed = MQ_TRAVEL × data-speed.
      function updateMarquees(p) {
        for (var i = 0; i < marquees.length; i++) {
          var m = marquees[i];
          // scale = rendered px per viewBox unit; MQ_TRAVEL is in SCREEN px, so divide to get
          // viewBox travel. pace on screen stays constant however wide the svg is drawn.
          var svgW  = m.svg ? m.svg.getBoundingClientRect().width : 0;
          if (svgW <= 0) { continue; }                                  // display:none / unmeasured
          var scale = svgW / m.vbw;
          var travel = -MQ_DIR * p * (MQ_TRAVEL * m.mult) / scale;      // 0 at p=0, reversible
          var x = m.start - travel;                                     // every string streams in at its own steady pace
          if (x < 0) {
            var per = m.len > 0 ? Math.min(m.period, Math.max(100, m.len - m.vbw - MQ_PAD)) : m.period;
            // random per-load offset eased in over the first lap: no jump at the intro
            // handoff, but every page visit shows different words at the same landmarks
            var xx = -x;
            x = -((xx + Math.min(xx, per) * m.rand) % per);
          }
          m.text.setAttribute('x', String(x));
        }
      }

      // ---- audio recorder bars: each rect's height pulses with pin progress ----
      var audioBars = [];
      (function collectAudio() {
        // data-anim="audio" is the intended hook, but it isn't always present in the published
        // DOM — fall back to the Webflow class so the bars animate either way.
        var host = section.querySelector(AUDIO_SEL) || document.querySelector(AUDIO_SEL) ||
                   section.querySelector('.flow_svg-inner') || document.querySelector('.flow_svg-inner');
        if (!host) { if (DEBUG) { console.warn('[flow-stack] no audio svg found'); } return; }
        var svg  = (host.tagName && host.tagName.toLowerCase() === 'svg') ? host : host.querySelector('svg');
        var vbh  = (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.height) || 33;
        Array.prototype.forEach.call(host.querySelectorAll('rect'), function (r) {
          var y = parseFloat(r.getAttribute('y')) || 0;
          var h = parseFloat(r.getAttribute('height')) || parseFloat(window.getComputedStyle(r).height) || 0;
          audioBars.push({
            el: r, cy: y + h / 2, vbh: vbh,
            ceil: AUDIO_MIN + (AUDIO_MAX - AUDIO_MIN) * (0.55 + 0.45 * Math.random()), // per-bar max, jagged
            // two detuned frequencies + random phase per bar → bars move independently, no clean wave
            f1: 0.8 + Math.random() * 1.5, f2: 2.0 + Math.random() * 3.0,
            ph1: Math.random() * 6.2832, ph2: Math.random() * 6.2832
          });
        });
        if (DEBUG) { console.log('[flow-stack] audio bars:', audioBars.length, 'vbh', vbh); }
      }());

      var envPh1 = Math.random() * 6.2832, envPh2 = Math.random() * 6.2832;   // per-load syllable phase

      function updateAudio(p) {
        var TWO_PI = Math.PI * 2;
        var t = p * AUDIO_CYCLES;
        // global loudness envelope: two beat frequencies multiply → uneven bursts and near-silent
        // gaps, the way speech has loud syllables and pauses (not a steady hum)
        var e = (0.5 + 0.5 * Math.sin(t * TWO_PI * 0.9 + envPh1)) *
                (0.5 + 0.5 * Math.sin(t * TWO_PI * 2.3 + envPh2));               // 0..1, spends time low
        for (var i = 0; i < audioBars.length; i++) {
          var b = audioBars[i];
          // per-bar jitter: detuned sines with unique phase — neighbouring bars disagree
          var v = 0.55 * Math.sin(t * TWO_PI * b.f1 + b.ph1) +
                  0.45 * Math.sin(t * TWO_PI * b.f2 + b.ph2);                    // ~ -1..1
          var s = 0.5 + 0.5 * v;                                                 // 0..1
          s *= AUDIO_ENV * e + (1 - AUDIO_ENV);                                  // loud bursts push up, pauses collapse
          var h = (AUDIO_MIN + (b.ceil - AUDIO_MIN) * s) * b.vbh;                // floor..this bar's ceil
          var y = b.cy - h / 2;                                                  // grow from the bar's own centre
          // set BOTH: inline style wins if Webflow authored height via CSS, attribute otherwise
          b.el.style.setProperty('height', h + 'px');
          b.el.style.setProperty('y', y + 'px');
          b.el.setAttribute('height', String(h));
          b.el.setAttribute('y', String(y));
        }
      }

      // ---- morph: both cards are in-flow flex children sharing the stage width; the script
      // splits the 100% between them. real boxes -> class border-radius just works. each
      // marquee is pinned to the full stage width (kb's anchored left, the card's anchored
      // right) so the text never rescales — the cards' overflow crops it into two windows
      // of one continuous line.
      guardStyle(stage);
      stage.style.display = 'block';
      stage.style.width   = '100%';
      if (window.getComputedStyle(stage).position === 'static') { stage.style.position = 'relative'; }
      guardStyle(card);
      card.style.position   = 'absolute';   // coordinates computed directly — no flex packing
      card.style.margin     = '0';
      card.style.overflow   = 'hidden';
      card.style.boxSizing  = 'border-box';
      card.style.willChange = 'width, transform';
      // the photo reveals leftward from a pinned right edge, then re-centres as the card shrinks
      var cardImgs = [];
      Array.prototype.forEach.call(card.querySelectorAll('img'), function (im) {
        guardStyle(im);
        im.style.objectPosition = 'right center';
        cardImgs.push(im);
      });
      // chapter background images: stacked in the card, crossfaded per chapter. author 3 imgs tagged
      // data-bg="0|1|2"; 0 = wpm/recording + chapter 1 (same photo as the card), 1 = ch2, 2 = ch3.
      var bgImgs = Array.prototype.slice.call(card.querySelectorAll('[data-bg]')).sort(function (a, b) {
        return (parseInt(a.getAttribute('data-bg'), 10) || 0) - (parseInt(b.getAttribute('data-bg'), 10) || 0);
      });
      bgImgs.forEach(function (im, k) {
        guardStyle(im);
        // author them hidden in Webflow if you like — we take over: force them displayed and
        // stacked, opacity is the only thing that shows/hides them (the crossfade).
        im.style.setProperty('display', 'block', 'important');
        im.style.setProperty('visibility', 'visible', 'important');
        im.style.position = 'absolute';
        im.style.top = '0'; im.style.left = '0';
        im.style.width = '100%'; im.style.height = '100%';
        im.style.objectFit = 'cover';
        im.style.zIndex = '0';                            // behind the card content (screen/composer)
        im.style.pointerEvents = 'none';
        im.style.transition = 'opacity ' + BG_FADE_MS + 'ms ease';
        im.style.opacity = k === 0 ? '1' : '0';           // start on the wpm image
      });
      var bgShown = 0;
      function setBgChapter(idx) {                          // recording+ch1 -> 0, ch2 -> 1, ch3 -> 2
        if (bgImgs.length < 2) { return; }
        var want = idx < 1 ? 0 : Math.min(idx, bgImgs.length - 1);
        if (want === bgShown) { return; }
        bgShown = want;
        for (var b = 0; b < bgImgs.length; b++) { bgImgs[b].style.opacity = b === want ? '1' : '0'; }
      }
      if (kb) {
        guardStyle(kb);
        kb.style.margin    = '0';
        kb.style.overflow  = 'hidden';
        kb.style.boxSizing = 'border-box';
      }
      // pin each marquee wrapper to the stage width; kb's sits left, the card's sits right
      var kbMq   = kb   ? kb.querySelector('[' + FLOW + '="marquee"]')   : null;
      var cardMq = card ? card.querySelector('[' + FLOW + '="marquee"]') : null;
      if (kbMq)   { guardStyle(kbMq);   kbMq.style.marginRight = 'auto'; }
      if (cardMq) { guardStyle(cardMq); cardMq.style.position  = 'absolute'; }   // stage-fixed backdrop; left set per frame
      // pin both marquees absolute against their own card, not Webflow's authored parent
      [[kb, kbMq], [card, cardMq]].forEach(function (pair) {
        var c = pair[0], mq = pair[1];
        if (!c || !mq) { return; }
        guardStyle(mq);
        if (mq.parentElement && mq.parentElement !== c) {
          guardStyle(mq.parentElement);
          mq.parentElement.style.position = 'static';
        }
        mq.style.position = 'absolute';
      });
      if (kbMq) { kbMq.style.left = '0'; }   // forced absolute above, so restore its left edge
      [kbMq, cardMq].forEach(function (mq) {
        if (!mq) { return; }
        var svg = mq.querySelector('svg');
        if (svg) { guardStyle(svg); svg.style.width = '100%'; }
      });

      // pin both wpm headings to the same % of card height (in PX, from shared stageH) so they
      // stay level at every screen size — see alignHeads() below
      var headEls = [];
      [kb, card].forEach(function (c) {
        if (!c) { return; }
        var head = c.querySelector('.flow_heading-wrap');
        if (!head) { return; }
        guardStyle(head);
        if (window.getComputedStyle(c).position === 'static') { c.style.position = 'relative'; }
        if (head.parentElement && head.parentElement !== c) {
          guardStyle(head.parentElement);
          head.parentElement.style.position = 'static';
        }
        head.style.position  = 'absolute';
        head.style.left      = '0';
        head.style.right     = '0';
        head.style.margin    = '0';
        head.style.textAlign = 'center';
        headEls.push(head);
      });
      function alignHeads() {
        var headPx = (HEAD_TOP * stageH) + 'px';
        for (var hi = 0; hi < headEls.length; hi++) { headEls[hi].style.top = headPx; }
        var mqBase = MQ_TOP * stageH;
        if (kbMq)   { kbMq.style.top   = (mqBase + MQ_NUDGE_KB)   + 'px'; }
        if (cardMq) { cardMq.style.top = (mqBase + MQ_NUDGE_CARD) + 'px'; }
      }

      var stageW = 0, stageH = 0, padL = 0, padT = 0, cardHpx = CARD_H_FALLBACK, msgCollapsedH = 0, msgExpandedH = 0, msgContainBaseH = 0, transcriptH = 0;
      var pillRecY = -180;   // px the pill lifts during recording — recomputed from stage height in measureStage
      function measureStage() {
        // natural sizes while measuring, so a mid-morph refresh can't feed back
        if (kb) { kb.style.width = ''; kb.style.height = ''; kb.style.visibility = ''; }
        card.style.width = ''; card.style.height = '';
        // neutralise any in-progress chapter-2 styling (a refresh can fire mid-scroll); otherwise the
        // grown/shifted message box + collapsed transcript pollute the measurement → card shrinks.
        if (transcriptEl) { transcriptEl.style.height = ''; transcriptEl.style.transform = ''; transcriptEl.style.opacity = ''; }
        if (msgGrowEl)    { msgGrowEl.style.height = ''; msgGrowEl.style.marginTop = '0px'; }
        if (msgContainEl) { msgContainEl.style.height = ''; msgContainEl.style.marginTop = '0px'; }
        if (polishedEl)   { polishedEl.style.display = ''; }
        // the CONTENT box: padding on the stage must not count, or the cards overflow it
        var cs = window.getComputedStyle(stage);
        padL = parseFloat(cs.paddingLeft) || 0;
        padT = parseFloat(cs.paddingTop)  || 0;
        stageW = (stage.clientWidth  - padL - (parseFloat(cs.paddingRight)  || 0)) || 1;
        stageH = (stage.clientHeight - padT - (parseFloat(cs.paddingBottom) || 0)) || 1;
        if (kbMq)   { kbMq.style.width   = stageW + 'px'; }
        if (cardMq) { cardMq.style.width = stageW + 'px'; }
        // size each svg to its viewBox aspect at the stage width: scale is then exactly the
        // width ratio (no meet/slice bands), so text always spans the full width. also
        // re-measure text lengths (webfonts change them) for the loop clamp below.
        for (var mi = 0; mi < marquees.length; mi++) {
          var mm = marquees[mi];
          if (mm.svg) {
            mm.svg.style.width    = stageW + 'px';
            mm.svg.style.height   = (stageW * mm.vbh / mm.vbw) + 'px';
            mm.svg.style.overflow = 'visible';   // wave crests may ride above the viewBox
          }
          try { mm.len = mm.text.getComputedTextLength ? mm.text.getComputedTextLength() : 0; } catch (e) { mm.len = 0; }
        }
        // measure everything at the FINAL card width, inside one screen-at-final-width context,
        // so text wraps exactly as it will when landed (natural-width measures are wildly wrong).
        if (CARD_H === 'auto' && screenEl) {
          var saved = screenEl.style.cssText;
          screenEl.style.position = 'static';
          screenEl.style.height   = 'auto';
          screenEl.style.width    = Math.min(CARD_W, stageW) + 'px';
          screenEl.style.opacity  = '0';                 // no flash during the measure

          transcriptH = transcriptEl ? transcriptEl.offsetHeight : 0;

          // message box collapsed (polished hidden) vs expanded (polished laid out).
          // we also grab the WHITE box (contain) collapsed height — that's the element that
          // actually grows upward, so the white rises with the text (see sceneUpdate).
          if (msgGrowEl) {
            var mv = msgGrowEl.style.cssText;
            var mcv = msgContainEl ? msgContainEl.style.cssText : null;
            msgGrowEl.style.height = 'auto'; msgGrowEl.style.maxHeight = 'none'; msgGrowEl.style.overflow = 'visible';
            if (polishedEl) { polishedEl.style.display = 'none'; }
            msgCollapsedH = msgGrowEl.offsetHeight;
            if (msgContainEl) { msgContainEl.style.height = 'auto'; msgContainBaseH = msgContainEl.offsetHeight; }
            if (polishedEl) { polishedEl.style.display = ''; }
            msgExpandedH = msgGrowEl.offsetHeight;
            msgGrowEl.style.cssText = mv; msgGrowEl.style.overflow = 'hidden';
            if (msgContainEl && mcv != null) { msgContainEl.style.cssText = mcv; }
          }
          // screen baseline = chapter-1 state (message box collapsed), so we don't double-count polished
          var mgh = msgGrowEl ? msgGrowEl.style.cssText : null;
          if (msgGrowEl) { msgGrowEl.style.height = msgCollapsedH + 'px'; msgGrowEl.style.overflow = 'hidden'; }
          var screenBase = screenEl.offsetHeight;
          if (msgGrowEl && mgh != null) { msgGrowEl.style.cssText = mgh; }

          screenEl.style.cssText = saved;                // restore exactly
          // constant landed height = the chapter-1 layout. the message box grows UPWARD over the
          // (faded, space-kept) transcript, so its footprint never changes and the card holds height.
          cardHpx = (screenBase > 0 ? screenBase : CARD_H_FALLBACK) + CARD_PAD_BOTTOM;
        } else {
          cardHpx = (typeof CARD_H === 'number') ? CARD_H : CARD_H_FALLBACK;
        }
        // cap against the VIEWPORT (the card rides down over the tabs), not the little stage row
        cardHpx = Math.min(cardHpx, (window.innerHeight || 900) * CARD_H_MAX);
        // recording-pill lift scales with the stage height (capped), so it sits at a consistent
        // spot in the full-bleed card across screen sizes instead of overshooting when short.
        pillRecY = -Math.min(PILL_REC_Y_MAX, Math.round(stageH * PILL_REC_VH));
      }

      // triggered final close-up: fillA.v 0 → 1 pulls the split to 0 (kb out, flow card full). the
      // tween runs on time, so onUpdate re-renders the morph at the last scroll position each frame.
      var fillA = { v: 0 }, fillLatched = false, lastMorphP = 0;
      function triggerFill(on) {
        gsap.to(fillA, { v: on ? 1 : 0, duration: FILL_MS / 1000, ease: 'power3.out',
          overwrite: true, onUpdate: function () { applyMorph(lastMorphP); } });
      }

      // width split per phase. Lp = where the photo card's left edge sits (px from stage left)
      function applyMorph(p) {
        lastMorphP = p;
        // photo layout: through the reveal + hold, PIN each photo at the full-bleed size (stageW×
        // stageH) with its right edge fixed at the stage's right — the widening card window then
        // reveals it as a pure crop, with NO object-fit cover rescale (that zoom was the "scale
        // shift"). at the shrink it hands back to 100%×100% cover so it scales down with the centred
        // card. boundary is continuous: at pBh the card is still full, so 100% == the pinned size.
        var pinnedPhoto = (p < pBh);
        for (var im = 0; im < bgImgs.length; im++) {
          var bi = bgImgs[im];
          if (pinnedPhoto) {
            bi.style.width  = stageW + 'px'; bi.style.height = stageH + 'px';
            bi.style.left   = 'auto';        bi.style.right  = '0';
          } else {
            bi.style.width  = '100%';        bi.style.height = '100%';
            bi.style.left   = '0';           bi.style.right  = 'auto';
          }
          bi.style.objectPosition = '50% center';
        }
        var cardW, cardH = stageH, kbW = 0;
        if (p < pB) {                        // P0 + P1: photo edge sweeps right -> left
          var gt = (p < pA || pB <= pA) ? 0 : (p - pA) / (pB - pA);
          // near the end of the grow, LATCH the timed close-up (hysteresis so it doesn't chatter)
          if (!fillLatched && gt >= FILL_AT)      { fillLatched = true;  triggerFill(true); }
          else if (fillLatched && gt < FILL_OFF)  { fillLatched = false; triggerFill(false); }
          var Lp = stageW * (1 - snapEnds(gt));   // width of the left (kb) column
          // once the kb column drops under CARD_MIN_W, ease it the rest of the way to 0 so it
          // disappears sooner. deriving BOTH widths from this one split keeps the cards flush —
          // the flow card grows to fill exactly what the kb gives up, so there's never a gap.
          var lpFrac = Lp / stageW;
          if (lpFrac < CARD_MIN_W) { Lp *= smooth(lpFrac / CARD_MIN_W); }
          Lp *= (1 - fillA.v);                    // triggered close-up pulls the split shut on a timer
          cardW = stageW - Lp;
          kbW   = Math.max(0, Lp - CARD_GAP);   // kb fills the (collapsed) left column; card butts against it
        } else if (p < pBh) {                // hold at full bleed
          cardW = stageW;
        } else {                             // P2 + after: shrink to the centred final card
          var t = phaseT(p, pBh, pC);
          cardW = stageW - (stageW - Math.min(CARD_W, stageW)) * t;
          cardH = stageH + (cardHpx - stageH) * t;      // grows from the full-bleed height to the landed height
          card.style.borderRadius = (RADIUS_FULL + (RADIUS_END - RADIUS_FULL) * t) + 'px';
        }
        if (p < pBh) { card.style.borderRadius = ''; }   // class radius before the shrink
        if (kb) {
          kb.style.width      = kbW + 'px';        // kbW already collapsed in the split above
          kb.style.height     = stageH + 'px';     // both cards always full stage height
          kb.style.visibility = kbW < 2 ? 'hidden' : '';
        }
        // grow: right edge fixed at the stage's content-right, growth is leftward only.
        // shrink: centred. (continuous at the boundary — both give left = padL at full width)
        var left = (p < pBh) ? padL + (stageW - cardW) : padL + (stageW - cardW) / 2;
        // card marquee (the bent wave svg, stageW wide): LEFT-ALIGNED to the card through the reveal
        // (its left edge tracks the card's left edge), then eased to CENTRED as the card centres +
        // lands (pBh→pC) — so the wave's bump ends up over the pill. ca: 0 = left-aligned, 1 = centred.
        // (at full bleed cardW == stageW, so both give left = 0 — the handoff is seamless.)
        if (cardMq) {
          var ca = phaseT(p, pBh, pC);
          cardMq.style.left = (ca * (cardW - stageW) / 2) + 'px';
        }
        card.style.left       = left + 'px';
        card.style.top        = (padT + (stageH - cardH) / 2) + 'px';
        card.style.width      = cardW + 'px';
        card.style.height     = cardH + 'px';
        card.style.visibility = cardW < 2 ? 'hidden' : '';
      }

      // ---- green panel / seam cover / mode swap (same as stack.js) ----
      var greenPanel = one(section, 'green');
      if (!greenPanel) {
        greenPanel = card;
        while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
      }
      var canLeave = greenPanel !== card;
      guardStyle(greenPanel);
      if (canLeave && GREEN_RADIUS && !greenPanel.hasAttribute('data-corners')) {
        greenPanel.setAttribute('data-corners', String(parseFloat(GREEN_RADIUS) || 80));
        if (window.Corners) { window.Corners.scan(); }
      }

      var greenBg  = canLeave ? window.getComputedStyle(greenPanel).backgroundColor : '';
      var topCover = null;
      if (canLeave && greenBg && greenBg !== 'rgba(0, 0, 0, 0)' && greenBg !== 'transparent') {
        topCover = document.createElement('div');
        topCover.setAttribute('aria-hidden', 'true');
        topCover.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;pointer-events:none;' +
          'display:none;z-index:989;background:' + greenBg + ';';
        document.body.appendChild(topCover);
        teardown.push(function () { if (topCover.parentNode) { topCover.parentNode.removeChild(topCover); } });
      }

      document.documentElement.setAttribute('data-stack-mode', isDesktop ? 'desktop' : 'mobile');
      var inSel  = isDesktop ? DESKTOP_SEL : MOBILE_SEL;
      var inDisp = isDesktop ? DESKTOP_DISPLAY : MOBILE_DISPLAY;
      Array.prototype.forEach.call(document.querySelectorAll(inSel), function (el) {
        guardStyle(el);
        el.style.display = '';
        if (window.getComputedStyle(el).display === 'none') { el.style.setProperty('display', inDisp, 'important'); }
      });

      // ---- content ride + tabs (same engine as stack.js) ----
      var transWrap = section.querySelector('.meeting_transition_wrap');
      var tabsWrap  = isDesktop ? (section.querySelector(TABS_SEL) || section.querySelector(DESKTOP_SEL)) : null;
      var contentEls = [greenPanel, transWrap, tabsWrap].filter(Boolean);

      if (greenPanel) { greenPanel.style.position = 'relative'; greenPanel.style.zIndex = '900'; }
      if (transWrap)  { guardStyle(transWrap); transWrap.style.zIndex = '1'; }
      if (tabsWrap)   { guardStyle(tabsWrap);  tabsWrap.style.zIndex  = '1'; }

      var tabItems = tabsWrap ? Array.prototype.slice.call(tabsWrap.querySelectorAll('.meeting_tabs_item')) : [];
      var numTabs  = Math.max(1, tabItems.length);
      var tabTexts = section.querySelectorAll('[data-tab-text]');
      var tabAnims = section.querySelectorAll('[data-tab-anim]');
      var bgSvgs   = section.querySelectorAll('[data-tab-bg]');
      var tabIndicator = tabsWrap ? tabsWrap.querySelector('[data-tab-indicator]') : null;
      var activeTab = -1;
      var bgTargetP = 0, bgCurrentP = 0;

      // ---- card scene: chapter 1 transcript typing + status pills ----
      // handoff (card ride pC->pHold) crossfades the intro out and the transcript/composer/pills in;
      // then within tab 0's scroll slice the transcript types word-by-word and the pill tracks the
      // category of the latest revealed highlight word.
      var introEl      = oneF(section, 'intro');                 // 220wpm + marquee — quick triggered fade
      if (introEl) { introEl.style.opacity = '0'; }              // start hidden → first update fades it in (0.25s)
      var screenEl     = oneF(section, 'screen');                // optional: one cover holding all chapter content
      var composerEl   = oneF(section, 'composer');
      var pillAudioEl  = oneF(section, 'pill-audio');            // recorder — glides down + shrinks at handoff
      var pillExtras   = pillAudioEl ? Array.prototype.slice.call(pillAudioEl.querySelectorAll('[data-pill-extra]')) : [];
      if (pillAudioEl) { guardStyle(pillAudioEl); pillAudioEl.style.transformOrigin = '50% 50%'; }
      // extras start at 0×0 (no space in the pill) and scale out to PILL_ICON_SIZE on the handoff
      pillExtras.forEach(function (el) {
        guardStyle(el);
        el.style.flex = '0 0 auto';
        el.style.overflow = 'hidden';
        el.style.opacity = '0';
        el.style.width = '0px';
        el.style.height = '0px';
      });
      var transcriptEl = card ? card.querySelector('[data-type="raw"]') : null;
      // raw-out wipe masks the transcript's WRAPPER, not the transcript (masking the same element
      // that has background-clip:text fights it on Blink/WebKit).
      var rawWrap = (transcriptEl && transcriptEl.parentNode) ? transcriptEl.parentNode : transcriptEl;
      var polishedEl   = card ? card.querySelector('[data-type="polished"]') : null;
      var destWrap     = card ? card.querySelector('.flow_icons-destination') : null;
      // ---- chapter 3 (Distribute) fan ----
      // slack card = the live composer note (card 0, reused). claude + gmail are authored copies:
      // duplicate .flow_message-wrap, tag data-dest, drop in a [data-flow="fan"] absolute overlay.
      var fanScope   = screenEl || section;
      var fanLayer   = oneF(section, 'fan') || fanScope.querySelector('[data-flow="fan"]');
      // LOGOS = the [data-dest] SVGs that live inside .flow_icons-destination (top of the card).
      var destLogos  = destWrap ? Array.prototype.slice.call(destWrap.querySelectorAll('[data-dest]')) : [];
      // CARDS = the [data-dest] note copies NOT in the logo wrap, and not slack (slack = live note).
      var destExtra  = Array.prototype.slice.call(fanScope.querySelectorAll('[data-dest]')).filter(function (el) {
        if (destWrap && destWrap.contains(el)) { return false; }       // it's a logo, not a card
        return (el.getAttribute('data-dest') || '').trim().toLowerCase() !== 'slack';
      });
      // fan order: live note (slack) first, then the authored copies in slack→claude→gmail order
      var DEST_ORDER = { claude: 1, gmail: 2 };
      destExtra.sort(function (a, b) {
        return (DEST_ORDER[a.getAttribute('data-dest')] || 9) - (DEST_ORDER[b.getAttribute('data-dest')] || 9);
      });
      var slackCenterY = 0;   // reserved; vertical placement handled via FAN_CENTER_NUDGE (manual)
      var fanPositioned = false;   // cards get placed over the note lazily, once the card is landed
      // NB: don't touch screenEl's position — it's an absolute cover; overriding it drops the
      // transcript + note out of view. it's already a positioned ancestor, so it anchors the cards.
      if (fanLayer) { guardStyle(fanLayer); fanLayer.style.position = 'absolute'; fanLayer.style.opacity = '0'; }
      destExtra.forEach(function (el) {
        guardStyle(el);
        el.style.position = 'absolute';         // out of flow so they don't inflate the card height
        el.style.willChange = 'transform,opacity';
        el.style.transformOrigin = FAN_PIVOT;
        el.style.backfaceVisibility = 'hidden';
        el.style.opacity = '0';                 // hidden until chapter 3 (avoid a pre-fan flash)
      });
      destLogos.forEach(function (el) { guardStyle(el); el.style.transformOrigin = '50% 50%'; el.style.opacity = '0'; });
      // place the absolute cards over the live note; each card's lift centres its OWN box in the
      // frame (regardless of height → no downward drift).
      function positionFanCards() {
        if (!composerEl) { return; }
        var scr = screenEl || composerEl.offsetParent;
        var scH = scr ? scr.clientHeight : 0;
        var t = composerEl.offsetTop, l = composerEl.offsetLeft, w = composerEl.offsetWidth;
        // slack: centre by TEXT height only (SLACK_PAD grows the box DOWN, doesn't lift it)
        composerEl._fanCY = Math.round(scH / 2 - (t + composerEl.offsetHeight / 2));
        for (var i = 0; i < destExtra.length; i++) {
          var el = destExtra[i];
          el.style.top   = t + 'px';
          el.style.left  = l + 'px';
          el.style.width = w + 'px';
          el._fanCY = Math.round(scH / 2 - (t + el.offsetHeight / 2));
        }
      }
      var pillEls      = Array.prototype.slice.call(section.querySelectorAll('[data-pill]'));
      var pillMap = {};
      pillEls.forEach(function (el) {
        guardStyle(el);
        var key = (el.getAttribute('data-pill') || '').trim().toLowerCase();
        if (key) { pillMap[key] = el; }
        // char-wrap the label so it can ripple; CSS drives visibility via the .is-on class.
        // prefer .flow_text-type, else the first leaf element that actually holds text (variants
        // and the separate polishing component may class their label differently).
        var txt = el.querySelector('.flow_text-type');
        if (!txt) {
          var cand = el.querySelectorAll('*');
          for (var qi = 0; qi < cand.length; qi++) {
            if (cand[qi].children.length === 0 && (cand[qi].textContent || '').trim()) { txt = cand[qi]; break; }
          }
        }
        if (txt && !txt.querySelector('.pill-ch')) {
          var s = txt.textContent; txt.textContent = '';
          for (var ci = 0; ci < s.length; ci++) {
            var ch = document.createElement('span');
            ch.className = 'pill-ch';
            ch.textContent = s.charAt(ci) === ' ' ? ' ' : s.charAt(ci);
            ch.style.transitionDelay = (0.16 + ci * 0.018) + 's';   // starts after the pill grows out
            txt.appendChild(ch);
          }
        }
      });

      // spinner: drop the 4-point sparkle SVG into any [data-flow="spinner"] that doesn't have one
      // (the CSS spins it). fill uses currentColor so it inherits the spinner's colour.
      Array.prototype.forEach.call(section.querySelectorAll('[' + FLOW + '="spinner"]'), function (sp) {
        if (sp.querySelector('svg')) { return; }
        sp.innerHTML = '<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M7.53991 0.363512L8.60385 2.9853C9.04863 4.08175 9.91825 4.95137 11.0147 5.39615L13.6365 ' +
          '6.46009C14.1212 6.65699 14.1212 7.34338 13.6365 7.53991L11.0147 8.60385C9.91825 9.04863 9.04863 ' +
          '9.91825 8.60385 11.0147L7.53991 13.6365C7.34301 14.1212 6.65662 14.1212 6.46009 13.6365L5.39615 ' +
          '11.0147C4.95137 9.91825 4.08175 9.04863 2.9853 8.60385L0.363512 7.53991C-0.121171 7.34301 ' +
          '-0.121171 6.65662 0.363512 6.46009L2.9853 5.39615C4.08175 4.95137 4.95137 4.08175 5.39615 ' +
          '2.9853L6.46009 0.363512C6.65662 -0.121171 7.34301 -0.121171 7.53991 0.363512Z" fill="currentColor"/></svg>';
      });

      // chapter-3 "done" state morphs the polishing pill (spinner+label → voice waveform). inject bars.
      var polishPill = pillMap.polishing || null;
      if (polishPill) {
        var polishWrap = polishPill.querySelector('.flow_pill-polish_wrap') || polishPill;
        if (!polishWrap.querySelector('.flow_pill-dots')) {
          var dw = document.createElement('div'); dw.className = 'flow_pill-dots';
          for (var di = 0; di < BAR_SHAPE.length; di++) {
            var bar = document.createElement('span'); bar.className = 'flow_pill-dot';
            bar.style.setProperty('--h', (BAR_MIN + BAR_SHAPE[di] * (BAR_MAX - BAR_MIN)) + 'px');  // grow-out target
            bar.style.transitionDelay = (di * 0.03) + 's';           // left→right ripple (both phases)
            dw.appendChild(bar);
          }
          polishWrap.appendChild(dw);
        }
        // hug content (not full-width) — !important to beat an authored width:100% rule
        polishPill.style.setProperty('align-self', 'center', 'important');
        polishPill.style.setProperty('flex', '0 0 auto', 'important');
        polishPill.style.setProperty('width', 'fit-content', 'important');
        polishPill.style.setProperty('min-width', '0', 'important');
        polishPill.style.setProperty('max-width', '100%', 'important');
        // pill height comes from the dots row's own padding (see .flow_pill-dots), not the outer pill.
        // manual nudge onto the audio-pill spot (top, not transform, so it never fights scaleX).
        if (POLISH_PILL_Y) { polishPill.style.position = 'relative'; polishPill.style.top = POLISH_PILL_Y + 'px'; }
      }
      // chapter-3 pill choreography: STAGE1 is-done (spinner+label out, ring draws) → STAGE2 is-in
      // (row grows bouncy + bullets wave in) → STAGE3 is-wave (bars grow to audio heights).
      // leaving ch3 drops all three so it replays from scratch next time.
      var pillDoneOn = false, pillCalls = [], pillOffCall = null, voiceLatched = false;
      function killPillCalls() { for (var c = 0; c < pillCalls.length; c++) { pillCalls[c].kill(); } pillCalls = []; }
      function setPillDone(on) {
        if (!polishPill) { return; }
        if (on) {
          if (pillOffCall) { pillOffCall.kill(); pillOffCall = null; }   // a brief dip below ch3 — cancel the exit
          if (pillDoneOn) { return; }
          pillDoneOn = true;
          killPillCalls();
          polishPill.classList.add('is-done');                                   // stage 1
          pillCalls.push(gsap.delayedCall(PILL_OUT_MS / 1000, function () {
            polishPill.classList.add('is-in');                                   // stage 2
            // bouncy row grow via a JS transition (not a CSS keyframe → a ST re-pin can't replay it)
            var row = polishPill.querySelector('.flow_pill-dots');
            if (row) {
              row.style.transition = 'none';
              row.style.height = '0px';
              void row.offsetHeight;                                             // reflow so the next set transitions
              row.style.transition = 'height .5s cubic-bezier(.34,1.56,.64,1)';
              row.style.height = BAR_MAX + 'px';
            }
          }));
          pillCalls.push(gsap.delayedCall((PILL_OUT_MS + BULLET_MS) / 1000, function () {
            polishPill.classList.add('is-wave');                                 // stage 3
          }));
        } else {
          if (!pillDoneOn || pillOffCall) { return; }
          // debounce the exit: only leave voice mode if we STAY below ch3 — a one-frame scrub dip at
          // the ch2/ch3 boundary must not tear down + re-draw the white ring (that was the "twice").
          pillOffCall = gsap.delayedCall(0.2, function () {
            pillOffCall = null; pillDoneOn = false; killPillCalls();
            polishPill.classList.remove('is-wave');
            polishPill.classList.remove('is-in');
            polishPill.classList.remove('is-done');
          });
        }
      }
      teardown.push(function () { killPillCalls(); if (pillOffCall) { pillOffCall.kill(); } });

      // wrap every word of the transcript in a reveal span; highlight words keep their
      // flow_type-* colour class and carry that class's suffix as their category.
      var words = [];
      (function buildTranscript() {
        if (!transcriptEl) { return; }
        function catOf(el) {
          var m = el && el.className ? /(?:^|\s)flow_type-([a-z]+)/.exec(el.className) : null;
          return m ? m[1] : null;
        }
        // rebuild (breakpoint cross): DOM already wrapped — just recollect, don't re-wrap
        if (transcriptEl.querySelector('.flow_w')) {
          Array.prototype.forEach.call(transcriptEl.querySelectorAll('.flow_w'), function (w) {
            w.style.opacity = '0';
            words.push({ el: w, cat: catOf(w.parentNode) });
          });
          return;
        }
        function wrapWords(container, cat) {
          var raw = container.textContent;
          container.textContent = '';
          raw.split(/(\s+)/).forEach(function (chunk) {
            if (chunk === '') { return; }
            if (/^\s+$/.test(chunk)) { container.appendChild(document.createTextNode(chunk)); return; }
            var w = document.createElement('span');
            w.className = 'flow_w';
            w.textContent = chunk;
            w.style.opacity = '0';
            container.appendChild(w);
            words.push({ el: w, cat: cat });
          });
        }
        var nodes = Array.prototype.slice.call(transcriptEl.childNodes);
        nodes.forEach(function (node) {
          if (node.nodeType === 3) {                              // text node → plain words
            var frag = document.createElement('span');
            transcriptEl.replaceChild(frag, node);
            frag.style.display = 'contents';
            frag.textContent = node.textContent;
            wrapWords(frag, null);
          } else if (node.nodeType === 1) {                       // highlight span → coloured words
            wrapWords(node, catOf(node));
          }
        });
      }());

      // polished message: wrap words for the wave-in; the composer's placeholder hides as it fills
      var pwords = [];
      (function buildPolished() {
        if (!polishedEl) { return; }
        guardStyle(polishedEl);
        // override any authored height:0 / opacity:0 / position:absolute — the container must be
        // in normal flow (so it grows the box), visible, natural height. words do the fade.
        polishedEl.style.position = 'relative';
        polishedEl.style.overflow = 'visible';
        polishedEl.style.opacity = '1';
        polishedEl.style.height = 'auto';
        // lift the polished text up over where the placeholder sat (transform → doesn't disturb
        // the measured box heights, so the grow math stays intact)
        polishedEl.style.transform = 'translateY(-' + POLISH_RISE + 'px)';
        if (polishedEl.querySelector('.flow_pw')) {                // rebuild: already wrapped, just recollect
          Array.prototype.forEach.call(polishedEl.querySelectorAll('.flow_pw'), function (w) { w.style.opacity = '0'; pwords.push(w); });
          return;
        }
        var raw = polishedEl.textContent; polishedEl.textContent = '';
        raw.split(/(\s+)/).forEach(function (chunk) {
          if (chunk === '') { return; }
          if (/^\s+$/.test(chunk)) { polishedEl.appendChild(document.createTextNode(chunk)); return; }
          var w = document.createElement('span'); w.className = 'flow_pw'; w.textContent = chunk; w.style.opacity = '0';
          polishedEl.appendChild(w); pwords.push(w);
        });
      }());
      var placeholderEl = (composerEl && composerEl.querySelector('.flow_message-placeholder')) ||
                          section.querySelector('.flow_message-placeholder');
      if (placeholderEl) { guardStyle(placeholderEl); }
      var msgGrowEl = oneF(section, 'msg-grow');                 // the box that grows to hold the message
      // reveal = clip (overflow hidden) + grow height, riding the top up via negative margin so the
      // footprint (icons below) stays put. the box carries the WHITE so the rising edge shows white.
      var msgContainEl = msgGrowEl ? msgGrowEl.parentNode : null;
      if (!(msgContainEl && msgContainEl.nodeType === 1)) { msgContainEl = null; }
      if (msgGrowEl) {
        guardStyle(msgGrowEl);
        msgGrowEl.style.overflow = 'hidden';
        // inherit the composer's white surface so the growing box IS the white box
        if (msgContainEl) {
          var ccs = window.getComputedStyle(msgContainEl);
          if (ccs.backgroundColor && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            msgGrowEl.style.backgroundColor    = ccs.backgroundColor;
          }
          msgGrowEl.style.borderTopLeftRadius  = ccs.borderTopLeftRadius;
          msgGrowEl.style.borderTopRightRadius = ccs.borderTopRightRadius;
        }
      }
      // parent must not clip the upward-grown box (it rides above the contain's own top edge)
      if (msgContainEl) { guardStyle(msgContainEl); msgContainEl.style.overflow = 'visible'; }

      Array.prototype.forEach.call(bgSvgs, function (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) {
          guardStyle(p);
          var len = (p.getTotalLength ? p.getTotalLength() : 0) || 1;
          p.style.strokeDasharray  = len;
          p.style.strokeDashoffset = len;
          p._len = len;
        });
      });
      function drawBg(tp) {
        var N = bgSvgs.length; if (!N) { return; }
        for (var i = 0; i < N; i++) {
          var local = (tp - i / N) * N;
          local = local < 0 ? 0 : (local > 1 ? 1 : local);
          var f = (local <= 0.5) ? (1 - local * 2) : (-(local - 0.5) * 2);
          Array.prototype.forEach.call(bgSvgs[i].querySelectorAll('path'), function (p) {
            p.style.strokeDashoffset = String(f * p._len);
          });
        }
      }

      function toggleByIndex(list, attr, n) {
        Array.prototype.forEach.call(list, function (el) {
          el.classList.toggle('is-active', parseInt(el.getAttribute(attr), 10) === n);
        });
      }
      function moveIndicator(n) {
        if (!tabIndicator || !tabItems[n]) { return; }
        var label = tabItems[n].querySelector('.meeting_tabs_text_wrap') || tabItems[n];
        tabIndicator.style.transform = 'translateY(' + label.offsetTop + 'px)';
        tabIndicator.style.height    = label.offsetHeight + 'px';
      }
      function setActiveTab(n) {
        if (n === activeTab) { return; }
        activeTab = n;
        for (var i = 0; i < tabItems.length; i++) { tabItems[i].classList.toggle('is-active', i === n); }
        if (tabsWrap) { tabsWrap.setAttribute('data-active-tab', String(n)); }
        section.setAttribute('data-active-tab', String(n));
        toggleByIndex(tabTexts, 'data-tab-text', n);
        toggleByIndex(tabAnims, 'data-tab-anim', n);
        moveIndicator(n);
      }

      // card rise: the card's final visual box is the centred clip inside the stage, so the
      // stage rect is the measuring stick (card el itself always spans the full stage)
      var cardRiseDist = 0, sCenter = 0, sCardStart = 0;
      function measurePositions() {
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        gsap.set(card, { y: 0 });
        var mid  = window.innerHeight * CARD_TARGET;
        var sTop = section.getBoundingClientRect().top;
        var cr   = stage.getBoundingClientRect();
        cardRiseDist = ((cr.top - sTop) + cr.height / 2) - mid;
        if (cardRiseDist < 0) { cardRiseDist = 0; }
        if (tabsWrap) {
          var tr = tabsWrap.getBoundingClientRect();
          sCenter = ((tr.top - sTop) + tr.height / 2) - mid;
        } else {
          sCenter = cardRiseDist;
        }
        if (sCenter < cardRiseDist) { sCenter = cardRiseDist; }
        sCardStart = sCenter - cardRiseDist;
      }

      // ---- pin timing ----
      var totalVH = 1, pA = 0, pB = 0, pBh = 0, pC = 0, pHold = 1, tabSpan = 1;
      var snapPoints = [], tabStops = [];        // tabStops: p-boundaries [pHold, end0, end1, …, 1]
      function tabVHs() {                        // per-tab scroll length in vh
        if (CH_VH && CH_VH.length === numTabs) { return CH_VH.slice(); }
        var a = []; for (var i = 0; i < numTabs; i++) { a.push(i < numTabs - 1 ? TAB_STEP_VH : END_HOLD_VH); }
        return a;
      }
      function computeTiming() {
        var contentVH = (isDesktop && window.innerHeight) ? (sCenter / window.innerHeight) : 0;
        var vhs = tabVHs();
        var tabsVH = 0; if (isDesktop) { for (var i = 0; i < vhs.length; i++) { tabsVH += vhs[i]; } }
        tabSpan = tabsVH / TAB_STEP_VH || 1;
        totalVH = IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH + contentVH + tabsVH;
        pA    = IN_VH / totalVH;                                           // scrub-in ends, grow begins
        pB    = (IN_VH + GROW_VH) / totalVH;                               // full bleed
        pBh   = (IN_VH + GROW_VH + FULL_HOLD_VH) / totalVH;                // hold ends, shrink begins
        pC    = (IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH) / totalVH;    // final card, ride begins
        pHold = (IN_VH + GROW_VH + FULL_HOLD_VH + SHRINK_VH + contentVH) / totalVH;   // tabs begin
        tabStops = [pHold];
        var acc = 0, sum = tabsVH || 1;
        for (var j = 0; j < vhs.length; j++) { acc += vhs[j]; tabStops.push(pHold + (acc / sum) * (1 - pHold)); }
        snapPoints = [0, pA, pB, pC, pHold, 1];
      }
      computeTiming();

      // which chapter p is in + local progress 0..1 through that chapter's scroll slice
      function tabLocal(p) {
        for (var i = 0; i < numTabs; i++) {
          if (p < tabStops[i + 1] || i === numTabs - 1) {
            var a = tabStops[i], b = tabStops[i + 1];
            var tp = b > a ? (p - a) / (b - a) : 1;
            return { idx: i, tp: tp < 0 ? 0 : (tp > 1 ? 1 : tp) };
          }
        }
        return { idx: 0, tp: 0 };
      }

      // ---- card scene driver: handoff crossfade + chapter-1 typing + pill ----
      var wordsShown = -1, pillShown = 0, polishColored = false;
      function resetPolishColor() {                              // clear the gradient per-word colours (once)
        if (!polishColored) { return; }
        for (var i = 0; i < words.length; i++) { words[i].el.style.color = ''; }
        polishColored = false;
      }

      // chapter-3 fan: card 0 = live note (slack), then authored copies. tp scrubs which is centred;
      // offset-from-centre → rotate+translate about the pivot = arc. live note resets to normal when OFF.
      // fan smoothing state: fanUpdate sets TARGETS from scroll; fanTick eases the rendered
      // values (fanFCur/fanLiftCur) toward them and calls fanRender — so the fan glides + settles
      // on each beat instead of tracking raw scroll. fanShow flips draw on/off (ch3 only).
      var fanFCur = 0, fanFTgt = 0, fanLiftCur = 1, fanLiftTgt = 1, fanShow = false, fanShownState = null, fanN = 0;

      function fanUpdate(tp, show) {                 // set targets from the scrubbed tp (no render)
        var live = composerEl;
        var n = (live ? 1 : 0) + destExtra.length;
        fanN = n; fanShow = show;
        if (n < 2) { return; }                       // render handled in fanTick / fanRender
        if (fanLayer) { fanLayer.style.opacity = show ? '1' : '0'; }
        // position lazily on first show — by then the card is LANDED, so the note's offset is correct
        if (show && !fanPositioned) { positionFanCards(); fanPositioned = true; }
        // two scrubbed phases: LIFT the note to centre (no jump from ch2), then SWING the cards through
        fanLiftTgt = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);
        var swingTp = FAN_LIFT_END < 1 ? Math.max(0, (tp - FAN_LIFT_END) / (1 - FAN_LIFT_END)) : 0;
        fanFTgt = fanStep(swingTp, n);   // parked beats at each card, fast swing between (see FAN_HOLD)
      }

      // render the fan at an explicit eased position (f = which card is centred, liftT = note lift)
      function fanRender(f, liftT, show) {
        var live = composerEl;
        var n = fanN;
        if (n < 2) { if (live && !show) { live.style.transform = ''; live.style.transformOrigin = ''; } return; }
        function place(el, i, isLive) {
          var rel = i - f, ar = Math.abs(rel);
          if (!show) {
            if (isLive) { el.style.transform = ''; el.style.transformOrigin = ''; }  // back to normal
            else { el.style.opacity = '0'; }
            return;
          }
          var op = 1 - Math.max(0, Math.min(1, (ar - 1) / FAN_FADE));
          var cy = ((el._fanCY || 0) + FAN_CENTER_NUDGE) * liftT;   // ramp the centring lift (smooth)
          el.style.transformOrigin = FAN_PIVOT;
          el.style.transform = 'translate(' + (FAN_TX * rel) + 'px,' + cy + 'px) rotate(' + (FAN_ANGLE * rel) +
            'deg) scale(' + (1 - (1 - FAN_SCALE) * Math.min(1, ar)) + ')';
          el.style.opacity = String(op < 0 ? 0 : op);
          el.style.zIndex  = String(100 - Math.round(ar * 10));
          if (!isLive) { el.style.pointerEvents = 'none'; }
        }
        var ci = 0;
        if (live) { place(live, ci++, true); }
        for (var e = 0; e < destExtra.length; e++) { place(destExtra[e], ci++, false); }
        // each logo tracks its card's offset from centre: fades + rotates in (LOGO_ROT·rel → 0)
        for (var g = 0; g < destLogos.length; g++) {
          var lk = (destLogos[g].getAttribute('data-dest') || '').trim().toLowerCase();
          var li = (lk === 'slack') ? 0 : -1;
          if (li < 0) {
            for (var x = 0; x < destExtra.length; x++) {
              if ((destExtra[x].getAttribute('data-dest') || '').trim().toLowerCase() === lk) { li = x + 1; break; }
            }
          }
          if (!show || li < 0) { destLogos[g].style.opacity = '0'; continue; }
          // slack (index 0) is centred from the start → entrance via the lift; others enter via the swing
          var lrel = (li === 0) ? ((li - f) + (1 - liftT)) : (li - f);
          var lar  = Math.abs(lrel);
          destLogos[g].style.opacity   = String(Math.max(0, 1 - lar / LOGO_FADE));
          destLogos[g].style.transform = 'rotate(' + (LOGO_ROT * lrel) + 'deg) scale(' +
            (1 - (1 - LOGO_SCALE) * Math.min(1, lar)) + ')';
        }
      }

      // ease the rendered fan toward the scrubbed target each frame; settles gently on each beat.
      // while hidden, keep cur == tgt so re-entering ch3 starts on the slack beat (no glide-in jump).
      function fanTick() {
        if (fanN < 2) { return; }
        if (!fanShow) {
          if (fanShownState !== false) { fanRender(fanFCur, fanLiftCur, false); fanShownState = false; }
          fanFCur = fanFTgt; fanLiftCur = fanLiftTgt;      // track silently so the next show is clean
          return;
        }
        var k = FAN_LERP >= 1 ? 1 : 1 - Math.pow(1 - FAN_LERP, gsap.ticker.deltaRatio());
        fanFCur    += (fanFTgt    - fanFCur)    * k;
        fanLiftCur += (fanLiftTgt - fanLiftCur) * k;
        if (Math.abs(fanFTgt    - fanFCur)    < 0.0004) { fanFCur    = fanFTgt; }
        if (Math.abs(fanLiftTgt - fanLiftCur) < 0.0004) { fanLiftCur = fanLiftTgt; }
        fanRender(fanFCur, fanLiftCur, true);
        fanShownState = true;
      }

      // ---- chapter 2 (polish) render, driven by an eased tp (see polishTick) ----
      // gradient waves onto the raw text, raw wipes out bottom→top, polished staggers in as the
      // message box grows. all a pure function of tp so it can be lerped exactly like the fan.
      function renderPolish(tp) {
        var n = words.length, np = pwords.length;
        // gradient-in front: each word switches into the gradient (colour → transparent) as it passes
        var Fg = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * 1.08;
        // polished-in front: polished staggers in behind the box grow (later window)
        var F  = phaseT(tp, POLISH_DROP[0], POLISH_DROP[1]) * (1 + POLISH_GAP + POLISH_BAND);
        for (var i = 0; i < n; i++) {
          var ph = n > 1 ? i / (n - 1) : 0;
          words[i].el.style.color = (Fg > ph) ? 'transparent' : '';     // gradient waves on (top→bottom)
        }
        // raw-out: a soft mask wipes the whole transcript BOTTOM→TOP (needs a wrapper mask — per-word
        // opacity can't fade the gradient painted at the container via background-clip:text).
        if (rawWrap) {
          var wipe = smooth(phaseT(tp, POLISH_RAWOUT[0], POLISH_RAWOUT[1]));
          var soft = 16, stop = wipe * (100 + soft);
          var m = 'linear-gradient(to top, transparent ' + Math.max(0, stop - soft).toFixed(1) +
            '%, #000 ' + stop.toFixed(1) + '%)';
          rawWrap.style.webkitMaskImage = m;
          rawWrap.style.maskImage = m;
        }
        for (var j = 0; j < np; j++) {
          pwords[j].style.opacity = String(smooth((F - (np > 1 ? j / (np - 1) : 0) - POLISH_GAP) / POLISH_BAND));
        }
        var grow = smooth(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1]));
        var gpx  = (msgExpandedH - msgCollapsedH) * grow;         // how far the box has grown
        // grow upward: bottom (icons) stays put, top rises over the faded transcript. footprint
        // constant (marginTop cancels the extra height) → card holds. box is white → white rises.
        if (msgGrowEl)    { msgGrowEl.style.height = (msgCollapsedH + gpx) + 'px'; msgGrowEl.style.marginTop = (-gpx) + 'px'; }
        if (placeholderEl){ placeholderEl.style.opacity = String(1 - smooth(Math.min(1, grow * 2.4))); }
      }

      // ease the ch2 render toward the scrubbed tp; while inactive, track silently so re-entry is clean
      var polishCur = 0, polishTgt = 0, polishActive = false;
      function polishTick() {
        if (!polishActive) { polishCur = polishTgt; return; }
        var k = POLISH_LERP >= 1 ? 1 : 1 - Math.pow(1 - POLISH_LERP, gsap.ticker.deltaRatio());
        polishCur += (polishTgt - polishCur) * k;
        if (Math.abs(polishTgt - polishCur) < 0.0004) { polishCur = polishTgt; }
        renderPolish(polishCur);
      }

      // audio pill handoff render at an explicit eased position (hp: 0 recording → 1 landed).
      // recording pose (bigger, higher, icons hidden) eases into the landed pose; the 2 extra
      // icons animate in over the tail so the pill leads the handoff.
      function renderPill(hp) {
        if (!pillAudioEl) { return; }
        var sc = PILL_REC_SCALE + (1 - PILL_REC_SCALE) * hp;    // REC_SCALE → 1 (shrinks to landed)
        var ty = pillRecY * (1 - hp);                           // lifted → 0 (settles at landed)
        pillAudioEl.style.transform = 'translateY(' + ty + 'px) scale(' + sc + ')';
        var ei = PILL_ICONS_AT < 1 ? smooth((hp - PILL_ICONS_AT) / (1 - PILL_ICONS_AT)) : (hp >= 1 ? 1 : 0);
        var isz = (PILL_ICON_SIZE * ei) + 'px';
        for (var pe = 0; pe < pillExtras.length; pe++) {
          pillExtras[pe].style.opacity = String(ei);
          pillExtras[pe].style.width  = isz;
          pillExtras[pe].style.height = isz;
        }
      }

      // ease the pill toward the scrubbed handoff target; trails the scroll, settles soft
      var pillCur = 0, pillTgt = 0;
      function pillTick() {
        if (!pillAudioEl) { return; }
        var k = PILL_LERP >= 1 ? 1 : 1 - Math.pow(1 - PILL_LERP, gsap.ticker.deltaRatio());
        pillCur += (pillTgt - pillCur) * k;
        if (Math.abs(pillTgt - pillCur) < 0.0004) { pillCur = pillTgt; }
        renderPill(pillCur);
      }

      function sceneUpdate(p) {
        // intro (220 wpm): shows once the flow card is at least CARD_MIN_W wide (so the label never
        // spills a too-narrow card), stays in view through the reveal, then fades out at the shrink
        // start. the show/hide is a quick TIMED fade (opacity + CSS transition, 0.25s), not scrubbed.
        if (introEl) {
          var gt2 = (pB > pA) ? (p - pA) / (pB - pA) : (p >= pB ? 1 : 0);
          gt2 = gt2 < 0 ? 0 : (gt2 > 1 ? 1 : gt2);
          var cardFrac = (p < pB) ? snapEnds(gt2) : 1;      // flow card width as a fraction of the stage
          introEl.style.opacity = (cardFrac >= CARD_MIN_W && p < pBh) ? '1' : '0';
        }

        // audio pill: hand the scrubbed handoff progress (shrink→land window) to the eased ticker
        if (pillAudioEl) {
          pillTgt = phaseT(p, pBh, pHold);                       // 0 recording → 1 landed (authored spot)
        }

        // handoff: chapter content is TRIGGERED in (CSS-timed fade), not scrubbed — fires once the
        // card starts riding (pC + MSG_TRIGGER of the ride) so the message fades in clean, no scrub.
        // while a tab CROSSFADE is running, the click owns scene opacity — don't fight it here.
        if (!tabFade) {
          var lit = (p >= pC + MSG_TRIGGER * Math.max(0, pHold - pC)) ? '1' : '0';
          if (screenEl) {
            screenEl.style.opacity = lit;                        // one cover fades in — everything inside comes together
          } else {                                               // no screen wrapper: fade the pieces individually
            if (transcriptEl) { transcriptEl.style.opacity = lit; }
            if (composerEl)   { composerEl.style.opacity = lit; }
          }
        }
        // destWrap (logo row) shown only in chapter 3 — set alongside the fan below

        var idx = -1, tp = 0;
        if (p >= pHold) { var loc = tabLocal(p); idx = loc.idx; tp = loc.tp; }

        setBgChapter(idx);   // crossfade the card background image to this chapter (data-bg="0/1/2")

        // audio/recorder is gone from chapter 2 on (polish); keep it through recording + chapter 1
        if (pillAudioEl) { pillAudioEl.style.opacity = (idx >= 1) ? '0' : '1'; }

        var n = words.length, count;
        if (idx < 0)        { count = 0; }
        else if (idx === 0) { count = Math.round(Math.min(1, tp / TYPE_END) * n); }
        else                { count = n; }                       // fully typed once past chapter 1
        count = count < 0 ? 0 : (count > n ? n : count);
        if (count !== wordsShown) {
          for (var i = 0; i < n; i++) { words[i].el.style.opacity = i < count ? '1' : '0'; }
          wordsShown = count;
        }

        // ---- chapter 2 (polish): gradient waves onto the raw text, raw wipes out, polished staggers
        // in as the message box grows ----
        var np = pwords.length;
        if (idx === 1) {
          if (transcriptEl) { transcriptEl.classList.add('is-polishing'); transcriptEl.style.transform = ''; transcriptEl.style.opacity = ''; }
          // hand the scrubbed tp to the eased ticker (polishTick → renderPolish); no direct draw here
          polishTgt = tp; polishActive = true;
          wordsShown = -1; polishColored = true;                    // force ch1 re-reveal + colour reset later
        } else if (idx >= 2) {                                       // chapter 3: polished only
          polishActive = false;
          if (transcriptEl) { transcriptEl.classList.remove('is-polishing'); transcriptEl.style.transform = ''; transcriptEl.style.opacity = '0'; }
          if (rawWrap) { rawWrap.style.webkitMaskImage = ''; rawWrap.style.maskImage = ''; }
          resetPolishColor();
          for (var j2 = 0; j2 < np; j2++) { pwords[j2].style.opacity = '1'; }
          // extend the box DOWN by SLACK_PAD (white below the text), eased in over the lift
          var padLiftT = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);
          if (msgGrowEl)    { msgGrowEl.style.height = (msgExpandedH + SLACK_PAD * padLiftT) + 'px'; msgGrowEl.style.marginTop = (-(msgExpandedH - msgCollapsedH)) + 'px'; }
          if (placeholderEl){ placeholderEl.style.opacity = '0'; }
        } else {                                                     // recording / chapter 1: raw only
          polishActive = false;
          if (transcriptEl) { transcriptEl.classList.remove('is-polishing'); transcriptEl.style.transform = ''; transcriptEl.style.opacity = ''; }
          if (rawWrap) { rawWrap.style.webkitMaskImage = ''; rawWrap.style.maskImage = ''; }
          resetPolishColor();
          for (var j3 = 0; j3 < np; j3++) { pwords[j3].style.opacity = '0'; }
          if (msgGrowEl)    { msgGrowEl.style.height = msgCollapsedH ? (msgCollapsedH + 'px') : ''; msgGrowEl.style.marginTop = '0px'; }
          if (placeholderEl){ placeholderEl.style.opacity = ''; }
        }

        // pill: ch1 → latest highlight category; ch2+3 → "polishing" (same pill, stays ON across 2→3;
        // ch3 flips its inner state to the "done" dots via is-done).
        var activePill = null;
        if (idx === 0) { for (var j = count - 1; j >= 0; j--) { if (words[j].cat) { activePill = words[j].cat; break; } } }
        else if (idx >= 1) { activePill = 'polishing'; }
        if (activePill !== pillShown) {
          // baton-pass: outgoing pill collapses on X while the incoming grows out + ripples (CSS)
          for (var k in pillMap) { if (pillMap.hasOwnProperty(k)) { pillMap[k].classList.toggle('is-on', k === activePill); } }
          pillShown = activePill;
        }
        // voice mode is LATCHED with hysteresis: it turns on at the ch3 boundary and only turns off
        // once we scroll well back into ch2. the fan lift ("card moves up") sits right on that
        // boundary, so without this a slow scroll flickers idx 2↔1 and re-draws the white ring.
        var ch3Start = tabStops[numTabs - 1];
        var voiceHyst = 0.15 * (1 - ch3Start);
        if (p >= ch3Start) { voiceLatched = true; }
        else if (p < ch3Start - voiceHyst) { voiceLatched = false; }
        setPillDone(voiceLatched);   // bullets pop in, then grow out to the voice-mode waveform

        // chapter 3 (Distribute): fan the cards through centre, scrubbed by this tab's tp
        // (0 → slack/live note, → claude, → gmail). hidden/normal before chapter 3.
        if (destWrap) { destWrap.style.opacity = (idx >= 2) ? '1' : '0'; }   // logo row on in ch3
        fanUpdate(idx >= 2 ? tp : 0, idx >= 2);
      }

      // scrub lerp state: morph/card follow p 1:1; marquee + audio ease toward pTarget in a ticker
      var pTarget = 0, pSmooth = 0, painted = -1;

      function applyScroll(p) {
        applyMorph(p);
        pTarget = p;                 // marquee + audio ease toward this in scrubTick

        if (isDesktop) {
          sceneUpdate(p);
          var S;
          if (p <= pC)         { S = 0; }
          else if (p >= pHold) { S = sCenter; }
          else                 { S = (pHold > pC) ? ((p - pC) / (pHold - pC)) * sCenter : sCenter; }
          for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }
          // mid-ride the card sags CARD_DIP below centre, easing back to dead centre at landing
          var rideT = (pHold > pC) ? Math.max(0, Math.min(1, (p - pC) / (pHold - pC))) : 1;
          var dip   = CARD_DIP * Math.sin(Math.PI * rideT);
          gsap.set(card, { y: S - Math.min(cardRiseDist, Math.max(0, S - sCardStart)) + dip });
        }

        if (canLeave && topCover) {
          var gr = greenPanel.getBoundingClientRect();
          topCover.style.display = (gr.top <= 1 && gr.bottom > 3) ? 'block' : 'none';
        }

        if (isDesktop) {
          // a tab click owns the active state until its scroll glide arrives, so tabs the
          // glide passes through don't flicker active and restart the animations
          if (clickLockP != null && (Math.abs(p - clickLockP) < 0.005 || Date.now() - clickLockT > (TAB_FADE_MS * 2 + 500))) {
            clickLockP = null;
          }
          if (clickLockP == null) {
            // nothing is active until the card is nearly landed, so tab 0's entrance animates
            var tn = -1;
            if (p >= pHold - 0.02) { tn = (p <= pHold) ? 0 : tabLocal(p).idx; }
            setActiveTab(tn);
          }
          bgTargetP = (p > pHold && pHold < 1) ? (p - pHold) / (1 - pHold) : 0;
        }
      }

      function refresh() {
        if (isDesktop) { section.style.height = 'calc(100vh + 2px)'; }
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        measureStage();
        alignHeads();
        measurePositions();
        computeTiming();
        fanPositioned = false;                 // re-place cards on next fan show (layout may have changed)
        applyScroll(st ? st.progress : 0);
        pSmooth = pTarget; painted = -1;      // no scrub sweep from 0 on load/rebuild
        fanFCur = fanFTgt; fanLiftCur = fanLiftTgt;   // fan starts settled, no glide-in on load
        polishCur = polishTgt;                        // ch2 starts settled too (no wipe sweep on load)
        pillCur = pillTgt;                            // pill starts settled (no glide-in on load)
        updateMarquees(pSmooth); updateAudio(pSmooth);
        if (activeTab >= 0) { moveIndicator(activeTab); }
      }

      var st = null;
      if (isDesktop) {
        st = ScrollTrigger.create({
          trigger: section, start: 'top top',
          end: function () { return '+=' + (window.innerHeight * totalVH); },
          pin: true, anticipatePin: 1, invalidateOnRefresh: true,
          refreshPriority: 1,
          onRefresh: function (self) { prevStart = self.start; prevEnd = self.end; },
          onRefreshInit: refresh,
          onUpdate: function (self) { applyScroll(self.progress); },
          onLeave:     function () { if (topCover) { topCover.style.display = 'none'; } },
          onLeaveBack: function () { if (topCover) { topCover.style.display = 'none'; } },
          snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
        });
        // ease the marquee + audio toward the scroll position; settles gently when scroll stops
        var scrubTick = function () {
          if (SCRUB_LERP >= 1) { pSmooth = pTarget; }
          else {
            var k = 1 - Math.pow(1 - SCRUB_LERP, gsap.ticker.deltaRatio());
            pSmooth += (pTarget - pSmooth) * k;
            if (Math.abs(pTarget - pSmooth) < 0.0002) { pSmooth = pTarget; }
          }
          if (pSmooth !== painted) { updateMarquees(pSmooth); updateAudio(pSmooth); painted = pSmooth; }
        };
        gsap.ticker.add(scrubTick);
        teardown.push(function () { gsap.ticker.remove(scrubTick); });
        gsap.ticker.add(fanTick);
        teardown.push(function () { gsap.ticker.remove(fanTick); });
        gsap.ticker.add(polishTick);
        teardown.push(function () { gsap.ticker.remove(polishTick); });
        gsap.ticker.add(pillTick);
        teardown.push(function () { gsap.ticker.remove(pillTick); });
      } else {
        // mobile: no pin/morph — show the card in its final centred state, text mid-line
        measureStage();
        alignHeads();
        applyMorph(1);
        updateMarquees(0.5);   // no scrub on mobile; park the strings mid-travel so words show
        updateAudio(0.25);     // park bars in a mid-pose so the recorder reads as bars, not flat
        sceneUpdate(1);        // mobile: transcript fully typed, intro hidden (mobile choreo deferred)
        // rendering moved to a ticker (desktop only) — draw the eased scenes' end-state once for mobile
        fanFCur = fanFTgt; fanLiftCur = fanLiftTgt; fanRender(fanFCur, fanLiftCur, fanShow);
        if (polishActive) { polishCur = polishTgt; renderPolish(polishCur); }
        pillCur = pillTgt; renderPill(pillCur);
      }

      if (DEBUG) {
        console.log('[flow-stack] build mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' rebuild=' + isRebuild + ' marquees=' + marquees.length +
          ' numTabs=' + numTabs + ' totalVH=' + totalVH.toFixed(2));
        console.log('[flow-stack] scene: transcript=' + !!transcriptEl + ' words=' + words.length +
          ' composer=' + !!composerEl + ' intro=' + !!introEl + ' pills=' + pillEls.length +
          ' pillKeys=' + JSON.stringify(Object.keys(pillMap)));
        console.log('[flow-stack] heights: msgGrow=' + !!msgGrowEl + ' collapsed=' + msgCollapsedH +
          ' expanded=' + msgExpandedH + ' delta=' + (msgExpandedH - msgCollapsedH) +
          ' polishedWords=' + pwords.length + ' transcriptH=' + transcriptH + ' cardHpx=' + cardHpx.toFixed(0));
      }

      // rebuild only: refresh once layout settles, then anchor scroll onto the rebuilt layout
      if (isRebuild && typeof window.requestAnimationFrame === 'function') {
        var buildAlive = true;
        teardown.push(function () { buildAlive = false; });
        window.requestAnimationFrame(function () {
          if (!buildAlive) { return; }
          window.requestAnimationFrame(function () {
            if (!buildAlive) { return; }
            ScrollTrigger.refresh();
            if (st && anchorY != null && anchorStart != null && anchorEnd != null) {
              var target;
              if (anchorY <= anchorStart)    { target = anchorY; }
              else if (anchorY <= anchorEnd) { target = st.start; }
              else                           { target = anchorY + (st.end - anchorEnd); }
              window.scrollTo(0, Math.max(0, Math.round(target)));
              anchorY = anchorStart = anchorEnd = null;
            }
          });
        });
      }

      // eased bg-line paint (only does work if [data-tab-bg] svgs exist)
      var bgTicker = function () {
        try {
          var diff = bgTargetP - bgCurrentP;
          if (Math.abs(diff) < 0.0005) { return; }
          var dt = gsap.ticker.deltaRatio();
          bgCurrentP += diff * (1 - Math.pow(1 - BG_SMOOTH, dt));
          drawBg(bgCurrentP);
        } catch (e) {}
      };
      gsap.ticker.add(bgTicker);
      teardown.push(function () { gsap.ticker.remove(bgTicker); });

      // click a tab -> crossfade the card scene to that tab's slice. the lock keeps pass-through
      // tabs from hijacking the active state; tabFade tells sceneUpdate to leave scene opacity to us.
      var clickLockP = null, clickLockT = 0, tabFade = false, tabFadeCall = null;
      // scene cover(s) whose opacity the crossfade drives (the one wrapper, or the pieces)
      var sceneEls = (screenEl ? [screenEl] : [transcriptEl, composerEl]).filter(Boolean);
      function setSceneOpacity(a, ms) {
        for (var s = 0; s < sceneEls.length; s++) {
          sceneEls[s].style.transition = 'opacity ' + ms + 'ms ease';
          sceneEls[s].style.opacity = String(a);
        }
      }
      function clearSceneTransition() { for (var s = 0; s < sceneEls.length; s++) { sceneEls[s].style.transition = ''; } }
      function snapEased() {                                    // settle fan/polish/pill to the target chapter
        fanFCur = fanFTgt; fanLiftCur = fanLiftTgt; polishCur = polishTgt; pillCur = pillTgt;
      }
      function killTabFade() { if (tabFadeCall) { tabFadeCall.kill(); tabFadeCall = null; } }
      function interruptTab() {                                 // user scrolled/keyed mid-crossfade → hand back
        if (!tabFade && !tabFadeCall) { return; }
        killTabFade(); tabFade = false; clearSceneTransition();
        if (st) { applyScroll(st.progress); }                  // repaint scene opacity from real progress
      }
      ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
        window.addEventListener(ev, interruptTab, { passive: true });
        teardown.push(function () { window.removeEventListener(ev, interruptTab, { passive: true }); });
      });
      tabItems.forEach(function (item, i) {
        guardStyle(item);
        item.style.cursor = 'pointer';
        var onClick = function () {
          if (!st) { return; }
          // true centre of this tab's scroll slice (tabStops already accounts for the CH_VH weights,
          // so the last/weighted tabs land correctly — no drift into the neighbouring slice)
          var centreP = (tabStops[i] + tabStops[i + 1]) / 2;
          var tabFrac = (1 - pHold) > 0 ? (centreP - pHold) / (1 - pHold) : 0;
          var N = bgSvgs.length || 1;
          bgCurrentP = Math.min(N - 1, Math.floor(tabFrac * N)) / N;
          var to = st.start + centreP * (st.end - st.start);
          clickLockP = centreP; clickLockT = Date.now();
          setActiveTab(i);                                      // indicator + text animate now (CSS)
          killTabFade();
          tabFade = true;
          setSceneOpacity(0, TAB_FADE_MS);                      // fade the current chapter out
          tabFadeCall = gsap.delayedCall(TAB_FADE_MS / 1000, function () {
            window.scrollTo(0, to);                             // jump while hidden — no scrub is seen
            applyScroll(centreP);                              // set scene targets to the destination NOW
            snapEased();                                        // settle them (no eased speed-run on reveal)
            setSceneOpacity(1, TAB_FADE_MS);                    // fade the target chapter in
            tabFadeCall = gsap.delayedCall(TAB_FADE_MS / 1000, function () {
              tabFade = false; tabFadeCall = null; clearSceneTransition();
            });
          });
        };
        item.addEventListener('click', onClick);
        teardown.push(function () { item.removeEventListener('click', onClick); });
      });

      return function cleanup() {
        for (var i = teardown.length - 1; i >= 0; i--) {
          try { teardown[i](); } catch (e) {}
        }
      };
    });

    function relayout() { ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }

    if (typeof window.ResizeObserver !== 'undefined') {
      var lastVW = window.innerWidth, lastVH = window.innerHeight, roTimer = null;
      var ro = new ResizeObserver(function () {
        if (window.innerWidth === lastVW && window.innerHeight === lastVH) { return; }
        lastVW = window.innerWidth; lastVH = window.innerHeight;
        if (roTimer) { clearTimeout(roTimer); }
        roTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 150);
      });
      ro.observe(document.documentElement);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
