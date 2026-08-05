(function () {

  // ---- corners: scroll-scrubbed corner radius ----

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
        if (DEBUG) { console.log('[corners] tracking', el, 'max=' + els[els.length - 1].max + 'px'); }
      }
    }
    if (DEBUG && !found.length) { console.warn('[corners] scan found no [' + ATTR + '] elements (yet)'); }
  }
  window.Corners = { scan: scan };

  function frame(dt) {
    var vh = window.innerHeight;
    var k  = 1 - Math.pow(1 - SMOOTH, dt);
    for (var i = 0; i < els.length; i++) {
      var s = els[i];
      // re-read the attribute every pass: scan() caches it once, so a value written later - a
      // breakpoint change, a rebuild - would never reach the running loop otherwise
      var live = parseFloat(s.el.getAttribute(ATTR));
      if (isFinite(live) && live > 0) { s.max = live; }
      var r = s.el.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }
      var tT = Math.max(0, Math.min(s.max, r.top));
      var tB = Math.max(0, Math.min(s.max, vh - r.bottom));
      if (s.t < 0) { s.t = tT; s.b = tB; }
      else {
        s.t += (tT - s.t) * k; if (Math.abs(tT - s.t) < 0.1) { s.t = tT; }
        s.b += (tB - s.b) * k; if (Math.abs(tB - s.b) < 0.1) { s.b = tB; }
      }
      if (s.t === s.wt && s.b === s.wb) { continue; }
      s.wt = s.t; s.wb = s.b;
      s.el.style.setProperty('border-top-left-radius',     s.t + 'px', 'important');
      s.el.style.setProperty('border-top-right-radius',    s.t + 'px', 'important');
      s.el.style.setProperty('border-bottom-left-radius',  s.b + 'px', 'important');
      s.el.style.setProperty('border-bottom-right-radius', s.b + 'px', 'important');
    }
  }

  function cornersStart() {
    if (DEBUG) { console.log('[corners] init (gsap=' + !!window.gsap + ')'); }
    scan();
    if (window.gsap) {
      if (window.ScrollTrigger) { gsap.registerPlugin(ScrollTrigger); }
      gsap.ticker.add(function () { try { frame(gsap.ticker.deltaRatio()); } catch (e) { if (DEBUG) { console.error('[corners]', e); } } });
    } else {
      var last = performance.now();
      (function loop(now) {
        var dt = (now - last) / (1000 / 60); last = now;
        try { frame(dt || 1); } catch (e) { if (DEBUG) { console.error('[corners]', e); } }
        requestAnimationFrame(loop);
      }(last));
    }
    window.addEventListener('load', scan);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', cornersStart); }
  else { cornersStart(); }

}());

