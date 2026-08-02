(function () {

  // ---- corners: scroll-scrubbed corner radius ----
  // tag an element with data-corners (optional value = max px, default 80): corners round
  // while it floats in the viewport, square off flush with an edge. per-edge, driven by the
  // element's current position (fast scroll can't desync) + a small lerp so it never pops.

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
    if (DEBUG) { console.log('[corners] init (gsap=' + !!window.gsap + ')'); }
    scan();
    if (window.gsap) {
      // register ST first so its pin correction runs before our rect reads each frame
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
  var STEP_VH       = 0.7;
  var SNAP          = false;   // magnetic scroll-to-nearest-step
  var SNAP_DUR      = 0.3;

  var POP_BATCH     = 1;       // one bubble at a time - reads as a conversation, not a burst
  var POP_STAGGER   = 0.05;
  var POP_DUR       = 0.34;
  var POP_BUNCH     = 0.55;    // <1 pulls pops earlier & tighter
  var POP_LEAD      = 0.06;    // scroll lead so the first batch animates in (not pre-popped)
  var POP_SCALE_X   = 0.35;
  var POP_SCALE_Y   = 0.85;
  var POP_EASE      = 'back.out(2)';
  var FIST          = 1;       // fan-out tightness: 1 = pop in place at the authored scatter spot,
                               // lower = start bunched toward the centre and spread out on scroll

  // "detected" words: in Webflow, select the word inside a bubble's text and give it the class
  // below (spans there can't carry attributes). when that bubble pops in the word takes the
  // gradient and runs the single-hump letter wave (the wisprflow button motion, same as
  // notetaker.js / flow-stack.js), then settles back to its own colour.
  var DETECT_SEL       = '.meeting_item_animate';
  var DETECT_GRAD      = 'linear-gradient(100deg,#F0D7FF 0%,#FFA946 23%,#FF6C4C 39%,#FFBCF2 67%,#7232A6 91%)';
  var DETECT_AT        = 0.22;  // seconds after the bubble starts popping
  var DETECT_FADE      = 350;   // ms: own colour -> gradient
  var DETECT_HOLD      = 1100;  // ms the gradient sits before releasing
  var DETECT_BACK      = 600;   // ms: gradient -> own colour
  var DETECT_Y_PCT     = 20;    // crest height as a % of letter height
  var DETECT_ROT       = 5;     // deg at the crest
  var DETECT_STAGGER   = 45;    // ms per letter (wave speed)
  var DETECT_LETTER_MS = 500;   // per-letter up-and-back

  // audio pill: the bars in [data-anim="audio"] pulse like a live waveform. the authored icon is a
  // SINGLE path holding all the bars as subpaths, so it can't be animated per-bar - the script hides
  // it and generates <rect> bars across its bounding box instead. same motion model as flow-stack.js.
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

  var GATHER_STAGGER = 0.09;
  var GATHER_DUR     = 0.7;
  var GATHER_EASE    = 'power3.inOut';
  var CARD_FADE      = 0.4;
  var LANDED_BG      = '';                      // '' = read LANDED_BG_VAR
  var LANDED_BG_VAR  = '--base-color--fathom';  // row bg once gathered
  var STACK_ITEM_RADIUS = '12px';   // every row's corners once stacked (scattered = authored). '' = off

  // images that pop in around the card once the rows have stacked. authored at their FINAL spots
  // in Webflow; JS only animates them in (and reverses on scroll-back). per-element overrides:
  // data-pop-x / data-pop-y / data-pop-rot / data-pop-scale, order via data-stack-order.
  var POP_IMG_AT      = 0.45;  // seconds into the gather timeline before the first image fires
  var POP_IMG_STAGGER = 0.12;
  var POP_IMG_DUR     = 0.5;
  var POP_IMG_EASE    = 'back.out(2)';
  var POP_IMG_SCALE   = 0.6;   // scale it grows from
  var POP_IMG_Y       = 24;    // px it rises from
  var POP_IMG_X       = 0;
  var POP_IMG_ROT     = -6;    // deg it rotates in from (alternates sign per image)
  var POP_IMG_Z       = 995;   // above the rows AND the light clone (LIGHT_Z 990), below the nav (999)
  // parallax: images drift AGAINST the scroll once they've popped in. px of drift per full unit of
  // pin progress (so ~POP_PAR_DIST × the progress left after the gather). per-image: data-pop-depth.
  var POP_PAR_DIST    = 65;
  var POP_PAR_DEPTH   = [1, 0.6, 1.35];   // cycles over the images; overridden by data-pop-depth
  var POP_PAR_SMOOTH  = 0.1;   // per-frame ease toward the scroll position; lower = more drag

  // exit as the card lands on the tabs. all of it is scrubbed over the tail of the card's travel,
  // and only inside that window - outside it the rows belong to the gather. tag a row
  // data-stack-keep to leave it in place.
  // TRIGGERED, not scrubbed: it fires once the card is CH1_AT of the way down to the tabs and then
  // plays on its own clock, so it finishes before the card lands. reverses on scroll-back.
  var CH1_AT          = 0.45;  // point in the pG->pHold travel that fires it (0 = at pG, 1 = landing)
  var CH1_ROW_Y       = -120;  // px each row travels; negative = up, positive = down
  var CH1_ROW_DUR     = 0.45;  // seconds per row
  var CH1_ROW_STAGGER = 0.06;  // seconds between rows (top row leaves first)
  var CH1_ROW_EASE    = 'power2.in';
  var CH1_ROW_FADE    = 0.55;  // fade duration as a fraction of the travel. <1 = gone before it
                               // clears the card's top edge, which is what stops rows bleeding out
  var CH1_IMG_OUT     = false; // false = the pop images stay in view through chapter 1
  var CH1_IMG_DUR     = 0.4;
  var CH1_IMG_STAGGER = 0.06;
  var CH1_IMG_Y       = -30;   // px the images drift as they go
  var CH1_IMG_SCALE   = 0.55;  // scale they shrink to
  var CH1_IMG_EASE    = 'back.in(1.6)';

  // the travelling card dissolves at the end of the exit, handing the tabs stage over to the
  // chapter embeds. the card sits in the green panel (z 900) and the tabs at z 1, so it covers
  // the stage until it goes. the pop images are NOT faded - they stay for chapter 1.
  var CARD_OUT      = true;
  // the swap is instant and happens at pHold, where the card and the plate are coincident, so it
  // needs no duration, ease or offset - see cardSwap().

  // what survived chapter 1 (pop images, foot pill, card head) clears when chapter 2 arrives
  var CH2_OUT         = true;
  var CH2_OUT_DUR     = 0.45;
  var CH2_OUT_STAGGER = 0.05;
  var CH2_OUT_EASE    = 'power2.out';

  // size the tab-panel stage to the travelling card's box on every refresh, so a chapter reads as
  // the same card rather than a differently-shaped one. false = size it yourself in Webflow.
  var STAGE_MATCH_CARD = true;
  // clip each chapter panel to that box, with the card's own corner radius
  var PANEL_CLIP       = true;
  // stretch whatever is inside a panel (bg wrapper, shader, embed) to that box instead of letting
  // it size to its own content
  var PANEL_FILL       = true;

  // a plate that sits UNDER every chapter panel and never fades. the panels crossfade against each
  // other, so without it you see straight through to the page for a few frames on every tab change
  // - which reads as a glitch. it takes over from the travelling card's own background, same box
  // and same colour, so the handoff is invisible.
  var CHAPTER_PLATE = true;
  var PLATE_BG      = '';     // '' = use LIGHT_CARD_BG

  // per-chapter background photos: tag an <img> data-chapter-bg="<tab index>" anywhere in the
  // section. they're moved onto the plate and swapped as the active tab changes.
  var CHAPTER_BG    = 'data-chapter-bg';
  var BG_FADE_MS    = 700;    // duration of the melt swap between chapter photos
  // melt: a self-contained WebGL displacement crossfade (codrops technique, no three.js), the same
  // one flow-stack.js uses. texture-clamped so there are no edge gaps; falls back to a plain
  // crossfade if WebGL or the texture upload (CORS) isn't available.
  var MELT_INTENSITY = 0.35;  // displacement strength as a fraction of the image. 0 = plain crossfade
  var MELT_NOISE     = 3.0;   // cloud scale of the displacement noise (higher = smaller, busier)
  // walk the travelling card onto the chapter stage as it lands, instead of stopping at viewport
  // centre. needed once anything on the card (pill, pop images) survives into chapter 1.
  var CARD_LANDS_ON_STAGE = true;

  // the tab panel's own animation is shot in once the card has landed. -1 until then, so panel 0
  // isn't sitting there playing through the whole ride down.
  var TABS_PLAY_AT    = 1.0;   // point in pG->pHold at which tab 0 activates (1 = at the landing)

  var HOLD_STEPS    = 0;

  // pin sequence: assemble -> green hold -> content scroll (card rises to centre) -> sticky tabs
  var CARD_TARGET    = 0.5;    // viewport fraction the card centres on
  var GREEN_HOLD_VH  = 0.25;
  var TAB_STEP_VH    = 1.0;    // scroll length per tab while sticky
  var END_HOLD_VH    = 0.35;   // short hold on the last tab before release
  var BG_SMOOTH      = 0.12;   // ease of the bg-line paint toward scroll

  var GREEN_RADIUS   = '80px'; // max corner radius; auto-tags the green panel for corners.js. '' = off

  // dark/light split reveal (desktop only)
  var LIGHT_REVEAL   = true;
  var LIGHT_CARD_BG  = '#E4E4D0';
  var LIGHT_ROW_BG   = '#FFFDF9';
  var LIGHT_Z        = 990;    // above section content, below the nav (999)
  var LIGHT_TEXT     = '#1A1A1A';
  var LIGHT_RING     = 2;      // px of outer ring that hides the dark card edge against the cream
  // per-speaker name tag in the LIGHT phase, keyed by the Webflow component variant on the tag
  // (read from whatever data-wf--…--variant attribute it carries, or a w-variant class).
  // value = text colour string, or { color: '#..', bg: '#..' }. {} = leave the tag alone.
  var NAME_TAG_SEL   = '.meeting_name-tag';
  var NAME_TAG_LIGHT = {
    dawn: '#7232A6'
    // add more variants as needed: pulse / glow / fathom / dusk …
  };

  var ATTR  = 'data-stack';
  var ORDER = 'data-stack-order';

  // wrappers that swap by breakpoint (mark in Webflow, class-agnostic):
  //   data-stack="desktop" = tabs wrapper, data-stack="mobile" = stacked-cards wrapper
  var DESKTOP_SEL = '[' + ATTR + '="desktop"]';
  var MOBILE_SEL  = '[' + ATTR + '="mobile"]';
  var TABS_SEL    = '.meeting_tabs_contain';   // tabs grid; falls back to the desktop wrapper
  var DESKTOP_DISPLAY = 'block';   // forced only if a stylesheet rule still hides the shown wrapper
  var MOBILE_DISPLAY  = 'block';

  // narrow the tabs copy below this width so it can't collide with the fixed-width card
  var COPY_SEL       = '.tab_copy';
  var COPY_NARROW_BP = 1180;
  var COPY_NARROW_MAXW = '30ch';

  var DEBUG = false;   // logs the mode swap + choreography measurements to the console

  // ---- helpers ----
  function sel(root, name) { return root.querySelectorAll('[' + ATTR + '="' + name + '"]'); }
  function one(root, name) { return root.querySelector('[' + ATTR + '="' + name + '"]'); }
  function smooth(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // injected once: hide the off-mode block per data-stack-mode, narrow the tabs copy, and the
    // tab-panel hide/reveal transitions. the panel rules live HERE (not in a Webflow embed) so
    // the Designer — where no script runs — shows the panels for editing.
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
        // play gate for the CSS-loop embeds. "off" REMOVES the animations rather than pausing them,
        // so every activation starts the loop at 0% - a paused animation would resume mid-cycle.
        // keyed off the panel, so it works whatever the embed calls its own root.
        '[data-tab-anim][data-play="off"] *,' +
        '[data-tab-anim][data-play="off"] *::before,' +
        '[data-tab-anim][data-play="off"] *::after{animation:none !important;}';
      document.head.appendChild(ms);
    }

    // anchor scroll restoration across a breakpoint cross: registered BEFORE gsap.matchMedia so it
    // captures the scroll + pin bounds ahead of the revert. only the stack pin's length differs.
    var prevStart = null, prevEnd = null;
    var anchorY = null, anchorStart = null, anchorEnd = null;
    var bpMQ = window.matchMedia('(min-width: 992px)');
    function captureAnchor() {
      anchorY = window.pageYOffset || window.scrollY || 0;
      anchorStart = prevStart; anchorEnd = prevEnd;
    }
    if (bpMQ.addEventListener) { bpMQ.addEventListener('change', captureAnchor); }
    else if (bpMQ.addListener) { bpMQ.addListener(captureAnchor); }

    // desktop (>=992) = full choreography; mobile (<=991) = assembly only. rebuilt on each cross;
    // matchMedia auto-reverts the ScrollTrigger + gsap.sets, teardown[] undoes the rest.
    var builtOnce = false;   // false only for the initial build
    var mm = gsap.matchMedia();
    mm.add({ isDesktop: '(min-width: 992px)', isMobile: '(max-width: 991px)' }, function (ctx) {
      var isDesktop = ctx.conditions.isDesktop;
      var isRebuild = builtOnce; builtOnce = true;

      var teardown = [];
      // snapshot + restore an element's inline style attribute (undoes every manual .style write)
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

      guardStyle(section);
      if (window.getComputedStyle(section).position === 'static') {
        section.style.position = 'relative';
      }

      // desktop: clip the section to one viewport. calc(100vh) (not a px snapshot) so ST's cached
      // pin height can't go stale on a height resize. mobile keeps natural height for the stack below.
      if (isDesktop) {
        section.style.height   = 'calc(100vh + 2px)';
        section.style.overflow = 'hidden';
      }

      // FLIP: record each item's scattered spot as a fraction of its frame, before touching the DOM
      var scatterCtx = items[0].parentNode;
      var mi0 = scatterCtx.getBoundingClientRect();
      var frac = items.map(function (it) {
        var r = it.getBoundingClientRect();
        return {
          fx: mi0.width  ? (r.left - mi0.left) / mi0.width  : 0,
          fy: mi0.height ? (r.top  - mi0.top)  / mi0.height : 0
        };
      });

      items.forEach(function (it) { guardStyle(it); });   // snapshot pristine style before any gsap.set
      gsap.set(items, { opacity: 0 });

      // reparent tasks into the card as flex children; a comment placeholder marks the original spot
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
        it.style.width      = '';
        it.style.boxSizing  = 'border-box';
        it.style.whiteSpace = 'nowrap';
        it.style.willChange = 'transform, opacity';
      });

      // the append above lands every task at the end of the card, so authored DOM order can't put
      // anything below them. tag an element data-stack="foot" (e.g. the voice pill) to be moved
      // after the tasks. runs before the light clone is taken, so the clone inherits the order.
      Array.prototype.forEach.call(sel(card, 'foot'), function (el) {
        var fph = document.createComment('stack-foot');
        el.parentNode.insertBefore(fph, el);
        teardown.push(function () {
          if (fph.parentNode) { fph.parentNode.insertBefore(el, fph); fph.parentNode.removeChild(fph); }
        });
        card.appendChild(el);
      });

      var checks = items.map(function (it) { return it.querySelector('[' + ATTR + '="check"], .meeting_check'); });

      // card-head icons (not inside a row): hidden up front, faded in with the head on gather
      var headIcons = card
        ? Array.prototype.slice.call(card.querySelectorAll('[' + ATTR + '="icon"]'))
            .filter(function (ic) { return !items.some(function (it) { return it.contains(ic); }); })
        : [];

      // capture the card's painted look, then make its face transparent (fades in during gather)
      var ccs        = window.getComputedStyle(card);
      var origBg     = ccs.backgroundColor;
      var origBorder = ccs.borderColor;
      var origShadow = ccs.boxShadow;
      guardStyle(card);
      card.style.boxSizing  = 'border-box';
      card.style.willChange = 'transform';

      var geo = items.map(function () { return { dx: 0, dy: 0 }; });
      var out = items.map(function () { return { ox: 0, oy: 0 }; });   // scatter-spot -> centroid vector

      // scatter deltas: read natural rects (transforms cleared), invert against the scatter fractions
      function measureGeo() {
        gsap.set(items, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
        gsap.set(card,  { x: 0, y: 0 });   // x too: the stage-landing correction also lives on it
        var mi  = scatterCtx.getBoundingClientRect();
        var nat = items.map(function (it) { return it.getBoundingClientRect(); });
        var spot = [], cx = 0, cy = 0, s;
        for (s = 0; s < items.length; s++) {
          geo[s].dx = (mi.left + frac[s].fx * mi.width)  - nat[s].left;
          geo[s].dy = (mi.top  + frac[s].fy * mi.height) - nat[s].top;
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

      // initial scattered + hidden state
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

      // pop timelines (batches): reveal in place at the scatter spot
      var batchCount = Math.ceil(items.length / POP_BATCH);
      var popTls = [];
      var b;
      for (b = 0; b < batchCount; b++) {
        (function (batch) {
          var members     = items.filter(function (it, i) { return Math.floor(i / POP_BATCH) === batch; });
          var memberIdx   = items.map(function (it, i) { return i; }).filter(function (i) { return Math.floor(i / POP_BATCH) === batch; });
          var batchChecks = memberIdx.map(function (i) { return checks[i]; }).filter(Boolean);

          var tl = gsap.timeline({ paused: true });
          tl.to(members, { opacity: 1, scaleX: 1, scaleY: 1, duration: POP_DUR, ease: POP_EASE, stagger: POP_STAGGER }, 0);
          if (batchChecks.length) {
            tl.to(batchChecks, { scale: 1, opacity: 1, duration: CHECK_DUR, ease: CHECK_EASE, stagger: POP_STAGGER }, CHECK_DELAY);
          }
          popTls.push(tl);
        }(b));
      }

      // ---- detected words ----
      // the gradient lives on each LETTER, not on the word: background-clip:text fights transforms
      // on the same element in Blink/WebKit (same trap flow-stack.js hit at its raw-out wipe). each
      // letter's background is sized to the whole word and offset by that letter's position, so it
      // reads as one continuous gradient while every span still owns its own clip and can move.
      var detectByBatch = [];
      for (b = 0; b < batchCount; b++) {
        detectByBatch.push(items.filter(function (it, i) { return Math.floor(i / POP_BATCH) === b; })
          .reduce(function (acc, it) {
            return acc.concat(Array.prototype.slice.call(it.querySelectorAll(DETECT_SEL)));
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
          s.style.whiteSpace = 'pre';        // keep spaces inside the phrase
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
          s.style.transition = 'color ' + (on ? DETECT_FADE : DETECT_BACK) + 'ms ease';
          s.style.color = on ? 'transparent' : (el._color || '');
        }
      }

      // one hump: up to a crest and back, staggered left to right. yPercent = relative to letter height
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
        (detectByBatch[batch] || []).forEach(function (el) {
          detectCalls.push(gsap.delayedCall(DETECT_AT, function () {
            paintDetect(el, true);
            rippleWord(el);
            detectCalls.push(gsap.delayedCall((DETECT_FADE + DETECT_HOLD) / 1000, function () {
              paintDetect(el, false);
            }));
          }));
        });
      }

      function resetDetect(batch) {
        // kill everything pending, not just this batch's: a scheduled call would otherwise fire
        // onto a bubble that has already reversed back out
        for (var i = 0; i < detectCalls.length; i++) { detectCalls[i].kill(); }
        detectCalls.length = 0;
        (detectByBatch[batch] || []).forEach(function (el) {
          if (el._letters) { paintDetect(el, false); }
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
        window.stackDetect = function (batch) { playDetect(batch || 0); };   // fire one by hand
      }

      var landedBg = LANDED_BG ||
        window.getComputedStyle(card).getPropertyValue(LANDED_BG_VAR).trim() ||
        window.getComputedStyle(document.documentElement).getPropertyValue(LANDED_BG_VAR).trim();

      // gather timeline: card face fades in, items fall into their real slots
      var gatherTl = gsap.timeline({ paused: true });
      gatherTl.to(card, { backgroundColor: origBg, borderColor: origBorder, duration: CARD_FADE, ease: 'power2.out' }, 0);
      if (head) { gatherTl.to(head, { opacity: 1, duration: CARD_FADE, ease: 'power2.out' }, 0); }
      if (headIcons.length) { gatherTl.to(headIcons, { opacity: 1, duration: CARD_FADE, ease: 'power2.out' }, 0); }
      items.forEach(function (it, slot) {
        var tween = {
          x: 0, y: 0, duration: GATHER_DUR, ease: GATHER_EASE,
          onStart: function () { it.style.zIndex = 100 + slot; }
        };
        if (landedBg) { tween.backgroundColor = landedBg; }
        if (STACK_ITEM_RADIUS) {                       // scattered bubbles carry mixed corners
          tween.borderTopLeftRadius = tween.borderTopRightRadius =
          tween.borderBottomLeftRadius = tween.borderBottomRightRadius = STACK_ITEM_RADIUS;
        }
        gatherTl.to(it, tween, CARD_FADE * 0.5 + slot * GATHER_STAGGER);
      });

      // pop-in images: ride the same timeline as the gather, so they're fully scrubbed
      var pops = Array.prototype.slice.call(sel(section, 'pop')).sort(function (a, b) {
        var ao = parseFloat(a.getAttribute(ORDER)); if (isNaN(ao)) { ao = Infinity; }
        var bo = parseFloat(b.getAttribute(ORDER)); if (isNaN(bo)) { bo = Infinity; }
        return ao - bo;
      });
      // parallax rides the INNER element, so it never fights the entrance tween on the wrapper
      var popPar = [];
      pops.forEach(function (el, i) {
        guardStyle(el);
        // always on top: the rows sit at 100+, the light clone at LIGHT_Z (990)
        if (window.getComputedStyle(el).position === 'static') { el.style.position = 'relative'; }
        el.style.zIndex = String(POP_IMG_Z);
        function num(attr, dflt) { var v = parseFloat(el.getAttribute(attr)); return isNaN(v) ? dflt : v; }
        var inner = el.querySelector('img') || el.firstElementChild;
        if (inner) {
          guardStyle(inner);
          inner.style.willChange = 'transform';
          popPar.push({ el: inner, depth: num('data-pop-depth', POP_PAR_DEPTH[i % POP_PAR_DEPTH.length]) });
        }
        var fromRot = num('data-pop-rot', POP_IMG_ROT * (i % 2 ? -1 : 1));   // alternate the tilt
        gsap.set(el, {
          opacity: 0, transformOrigin: '50% 50%',
          scale: num('data-pop-scale', POP_IMG_SCALE),
          x: num('data-pop-x', POP_IMG_X), y: num('data-pop-y', POP_IMG_Y), rotation: fromRot
        });
        gatherTl.to(el, { opacity: 1, scale: 1, x: 0, y: 0, rotation: 0, duration: POP_IMG_DUR, ease: POP_IMG_EASE },
          POP_IMG_AT + i * POP_IMG_STAGGER);
      });
      // drift opposite the scroll, measured from the moment they pop in (0 offset there). the scroll
      // position only sets a TARGET; a ticker eases toward it so the float drags instead of snapping.
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
      // they must live INSIDE the card to ride its travel transform — warn instead of silently
      // leaving them behind up in the stage
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

      function spreadT(ap) {   // fan-out growth: 0 at start of pops -> full as gather begins
        if (gatherThresh <= 0) { return 0; }
        return smooth(ap / gatherThresh);
      }

      // play/reverse the pop batches + gather as triggered, time-based timelines
      function update(p) {
        var i;
        for (i = 0; i < popTls.length; i++) {
          if (p >= popThresh[i] && !popPlayed[i])      { popTls[i].play();    popPlayed[i] = true;  playDetect(i); }
          else if (p < popThresh[i] && popPlayed[i])   { popTls[i].reverse(); popPlayed[i] = false; resetDetect(i); }
        }
        if (p >= gatherThresh && !gatherOn)            { gatherTl.play();    gatherOn = true;  }
        else if (p < gatherThresh && gatherOn)         { gatherTl.reverse(); gatherOn = false; }
      }

      // re-measure on refresh/resize; then re-assert the visual state for the current scroll
      function refresh() {
        if (isDesktop) { section.style.height = 'calc(100vh + 2px)'; }
        else if (canLeave) { greenPanel.style.height = window.innerHeight + 'px'; }
        if (cardClone) { cardClone.style.display = 'none'; }
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        measureGeo();
        measurePositions();
        computeTiming();
        if (!gatherOn) {
          items.forEach(function (it, i) {
            var played = popPlayed[Math.floor(i / POP_BATCH)];
            gsap.set(it, {
              x: geo[i].dx, y: geo[i].dy,
              scaleX: played ? 1 : POP_SCALE_X,
              scaleY: played ? 1 : POP_SCALE_Y,
              opacity: played ? 1 : 0
            });
          });
          gatherTl.invalidate();
        } else {
          gsap.set(items, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 });
        }
        // the reset above returns the rows to their gathered state, which would undo an exit that
        // has already played (ch1Exit only fires on a threshold crossing, so it won't re-apply it).
        // invalidate so the tweens re-record from the fresh geometry, then jump back to the end.
        if (exitTl && exitPlayed) { exitTl.invalidate().progress(1); }
        applyScroll(st ? st.progress : 0);
        if (activeTab >= 0) { moveIndicator(activeTab); }
      }

      // green panel = element carrying the green bg + rounded corners (data-stack="green", else walk up)
      var greenPanel = one(section, 'green');
      if (!greenPanel) {
        greenPanel = card;
        while (greenPanel.parentNode && greenPanel.parentNode !== section) { greenPanel = greenPanel.parentNode; }
      }
      var canLeave = greenPanel !== card;
      guardStyle(greenPanel);
      // rounding handled by the corners module; just tag the panel
      if (canLeave && GREEN_RADIUS && !greenPanel.hasAttribute('data-corners')) {
        greenPanel.setAttribute('data-corners', String(parseFloat(GREEN_RADIUS) || 80));
        if (window.Corners) { window.Corners.scan(); }
      }

      // mobile: clip the green panel to one viewport (stack below stays free to scroll)
      if (!isDesktop && canLeave) {
        greenPanel.style.height   = window.innerHeight + 'px';
        greenPanel.style.overflow = 'hidden';
      }

      // fixed strip at viewport top covering the sub-pixel cream seam while the green is docked
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

      // mode swap: stamp <html> (injected sheet hides the off-mode block), and force-show the
      // in-mode block anywhere in the DOM (clear stuck inline display; force one only if a
      // stylesheet rule still hides it).
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

      // content stack scrolled up together (by S) to reveal the H2 + tabs
      var transWrap = section.querySelector('.meeting_transition_wrap');
      var tabsWrap  = isDesktop ? (section.querySelector(TABS_SEL) || section.querySelector(DESKTOP_SEL)) : null;
      var contentEls = [greenPanel, transWrap, tabsWrap].filter(Boolean);

      // card must sit above the H2 + tabs grid where they overlap
      if (greenPanel) { greenPanel.style.position = 'relative'; greenPanel.style.zIndex = '900'; }
      if (transWrap)  { guardStyle(transWrap); transWrap.style.zIndex = '1'; }
      if (tabsWrap)   { guardStyle(tabsWrap);  tabsWrap.style.zIndex  = '1'; }

      // tabs: left-column items; scroll advances the active one while sticky. state published as
      // is-active + data-active-tab="N" on the tabs container + section for Webflow content to react.
      var tabItems = tabsWrap ? Array.prototype.slice.call(tabsWrap.querySelectorAll('.meeting_tabs_item')) : [];
      var numTabs  = Math.max(1, tabItems.length);
      var tabTexts = section.querySelectorAll('[data-tab-text]');
      var tabAnims = section.querySelectorAll('[data-tab-anim]');
      var bgSvgs   = section.querySelectorAll('[data-tab-bg]');
      var tabIndicator = tabsWrap ? tabsWrap.querySelector('[data-tab-indicator]') : null;
      var activeTab = -1;
      var bgTargetP = 0, bgCurrentP = 0;   // lerped bg-line paint progress

      // prep each bg SVG path so it can be "drawn" by scrubbing stroke-dashoffset
      Array.prototype.forEach.call(bgSvgs, function (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('path'), function (p) {
          guardStyle(p);
          var len = (p.getTotalLength ? p.getTotalLength() : 0) || 1;
          p.style.strokeDasharray  = len;
          p.style.strokeDashoffset = len;
          p._len = len;
        });
      });
      // draw each SVG in (first half of its slice) then out (second half). tp = 0..1 tabs progress
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
      // slide the orange indicator over the active tab's label (CSS owns the glide)
      function moveIndicator(n) {
        if (!tabIndicator || !tabItems[n]) { return; }
        var label = tabItems[n].querySelector('.meeting_tabs_text_wrap') || tabItems[n];
        tabIndicator.style.transform = 'translateY(' + label.offsetTop + 'px)';
        tabIndicator.style.height    = label.offsetHeight + 'px';
      }
      // every panel starts gated off, so no embed is looping behind the card during the ride down.
      // "off" removes the animations outright (see the injected sheet), so flipping it to "on"
      // starts that embed's loop at 0% every time the tab is entered.
      Array.prototype.forEach.call(tabAnims, function (el) { el.setAttribute('data-play', 'off'); });

      // stack the panels in one grid cell. they're siblings in the stage, and visibility:hidden
      // still occupies layout, so left in flow they pile up and make the stage five panels tall.
      // grid (not absolute) keeps the stage sizing itself to the tallest panel.
      var animStage = tabAnims.length ? tabAnims[0].parentNode : null;
      if (animStage) {
        guardStyle(animStage);
        animStage.style.display = 'grid';
        // pin the single cell to the stage's own box. left implicit the row would be auto-sized and
        // a tall chapter (the brief expands downward) would stretch the row past the card's height.
        animStage.style.gridTemplateRows    = '100%';
        animStage.style.gridTemplateColumns = '100%';
        // clip each panel to the card's box and corner radius. chapter content is taller than the
        // card in places (the brief expands downward), and without this it spills past the edge.
        var panelRadius = PANEL_CLIP ? window.getComputedStyle(card).borderRadius : '';
        Array.prototype.forEach.call(tabAnims, function (el) {
          guardStyle(el);
          el.style.gridArea = '1 / 1';
          el.style.minWidth = el.style.minHeight = '0';   // else content sets an auto floor
          if (PANEL_FILL) {
            // beat any authored height on the panel, then make the panel its own single-cell grid
            // so whatever is inside (bg wrapper, shader, embed) is stretched to the card's box
            // instead of sizing to its own content. a percentage height authored in Webflow can't
            // do this on its own: it needs a definite parent height to resolve against.
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

      // ---- chapter plate: one never-fading surface under all the panels, plus the per-chapter
      // photos and the melt crossfade between them.
      var plate = null, plateRadius = window.getComputedStyle(card).borderRadius;
      var bgList = [], bgByTab = {}, bgShown = -1, bgMeltTween = null, meltGL = null;

      // DEBUG helper: reports whether the stage/panels actually took the card's box
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
        // first child = paints below every panel. opacity 0 until the travelling card hands over.
        plate.style.cssText = 'grid-area:1 / 1;position:relative;overflow:hidden;pointer-events:none;' +
          'min-width:0;min-height:0;opacity:0;box-sizing:border-box;' +
          (plateRadius && plateRadius !== '0px' ? 'border-radius:' + plateRadius + ';' : '');

        // the plate stands in for the travelling card once the card's own paint leaves, so it has to
        // BE the card visually: same fill, same border, same shadow, same radius. colours come from
        // the light phase, because that's what's on screen at the handoff (the light clone).
        var cardCS = window.getComputedStyle(card);
        plate.style.backgroundColor = PLATE_BG || (LIGHT_REVEAL ? LIGHT_CARD_BG : origBg);
        if (cardCS.backgroundImage && cardCS.backgroundImage !== 'none') {
          plate.style.backgroundImage    = cardCS.backgroundImage;
          plate.style.backgroundSize     = cardCS.backgroundSize;
          plate.style.backgroundPosition = cardCS.backgroundPosition;
          plate.style.backgroundRepeat   = cardCS.backgroundRepeat;
        }
        // per-side: copying one side's width onto all four invents borders the card doesn't have
        ['Top', 'Right', 'Bottom', 'Left'].forEach(function (side) {
          if (parseFloat(cardCS['border' + side + 'Width']) > 0 &&
              cardCS['border' + side + 'Style'] !== 'none') {
            plate.style['border' + side + 'Width'] = cardCS['border' + side + 'Width'];
            plate.style['border' + side + 'Style'] = cardCS['border' + side + 'Style'];
            plate.style['border' + side + 'Color'] = LIGHT_REVEAL ? LIGHT_CARD_BG : origBorder;
          }
        });
        // in the light phase the plate wears the same 2px outer ring the clone does, rather than the
        // card's authored shadow - that shadow is the dark hairline the ring exists to hide, and it
        // shows against the cream section below. only fall back to the real shadow if there's no
        // light reveal to impersonate.
        if (LIGHT_REVEAL) { plate.style.boxShadow = '0 0 0 ' + LIGHT_RING + 'px ' + LIGHT_CARD_BG; }
        else if (origShadow && origShadow !== 'none') { plate.style.boxShadow = origShadow; }
        animStage.insertBefore(plate, animStage.firstChild);
        teardown.push(function () { if (plate.parentNode) { plate.parentNode.removeChild(plate); } });

        // photos are authored anywhere in the section, tagged with the tab index they belong to
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
          // authored hidden in Webflow is fine - we take over, opacity is the only thing that shows
          im.style.setProperty('display', 'block', 'important');
          im.style.setProperty('visibility', 'visible', 'important');
          im.style.position = 'absolute';
          im.style.top = im.style.left = '0';
          im.style.width = im.style.height = '100%';
          im.style.objectFit = 'cover';
          im.style.zIndex = '0';
          im.style.pointerEvents = 'none';
          im.style.opacity = '0';
          // gsap owns opacity here. any CSS transition (authored, or left by an earlier fade) would
          // animate the melt's settle-onto-the-real-image step and read as a second fade after it.
          im.style.transition = 'none';
        });
      }

      // WebGL melt: a canvas that overlays the plate ONLY during a photo swap and runs a
      // texture-clamped displacement crossfade between the two. Ported from flow-stack.js so both
      // pages share the same transition. Silently no-ops if WebGL or the texture upload fails.
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

      // swap the plate's photo to whatever this tab wants. tabs with no photo (0 and 1) fade the
      // current one out and leave the plate's flat colour showing.
      function setChapterBg(n) {
        if (!plate) { return; }
        var want = bgByTab.hasOwnProperty(n) ? bgByTab[n] : -1;
        if (want === bgShown) { return; }
        var prev = bgShown;
        bgShown = want;
        // tear down any swap still in flight. killing the tween skips its onComplete, so the canvas
        // has to be hidden HERE too - otherwise it's left showing a frozen melt frame on top of the
        // images (canvas z-index 1, images 0) and every later fade happens invisibly underneath it.
        if (bgMeltTween) { bgMeltTween.kill(); bgMeltTween = null; }
        if (meltGL) { meltGL.show(false); }
        if (bgList.length) { gsap.killTweensOf(bgList); }   // no half-finished fade under the swap
        // and re-assert the last COMMITTED state. an interrupted swap leaves the images mid-fade
        // (or both at 0, which is how a melt starts) while bgShown already claims the target, so
        // asking for that chapter again would early-return onto a blank plate.
        for (var i = 0; i < bgList.length; i++) { gsap.set(bgList[i], { opacity: i === prev ? 1 : 0 }); }

        // melt needs two real textures; anything involving "no photo" is a plain fade
        if (prev >= 0 && want >= 0 && meltGL && meltGL.ready(prev, want)) {
          meltGL.render(prev, want, 0);            // paint the "from" frame before showing, no flash
          meltGL.show(true);
          bgList[prev].style.opacity = '0';
          bgList[want].style.opacity = '0';
          var proxy = { p: 0 };
          bgMeltTween = gsap.to(proxy, {
            p: 1, duration: BG_FADE_MS / 1000, ease: 'power1.inOut',
            onUpdate: function () { meltGL.render(prev, want, proxy.p); },
            onComplete: function () {
              // instant, and before the canvas goes, so there's no frame showing neither
              gsap.set(bgList[want], { opacity: 1 });
              meltGL.show(false);
              for (var b = 0; b < bgList.length; b++) { if (b !== want) { gsap.set(bgList[b], { opacity: 0 }); } }
              bgMeltTween = null;
            }
          });
        } else {
          // no melt available (no "from" photo, no WebGL, textures not ready): plain crossfade,
          // driven by gsap so it can't collide with the melt's own opacity writes
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
        // shoot the entering panel's animation in from the top; park every other one
        Array.prototype.forEach.call(tabAnims, function (el) {
          el.setAttribute('data-play', parseInt(el.getAttribute('data-tab-anim'), 10) === n ? 'on' : 'off');
        });
        ch2Leftovers(n);
        setChapterBg(n);
        moveIndicator(n);
      }

      // measured each refresh: card rise distance, and S to bring the tabs-grid centre to screen centre
      var cardRiseDist = 0, sCenter = 0, sCardStart = 0;
      var landDX = 0, landDY = 0;   // correction that walks the card onto the chapter stage
      function measurePositions() {
        contentEls.forEach(function (el) { gsap.set(el, { y: 0 }); });
        gsap.set(card, { x: 0, y: 0 });
        var mid   = window.innerHeight * CARD_TARGET;
        var secR  = section.getBoundingClientRect();
        var sTop  = secR.top;
        var sLeft = secR.left;
        var cr    = card.getBoundingClientRect();
        // the chapter panels take the travelling card's exact box, so the handoff reads as one card
        // rather than a swap. measured here because the card's transform is already cleared.
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

        // sCenter centres the tabs CONTAINER on the viewport, but the chapter stage is a grid cell
        // inside it, so the card would land near the panel rather than on it. measure the gap
        // between where the card ends up and where the stage ends up, and walk the card across it
        // over the same pG->pHold travel. without this the pill and pop images that survive into
        // chapter 1 sit apart from the panel they belong to.
        landDX = landDY = 0;
        if (CARD_LANDS_ON_STAGE && animStage) {
          var sr = animStage.getBoundingClientRect();
          if (sr.width && sr.height) {
            var cardCX = (cr.left - sLeft) + cr.width  / 2;
            var cardCY = (cr.top  - sTop)  + cr.height / 2;
            var stgCX  = (sr.left - sLeft) + sr.width  / 2;
            var stgCY  = (sr.top  - sTop)  + sr.height / 2;
            landDX = stgCX - cardCX;                             // stage sits off-centre horizontally
            landDY = (stgCY - sCenter) - (cardCY - cardRiseDist); // both land points, section-relative
          }
        }
      }

      // name tags in the light clone: each speaker keeps its own colour, looked up from the Webflow
      // variant. the variant name lives in a data-wf--<component>--variant attr (component name
      // varies, so match by shape) and falls back to a w-variant-* class.
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

      // light clone: a light-themed copy of the card, absolute inset:0 inside the card, clipped at
      // the green/white boundary so the card reads dark above the line and light below.
      var cardClone = null;
      if (LIGHT_REVEAL && isDesktop) {
        cardClone = card.cloneNode(true);
        cardClone.removeAttribute(ATTR);
        // pop images live in the card, so the clone would show a frozen ghost copy of each
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
          if (STACK_ITEM_RADIUS) { el.style.borderRadius = STACK_ITEM_RADIUS; }   // clone is a pre-gather snapshot
        });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_item_text, [data-stack="card-head"]'), function (el) { el.style.color = LIGHT_TEXT; });
        Array.prototype.forEach.call(cardClone.querySelectorAll('.meeting_check, [data-stack="check"]'), function (el) { el.style.borderColor = LIGHT_TEXT; });
        cardClone.style.borderColor = LIGHT_CARD_BG;
        cardClone.style.boxShadow   = '0 0 0 ' + LIGHT_RING + 'px ' + LIGHT_CARD_BG;   // masks the dark card edge
        card.appendChild(cardClone);
        teardown.push(function () { if (cardClone.parentNode) { cardClone.parentNode.removeChild(cardClone); } });
        recolorNameTags(cardClone);
        // recolor icons on the property each shape actually paints with (stroke vs fill)
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
      // runs AFTER the clone is built so both copies of the pill get bars; otherwise the clone shows
      // a frozen icon on top of the animating one all through the light phase.
      var audioBars = [];
      (function buildAudio() {
        if (!AUDIO_BARS) { return; }
        Array.prototype.forEach.call(section.querySelectorAll(AUDIO_SEL), function (host) {
          var svg  = (host.tagName && host.tagName.toLowerCase() === 'svg') ? host : host.querySelector('svg');
          if (!svg) { return; }
          // the authored bars: one path holding every bar as a subpath
          var src = svg.querySelector('path');
          if (!src) { return; }
          var bb;
          try { bb = src.getBBox(); } catch (e) { return; }     // display:none -> no box
          if (!bb || !bb.width || !bb.height) { return; }
          var fill = window.getComputedStyle(src).fill;
          src.style.display = 'none';
          teardown.push(function () { src.style.display = ''; });

          var n  = AUDIO_BARS;
          var bw = bb.width / (n + (n - 1) * AUDIO_GAP_RATIO);   // bars + gaps span the same box
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
              // two detuned frequencies + random phase per bar so they move independently
              f1: 0.8 + Math.random() * 1.5, f2: 2.0 + Math.random() * 3.0,
              ph1: Math.random() * 6.2832, ph2: Math.random() * 6.2832
            });
          }
        });
        if (DEBUG) { console.log('[stack] audio bars:', audioBars.length); }
      }());

      var envPh1 = Math.random() * 6.2832, envPh2 = Math.random() * 6.2832;
      var audioClock = 0, audioP = 0;
      function updateAudio(p) {
        if (!audioBars.length) { return; }
        var TWO_PI = Math.PI * 2;
        var t = p * AUDIO_CYCLES + audioClock * AUDIO_SPEED;
        // loudness envelope: two beat frequencies multiply, giving uneven bursts and near-silent
        // gaps the way speech has loud syllables and pauses, rather than a steady hum
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
          var sWav = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));   // gentle centre lift
          var s = AUDIO_WAVE * sWav + (1 - AUDIO_WAVE) * sJag;
          var h = (AUDIO_MIN + (b.ceil - AUDIO_MIN) * s) * b.span;
          b.el.setAttribute('height', String(h));
          b.el.setAttribute('y', String(b.cy - h / 2));          // grow from the bar's own centre
        }
      }
      if (audioBars.length && AUDIO_SPEED) {
        var audioTicker = function () {
          audioClock += gsap.ticker.deltaRatio() / 60;
          updateAudio(audioP);
        };
        gsap.ticker.add(audioTicker);
        teardown.push(function () { gsap.ticker.remove(audioTicker); });
      }

      var cardLightOn = false;   // real card flipped to the light theme in the full-light phase

      // pin timing (recomputed on refresh)
      var assemblySteps = STEP_VH * stepCount;
      var totalVH = 0, pA = 0, pG = 0, pHold = 0, tabSpan = 1;
      var snapPoints = [];
      function computeTiming() {
        var contentVH = (isDesktop && window.innerHeight) ? (sCenter / window.innerHeight) : 0;
        var tabsVH    = isDesktop ? ((numTabs - 1) * TAB_STEP_VH + END_HOLD_VH) : 0;
        tabSpan = tabsVH / TAB_STEP_VH || 1;
        totalVH = assemblySteps + GREEN_HOLD_VH + contentVH + tabsVH;
        pA    = assemblySteps / totalVH;                                 // assembly ends
        pG    = (assemblySteps + GREEN_HOLD_VH) / totalVH;               // green hold ends
        pHold = (assemblySteps + GREEN_HOLD_VH + contentVH) / totalVH;   // card centred / tabs phase begins
        snapPoints = [0].concat(popThresh, [gatherThresh]).map(function (v) { return v * pA; }).concat([pG, pHold, 1]);
      }
      computeTiming();

      // ---- exit: the images leave, then the task rows travel on y and fade, clearing the card.
      // TRIGGERED at CH1_AT of the ride down and played on its own clock, so it's finished before
      // the card lands. reverses if you scroll back above the trigger.
      //
      // it animates y/opacity/scale on elements gatherTl and the fan-out also own, so it must never
      // touch them outside its own window - hence the play/reverse gate rather than a per-frame
      // write. (an earlier scrubbed version ran on every frame and wrote y:0 over every scatter
      // position, flattening the whole assembly.)
      var exitRows = items.filter(function (it) { return !it.hasAttribute('data-stack-keep'); });
      var exitCloneRows = cardClone
        ? Array.prototype.slice.call(cardClone.querySelectorAll('[' + ATTR + '="item"], .meeting_item'))
        : [];
      var exitTl = gsap.timeline({ paused: true });
      var rowsAt = 0;
      if (CH1_IMG_OUT && pops.length) {
        exitTl.to(pops, {
          y: CH1_IMG_Y, scale: CH1_IMG_SCALE, opacity: 0,
          duration: CH1_IMG_DUR, ease: CH1_IMG_EASE, stagger: CH1_IMG_STAGGER
        }, 0);
        rowsAt = CH1_IMG_DUR * 0.5;   // rows follow the images out
      }
      // travel and fade are SEPARATE tweens: the fade is shorter, so a row is already invisible by
      // the time it reaches the card's top edge. the card can't clip them (the pop images live
      // inside it and deliberately hang outside its bounds), so the fade is what does the masking.
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
      // only the card's BACKGROUND goes: its own paint, plus the light clone (which is a full
      // opaque copy of the plate, so leaving it up would leave the background up). the pop images,
      // the foot pill and the head all stay for chapter 1 - they clear at chapter 2 instead.
      // the card/plate swap is deliberately NOT part of this timeline. it's driven by pHold below,
      // because it has to follow the card's POSITION: tied to the exit it only reversed once you
      // scrolled back to CH1_AT, so on the way up the plate sat in the tabs while the invisible card
      // rode up with you, then the paint snapped back partway. see cardSwap().
      // leftovers: the pop images, the foot pill and the card head ride through chapter 1 and clear
      // when chapter 2 arrives. driven by the ACTIVE TAB, not by scroll position, so it stays in
      // step with a tab click as well as a scroll.
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
        if (!leftoverTl) { return; }   // setActiveTab is defined above this; guard the early calls
        var want = CH2_OUT && n >= 1;
        if (want === leftoverOut) { return; }
        leftoverOut = want;
        if (want) { leftoverTl.play(); } else { leftoverTl.reverse(); }
      }

      // hand the card's paint over to the plate, and back again. driven by pHold, where the card and
      // the plate are exactly coincident, so the switch is invisible in both directions. instant on
      // purpose: they're identical, so there's nothing to crossfade, and crossfading two opaque
      // layers composites to ~75% coverage mid-way and shows the page through.
      var cardSwapped = false;
      function cardSwap(p) {
        if (!CARD_OUT) { return; }
        var want = (p >= pHold);
        if (want === cardSwapped) { return; }
        cardSwapped = want;
        if (plate)     { gsap.set(plate,     { opacity: want ? 1 : 0 }); }
        if (cardClone) { gsap.set(cardClone, { opacity: want ? 0 : 1 }); }
        if (want) {
          gsap.set(card, { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', boxShadow: 'none' });
        } else {
          gsap.set(card, { backgroundColor: origBg, borderColor: origBorder, boxShadow: origShadow });
          cardLightOn = false;   // let the light-split block re-decide from scratch
        }
      }

      var exitPlayed = false;
      function ch1Exit(p) {
        var at   = pG + (pHold - pG) * CH1_AT;
        var want = p >= at;
        if (want === exitPlayed) { return; }
        exitPlayed = want;
        if (want) { exitTl.play(); } else { exitTl.reverse(); }
      }

      // maps scroll progress -> every visual; used by both onUpdate and refresh
      function applyScroll(p) {
        var ap = pA > 0 ? Math.min(1, p / pA) : 1;
        update(ap);

        // fan-out: rows open from a fist to their scatter spots. only drive x/y once gather is fully
        // settled at the scattered end, else it fights gatherTl mid-reverse.
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

        // desktop: scroll the stack up by S and rise the card to centre. mobile: nothing scrolls.
        if (isDesktop) {
          var S;
          if (p <= pG)         { S = 0; }
          else if (p >= pHold) { S = sCenter; }
          else                 { S = (pHold > pG) ? ((p - pG) / (pHold - pG)) * sCenter : sCenter; }
          for (var ci = 0; ci < contentEls.length; ci++) { gsap.set(contentEls[ci], { y: -S }); }
          // lp walks the stage correction in over the same travel, so the card arrives on the panel
          var lp = (p <= pG) ? 0 : (p >= pHold ? 1 : ((pHold > pG) ? (p - pG) / (pHold - pG) : 1));
          gsap.set(card, {
            x: landDX * lp,
            y: (S - Math.min(cardRiseDist, Math.max(0, S - sCardStart))) + landDY * lp
          });
        }
        popParallax(p);
        ch1Exit(p);
        cardSwap(p);
        audioP = p;
        updateAudio(p);

        // seam cover: show while the green panel is docked flush to the viewport top
        if (canLeave && topCover) {
          var gr = greenPanel.getBoundingClientRect();
          topCover.style.display = (gr.top <= 1 && gr.bottom > 3) ? 'block' : 'none';
        }

        // light split: clip the clone at the green/white boundary; recolor the real card to light
        // once fully in the white zone so no green hairline peeks around the clone.
        // skipped once the plate has taken over, or it would paint the card straight back in
        if (cardClone && st && st.isActive && !(CARD_OUT && cardSwapped)) {
          var cr = card.getBoundingClientRect();
          var B  = canLeave ? greenPanel.getBoundingClientRect().bottom : -1e9;
          var topClip = Math.max(0, Math.min(cr.height, B - cr.top));
          if (p >= pHold) { topClip = 0; }
          if (topClip >= cr.height - 0.5) {
            cardClone.style.display = 'none';
          } else {
            cardClone.style.display  = '';
            // negative insets on the other three sides: inset() clips at the border box, which would
            // cut off the outer ring (a box-shadow lives OUTSIDE that box) and re-expose the card's
            // dark edge for the whole split phase. only the top is a real cut.
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

        // tabs (desktop): advance the active tab while sticky; publish bg-line paint target.
        // held at -1 until the card has landed, so panel 0 doesn't play through the ride down.
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

      var st = ScrollTrigger.create({
        trigger: section, start: 'top top',
        end: function () { return '+=' + (window.innerHeight * totalVH); },
        pin: true, anticipatePin: 1, invalidateOnRefresh: true,   // anticipatePin: no jerk when fast scroll hits the pin
        refreshPriority: 1,   // this pin sits above the slider pin; refresh it first (slider stays 0)
        onRefresh: function (self) { prevStart = self.start; prevEnd = self.end; },
        onRefreshInit: refresh,
        onUpdate: function (self) {
          var p = self.progress;
          // forward lock: hold at pG until the time-based gather finishes playing in
          var gThreshP = gatherThresh * pA;
          if (p > pG && gatherOn && gatherTl.progress() < 1) {
            self.scroll(self.start + pG * (self.end - self.start));
            p = pG;
          }
          // reverse lock: hold just below the gather boundary until the reverse finishes
          else if (p < gThreshP && !gatherOn && gatherTl.progress() > 0) {
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

      // rebuild only: the pin-spacer can be created short (page too short to reach the tabs phase),
      // so refresh once layout settles, then anchor the scroll onto the rebuilt layout.
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
              if (anchorY <= anchorStart)    { target = anchorY; }                        // above the pin
              else if (anchorY <= anchorEnd) { target = st.start; }                        // inside -> snap to start
              else                           { target = anchorY + (st.end - anchorEnd); }  // below -> shift by delta
              window.scrollTo(0, Math.max(0, Math.round(target)));
              anchorY = anchorStart = anchorEnd = null;
            }
            logChoreo('post-refresh');
          });
        });
      }

      // ease the bg-line paint toward the scroll target each frame (removed on teardown)
      var bgTicker = function () {
        try {
          var diff = bgTargetP - bgCurrentP;
          if (Math.abs(diff) < 0.0005) { return; }
          var dt = gsap.ticker.deltaRatio();
          bgCurrentP += diff * (1 - Math.pow(1 - BG_SMOOTH, dt));
          drawBg(bgCurrentP);
        } catch (e) { /* never let a paint hiccup break the global ticker */ }
      };
      gsap.ticker.add(bgTicker);
      teardown.push(function () { gsap.ticker.remove(bgTicker); });

      // click a tab -> jump to the middle of that tab's slice
      tabItems.forEach(function (item, i) {
        guardStyle(item);
        item.style.cursor = 'pointer';
        var onClick = function () {
          var last = numTabs - 1;
          var centerProg = (i < last) ? (i + 0.5) / tabSpan : ((last / tabSpan) + 1) / 2;
          var centreP = pHold + centerProg * (1 - pHold);
          var N = bgSvgs.length || 1;
          bgCurrentP = Math.min(N - 1, Math.floor(centerProg * N)) / N;   // pre-seed so only the target line draws
          window.scrollTo({ top: st.start + centreP * (st.end - st.start), behavior: 'auto' });
        };
        item.addEventListener('click', onClick);
        teardown.push(function () { item.removeEventListener('click', onClick); });
      });

      // undo the tracked mutations newest-first (matchMedia kills st + reverts gsap.sets itself)
      return function cleanup() {
        for (var i = teardown.length - 1; i >= 0; i--) {
          try { teardown[i](); } catch (e) { /* keep tearing down the rest */ }
        }
      };
    });

    // re-measure once layout & webfonts settle (added once, not per-rebuild)
    function relayout() { ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }

    // viewport-size watchdog: refresh on real viewport changes (a height-only resize doesn't cross
    // 992px and a plain resize event doesn't always reach ScrollTrigger in embedded contexts).
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