(function () {

  // ---- config ----
  var STEP_VH       = 0.45;    // scroll length per row before the gather (was 0.7)
  var SNAP          = false;   // magnetic scroll-to-nearest-step
  var SNAP_DUR      = 0.3;

  // rows popped per scroll step. 0 = ALL of them on one step, which is what the section wants
  // now: one scroll brings the whole scatter in, the next gathers it into the card. order is
  // still honoured inside the step - POP_STAGGER is what spaces them, so it has to be large
  // enough to read as a sequence rather than a single burst.
  // fire the first batch BEFORE the section pins, while it is still travelling up the
  // viewport - the rows pop in and then ride up with the page, filling what is otherwise
  // dead scroll. only the pop moves: the gather has to stay inside the pin because it holds
  // the scroll while it plays. with POP_BATCH = 0 there is one batch, so this covers every
  // row; with a positive POP_BATCH it covers the first batch and the pin drives the rest.
  var PRE_POP       = true;
  // ScrollTrigger start for the pre-roll. lower = later: 'top 90%' fires as the section's top
  // crosses 90% down the viewport (barely on screen), 'top 10%' waits until it is nearly at
  // the top, leaving only a little space before the pin takes over.
  var PRE_POP_START = 'top 60%';
  var POP_BATCH     = 0;
  var POP_STAGGER   = 0.28;
  var POP_HEAD      = 3;
  var POP_DUR       = 0.5;
  var POP_BUNCH     = 0.55;    // <1 pulls pops earlier & tighter
  var POP_LEAD      = 0.06;    // scroll lead so the first batch animates in (not pre-popped)
  var POP_SCALE_X   = 0.35;
  var POP_SCALE_Y   = 0.85;
  var POP_EASE      = 'back.out(2)';
  // a row pops to whatever opacity it was authored with in the Designer, not to a hardcoded 1 -
  // so a row set to 40% there scatters in dimmed and reads as chatter the notetaker heard but did
  // not act on. it comes up to GATHER_OPACITY only as it stacks into the card, which is the
  // moment it becomes part of the summary. false = every row pops to full, as before.
  var DIM_FROM_CSS   = true;
  var GATHER_OPACITY = 1;
  var FIST          = 1;       // 1 = pop in place at the authored spot; lower = bunched, spreads on scroll

  var DETECT_SEL       = '.meeting_item_animate';
  // the detected word is lit by a GLARE, not a rainbow: a neutral ramp with a hot band through the
  // middle, so it reads as light passing over the text rather than the text changing colour. the
  // ends sit under the row's own cream so the word dims into its neighbours instead of ending on a
  // hard edge. same painting and same ripple as before - only the ramp changed.
  var DETECT_GRAD      = 'linear-gradient(100deg,#8E948C 0%,#C9CEC4 26%,#FFFFFF 48%,#EFF2EA 62%,#9AA096 100%)';
  var DETECT_GLOW      = 6;    // px of soft white bloom while the glare is on. 0 = flat
  var DETECT_GLOW_A    = 0.45; // its alpha at full
  var DETECT_AT        = 0.22;  // seconds after the bubble starts popping
  var DETECT_FADE      = 350;   // ms: own colour -> gradient
  var DETECT_HOLD      = 1100;  // ms the gradient sits before releasing
  var DETECT_BACK      = 600;   // ms: gradient -> own colour
  var DETECT_Y_PCT     = 20;    // crest height as a % of letter height
  var DETECT_ROT       = 5;     // deg at the crest
  var DETECT_STAGGER   = 45;    // ms per letter (wave speed)
  var DETECT_LETTER_MS = 500;   // per-letter up-and-back

  var AUDIO_SEL       = '[data-anim="audio"]';
  var AUDIO_BARS      = 5;     // bars to generate. '' / 0 = leave the icon alone
  var AUDIO_GAP_RATIO = 1;     // gap width as a multiple of bar width (1 = equal bars and gaps)
  var AUDIO_MIN       = 0.18;  // shortest a bar gets, as a fraction of the icon's bar-block height
  var AUDIO_MAX       = 1.0;   // tallest a bar reaches
  var AUDIO_CYCLES    = 8;     // activity rate across the whole pin (higher = busier)
  var AUDIO_ENV       = 0.22;  // 0 = per-bar jitter only, 1 = strong syllable bursts
  var AUDIO_SPEED     = 2.4;   // live clock (cycles/sec) so bars stay alive when scroll is idle
  var AUDIO_WAVE      = 0.72;  // 0 = jagged speech bursts, 1 = smooth travelling wave
  var AUDIO_WAVE_SPAN = 1.7;   // crests spanning the row

  var CHECK_DELAY   = 0.18;
  var CHECK_DUR     = 0.4;
  var CHECK_EASE    = 'back.out(2.4)';

  // ---- landed state: what a row becomes as it flies into the card ----
  // the scattered row says what was said; the landed row says what it became. authored per row in
  // the Designer, all optional - a row with none of these is untouched:
  //   data-stack-landed="..."         the pill text
  //   data-stack-landed-name="..."    the name tag's text
  //   data-stack-landed-color="..."   the name tag's colour
  //   data-stack-landed-bg="..."      the name tag's background
  // the swap is instant and lands mid-flight, where the row is moving fast enough that the change
  // is not readable. it does NOT touch the gather order - rows land exactly as they did before.
  // the landed wording per row, keyed by its data-stack-order value, stamped onto the rows at init
  // so everything downstream still reads the attributes. an attribute authored in the Designer wins
  // over this table, and LANDED_ROWS = null hands the whole thing back to the Designer.
  // NOTE: keys are data-stack-order values, NOT positions. if a row's order value is not 1-5 the
  // text lands on the wrong row - check with the one-liner in the console before trusting it.
  // landed name colour, by name. keyed this way rather than per row so adding a row with an
  // existing speaker picks the colour up automatically; a row's own data-stack-landed-color
  // still wins over it.
  var LANDED_NAME_COLORS = {
    Hayle:  '#FFA946',
    Zharia: '#7F1C34'
  };

  var LANDED_ROWS = {
    1: { name: 'Hayle',  text: 'Where are we with the a16z conversation?' },
    2: { name: 'Mikel',  text: "Term sheet's in, Priya sent it over last night." },
    3: { name: 'Hayle',  text: "Perfect. ARR's up 12% since we closed Atlassian." },
    4: { name: 'Zharia', text: "Great, I'll tell Aisha during our sync." },
    5: { name: 'Mikel',  text: 'The Figma integration is live, right?' }
  };

  var LANDED_ATTR       = 'data-stack-landed';
  var LANDED_NAME_ATTR  = 'data-stack-landed-name';
  var LANDED_COLOR_ATTR = 'data-stack-landed-color';
  var LANDED_BG_ATTR    = 'data-stack-landed-bg';
  var LANDED_AT         = 0.35;   // fraction into that row's own flight when it changes

  var GATHER_STAGGER = 0.09;
  var GATHER_DUR     = 0.7;
  var GATHER_EASE    = 'power3.inOut';
  var GATHER_LOCK    = 0.4;   // fraction of the gather that plays before scroll is released. 1 = all of it
  var CARD_FADE      = 0.4;
  var STACK_TOP_PAD     = 0;   // px above the first stacked row, desktop. 0 = off
  var STACK_TOP_PAD_MOB = 16;  // same, tablet and down (<992px)
  // rows hug their own text at every size (white-space:nowrap, width auto), which is right on a
  // wide card and wrong on a narrow one: the row ends where its sentence ends, leaving a band of
  // empty card that the pop images then drift over. on mobile they fill the card's width instead
  // and wrap, so the text uses the space and the photos have nothing to sit on top of.
  // 'fill' = full width + wrapping, 'wrap' = keep hugging but allow a second line, '' = as desktop
  var ROW_MOBILE_FIT = 'fill';
  var LANDED_BG      = '';                      // '' = read LANDED_BG_VAR
  var LANDED_BG_VAR  = '--base-color--fathom';  // row bg once gathered
  var STACK_ITEM_RADIUS = '12px';   // every row's corners once stacked (scattered = authored). '' = off

  var POP_IMG_AT      = 0.45;  // seconds into the gather timeline before the first image fires
  var POP_IMG_STAGGER = 0.12;
  var POP_IMG_DUR     = 0.5;
  var POP_IMG_EASE    = 'back.out(2)';
  var POP_IMG_SCALE   = 0.6;   // scale it grows from
  var POP_IMG_Y       = 24;    // px it rises from
  var POP_IMG_X       = 0;
  var POP_IMG_ROT     = -6;    // deg it rotates in from (alternates sign per image)
  var POP_IMG_Z       = 995;   // above the rows AND the light clone (LIGHT_Z 990), below the nav (999)
  var POP_PAR_DIST    = 65;
  var POP_PAR_DEPTH   = [1, 0.6, 1.35];   // cycles over the images; overridden by data-pop-depth
  var POP_PAR_SMOOTH  = 0.1;   // per-frame ease toward the scroll position; lower = more drag

  // point in the pG->pHold travel that fires the row exit (0 = at pG, 1 = the landing). the rows
  // should clear just BEFORE the card is placed into the tabs section, so this sits late in the
  // travel - but not at 1: the exit runs on its own clock for CH1_ROW_DUR + stagger x rows
  // (~0.75s at six rows), and firing it at the landing would leave rows still flying out after
  // the card has already arrived.
  var CH1_AT          = 0.95;  // as late as the ride allows: rows clear just before the landing
  var CH1_ROW_Y       = -120;  // px each row travels; negative = up, positive = down
  var CH1_ROW_DUR     = 0.3;   // seconds per row
  var CH1_ROW_STAGGER = 0.04;  // seconds between rows (top row leaves first)
  var CH1_ROW_EASE    = 'power2.in';
  var CH1_ROW_FADE    = 0.55;  // fade as a fraction of the travel. <1 = gone before it clears the card
  var CH1_IMG_OUT     = false; // false = the pop images stay in view through chapter 1
  var CH1_IMG_OUT_MOB = true;  // mobile has no chapters to stay for: images leave with the rows
  var CH1_IMG_DUR     = 0.4;
  var CH1_IMG_STAGGER = 0.06;
  var CH1_IMG_Y       = -30;   // px the images drift as they go
  var CH1_IMG_SCALE   = 0.55;  // scale they shrink to
  var CH1_IMG_EASE    = 'back.in(1.6)';

  var CARD_OUT      = true;
  var MOBILE_KEEP_CARD = true;

  // phones run no choreography at all - mobile landscape (<768px) and down. the pop/gather/pin
  // sequence needs width: below the tablet breakpoint it re-parented the rows into the card,
  // transformed and pinned them, and ended in a layout nothing in the Designer could correct.
  // with this on the script leaves that markup exactly as authored - place the rows, the card and
  // the panels by hand and they stay put. tablet and desktop are untouched and still animate.
  // false = the old behaviour, the full sequence at every size.
  var MOBILE_STATIC = true;

  var CH2_OUT         = true;
  var CH2_OUT_DUR     = 0.45;
  var CH2_OUT_STAGGER = 0.05;
  var CH2_OUT_EASE    = 'power2.out';

  var STAGE_MATCH_CARD = true;
  var PANEL_CLIP       = true;
  var PANEL_FILL       = true;

  var CHAPTER_PLATE = true;
  var PLATE_BG      = '';     // '' = use LIGHT_CARD_BG

  var CHAPTER_BG    = 'data-chapter-bg';
  var BG_FADE_MS    = 700;    // duration of the melt swap between chapter photos
  var MELT_INTENSITY = 0.35;  // displacement strength as a fraction of the image. 0 = plain crossfade
  var MELT_NOISE     = 3.0;   // cloud scale of the displacement noise (higher = smaller, busier)
  var CARD_LANDS_ON_STAGE = true;

  // point in pG->pHold at which tab 0 activates (1 = at the landing). pulled back so the panel's
  // 0.4s fade OVERLAPS the row exit instead of following it: the rows start leaving at CH1_AT and
  // take CH1_ROW_DUR + stagger x rows to clear, so at 1.0 the card sat empty in between and the
  // two beats read as separate events rather than one handing over to the other.
  var TABS_PLAY_AT    = 0.85;

  var HOLD_STEPS    = 0;

  var CARD_DROP_PX   = 48;
  var CARD_TARGET    = 0.5;    // viewport fraction the card centres on
  var GREEN_HOLD_VH  = 0.25;
  var TAB_STEP_VH    = 1.0;    // scroll length per tab while sticky
  var END_HOLD_VH    = 0.35;   // short hold on the last tab before release
  var BG_SMOOTH      = 0.12;   // ease of the bg-line paint toward scroll (scrub mode only)
  // the chapter bg lines can either follow the scroll (scrubbed, the original) or draw
  // themselves once per tab: each tab's line paints its full length when that tab becomes
  // active, so they arrive one by one as you move through the chapters rather than being
  // wound in and out by the scroll position.
  var BG_DRAW_ON_TAB = true;
  var BG_DRAW_MS     = 900;    // ms for a line to draw its full length
  var BG_DRAW_OUT_MS = 400;    // ms for the outgoing tab's line to retract
  var BG_DRAW_EASE   = 'power2.inOut';

  var GREEN_RADIUS   = '80px'; // max corner radius; auto-tags the green panel for corners.js. '' = off
  // responsive radius, ordered HIGH to LOW - the first entry whose min is <= the viewport wins.
  // a hardcoded table rather than reading --_spacing---section-radius--large: the variable lookup
  // was tried first and did not resolve reliably, so the table is the source of truth and the
  // variable is only consulted when the table is empty.
  var GREEN_RADIUS_VAR = '--_spacing---section-radius--large';
  var GREEN_RADIUS_BP = [
    { min: 768, px: 80 },
    { min: 0,   rem: 2.5 }
  ];

  var LIGHT_REVEAL   = true;
  var LIGHT_CARD_BG  = '#E4E4D0';
  var LIGHT_ROW_BG   = '#FFFDF9';
  var LIGHT_Z        = 990;    // above section content, below the nav (999)
  var LIGHT_TEXT     = '#1A1A1A';
  var LIGHT_RING     = 2;      // px of outer ring that hides the dark card edge against the cream
  // colour of that ring AND of the border the plate copies off the card. kept separate from
  // LIGHT_CARD_BG, which is the plate's FILL: the fill has to match the chapter panels it sits
  // behind, while the edge has to match the page around it, and those are not the same cream.
  // '' = fall back to LIGHT_CARD_BG, which is what it used to do.
  var PLATE_EDGE     = '#FFFFEB';
  // what the edge becomes once the plate has taken the paint over at pHold - by then the
  // green panel it was masking is gone. 'transparent' = no outline on the chapter cards.
  var PLATE_EDGE_AFTER = 'transparent';
  var NAME_TAG_SEL   = '.meeting_name-tag';
  var NAME_TAG_LIGHT = {
    dawn: '#7232A6'
  };

  var ATTR  = 'data-stack';
  var ORDER = 'data-stack-order';

  // two breakpoints, and matchMedia AND the injected CSS both read them so they cannot drift apart.
  // BP_DESKTOP picks WHICH build runs - the wide one above it, the narrow one below. BP_STATIC is
  // lower and picks WHETHER anything runs at all: under it the build bails (see MOBILE_STATIC).
  // between them - Webflow's tablet - the narrow build runs exactly as it always did.
  var BP_DESKTOP = 992;   // desktop
  var BP_STATIC  = 768;   // tablet down to here; below = mobile landscape and portrait

  var DESKTOP_SEL = '[' + ATTR + '="desktop"]';
  var MOBILE_SEL  = '[' + ATTR + '="mobile"]';
  var TABS_SEL    = '.meeting_tabs_contain';   // tabs grid; falls back to the desktop wrapper
  var DESKTOP_DISPLAY = 'block';   // forced only if a stylesheet rule still hides the shown wrapper
  var MOBILE_DISPLAY  = 'block';

  var COPY_SEL       = '.tab_copy';
  var COPY_NARROW_BP = 1180;
  var COPY_NARROW_MAXW = '30ch';

  var DEBUG = false;   // logs the mode swap + choreography measurements to the console

  // ---- helpers ----
  function sel(root, name) { return root.querySelectorAll('[' + ATTR + '="' + name + '"]'); }

  // px for the green panel's corner radius at the current viewport. rem entries are multiplied by
  // the root font size READ AT THAT MOMENT, so it follows a user's text scaling too.
  function resolveRadius(el) {
    var fallback = parseFloat(GREEN_RADIUS) || 80;
    if (GREEN_RADIUS_BP && GREEN_RADIUS_BP.length) {
      var w = window.innerWidth;
      var rootPx = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      for (var b = 0; b < GREEN_RADIUS_BP.length; b++) {
        if (w >= GREEN_RADIUS_BP[b].min) {
          var v = GREEN_RADIUS_BP[b];
          return Math.round(v.rem != null ? v.rem * rootPx : v.px);
        }
      }
    }
    if (!GREEN_RADIUS_VAR || !el) { return fallback; }
    var raw = '';
    try { raw = window.getComputedStyle(el).getPropertyValue(GREEN_RADIUS_VAR).trim(); } catch (e) {}
    if (!raw) {
      try { raw = window.getComputedStyle(document.documentElement).getPropertyValue(GREEN_RADIUS_VAR).trim(); } catch (e2) {}
    }
    var n = parseFloat(raw);
    if (!isFinite(n) || n <= 0) { return fallback; }
    if (/rem\s*$/.test(raw)) {
      n *= parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    } else if (/em\s*$/.test(raw)) {
      n *= parseFloat(window.getComputedStyle(el).fontSize) || 16;
    }
    return Math.round(n);
  }
  function one(root, name) { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    if (!document.getElementById('stack-mode-style')) {
      var ms = document.createElement('style');
      ms.id = 'stack-mode-style';
      // the tab rules hide every panel and wait for .is-active, which only the build ever adds.
      // under MOBILE_STATIC no build runs below BP_STATIC, so they have to stop there or the phone
      // markup would sit invisible forever with nothing left to reveal it. tablet still builds, so
      // the cutoff is BP_STATIC and not BP_DESKTOP. a media query, not the data-stack-mode attribute:
      // that attribute is written late in the build, and scoping to it would leave the panels
      // visible until then.
      var tabCss =
        '[data-tab-anim],[data-tab-text]{opacity:0;visibility:hidden;transition:opacity .4s ease;}' +
        '[data-tab-anim].is-active,[data-tab-text].is-active{opacity:1;visibility:visible;}' +
        '[data-tab-text] .meeting_tabs_heading,[data-tab-text] .meeting_tabs_paragraph{' +
          'opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease;}' +
        '[data-tab-text].is-active .meeting_tabs_heading{opacity:1;transform:none;transition-delay:.06s;}' +
        '[data-tab-text].is-active .meeting_tabs_paragraph{opacity:1;transform:none;transition-delay:.16s;}' +
        '[data-tab-anim][data-play="off"] *,' +
        '[data-tab-anim][data-play="off"] *::before,' +
        '[data-tab-anim][data-play="off"] *::after{animation:none !important;}';
      ms.textContent =
        'html[data-stack-mode="desktop"] ' + MOBILE_SEL  + '{display:none !important;}' +
        'html[data-stack-mode="mobile"] '  + DESKTOP_SEL + '{display:none !important;}' +
        (COPY_SEL ? ('@media (max-width:' + COPY_NARROW_BP + 'px){' + COPY_SEL +
          '{max-width:' + COPY_NARROW_MAXW + ';}}') : '') +
        (MOBILE_STATIC ? ('@media (min-width:' + BP_STATIC + 'px){' + tabCss + '}') : tabCss);
      document.head.appendChild(ms);
    }

    var prevStart = null, prevEnd = null;
    var anchorY = null, anchorStart = null, anchorEnd = null;
    function captureAnchor() {
      anchorY = window.pageYOffset || window.scrollY || 0;
      anchorStart = prevStart; anchorEnd = prevEnd;
    }
    // both breakpoints rebuild, so both have to hand the scroll position over
    [BP_DESKTOP, BP_STATIC].forEach(function (bp) {
      var mq = window.matchMedia('(min-width: ' + bp + 'px)');
      if (mq.addEventListener) { mq.addEventListener('change', captureAnchor); }
      else if (mq.addListener) { mq.addListener(captureAnchor); }
    });

    var builtOnce = false;
    var mm = gsap.matchMedia();
    // three conditions, not two: the context is only alive while ONE of them matches, so a plain
    // desktop/mobile pair plus a third state would have left the phone range with no callback at
    // all - and the wrapper swap lives inside it.
    mm.add({
      isDesktop: '(min-width: ' + BP_DESKTOP + 'px)',
      isTablet:  '(min-width: ' + BP_STATIC + 'px) and (max-width: ' + (BP_DESKTOP - 1) + 'px)',
      isStatic:  '(max-width: ' + (BP_STATIC - 1) + 'px)'
    }, function (ctx) {
      var isDesktop = ctx.conditions.isDesktop;
      var isStatic  = ctx.conditions.isStatic;
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

      // phones are authored, not animated. everything below this point measures, re-parents the rows
      // into the card, transforms them and pins the section - none of which the phone layout
      // survived. bailing here leaves that markup exactly as the Designer placed it; the only thing
      // this branch still owns is the desktop/mobile wrapper swap. tablet falls through and builds.
      if (isStatic && MOBILE_STATIC) {
        document.documentElement.setAttribute('data-stack-mode', 'mobile');
        Array.prototype.forEach.call(document.querySelectorAll(MOBILE_SEL), function (el) {
          guardStyle(el);
          el.style.display = '';
          if (window.getComputedStyle(el).display === 'none') {
            el.style.setProperty('display', MOBILE_DISPLAY, 'important');
          }
        });
        if (DEBUG) { console.log('[stack] mobile static: no choreography built'); }
        return function cleanupStatic() {
          for (var t = teardown.length - 1; t >= 0; t--) {
            try { teardown[t](); } catch (e) {  }
          }
        };
      }

      var section = one(document, 'section');
      if (!section) { console.warn('[stack] no data-stack="section" found'); return; }

      var card  = one(section, 'card');
      var head  = one(section, 'card-head');
      var items = Array.prototype.slice.call(sel(section, 'item'));

      if (!card) { console.warn('[stack] no data-stack="card" inside section'); return; }
      if (items.length < 2) { console.warn('[stack] need 2+ data-stack="item" elements'); return; }

      items.sort(function (a, b) {
        var ao = parseFloat(a.getAttribute(ORDER)); if (isNaN(ao)) { ao = Infinity; }
        var bo = parseFloat(b.getAttribute(ORDER)); if (isNaN(bo)) { bo = Infinity; }
        return ao - bo;
      });

      // stamp LANDED_ROWS on as attributes, before anything reads them. never over an attribute the
      // Designer already set - authored markup outranks this table.
      if (LANDED_ROWS) {
        items.forEach(function (it, i) {
          var key = parseFloat(it.getAttribute(ORDER));
          var spec = LANDED_ROWS[isNaN(key) ? (i + 1) : key];
          if (!spec) { return; }
          if (spec.text  && !it.getAttribute(LANDED_ATTR))       { it.setAttribute(LANDED_ATTR, spec.text); }
          if (spec.name  && !it.getAttribute(LANDED_NAME_ATTR))  { it.setAttribute(LANDED_NAME_ATTR, spec.name); }
          var col = spec.color || (spec.name && LANDED_NAME_COLORS[spec.name]);
          if (col && !it.getAttribute(LANDED_COLOR_ATTR)) { it.setAttribute(LANDED_COLOR_ATTR, col); }
        });
        if (DEBUG) {
          console.log('[stack] landed rows:', items.map(function (it) {
            return it.getAttribute(ORDER) + '=' + (it.getAttribute(LANDED_NAME_ATTR) || '-');
          }).join(' '));
        }
      }

      guardStyle(section);
      if (window.getComputedStyle(section).position === 'static') {
        section.style.position = 'relative';
      }

      if (isDesktop) {
        section.style.height   = 'calc(100vh + 2px)';
        section.style.overflow = 'hidden';
      }

      var scatterCtx = items[0].parentNode;
      var mi0 = scatterCtx.getBoundingClientRect();
      var frac = items.map(function (it) {
        var r = it.getBoundingClientRect();
        return {
          fx: mi0.width  ? (r.left - mi0.left) / mi0.width  : 0,
          fy: mi0.height ? (r.top  - mi0.top)  / mi0.height : 0
        };
      });

      // READ BEFORE WRITE: the next line sets every row to 0, and once that inline style is on
      // the element its authored opacity is gone for good. captured here, while the computed
      // value is still whatever Webflow styled it as.
      items.forEach(function (it) {
        var o = DIM_FROM_CSS ? parseFloat(window.getComputedStyle(it).opacity) : 1;
        // 0 is a legitimate authored value, not "unset": a row set to 0 stays out of the scatter
        // entirely and only appears as it flies into the card. only NaN falls back to full.
        it._restOpacity = isNaN(o) ? 1 : Math.max(0, Math.min(1, o));
      });

      items.forEach(function (it) { guardStyle(it); });
      gsap.set(items, { opacity: 0 });

      items.forEach(function (it) {
        var ph = document.createComment('stack-item');
        it.parentNode.insertBefore(ph, it);
        teardown.push(function () {
          if (ph.parentNode) { ph.parentNode.insertBefore(it, ph); ph.parentNode.removeChild(ph); }
        });
        guardStyle(it);
        card.appendChild(it);
        it.style.position   = 'relative';
        it.style.inset      = 'auto';
        it.style.margin     = '0';
        it.style.boxSizing  = 'border-box';
        if (!isDesktop && ROW_MOBILE_FIT === 'fill') {
          it.style.width      = '100%';
          it.style.whiteSpace = 'normal';
        } else if (!isDesktop && ROW_MOBILE_FIT === 'wrap') {
          it.style.width      = '';
          it.style.whiteSpace = 'normal';
        } else {
          it.style.width      = '';
          it.style.whiteSpace = 'nowrap';
        }
        it.style.willChange = 'transform, opacity';
      });
      // the rows are re-parented into the card with margin:0, so the first one sits flush against
      // the head. this is the only gap the authored layout can't give back.
      var topPad = isDesktop ? STACK_TOP_PAD : STACK_TOP_PAD_MOB;
      if (topPad && items[0]) { items[0].style.marginTop = topPad + 'px'; }

      Array.prototype.forEach.call(sel(card, 'foot'), function (el) {
        var fph = document.createComment('stack-foot');
        el.parentNode.insertBefore(fph, el);
        teardown.push(function () {
          if (fph.parentNode) { fph.parentNode.insertBefore(el, fph); fph.parentNode.removeChild(fph); }
        });
        card.appendChild(el);
      });

      var checks = items.map(function (it) { return it.querySelector('[' + ATTR + '="check"], .meeting_check'); });

      var headIcons = card
        ? Array.prototype.slice.call(card.querySelectorAll('[' + ATTR + '="icon"]'))
            .filter(function (ic) { return !items.some(function (it) { return it.contains(ic); }); })
        : [];

      var ccs        = window.getComputedStyle(card);
      var origBg     = ccs.backgroundColor;
      var origBorder = ccs.borderColor;
      var origShadow = ccs.boxShadow;
      guardStyle(card);
      card.style.boxSizing  = 'border-box';
      card.style.willChange = 'transform';

      var geo = items.map(function () { return { dx: 0, dy: 0 }; });
      var out = items.map(function () { return { ox: 0, oy: 0 }; });

      function measureGeo() {
        gsap.set(items, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
        gsap.set(card,  { x: 0, y: 0 });
        var mi  = scatterCtx.getBoundingClientRect();
        var nat = items.map(function (it) { return it.getBoundingClientRect(); });
        var spot = [], cx = 0, cy = 0, s;
        for (s = 0; s < items.length; s++) {
          geo[s].dx = (mi.left + frac[s].fx * mi.width)  - nat[s].left;
          geo[s].dy = (mi.top  + frac[s].fy * mi.height) - nat[s].top - CARD_DROP_PX;
          var scX = nat[s].left + geo[s].dx + nat[s].width  / 2;
          var scY = nat[s].top  + geo[s].dy + nat[s].height / 2;
          spot.push({ x: scX, y: scY });
          cx += scX; cy += scY;
        }
        cx /= items.length; cy /= items.length;
        for (s = 0; s < items.length; s++) {
          out[s].ox = spot[s].x - cx;
          out[s].oy = spot[s].y - cy;
        }
      }

      measureGeo();
      items.forEach(function (it, i) {
        gsap.set(it, {
          x: geo[i].dx, y: geo[i].dy,
          scaleX: POP_SCALE_X, scaleY: POP_SCALE_Y,
          opacity: 0, transformOrigin: '50% 50%', zIndex: i + 1
        });
        if (checks[i]) { gsap.set(checks[i], { scale: 0, opacity: 0, transformOrigin: '50% 50%' }); }
      });
      gsap.set(card, { opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)' });
      if (head) { gsap.set(head, { opacity: 0 }); }
      if (headIcons.length) { gsap.set(headIcons, { opacity: 0 }); }

      // the opacity a row rests at once popped, before it is gathered
      function popOpacity(i, el) { return el._restOpacity; }
      function isDim(el) { return el._restOpacity < GATHER_OPACITY; }
      if (DEBUG) {
        console.log('[stack] rows dimmed by their own CSS:', items.filter(isDim).length,
                    'of', items.length, '| values:', items.map(function (it) { return it._restOpacity; }));
      }

      // one place resolves the batch size, so POP_BATCH = 0 cannot divide by zero anywhere
      var perBatch   = POP_BATCH > 0 ? POP_BATCH : items.length;
      var batchCount = Math.ceil(items.length / perBatch);
      var popTls = [];
      var b;
      for (b = 0; b < batchCount; b++) {
        (function (batch) {
          var members     = items.filter(function (it, i) { return Math.floor(i / perBatch) === batch; });
          var memberIdx   = items.map(function (it, i) { return i; }).filter(function (i) { return Math.floor(i / perBatch) === batch; });
          var batchChecks = memberIdx.map(function (i) { return checks[i]; }).filter(Boolean);

          var tl = gsap.timeline({ paused: true });
          // a function value, not a number: one tween covers the batch but each row resolves its
          // own target, so a dimmed row and a solid one can pop together
          var popStag = (POP_HEAD > 0)
            ? function (i) { return i < POP_HEAD ? 0 : (i - POP_HEAD + 1) * POP_STAGGER; }
            : POP_STAGGER;
          tl.to(members, { opacity: popOpacity, scaleX: 1, scaleY: 1, duration: POP_DUR, ease: POP_EASE, stagger: popStag }, 0);
          if (batchChecks.length) {
            tl.to(batchChecks, { scale: 1, opacity: 1, duration: CHECK_DUR, ease: CHECK_EASE, stagger: popStag }, CHECK_DELAY);
          }
          popTls.push(tl);
        }(b));
      }

      // ---- detected words: the gradient goes on each LETTER, not the word — background-clip:text
      // fights a transform on the same element in Blink/WebKit ----
      // each word remembers WHICH row in the batch it belongs to. with one row per batch that was
      // implicit - the scroll step spaced them - but a batch holding every row fires them all at
      // one delay, so every gradient lights at once and the walk down the list becomes a flash.
      // the slot is what lets the word wait for its own row to pop.
      var detectByBatch = [];
      for (b = 0; b < batchCount; b++) {
        detectByBatch.push(items.filter(function (it, i) { return Math.floor(i / perBatch) === b; })
          .reduce(function (acc, it, slot) {
            return acc.concat(Array.prototype.slice.call(it.querySelectorAll(DETECT_SEL))
              .map(function (el) { return { el: el, slot: slot }; }));
          }, []));
      }
      var detectCalls = [];

      function splitWord(el) {
        if (el._letters) { return el._letters; }
        var txt = el.textContent, spans = [], i, s;
        el._color = window.getComputedStyle(el).color;
        el.textContent = '';
        for (i = 0; i < txt.length; i++) {
          s = document.createElement('span');
          s.textContent = txt.charAt(i);
          s.style.display = 'inline-block';
          s.style.whiteSpace = 'pre';
          el.appendChild(s);
          spans.push(s);
        }
        el._letters = spans;
        teardown.push(function () { el.textContent = txt; el._letters = null; });
        return spans;
      }

      function paintDetect(el, on) {
        var spans = splitWord(el);
        var wordLeft = el.getBoundingClientRect().left;
        var wordW = el.getBoundingClientRect().width || 1;
        for (var i = 0; i < spans.length; i++) {
          var s = spans[i];
          if (on) {
            s.style.backgroundImage = DETECT_GRAD;
            s.style.backgroundSize = wordW + 'px 100%';
            s.style.backgroundRepeat = 'no-repeat';
            s.style.backgroundPosition = (-(s.getBoundingClientRect().left - wordLeft)) + 'px 0';
            s.style.setProperty('-webkit-background-clip', 'text');
            s.style.backgroundClip = 'text';
          }
          // the bloom rides the same fade as the colour, so the word lights and settles as one move.
          // text-shadow paints from the GLYPH, not the background, so it survives
          // background-clip:text - a box-shadow here would draw a rectangle instead.
          s.style.transition = 'color ' + (on ? DETECT_FADE : DETECT_BACK) + 'ms ease' +
            (DETECT_GLOW ? ', text-shadow ' + (on ? DETECT_FADE : DETECT_BACK) + 'ms ease' : '');
          if (DETECT_GLOW) {
            s.style.textShadow = on
              ? ('0 0 ' + DETECT_GLOW + 'px rgba(255,255,255,' + DETECT_GLOW_A + ')')
              : '';
          }
          s.style.color = on ? 'transparent' : (el._color || '');
        }
      }

      function rippleWord(el) {
        var spans = splitWord(el);
        for (var i = 0; i < spans.length; i++) {
          (function (sp, idx) {
            if (typeof sp.animate !== 'function') { return; }
            sp.animate([
              { transform: 'translateY(0%) rotate(0deg)' },
              { transform: 'translateY(' + (-DETECT_Y_PCT) + '%) rotate(' + (-DETECT_ROT) + 'deg)', offset: 0.5 },
              { transform: 'translateY(0%) rotate(0deg)' }
            ], { duration: DETECT_LETTER_MS, delay: idx * DETECT_STAGGER, easing: 'linear' });
          }(spans[i], i));
        }
      }

      function playDetect(batch) {
        (detectByBatch[batch] || []).forEach(function (d) {
          var el = d.el;
          // DETECT_AT is measured from the row's OWN pop, so the same offset the pop tween
          // staggers by has to be added here or the word lights before its row arrives
          detectCalls.push(gsap.delayedCall(DETECT_AT + d.slot * POP_STAGGER, function () {
            paintDetect(el, true);
            rippleWord(el);
            detectCalls.push(gsap.delayedCall((DETECT_FADE + DETECT_HOLD) / 1000, function () {
              paintDetect(el, false);
            }));
          }));
        });
      }

      function resetDetect(batch) {
        // every pending call, not just this batch's: one would fire onto an already-reversed bubble
        for (var i = 0; i < detectCalls.length; i++) { detectCalls[i].kill(); }
        detectCalls.length = 0;
        (detectByBatch[batch] || []).forEach(function (d) {
          if (d.el._letters) { paintDetect(d.el, false); }
        });
      }

      teardown.push(function () {
        for (var i = 0; i < detectCalls.length; i++) { detectCalls[i].kill(); }
        detectCalls.length = 0;
      });

      if (DEBUG) {
        console.log('[stack] detect "' + DETECT_SEL + '" per batch: [' +
          detectByBatch.map(function (a) { return a.length; }).join(',') + '] total=' +
          detectByBatch.reduce(function (n, a) { return n + a.length; }, 0) +
          ' | inSection=' + section.querySelectorAll(DETECT_SEL).length);
        window.stackDetect = function (batch) { playDetect(batch || 0); };
      }

      var landedBg = LANDED_BG ||
        window.getComputedStyle(card).getPropertyValue(LANDED_BG_VAR).trim() ||
        window.getComputedStyle(document.documentElement).getPropertyValue(LANDED_BG_VAR).trim();

      // rewrite an element's words, preferring its own TEXT NODE over textContent: a row holds its
      // name tag as an element sibling of its text, and textContent would delete it. originals are
      // captured on first use so the reverse is exact.
      function swapNode(el, alt, landed) {
        if (!el) { return; }
        for (var i = 0; i < el.childNodes.length; i++) {
          var n = el.childNodes[i];
          if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) {
            if (n._rawText == null) { n._rawText = n.nodeValue; }
            n.nodeValue = landed ? alt : n._rawText;
            return;
          }
        }
        if (el._rawText == null) { el._rawText = el.textContent; }
        el.textContent = landed ? alt : el._rawText;
      }
      function swapStyle(el, prop, val, landed) {
        if (!el || !val) { return; }
        var key = '_raw_' + prop;
        if (el[key] == null) { el[key] = el.style[prop] || ''; }   // '' restores the stylesheet's own
        el.style[prop] = landed ? val : el[key];
      }
      function hasLanded(it) {
        return !!(it.getAttribute(LANDED_ATTR) || it.getAttribute(LANDED_NAME_ATTR) ||
                  it.getAttribute(LANDED_COLOR_ATTR) || it.getAttribute(LANDED_BG_ATTR));
      }
      // replace ALL of an element's content, keeping the original child NODES alive so they can be
      // put back byte-for-byte. .meeting_item_text is not one text node - it is
      // "text" + <span class="meeting_item_animate"> + "text", so rewriting only the first text
      // node left the detect span and the trailing words behind and the two readings ran together.
      // removeChild keeps each node alive in the saved array, so the detect span that
      // detectByBatch already holds a reference to is the SAME element when it comes back - an
      // innerHTML round-trip would silently swap it for a clone and break the gradient on reverse.
      function swapContent(el, alt, landed) {
        if (!el) { return; }
        if (el._rawNodes == null) { el._rawNodes = Array.prototype.slice.call(el.childNodes); }
        while (el.firstChild) { el.removeChild(el.firstChild); }
        if (landed) {
          el.appendChild(document.createTextNode(alt));
        } else {
          for (var i = 0; i < el._rawNodes.length; i++) { el.appendChild(el._rawNodes[i]); }
        }
      }

      // one row - real or cloned. the clone carries the same attributes (it was cloneNode'd after
      // they were stamped), so it can be driven by exactly the same code.
      function applyLanded(row, landed) {
        if (!row) { return; }
        var alt = row.getAttribute(LANDED_ATTR);
        if (alt) { swapContent(row.querySelector('.meeting_item_text') || row, alt, landed); }
        var tag = row.querySelector(NAME_TAG_SEL);
        if (!tag) { return; }
        swapNode(tag, row.getAttribute(LANDED_NAME_ATTR) || '', landed && !!row.getAttribute(LANDED_NAME_ATTR));
        swapStyle(tag, 'color', row.getAttribute(LANDED_COLOR_ATTR), landed);
        swapStyle(tag, 'backgroundColor', row.getAttribute(LANDED_BG_ATTR), landed);
      }

      // the light clone is a snapshot taken at init, so it froze the ORIGINAL wording - it has to be
      // updated alongside the real row or the card changes text the moment the light reveal swaps
      // one for the other. matched by position: the clone was made after the rows were reparented,
      // so its row order is the same.
      var cloneRowCache = null;
      function cloneRowFor(it) {
        if (!cardClone) { return null; }
        if (!cloneRowCache) {
          cloneRowCache = Array.prototype.slice.call(cardClone.querySelectorAll('[' + ATTR + '="item"]'));
        }
        var idx = items.indexOf(it);
        return idx >= 0 ? (cloneRowCache[idx] || null) : null;
      }

      function setRowLanded(it, landed) {
        applyLanded(it, landed);
        applyLanded(cloneRowFor(it), landed);
      }

      var gatherTl = gsap.timeline({ paused: true });
      gatherTl.to(card, { backgroundColor: origBg, borderColor: origBorder, duration: CARD_FADE, ease: 'power2.out' }, 0);
      if (head) { gatherTl.to(head, { opacity: 1, duration: CARD_FADE, ease: 'power2.out' }, 0); }
      if (headIcons.length) { gatherTl.to(headIcons, { opacity: 1, duration: CARD_FADE, ease: 'power2.out' }, 0); }
      items.forEach(function (it, slot) {
        var tween = {
          x: 0, y: 0, duration: GATHER_DUR, ease: GATHER_EASE,
          onStart: function () { it.style.zIndex = 100 + slot; }
        };
        // a dimmed row comes up to full as it lands - the gather is the moment it stops being
        // background chatter and becomes a line in the summary. rows that were never dimmed are
        // left out of this entirely rather than tweened 1 -> 1, so the gather does not take
        // ownership of an opacity the pop already owns.
        if (isDim(it)) { tween.opacity = GATHER_OPACITY; }
        if (landedBg) { tween.backgroundColor = landedBg; }
        if (STACK_ITEM_RADIUS) {
          tween.borderTopLeftRadius = tween.borderTopRightRadius =
          tween.borderBottomLeftRadius = tween.borderBottomRightRadius = STACK_ITEM_RADIUS;
        }
        var flyAt = CARD_FADE * 0.5 + slot * GATHER_STAGGER;
        gatherTl.to(it, tween, flyAt);
        // onStart fires crossing forward, onReverseComplete crossing back - so scrubbing up
        // restores the scattered wording instead of stranding the landed one
        if (hasLanded(it)) {
          (function (row) {
            gatherTl.to({}, {
              duration: 0.001,
              onStart: function () { setRowLanded(row, true); },
              onReverseComplete: function () { setRowLanded(row, false); }
            }, flyAt + GATHER_DUR * LANDED_AT);
          }(it));
        }
      });

      var pops = Array.prototype.slice.call(sel(section, 'pop')).sort(function (a, b) {
        var ao = parseFloat(a.getAttribute(ORDER)); if (isNaN(ao)) { ao = Infinity; }
        var bo = parseFloat(b.getAttribute(ORDER)); if (isNaN(bo)) { bo = Infinity; }
        return ao - bo;
      });
      var popPar = [];
      pops.forEach(function (el, i) {
        guardStyle(el);
        if (window.getComputedStyle(el).position === 'static') { el.style.position = 'relative'; }
        el.style.zIndex = String(POP_IMG_Z);
        function num(attr, dflt) { var v = parseFloat(el.getAttribute(attr)); return isNaN(v) ? dflt : v; }
        var inner = el.querySelector('img') || el.firstElementChild;
        if (inner) {
          guardStyle(inner);
          inner.style.willChange = 'transform';
          popPar.push({ el: inner, depth: num('data-pop-depth', POP_PAR_DEPTH[i % POP_PAR_DEPTH.length]) });
        }
        var fromRot = num('data-pop-rot', POP_IMG_ROT * (i % 2 ? -1 : 1));
        gsap.set(el, {
          opacity: 0, transformOrigin: '50% 50%',
          scale: num('data-pop-scale', POP_IMG_SCALE),
          x: num('data-pop-x', POP_IMG_X), y: num('data-pop-y', POP_IMG_Y), rotation: fromRot
        });
        gatherTl.to(el, { opacity: 1, scale: 1, x: 0, y: 0, rotation: 0, duration: POP_IMG_DUR, ease: POP_IMG_EASE },
          POP_IMG_AT + i * POP_IMG_STAGGER);
      });
      var popTgt = 0, popCur = 0, popPainted = null;
      function popParallax(p) {
        if (!popPar.length) { return; }
        popTgt = Math.max(0, p - gatherThresh * pA);
      }
      function paintPopParallax() {
        if (popPainted === popCur) { return; }
        popPainted = popCur;
        for (var i = 0; i < popPar.length; i++) {
          popPar[i].el.style.transform =
            'translate3d(0,' + (-popCur * POP_PAR_DIST * popPar[i].depth).toFixed(2) + 'px,0)';
        }
      }
      if (pops.length) {
        var popTicker = function () {
          var diff = popTgt - popCur;
          if (Math.abs(diff) < 0.00002) { if (popCur !== popTgt) { popCur = popTgt; paintPopParallax(); } return; }
          popCur += diff * (1 - Math.pow(1 - POP_PAR_SMOOTH, gsap.ticker.deltaRatio()));
          paintPopParallax();
        };
        gsap.ticker.add(popTicker);
        teardown.push(function () { gsap.ticker.remove(popTicker); });
      }
      var popsOutside = pops.filter(function (el) { return !card.contains(el); }).length;
      if (popsOutside) {
        console.warn('[stack] ' + popsOutside + ' [data-stack="pop"] element(s) are outside ' +
          '[data-stack="card"] — they will not travel with the card. move them inside it.');
      }
      if (DEBUG) { console.log('[stack] pop images:', pops.length, 'outside card:', popsOutside); }

      var stepCount = batchCount + 1 + HOLD_STEPS;
      var popPlayed = popTls.map(function () { return false; });
      var gatherOn  = false;

      function thresholdFor(step) { return step / stepCount; }
      var popThresh    = popTls.map(function (_, i) { return POP_LEAD + thresholdFor(i) * POP_BUNCH; });
      var gatherThresh = thresholdFor(batchCount);

      function spreadT(ap) {
        if (gatherThresh <= 0) { return 0; }
        return smooth(ap / gatherThresh);
      }

      // batches the pre-roll owns. the pinned progress is 0 at the pin, which is BELOW every pop
      // threshold - so without this the pin would immediately reverse whatever the pre-roll played.
      var preOwned = (PRE_POP && popTls.length) ? 1 : 0;

      function update(p) {
        var i;
        for (i = preOwned; i < popTls.length; i++) {
          if (p >= popThresh[i] && !popPlayed[i])      { popTls[i].play();    popPlayed[i] = true;  playDetect(i); }
          else if (p < popThresh[i] && popPlayed[i])   { popTls[i].reverse(); popPlayed[i] = false; resetDetect(i); }
        }
        if (p >= gatherThresh && !gatherOn)            { gatherTl.play();    gatherOn = true;  }
        else if (p < gatherThresh && gatherOn)         { gatherTl.reverse(); gatherOn = false; }
      }

      function refresh() {
        if (AUDIO_BARS && !audioBars.length) { buildAudio(); }   // hosts may be measurable now
        if (isDesktop) { section.style.height = 'calc(100vh + 2px)'; }
        else if (canLeave) { greenPanel.style.height = window.innerHeight + 'px'; }
        if (cardClone) { cardClone.style.display = 'none'; }
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        measureGeo();
        measurePositions();
        computeTiming();
        if (!gatherOn) {
          items.forEach(function (it, i) {
            var played = popPlayed[Math.floor(i / perBatch)];
            gsap.set(it, {
              x: geo[i].dx, y: geo[i].dy,
              scaleX: played ? 1 : POP_SCALE_X,
              scaleY: played ? 1 : POP_SCALE_Y,
              // a popped-but-not-yet-gathered dim row belongs at DIM_OPACITY, not 1 - resizing
              // mid-scatter used to restore every row to full and lose the dimming
              opacity: played ? popOpacity(i, it) : 0
            });
          });
          gatherTl.invalidate();
        } else {
          gsap.set(items, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 });
        }
        if (exitTl && exitPlayed) { exitTl.invalidate().progress(1); }
        applyScroll(st ? st.progress : 0);
        if (activeTab >= 0) { moveIndicator(activeTab); }
      }

      var greenPanel = one(section, 'green');
      if (!greenPanel) {
        greenPanel = card;
        while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
      }
      var canLeave = greenPanel !== card;
      guardStyle(greenPanel);
      // no hasAttribute guard: it wrote the value once on the first build, so every later build -
      // including the desktop<->mobile matchMedia rebuild - skipped this block entirely and the
      // panel kept whatever radius the first build happened to resolve.
      if (canLeave && (GREEN_RADIUS || (GREEN_RADIUS_BP && GREEN_RADIUS_BP.length))) {
        var setGreenRadius = function () {
          var v = String(resolveRadius(greenPanel));
          if (greenPanel.getAttribute('data-corners') !== v) {
            greenPanel.setAttribute('data-corners', v);
            if (DEBUG) { console.log('[stack] green radius ' + v + 'px at ' + window.innerWidth + 'px'); }
          }
        };
        setGreenRadius();
        // matchMedia only rebuilds at 992, and this breakpoint is 767 - so the rebuild alone would
        // never notice a crossing. the listener is what actually makes it responsive.
        window.addEventListener('resize', setGreenRadius);
        teardown.push(function () { window.removeEventListener('resize', setGreenRadius); });
        if (window.Corners) { window.Corners.scan(); }
      }

      if (!isDesktop && canLeave) {
        greenPanel.style.height   = window.innerHeight + 'px';
        greenPanel.style.overflow = 'hidden';
      }

      var greenBg  = canLeave ? window.getComputedStyle(greenPanel).backgroundColor : '';
      var topCover = null;
      if (canLeave && greenBg && greenBg !== 'rgba(0, 0, 0, 0)' && greenBg !== 'transparent') {
        topCover = document.createElement('div');
        topCover.setAttribute('aria-hidden', 'true');
        topCover.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;pointer-events:none;' +
          'display:none;z-index:' + (LIGHT_Z - 1) + ';background:' + greenBg + ';';
        document.body.appendChild(topCover);
        teardown.push(function () { if (topCover.parentNode) { topCover.parentNode.removeChild(topCover); } });
      }

      document.documentElement.setAttribute('data-stack-mode', isDesktop ? 'desktop' : 'mobile');
      var inSel   = isDesktop ? DESKTOP_SEL : MOBILE_SEL;
      var offSel  = isDesktop ? MOBILE_SEL  : DESKTOP_SEL;
      var inDisp  = isDesktop ? DESKTOP_DISPLAY : MOBILE_DISPLAY;
      var inBlocks = document.querySelectorAll(inSel);
      if (DEBUG) {
        console.log('[stack] build mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' | in(' + inSel + ')=' + inBlocks.length + ' off(' + offSel + ')=' + document.querySelectorAll(offSel).length);
      }
      Array.prototype.forEach.call(inBlocks, function (el) {
        guardStyle(el);
        el.style.display = '';
        if (window.getComputedStyle(el).display === 'none') { el.style.setProperty('display', inDisp, 'important'); }
      });

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

      Array.prototype.forEach.call(bgSvgs, function (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) {
          guardStyle(p);
          var len = (p.getTotalLength ? p.getTotalLength() : 0) || 1;
          p.style.strokeDasharray  = len;
          p.style.strokeDashoffset = len;
          p._len = len;
        });
      });
      // draw ONE tab's line to full length, retract every other. timed, not scrubbed - so the line
      // always plays its whole animation regardless of how fast the tab was reached.
      function drawBgTab(n) {
        var N = bgSvgs.length; if (!N) { return; }
        for (var i = 0; i < N; i++) {
          var want = (i === n) ? 0 : 1;                       // 0 = fully drawn, 1 = fully retracted
          var ms   = (i === n) ? BG_DRAW_MS : BG_DRAW_OUT_MS;
          Array.prototype.forEach.call(bgSvgs[i].querySelectorAll('path'), function (pth) {
            gsap.to(pth, {
              strokeDashoffset: want * pth._len,
              duration: ms / 1000, ease: BG_DRAW_EASE, overwrite: true
            });
          });
        }
      }

      function drawBg(tp) {
        if (BG_DRAW_ON_TAB) { return; }   // per-tab draw owns the paths; scrubbing would fight it
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
      Array.prototype.forEach.call(tabAnims, function (el) { el.setAttribute('data-play', 'off'); });

      // panels stacked into one grid cell: visibility:hidden still occupies layout, so left in flow
      // they pile up and make the stage five panels tall
      var animStage = tabAnims.length ? tabAnims[0].parentNode : null;
      if (animStage) {
        guardStyle(animStage);
        animStage.style.display = 'grid';
        animStage.style.gridTemplateRows    = '100%';
        animStage.style.gridTemplateColumns = '100%';
        var panelRadius = PANEL_CLIP ? window.getComputedStyle(card).borderRadius : '';
        Array.prototype.forEach.call(tabAnims, function (el) {
          guardStyle(el);
          el.style.gridArea = '1 / 1';
          el.style.minWidth = el.style.minHeight = '0';
          if (PANEL_FILL) {
            el.style.height = el.style.width = '100%';
            el.style.display = 'grid';
            el.style.gridTemplateRows    = '100%';
            el.style.gridTemplateColumns = '100%';
            Array.prototype.forEach.call(el.children, function (kid) {
              if (kid.nodeType !== 1) { return; }
              guardStyle(kid);
              kid.style.gridArea = '1 / 1';
              kid.style.minWidth = kid.style.minHeight = '0';
            });
          }
          if (PANEL_CLIP) {
            el.style.overflow = 'hidden';
            if (panelRadius && panelRadius !== '0px') { el.style.borderRadius = panelRadius; }
          }
        });
      }

      // ---- chapter plate: never-fading surface under the panels + the per-chapter photos ----
      var plate = null, plateRadius = window.getComputedStyle(card).borderRadius;
      var plateEdge = PLATE_EDGE || LIGHT_CARD_BG;
      var plateEdgeSides = [];   // only the sides the card actually draws a border on
      var bgList = [], bgByTab = {}, bgShown = -1, bgMeltTween = null, meltGL = null;

      if (DEBUG) { window.stackBoxes = function () {
        function box(el) {
          if (!el) { return 'none'; }
          var r = el.getBoundingClientRect();
          return Math.round(r.width) + 'x' + Math.round(r.height);
        }
        console.log('[stack] card=' + box(card) + ' stage=' + box(animStage) +
          ' stageInline=' + (animStage ? animStage.style.width + '/' + animStage.style.height : '-'));
        Array.prototype.forEach.call(tabAnims, function (el) {
          console.log('  tab' + el.getAttribute('data-tab-anim') + ' panel=' + box(el) +
            ' child=' + box(el.firstElementChild) +
            ' grandchild=' + box(el.firstElementChild && el.firstElementChild.firstElementChild));
        });
      }; }

      if (CHAPTER_PLATE && animStage) {
        plate = document.createElement('div');
        plate.setAttribute('aria-hidden', 'true');
        plate.className = 'stack-chapter-plate';
        plate.style.cssText = 'grid-area:1 / 1;position:relative;overflow:hidden;pointer-events:none;' +
          'min-width:0;min-height:0;opacity:0;box-sizing:border-box;' +
          (plateRadius && plateRadius !== '0px' ? 'border-radius:' + plateRadius + ';' : '');

        var cardCS = window.getComputedStyle(card);
        plate.style.backgroundColor = PLATE_BG || (LIGHT_REVEAL ? LIGHT_CARD_BG : origBg);
        if (cardCS.backgroundImage && cardCS.backgroundImage !== 'none') {
          plate.style.backgroundImage    = cardCS.backgroundImage;
          plate.style.backgroundSize     = cardCS.backgroundSize;
          plate.style.backgroundPosition = cardCS.backgroundPosition;
          plate.style.backgroundRepeat   = cardCS.backgroundRepeat;
        }
        ['Top', 'Right', 'Bottom', 'Left'].forEach(function (side) {
          if (parseFloat(cardCS['border' + side + 'Width']) > 0 &&
              cardCS['border' + side + 'Style'] !== 'none') {
            plate.style['border' + side + 'Width'] = cardCS['border' + side + 'Width'];
            plate.style['border' + side + 'Style'] = cardCS['border' + side + 'Style'];
            plate.style['border' + side + 'Color'] = LIGHT_REVEAL ? plateEdge : origBorder;
            plateEdgeSides.push(side);
          }
        });
        if (LIGHT_REVEAL) { plate.style.boxShadow = '0 0 0 ' + LIGHT_RING + 'px ' + plateEdge; }
        else if (origShadow && origShadow !== 'none') { plate.style.boxShadow = origShadow; }
        animStage.insertBefore(plate, animStage.firstChild);
        teardown.push(function () { if (plate.parentNode) { plate.parentNode.removeChild(plate); } });

        bgList = Array.prototype.slice.call(section.querySelectorAll('[' + CHAPTER_BG + ']'))
          .sort(function (a, b) {
            return (parseInt(a.getAttribute(CHAPTER_BG), 10) || 0) - (parseInt(b.getAttribute(CHAPTER_BG), 10) || 0);
          });
        bgList.forEach(function (im, k) {
          bgByTab[parseInt(im.getAttribute(CHAPTER_BG), 10)] = k;
          var ph = document.createComment('chapter-bg');
          im.parentNode.insertBefore(ph, im);
          teardown.push(function () {
            if (ph.parentNode) { ph.parentNode.insertBefore(im, ph); ph.parentNode.removeChild(ph); }
          });
          guardStyle(im);
          plate.appendChild(im);
          im.style.setProperty('display', 'block', 'important');
          im.style.setProperty('visibility', 'visible', 'important');
          im.style.position = 'absolute';
          im.style.top = im.style.left = '0';
          im.style.width = im.style.height = '100%';
          im.style.objectFit = 'cover';
          im.style.zIndex = '0';
          im.style.pointerEvents = 'none';
          im.style.opacity = '0';
          im.style.transition = 'none';
        });
      }

      (function initMeltGL() {
        if (!plate || bgList.length < 2 || MELT_INTENSITY <= 0) { return; }
        var canvas = document.createElement('canvas');
        canvas.className = 'stack-melt-canvas';
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:1;';
        plate.appendChild(canvas);
        var gl = null;
        try { gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true }) || canvas.getContext('experimental-webgl'); } catch (e) {}
        if (!gl) { if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } return; }

        var VS = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}';
        var FS = [
          'precision mediump float;',
          'uniform sampler2D uFrom;uniform sampler2D uTo;',
          'uniform float uDisp;uniform float uIntensity;uniform float uNoise;',
          'uniform vec4 uCoverFrom;uniform vec4 uCoverTo;varying vec2 vUv;',
          'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
          'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));vec2 u=f*f*(3.-2.*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}',
          'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vnoise(p);p*=2.;a*=.5;}return v;}',
          'void main(){',
          ' float n=fbm(vUv*uNoise);float amt=n*uIntensity;',
          ' vec2 uF=clamp(vUv+vec2(amt*uDisp,0.0),0.,1.)*uCoverFrom.xy+uCoverFrom.zw;',
          ' vec2 uT=clamp(vUv-vec2(amt*(1.0-uDisp),0.0),0.,1.)*uCoverTo.xy+uCoverTo.zw;',
          ' gl_FragColor=mix(texture2D(uFrom,uF),texture2D(uTo,uT),uDisp);',
          '}'
        ].join('\n');

        function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[melt] shader', gl.getShaderInfoLog(s)); } return s; }
        var prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[melt] link', gl.getProgramInfoLog(prog)); if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } return; }
        gl.useProgram(prog);

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var aPos = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        var uFrom = gl.getUniformLocation(prog, 'uFrom'), uTo = gl.getUniformLocation(prog, 'uTo'),
            uDisp = gl.getUniformLocation(prog, 'uDisp'), uInt = gl.getUniformLocation(prog, 'uIntensity'),
            uNoi = gl.getUniformLocation(prog, 'uNoise'),
            uCF = gl.getUniformLocation(prog, 'uCoverFrom'), uCT = gl.getUniformLocation(prog, 'uCoverTo');
        gl.uniform1i(uFrom, 0); gl.uniform1i(uTo, 1);
        gl.uniform1f(uInt, MELT_INTENSITY); gl.uniform1f(uNoi, MELT_NOISE);

        function mkTex() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]));
          return t; }
        var meta = bgList.map(function (im) {
          var m = { tex: mkTex(), w: 1, h: 1, ready: false };
          var ld = new Image(); ld.crossOrigin = 'anonymous';
          ld.onload = function () {
            try {
              gl.bindTexture(gl.TEXTURE_2D, m.tex);
              gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ld);
              m.w = ld.naturalWidth || 1; m.h = ld.naturalHeight || 1; m.ready = true;
            } catch (e) { console.warn('[melt] texture upload failed (CORS?) - plain crossfade fallback', e); }
          };
          ld.onerror = function () {};
          ld.src = im.currentSrc || im.src;
          return m;
        });

        function cover(m) {
          var cw = canvas.width || 1, ch = canvas.height || 1;
          var ca = cw / ch, ia = m.w / m.h, sx, sy;
          if (ia > ca) { sx = ca / ia; sy = 1; } else { sx = 1; sy = ia / ca; }
          return [sx, sy, (1 - sx) / 2, (1 - sy) / 2];
        }
        function resize() {
          var r = canvas.getBoundingClientRect();
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
        meltGL = {
          ready: function (a, b) { return meta[a] && meta[b] && meta[a].ready && meta[b].ready; },
          show: function (on) { canvas.style.opacity = on ? '1' : '0'; },
          render: function (a, b, disp) {
            resize();
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, meta[a].tex);
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, meta[b].tex);
            var cf = cover(meta[a]), ct = cover(meta[b]);
            gl.uniform4f(uCF, cf[0], cf[1], cf[2], cf[3]);
            gl.uniform4f(uCT, ct[0], ct[1], ct[2], ct[3]);
            gl.uniform1f(uDisp, disp);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
        };
        teardown.push(function () { if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } });
      }());

      function setChapterBg(n) {
        if (!plate) { return; }
        var want = bgByTab.hasOwnProperty(n) ? bgByTab[n] : -1;
        if (want === bgShown) { return; }
        var prev = bgShown;
        bgShown = want;
        if (bgMeltTween) { bgMeltTween.kill(); bgMeltTween = null; }
        if (meltGL) { meltGL.show(false); }
        if (bgList.length) { gsap.killTweensOf(bgList); }
        for (var i = 0; i < bgList.length; i++) { gsap.set(bgList[i], { opacity: i === prev ? 1 : 0 }); }

        if (prev >= 0 && want >= 0 && meltGL && meltGL.ready(prev, want)) {
          meltGL.render(prev, want, 0);
          meltGL.show(true);
          bgList[prev].style.opacity = '0';
          bgList[want].style.opacity = '0';
          var proxy = { p: 0 };
          bgMeltTween = gsap.to(proxy, {
            p: 1, duration: BG_FADE_MS / 1000, ease: 'power1.inOut',
            onUpdate: function () { meltGL.render(prev, want, proxy.p); },
            onComplete: function () {
              gsap.set(bgList[want], { opacity: 1 });
              meltGL.show(false);
              for (var b = 0; b < bgList.length; b++) { if (b !== want) { gsap.set(bgList[b], { opacity: 0 }); } }
              bgMeltTween = null;
            }
          });
        } else {
          for (var b = 0; b < bgList.length; b++) {
            gsap.to(bgList[b], {
              opacity: (b === want) ? 1 : 0,
              duration: BG_FADE_MS / 1000, ease: 'power1.inOut'
            });
          }
        }
      }
      teardown.push(function () {
        if (bgMeltTween) { bgMeltTween.kill(); bgMeltTween = null; }
        if (meltGL) { meltGL.show(false); }
      });

      function setActiveTab(n) {
        if (n === activeTab) { return; }
        activeTab = n;
        for (var i = 0; i < tabItems.length; i++) { tabItems[i].classList.toggle('is-active', i === n); }
        if (tabsWrap) { tabsWrap.setAttribute('data-active-tab', String(n)); }
        section.setAttribute('data-active-tab', String(n));
        toggleByIndex(tabTexts, 'data-tab-text', n);
        toggleByIndex(tabAnims, 'data-tab-anim', n);
        Array.prototype.forEach.call(tabAnims, function (el) {
          el.setAttribute('data-play', parseInt(el.getAttribute('data-tab-anim'), 10) === n ? 'on' : 'off');
        });
        ch2Leftovers(n);
        setChapterBg(n);
        moveIndicator(n);
        if (BG_DRAW_ON_TAB) { drawBgTab(n); }
      }

      var cardRiseDist = 0, sCenter = 0, sCardStart = 0;
      var landDX = 0, landDY = 0;
      function measurePositions() {
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        gsap.set(card, { x: 0, y: 0 });
        var mid   = window.innerHeight * CARD_TARGET;
        var secR  = section.getBoundingClientRect();
        var sTop  = secR.top;
        var sLeft = secR.left;
        var cr    = card.getBoundingClientRect();
        if (STAGE_MATCH_CARD && animStage && cr.width && cr.height) {
          animStage.style.width  = cr.width  + 'px';
          animStage.style.height = cr.height + 'px';
        }
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

        landDX = landDY = 0;
        if (CARD_LANDS_ON_STAGE && animStage) {
          var sr = animStage.getBoundingClientRect();
          if (sr.width && sr.height) {
            var cardCX = (cr.left - sLeft) + cr.width  / 2;
            var cardCY = (cr.top  - sTop)  + cr.height / 2;
            var stgCX  = (sr.left - sLeft) + sr.width  / 2;
            var stgCY  = (sr.top  - sTop)  + sr.height / 2;
            landDX = stgCX - cardCX;
            landDY = (stgCY - sCenter) - (cardCY - cardRiseDist);
          }
        }
      }

      function variantOf(el) {
        var at = el.attributes, i;
        for (i = 0; i < at.length; i++) {
          if (/^data-wf--.*--variant$/.test(at[i].name) && at[i].value) { return at[i].value.trim().toLowerCase(); }
        }
        var m = /(?:^|\s)w-variant-([\w-]+)/.exec(el.className || '');
        return m ? m[1].toLowerCase() : '';
      }
      function recolorNameTags(root) {
        Array.prototype.forEach.call(root.querySelectorAll(NAME_TAG_SEL), function (tag) {
          var v = variantOf(tag) || variantOf(tag.parentNode || tag);
          var spec = NAME_TAG_LIGHT[v];
          if (!spec) { return; }
          if (typeof spec === 'string') { tag.style.color = spec; return; }
          if (spec.color) { tag.style.color = spec.color; }
          if (spec.bg)    { tag.style.backgroundColor = spec.bg; }
        });
      }

      var cardClone = null;
      if (LIGHT_REVEAL && isDesktop) {
        cardClone = card.cloneNode(true);
        cardClone.removeAttribute(ATTR);
        Array.prototype.forEach.call(cardClone.querySelectorAll('[' + ATTR + '="pop"]'), function (el) {
          if (el.parentNode) { el.parentNode.removeChild(el); }
        });
        cardClone.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;' +
          'box-sizing:border-box;pointer-events:none;overflow:hidden;border-radius:inherit;' +
          'z-index:' + LIGHT_Z + ';display:none;' +
          'background:' + LIGHT_CARD_BG + ';color:' + LIGHT_TEXT + ';will-change:clip-path;';
        Array.prototype.forEach.call(cardClone.querySelectorAll('*'), function (el) { el.style.transform = ''; el.style.opacity = '1'; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="item"], .meeting_item'), function (el) {
          el.style.backgroundColor = LIGHT_ROW_BG;
          if (STACK_ITEM_RADIUS) { el.style.borderRadius = STACK_ITEM_RADIUS; }
        });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_item_text, [data-stack="card-head"]'), function (el) { el.style.color = LIGHT_TEXT; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_check, [data-stack="check"]'), function (el) { el.style.borderColor = LIGHT_TEXT; });
        cardClone.style.borderColor = plateEdge;
        cardClone.style.boxShadow   = '0 0 0 ' + LIGHT_RING + 'px ' + plateEdge;
        card.appendChild(cardClone);
        teardown.push(function () { if (cardClone.parentNode) { cardClone.parentNode.removeChild(cardClone); } });
        recolorNameTags(cardClone);
        Array.prototype.forEach.call(cardClone.querySelectorAll('[data-stack="icon"]'), function (icon) {
          icon.style.color = LIGHT_TEXT;
          var shapes = icon.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse');
          Array.prototype.forEach.call(shapes.length ? shapes : [icon], function (p) {
            var cs = window.getComputedStyle(p);
            var none = { 'none': 1, 'rgba(0, 0, 0, 0)': 1, 'transparent': 1 };
            if (cs.fill   && !none[cs.fill])   { p.style.fill   = LIGHT_TEXT; }
            if (cs.stroke && !none[cs.stroke]) { p.style.stroke = LIGHT_TEXT; }
          });
        });
      }

      // ---- audio pill: generate the bars and pulse them like a live waveform ----
      var audioBars = [];
      // named + re-runnable, not a one-shot IIFE: a host inside a display:none ancestor measures
      // as 0x0 and is skipped, which is exactly what the hidden desktop/mobile wrapper does to the
      // audio pill during a build. refresh() calls this again while nothing has been found.
      function buildAudio() {
        if (!AUDIO_BARS) { return; }
        var skipped = 0;
        Array.prototype.forEach.call(section.querySelectorAll(AUDIO_SEL), function (host) {
          var svg  = (host.tagName && host.tagName.toLowerCase() === 'svg') ? host : host.querySelector('svg');
          if (!svg) { return; }
          var src = svg.querySelector('path');
          if (!src) { return; }
          var bb;
          try { bb = src.getBBox(); } catch (e) { skipped++; return; }
          if (!bb || !bb.width || !bb.height) { skipped++; return; }
          var fill = window.getComputedStyle(src).fill;
          src.style.display = 'none';
          teardown.push(function () { src.style.display = ''; });

          var n  = AUDIO_BARS;
          var bw = bb.width / (n + (n - 1) * AUDIO_GAP_RATIO);
          var gap = bw * AUDIO_GAP_RATIO;
          var cy = bb.y + bb.height / 2;
          for (var i = 0; i < n; i++) {
            var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            r.setAttribute('x', String(bb.x + i * (bw + gap)));
            r.setAttribute('width', String(bw));
            r.setAttribute('rx', String(bw / 2));
            r.setAttribute('fill', fill && fill !== 'none' ? fill : 'currentColor');
            src.parentNode.insertBefore(r, src);
            (function (el) { teardown.push(function () { if (el.parentNode) { el.parentNode.removeChild(el); } }); }(r));
            audioBars.push({
              el: r, cy: cy, span: bb.height,
              ceil: AUDIO_MIN + (AUDIO_MAX - AUDIO_MIN) * (0.82 + 0.18 * Math.random()),
              f1: 0.8 + Math.random() * 1.5, f2: 2.0 + Math.random() * 3.0,
              ph1: Math.random() * 6.2832, ph2: Math.random() * 6.2832
            });
          }
        });
        if (DEBUG) {
          console.log('[stack] audio bars:', audioBars.length,
                      skipped ? '(' + skipped + ' host(s) not measurable yet)' : '');
        }
      }
      buildAudio();

      var envPh1 = Math.random() * 6.2832, envPh2 = Math.random() * 6.2832;
      var audioClock = 0, audioP = 0;
      function updateAudio(p) {
        if (!audioBars.length) { return; }
        var TWO_PI = Math.PI * 2;
        var t = p * AUDIO_CYCLES + audioClock * AUDIO_SPEED;
        var e = (0.5 + 0.5 * Math.sin(t * TWO_PI * 0.9 + envPh1)) *
                (0.5 + 0.5 * Math.sin(t * TWO_PI * 2.3 + envPh2));
        var n = audioBars.length;
        for (var i = 0; i < n; i++) {
          var b = audioBars[i];
          var v = 0.55 * Math.sin(t * TWO_PI * b.f1 + b.ph1) +
                  0.45 * Math.sin(t * TWO_PI * b.f2 + b.ph2);
          var sJag = (0.5 + 0.5 * v) * (AUDIO_ENV * e + (1 - AUDIO_ENV));
          var xi = n > 1 ? i / (n - 1) : 0.5;
          var wave = 0.6 * Math.sin((xi * AUDIO_WAVE_SPAN - t) * TWO_PI) +
                     0.4 * Math.sin((xi * AUDIO_WAVE_SPAN * 0.5 - t * 0.6) * TWO_PI + 1.7);
          var sWav = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));
          var s = AUDIO_WAVE * sWav + (1 - AUDIO_WAVE) * sJag;
          var h = (AUDIO_MIN + (b.ceil - AUDIO_MIN) * s) * b.span;
          b.el.setAttribute('height', String(h));
          b.el.setAttribute('y', String(b.cy - h / 2));
        }
      }
      if (AUDIO_SPEED) {
        var audioTicker = function () {
          audioClock += gsap.ticker.deltaRatio() / 60;
          updateAudio(audioP);
        };
        gsap.ticker.add(audioTicker);
        teardown.push(function () { gsap.ticker.remove(audioTicker); });
      }

      var cardLightOn = false;

      var assemblySteps = STEP_VH * stepCount;
      var totalVH = 0, pA = 0, pG = 0, pHold = 0, tabSpan = 1;
      var snapPoints = [];
      function computeTiming() {
        var contentVH = (isDesktop && window.innerHeight) ? (sCenter / window.innerHeight) : 0;
        var tabsVH    = isDesktop ? ((numTabs - 1) * TAB_STEP_VH + END_HOLD_VH) : 0;
        tabSpan = tabsVH / TAB_STEP_VH || 1;
        totalVH = assemblySteps + GREEN_HOLD_VH + contentVH + tabsVH;
        pA    = assemblySteps / totalVH;
        pG    = (assemblySteps + GREEN_HOLD_VH) / totalVH;
        pHold = (assemblySteps + GREEN_HOLD_VH + contentVH) / totalVH;
        snapPoints = [0].concat(popThresh, [gatherThresh]).map(function (v) { return v * pA; }).concat([pG, pHold, 1]);
      }
      computeTiming();

      // ---- exit: rows travel on y and fade, clearing the card. gated play/reverse, never scrubbed:
      // it owns y/opacity that gatherTl and the fan-out also write ----
      var exitRows = items.filter(function (it) { return !it.hasAttribute('data-stack-keep'); });
      var exitCloneRows = cardClone
        ? Array.prototype.slice.call(cardClone.querySelectorAll('[' + ATTR + '="item"], .meeting_item'))
        : [];
      var exitTl = gsap.timeline({ paused: true });
      var rowsAt = 0;
      var ch1ImgOut = isDesktop ? CH1_IMG_OUT : CH1_IMG_OUT_MOB;
      if (ch1ImgOut && pops.length) {
        exitTl.to(pops, {
          y: CH1_IMG_Y, scale: CH1_IMG_SCALE, opacity: 0,
          duration: CH1_IMG_DUR, ease: CH1_IMG_EASE, stagger: CH1_IMG_STAGGER
        }, 0);
        rowsAt = CH1_IMG_DUR * 0.5;
      }
      [exitRows, exitCloneRows].forEach(function (rows) {
        if (!rows.length) { return; }
        exitTl.to(rows, {
          y: CH1_ROW_Y,
          duration: CH1_ROW_DUR, ease: CH1_ROW_EASE, stagger: CH1_ROW_STAGGER
        }, rowsAt);
        exitTl.to(rows, {
          opacity: 0,
          duration: CH1_ROW_DUR * CH1_ROW_FADE, ease: 'power1.in', stagger: CH1_ROW_STAGGER
        }, rowsAt);
      });
      var leftovers = pops.concat(Array.prototype.slice.call(sel(card, 'foot')));
      if (head) { leftovers.push(head); }
      leftovers = leftovers.concat(headIcons);
      var leftoverTl = gsap.timeline({ paused: true });
      if (CH2_OUT && leftovers.length) {
        leftoverTl.to(leftovers, {
          opacity: 0, duration: CH2_OUT_DUR, ease: CH2_OUT_EASE, stagger: CH2_OUT_STAGGER
        });
      }
      var leftoverOut = false;
      function ch2Leftovers(n) {
        if (!leftoverTl) { return; }
        var want = CH2_OUT && n >= 1;
        if (want === leftoverOut) { return; }
        leftoverOut = want;
        if (want) { leftoverTl.play(); } else { leftoverTl.reverse(); }
      }

      // hand the card's paint to the plate at pHold, where the two are coincident. instant on
      // purpose: crossfading two identical opaque layers dips to ~75% and shows the page through.
      function setPlateEdge(col) {
        if (!plate) { return; }
        for (var i = 0; i < plateEdgeSides.length; i++) {
          plate.style['border' + plateEdgeSides[i] + 'Color'] = col;
        }
        if (LIGHT_REVEAL) { plate.style.boxShadow = '0 0 0 ' + LIGHT_RING + 'px ' + col; }
      }

      var cardSwapped = false;
      function cardSwap(p) {
        if (!CARD_OUT) { return; }
        if (!isDesktop && MOBILE_KEEP_CARD) { return; }
        var want = (p >= pHold);
        if (want === cardSwapped) { return; }
        cardSwapped = want;
        // rows have no business in the chapter phase: hard-hide them on visibility, which the exit
        // timeline doesn't animate, so its state stays intact and reversible
        var vis = want ? 'hidden' : '';
        for (var r = 0; r < exitRows.length; r++)      { exitRows[r].style.visibility = vis; }
        for (var c = 0; c < exitCloneRows.length; c++) { exitCloneRows[c].style.visibility = vis; }
        if (plate) {
          gsap.set(plate, { opacity: want ? 1 : 0 });
          // the ring and the copied border only ever existed to hide the dark card edge
          // against the green panel behind it. past pHold that panel has gone and the plate
          // sits on the page itself, so the edge has nothing left to mask and just reads as
          // a hairline outline on the chapter cards. reversible: scrubbing back restores it.
          setPlateEdge(want ? PLATE_EDGE_AFTER : plateEdge);
        }
        if (cardClone) { gsap.set(cardClone, { opacity: want ? 0 : 1 }); }
        if (want) {
          gsap.set(card, { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', boxShadow: 'none' });
        } else {
          gsap.set(card, { backgroundColor: origBg, borderColor: origBorder, boxShadow: origShadow });
          cardLightOn = false;
        }
      }

      var exitPlayed = false;
      function ch1Exit(p) {
        if (!isDesktop && MOBILE_KEEP_CARD) { return; }
        var at   = pG + (pHold - pG) * CH1_AT;
        var want = p >= at;
        if (want === exitPlayed) { return; }
        exitPlayed = want;
        // settle the gather first: released at GATHER_LOCK it can still be playing/reversing, and its
        // tail writes the same x/y/opacity, which would undo the exit a frame or two later
        gatherTl.pause().progress(1);
        gatherOn = true;
        if (want) { exitTl.play(); } else { exitTl.reverse(); }
      }

      function applyScroll(p) {
        var ap = pA > 0 ? Math.min(1, p / pA) : 1;
        update(ap);

        if (!gatherOn && gatherTl.progress() === 0) {
          var t    = spreadT(ap);
          var pull = (1 - FIST) * (1 - t);
          for (var si = 0; si < items.length; si++) {
            gsap.set(items[si], {
              x: geo[si].dx - out[si].ox * pull,
              y: geo[si].dy - out[si].oy * pull
            });
          }
        }

        if (isDesktop) {
          var S;
          if (p <= pG)         { S = 0; }
          else if (p >= pHold) { S = sCenter; }
          else                 { S = (pHold > pG) ? ((p - pG) / (pHold - pG)) * sCenter : sCenter; }
          for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }
          var lp = (p <= pG) ? 0 : (p >= pHold ? 1 : ((pHold > pG) ? (p - pG) / (pHold - pG) : 1));
          gsap.set(card, {
            x: landDX * lp,
            y: (S - Math.min(cardRiseDist, Math.max(0, S - sCardStart))) + landDY * lp + CARD_DROP_PX * (1 - lp)
          });
        }
        popParallax(p);
        ch1Exit(p);
        cardSwap(p);
        audioP = p;
        updateAudio(p);

        if (canLeave && topCover) {
          var gr = greenPanel.getBoundingClientRect();
          topCover.style.display = (gr.top <= 1 && gr.bottom > 3) ? 'block' : 'none';
        }

        if (cardClone && st && st.isActive && !(CARD_OUT && cardSwapped)) {
          var cr = card.getBoundingClientRect();
          var B  = canLeave ? greenPanel.getBoundingClientRect().bottom : -1e9;
          var topClip = Math.max(0, Math.min(cr.height, B - cr.top));
          if (p >= pHold) { topClip = 0; }
          if (topClip >= cr.height - 0.5) {
            cardClone.style.display = 'none';
          } else {
            cardClone.style.display  = '';
            // negative insets on the other three sides: inset() clips at the border box and would
            // cut off the outer ring (a box-shadow lives outside it). only the top is a real cut.
            cardClone.style.clipPath = 'inset(' + topClip + 'px ' + (-LIGHT_RING - 2) + 'px ' +
              (-LIGHT_RING - 2) + 'px ' + (-LIGHT_RING - 2) + 'px)';
          }
          var wantLight = (p >= pHold);
          if (wantLight && !cardLightOn) {
            gsap.set(card, { backgroundColor: LIGHT_CARD_BG, borderColor: LIGHT_CARD_BG, boxShadow: 'none' });
            cardLightOn = true;
          } else if (!wantLight && cardLightOn) {
            gsap.set(card, { backgroundColor: origBg, borderColor: origBorder, boxShadow: origShadow });
            cardLightOn = false;
          }
        }

        if (isDesktop) {
          var tn = -1;
          if (p > pHold && pHold < 1) {
            tn = Math.floor((p - pHold) / (1 - pHold) * tabSpan);
            if (tn < 0) { tn = 0; } else if (tn > numTabs - 1) { tn = numTabs - 1; }
          } else if (p >= pG + (pHold - pG) * TABS_PLAY_AT) {
            tn = 0;
          }
          setActiveTab(tn);
          bgTargetP = (p > pHold && pHold < 1) ? (p - pHold) / (1 - pHold) : 0;
        }
      }

      // ---- pre-roll: the first batch pops before the pin ----
      // a separate, UNPINNED trigger. it cannot be folded into the pinned one: that trigger starts
      // at 'top top', so its progress does not exist until the section is already pinned.
      if (preOwned) {
        var preTl = popTls[0];
        ScrollTrigger.create({
          trigger: section,
          start: PRE_POP_START,
          end: 'top top',
          onEnter: function () {
            if (popPlayed[0]) { return; }
            popPlayed[0] = true; preTl.play(); playDetect(0);
          },
          onLeaveBack: function () {
            if (!popPlayed[0]) { return; }
            popPlayed[0] = false; preTl.reverse(); resetDetect(0);
          }
        });
      }

      var st = ScrollTrigger.create({
        trigger: section, start: 'top top',
        end: function () { return '+=' + (window.innerHeight * totalVH); },
        pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        refreshPriority: 1,
        onRefresh: function (self) { prevStart = self.start; prevEnd = self.end; },
        onRefreshInit: refresh,
        onUpdate: function (self) {
          var p = self.progress;
          // scroll locks: hold at pG while the gather plays in, and just below the gather boundary
          // while it reverses. released at GATHER_LOCK, so the ride down overlaps the last rows
          var gThreshP = gatherThresh * pA;
          if (p > pG && gatherOn && gatherTl.progress() < GATHER_LOCK) {
            self.scroll(self.start + pG * (self.end - self.start));
            p = pG;
          }
          else if (p < gThreshP && !gatherOn && gatherTl.progress() > 1 - GATHER_LOCK) {
            var holdP = Math.max(0, gThreshP - 0.0005);
            self.scroll(self.start + holdP * (self.end - self.start));
            p = holdP;
          }
          applyScroll(p);
        },
        onLeave:     function () { if (topCover) { topCover.style.display = 'none'; } },
        onLeaveBack: function () { if (cardClone) { cardClone.style.display = 'none'; } if (topCover) { topCover.style.display = 'none'; } },
        snap: SNAP ? { snapTo: snapPoints, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false } : false
      });

      function logChoreo(tag) {
        if (!DEBUG) { return; }
        console.log('[stack] choreography(' + tag + ') mode=' + (isDesktop ? 'desktop' : 'mobile') +
          ' rebuild=' + isRebuild + ' tabsWrap=' + !!tabsWrap + ' numTabs=' + numTabs +
          ' totalVH=' + totalVH.toFixed(2) + ' secH=' + section.style.height +
          ' pinLen=' + Math.round(st.end - st.start) +
          ' docHeight=' + Math.round(document.documentElement.scrollHeight) +
          ' scrollY=' + Math.round(window.scrollY) + ' innerH=' + window.innerHeight);
      }
      logChoreo('build');

      if (isRebuild && typeof window.requestAnimationFrame === 'function') {
        var buildAlive = true;
        teardown.push(function () { buildAlive = false; });
        window.requestAnimationFrame(function () {
          if (!buildAlive) { return; }
          window.requestAnimationFrame(function () {
            if (!buildAlive) { return; }
            ScrollTrigger.refresh();
            if (anchorY != null && anchorStart != null && anchorEnd != null) {
              var target;
              if (anchorY <= anchorStart)    { target = anchorY; }
              else if (anchorY <= anchorEnd) { target = st.start; }
              else                           { target = anchorY + (st.end - anchorEnd); }
              window.scrollTo(0, Math.max(0, Math.round(target)));
              anchorY = anchorStart = anchorEnd = null;
            }
            logChoreo('post-refresh');
          });
        });
      }

      var bgTicker = function () {
        try {
          var diff = bgTargetP - bgCurrentP;
          if (Math.abs(diff) < 0.0005) { return; }
          var dt = gsap.ticker.deltaRatio();
          bgCurrentP += diff * (1 - Math.pow(1 - BG_SMOOTH, dt));
          drawBg(bgCurrentP);
        } catch (e) {  }
      };
      // no point running a per-frame painter that returns immediately
      if (!BG_DRAW_ON_TAB) {
        gsap.ticker.add(bgTicker);
        teardown.push(function () { gsap.ticker.remove(bgTicker); });
      }

      tabItems.forEach(function (item, i) {
        guardStyle(item);
        item.style.cursor = 'pointer';
        var onClick = function () {
          var last = numTabs - 1;
          var centerProg = (i < last) ? (i + 0.5) / tabSpan : ((last / tabSpan) + 1) / 2;
          var centreP = pHold + centerProg * (1 - pHold);
          var N = bgSvgs.length || 1;
          bgCurrentP = Math.min(N - 1, Math.floor(centerProg * N)) / N;
          window.scrollTo({ top: st.start + centreP * (st.end - st.start), behavior: 'auto' });
        };
        item.addEventListener('click', onClick);
        teardown.push(function () { item.removeEventListener('click', onClick); });
      });

      return function cleanup() {
        for (var i = teardown.length - 1; i >= 0; i--) {
          try { teardown[i](); } catch (e) {  }
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
