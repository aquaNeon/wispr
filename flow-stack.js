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
      var live = parseFloat(s.el.getAttribute(ATTR));
      if (isFinite(live) && live > 0) { s.max = live; }
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
  var IN_VH        = 0.25;   // P0: brief comparison beat, then scroll straight into the grow (was a long hold)
  var GROW_VH      = 0.8;    // P1: photo card grows right -> left to full stage width
  var FULL_HOLD_VH = 0.25;   // beat at full bleed
  var SHRINK_VH    = 0.7;    // P2: sides shrink in to the final card
  var TAB_STEP_VH  = 1.0;    // fallback scroll length per tab (used if CH_VH doesn't fit numTabs)
  var END_HOLD_VH  = 1.0;    // fallback hold on the last tab
  // per-tab scroll length (vh). short now that autoplay (not scroll) drives the animation — these
  // just set how far you scroll between tab snap-stops. one entry per tab.
  var CH_VH        = [1.0, 1.0, 1.2];
  var TYPE_END     = 0.9;    // fraction of chapter 1's slice by which the transcript finishes typing
  // in-card animations play once on tab entry (time-based) instead of scrubbing to scroll; each
  // tab is a snap stop, so landing on it plays its chapter. per-tab durations in ms.
  var AUTOPLAY        = true;
  var AUTOPLAY_MS     = [9500, 6200, 6800];   // [tab1 "Speak naturally" slower, tab2, tab3] — per-tab pace (ms)
  var AUTOPLAY_REPLAY = true;   // false = a revisited tab shows its finished last frame, no replay
  var AUTOPLAY_LOOP   = false;  // false = play once and hold the end frame (looping looked weird)
  var AUTOPLAY_LOOP_TABS = [2]; // ...except these tabs, which do loop. chapter 3's fan reads as a cycle
  var LOOP_GAP_MS     = 400;    // beat held on the empty stage before a looping tab restarts
  // chapter 3's tail: rather than cutting on a parked card, the swing carries PAST the last one so it
  // exits like the others, then the next pass fades back in from the start.
  var FAN_EXIT    = 2;     // card-units the swing travels past the last card. ~2 clears it fully
  var FAN_EXIT_AT = 0.78;  // point in the swing where that tail starts
  var FAN_IN_T    = 0.10;  // fraction of the chapter over which the fan fades back in at the top
  // MOBILE: each [data-flow-play="chN"] block in the data-stack="mobile" container clones its desktop
  // chapter and plays on scroll-into-view (replays on re-enter). per-chapter play duration in ms.
  var MOBILE_CH_MS        = [4000, 5200, 3000];
  // a card plays when its TOP crosses a line this far up from the bottom of the screen. '-10%' = fires
  // almost as soon as it enters; '-40%' = waits until it's ~40% up the viewport (later). tune to taste.
  var MOBILE_IO_MARGIN    = '-15%';
  // extra px shaved off the open message box on mobile (ch2 + ch3). the box is already clamped to the
  // polished text by mobileBoxFit — this is the manual dial on top of it.
  var MOBILE_MSG_TRIM     = 0;
  // mobile ch2 "cleaning up" pill: tp at which the polishing pill grows in (and the audio pill fades
  // out), plus a px nudge if the clone's pill sits off its spot (+down / −up).
  var MOBILE_PILL_AT      = 0.06;
  var MOBILE_PILL_Y       = 0;
  // mobile: the 45 + 220 wpm cards stack in normal flow, equal height, marquee text autoplaying
  // (no pin/morph/chapter content). false = hide the desktop stage entirely, as before.
  var MOBILE_WPM          = true;
  var MOBILE_WPM_GAP      = 0;    // px between the two cards (they split the stage height evenly)
  var MOBILE_WPM_PAD      = 12;   // px inner padding of each card
  // marquee text size in RENDERED px (the authored font-size is in viewBox units, so it shrinks with
  // the svg — see fitMarqueeText). 0 = leave the authored size alone.
  var MOBILE_WPM_TEXT_PX  = 13;
  // where the marquee TEXT lands, as % of card height from the TOP. aligned per marquee from its
  // rendered text box — the straight (45) and curved (220) svgs sit at different heights in the viewBox.
  var MOBILE_WPM_MQ_TOP   = 60;
  // same for the wpm HEADINGS — pinned, not flex-centred, so the 45 card (heading only) and the 220
  // card (heading + recorder pill in flow) put their label at the identical height.
  var MOBILE_HEAD_PIN     = false;
  var MOBILE_WPM_HEAD_TOP = 38;
  // tab click: CROSSFADE the card scene between tabs instead of scrubbing through every chapter.
  // fade the current chapter out, jump to the target (hidden), settle it, fade the target in — so
  // clicking 1→3 shows tab 3, not a fast-forward through tab 2.
  var TAB_FADE_MS  = 220;         // ms each half of the crossfade (out, then in)
  var INDICATOR_MS = 500;         // ms the tab indicator slides/resizes to the active tab

  // chapter 2 (polish), in fractions of tab-1's scroll slice (gradient itself loops via CSS):
  // the three windows OVERLAP on purpose: the raw starts dissolving while the gradient is still
  // travelling, and the box opens before the raw is gone, so it reads as one continuous pass from
  // the transcript into the UI rather than three separate beats.
  var BOX_OUT_POW   = 4;
  var MSG_BLEED     = true;
  var MSG_BLEED_X   = -1;
  var MSG_BORDER    = true;
  var POLISH_GRAD   = [0.0, 0.46];  // PHASE 1 (processing): gradient + glare sweep the whole transcript
  var POLISH_RAWOUT = [0.46, 0.55]; // PHASE 2: only once processing has finished does the text dissolve
  var POLISH_DROP   = [0.52, 0.66]; // ...and move into the UI — overlaps the dissolve so it's one move
  // how much faster than the box grow the "Message…" placeholder clears. higher = gone sooner, so the
  // polished text never lands on top of it. 1 = fades exactly with the box.
  var PLACEHOLDER_OUT = 6.0;
  var POLISH_BAND   = 0.22;  // width of each word's fade within the wave (bigger = softer wave edge)
  var POLISH_GAP    = 0.12;  // how far the polished-in lags behind the raw-out at the wavefront
  var POLISH_RISE   = 16;    // px the polished text lifts up to sit where the "Message…" placeholder was
  var GRAD_WORD_MS  = 350;   // ms each word's colour→gradient fade plays through as the wavefront passes
                             // it (a CSS transition — TRIGGERED per word, so it never scrubs word-by-word)
  // experiment: a light band riding the gradient wavefront (glow, not just a colour reveal)
  var GLOW_EDGE     = true;  // false = plain gradient reveal, no glow
  var GLOW_BAND     = 0.14;  // how far behind the wavefront the glow trails (fraction of the transcript)
  var GLOW_MAX      = 12;    // px blur of the glow right at the wavefront
  var GLOW_COLOR    = '255,255,240';   // rgb of the glow
  // wavefront travels line-by-line (by vertical position) with a horizontal tilt so it reads as a
  // diagonal sweep. 0 = flat horizontal lines, higher = more diagonal.
  var GLOW_DIAG     = 0.35;
  // the wavefront also MOVES the words it passes (a crest riding through the text, like the buttons)
  // so the pass reads as processing, not just a recolour. crest = a half-sine over WAVE_BAND.
  // background-clip:text on the transcript can't paint a glyph inside a transformed child — the
  // transform composites it out of the ancestor's clip and the word renders as nothing. so each word
  // carries its own copy of the gradient, offset to keep one continuous ramp across the block.
  // required for WAVE_MOTION; false = container gradient, no crest during processing.
  var WORD_GRAD     = true;
  var GRAD_SPAN     = 2.2;    // gradient image width as a multiple of the transcript width
  var GRAD_SHIFT_MS = 3200;   // ms for one travel of the gradient across the text (the shimmer)
  var POLISH_GRAD_CSS = 'linear-gradient(100deg,#F0D7FF 0%,#FFA946 23%,#FF6C4C 39%,#FFBCF2 67%,#7232A6 91%)';
  var WAVE_MOTION   = true;
  var WAVE_AMP      = 7;     // px a word lifts at the crest
  var WAVE_SCALE    = 0.05;  // extra scale at the crest (0 = pure lift)
  var WAVE_ROT      = 0;     // deg tilt at the crest (0 = off — reads busy on long lines)
  var WAVE_BAND     = 0.18;  // width of the crest as a fraction of the sweep (wider = longer swell)
  // raw-out: dissolve along the SAME diagonal the gradient travelled instead of wiping bottom→top,
  // so the text leaves the way it was processed. false = the old bottom→top wipe.
  var RAW_OUT_WAVE  = true;
  var RAW_OUT_SOFT  = 30;    // % softness of the dissolve edge (bigger = longer fade band)
  // polished text rides the same crest as it fades in, so the wave carries through into the UI
  var POLISH_WAVE   = true;
  var POLISH_AMP    = 12;    // px the polished words rise from as they fade in

  // ---- ch2 "paste": the transcript is PUSHED INTO the composer, not faded away ----
  // the dissolve alone reads as the text evaporating. here it travels DOWN into the box while it
  // goes, the box takes the hit with a squash-and-settle, and the polished text snaps in behind -
  // so the beat reads as paste, the way notetaker.js throws its task card sideways into the deck
  // rather than cross-fading it.
  // every value below is a pure function of tp, like the rest of renderPolish: a triggered wobble
  // would fight the scrub and leave the box mid-wiggle whenever you stopped scrolling.
  var PASTE_MODE        = true;   // false = the old dissolve-and-fade
  var RAW_PUSH_Y        = 90;     // px the raw transcript travels down as it dissolves
  var RAW_PUSH_SCALE    = 1;      // 1 = no shrink; the text keeps its size the whole way down
  // dissolve speed vs travel. this was 1.7, which faded the text out by 65% of the push - the
  // movement then happened on something invisible and the whole beat read as the old fade. just
  // over 1 keeps the text legible for most of the travel and only clears it at the very end.
  var RAW_FADE_FAST     = 1.12;
  var BOX_GROW_FAST     = 2.6;    // >1 front-loads the box grow so it opens fast and settles late
  // the wobble is on the WHOLE CARD, not the message box. scaling the box only ever moves its top
  // edge - it grows upward from a pinned base - so it read as the lid flapping rather than as the
  // card taking a hit. the card is positioned by left/top/width/height and nothing else writes its
  // transform, so the wobble composes cleanly on top.
  var CARD_WIGGLE       = [0.53, 0.72];  // tp window of the impact wobble
  var CARD_WIGGLE_Y     = 14;     // px the card kicks vertically at the peak
  var CARD_WIGGLE_X     = 0;      // px sideways. 0 = pure vertical
  var CARD_WIGGLE_ROT   = 0.6;    // deg of tilt at the peak. 0 = pure translation
  var CARD_WIGGLE_CYCLES = 2.2;   // oscillations before it settles
  var POLISH_FAST       = 1.7;    // >1 finishes the polished fill early in its window, so the text
                                  // is IN before the box stops wobbling

  var INTRO_FADE_MS   = 250; // 220 wpm + marquee: timed fade in (at scroll-in) and out (at shrink start)
  var MSG_FADE_MS     = 450; // timed fade-IN of the message/composer content — TRIGGERED, not scrubbed
  var BG_FADE_MS      = 700; // duration of the melt swap between chapter bg images (data-bg="0/1/2")
  // melt: a self-contained WebGL displacement crossfade (codrops technique, no three.js). texture
  // clamped (no edge gaps) + smooth dual-image mix (matches the demo, not a hard swap).
  var MELT_INTENSITY  = 0.35; // displacement strength as a fraction of the image (~demo 0.2). 0 = plain crossfade
  var MELT_NOISE      = 3.0;  // cloud scale of the displacement noise (higher = smaller, busier blobs)
  var MSG_BOX_GUARD   = true;
  var MSG_TRIGGER     = 0.8; // where in the card ride (pC→pHold fraction) the message fade fires — near
                             // the end so the message frame animates in just before the raw text types
  // chapter-3 pill "voice mode": the done pill shows a cream waveform — bars that animate OUT to
  // varying heights (left→right ripple). shape = per-bar height fractions; count = its length.
  var BAR_COLOR = '#FFFFEB';
  var BAR_W      = 3;        // px width of each bar
  var BAR_GAP    = 3;        // px gap between bars
  var BAR_MIN    = 3;        // px shortest bar (the tiny end dots)
  var BAR_MAX    = 14;       // px tallest bar — the row locks to this height so the pill never resizes
  var PILL_PAD_Y = 5;        // px bar→edge, top/bottom (on the capsule — the black bg/stroke element)
  // .flow_pill-dots is injected by this script, so it won't exist in Webflow to style. content-box +
  // locked height means this adds to the row's total height rather than eating into the bars.
  var DOTS_PAD_Y = 2;        // px top/bottom on the bar row itself
  var PILL_WAVE_PADX = 16;   // px bar→edge, left/right — ignored when PILL_WAVE_W is set
  // target TOTAL width of the voice-mode capsule. the bar row is a fixed size (count × BAR_W plus the
  // gaps), so the side padding is derived from this instead of hardcoded. 0 = use PILL_WAVE_PADX.
  var PILL_WAVE_W = 72;
  var PILL_OUT_MS = 240;     // ms the spinner+label take to fade/shrink out before the waveform comes in
  var BULLET_MS  = 300;      // ms the bullets wave in + row grows BEFORE they grow out to the audio heights
  var BAR_SHAPE  = [0.16, 0.42, 0.7, 0.92, 1, 0.88, 0.66, 0.46, 0.28, 0.14];   // 10 bars
  // bar row is fixed: n bars + (n-1) gaps. side padding is whatever's left of PILL_WAVE_W.
  var BARS_W        = BAR_SHAPE.length * BAR_W + (BAR_SHAPE.length - 1) * BAR_GAP;
  var PILL_WAVE_PAD_X = PILL_WAVE_W ? Math.max(0, (PILL_WAVE_W - BARS_W) / 2) : PILL_WAVE_PADX;
  // ch2 dots capsule — the state the pill lands in as the text waves out, before ch3 grows the bars.
  // matches the authored svg: 10 dots, 2.25px, 2px apart, white at 40%, in a 72px capsule.
  var PILL_DOTS_AT = 0.46;   // tp within chapter 2 at which the pill swaps to the dots
  var DOT_W        = 2.25;
  var DOT_GAP      = 2;
  var DOT_COLOR    = 'rgba(255,255,255,0.4)';
  var DOTS_W       = BAR_SHAPE.length * DOT_W + (BAR_SHAPE.length - 1) * DOT_GAP;
  var DOTS_PAD_X   = PILL_WAVE_W ? Math.max(0, (PILL_WAVE_W - DOTS_W) / 2) : PILL_WAVE_PADX;

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
  // an off pill is opacity:0 + scaleX(0) — neither affects layout, so in the authored flow it still
  // reserves its box and the row shows gaps where the hidden pills sit. stack every pill that shares
  // a parent into ONE grid cell: no reserved space, and the baton pass happens at a single anchor.
  var PILL_ANCHOR    = true;

  // chapter 3 (Distribute) — the destination cards arc through centre like a hand of cards.
  // pivot is BELOW the card so rotateZ swings them on an arc (＼ ｜ ／). scrubbed by the tab's tp.
  var FAN_ANGLE = 45;          // deg a card is rotated at its off (left/right) position
  var FAN_TX    = 300;         // px a card is translated sideways at its off position
  var FAN_SCALE = 1;           // scale of an off card (1 = no shrink; cards just swing + clip)
  var FAN_CARD_SCALE = 1;      // base size of every fan card. 1 = authored size
  // clamp each fan card's message box to its own text, killing the dead space under the message.
  // height only — the card keeps its authored width.
  var FAN_FIT_BOX = true;
  var FAN_BOX_PAD = 0;         // px breathing room left under the last line (+ = looser)
  var FAN_STRIP_BR = true;     // drop the trailing <br>s the authored copies pad their message with
  var FAN_PIVOT = '50% 100%';  // transform-origin at the card's bottom-middle → swings on that hinge
  var FAN_FADE  = 0.6;         // card-units past ±1 over which an off card fades fully out
  var FAN_CENTER_NUDGE = 0;    // px fine-tune for the centred slack note (— = up, + = down)
  // the fan cards are centred on their VISIBLE box, not the [data-dest] wrapper — the wrapper can
  // carry padding/invisible rows the eye doesn't read, which is what left claude + gmail sitting low.
  // '' = centre the wrapper itself (old behaviour).
  var FAN_CENTER_BY   = '[data-flow="msg-grow"]';
  // px fine-tune for the swung-in cards only (— = up, + = down). dialled in against the live page:
  // the msg-grow box measures taller than the white surface reads, so geometric centre sits low.
  var FAN_CARD_NUDGE  = -30;
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
  // per-frame ease toward the scrubbed tp. 0.12 took ~18 frames to cover a jump, which read as
  // lag on top of the windows above - the paste beats are short now and cannot afford it.
  var POLISH_LERP  = 0.32;
  var SLACK_PAD    = 48;       // px white space below the slack text in ch3 (eases in after the type-in)
  var LOGO_ROT     = 90;       // deg a logo rotates in as it centres (same direction as the swing; flip to reverse)
  var LOGO_FADE    = 1;        // card-units over which a logo fades + rotates in/out around centre
  var LOGO_SCALE   = 0.6;      // scale of a logo when off-centre (pops up to 1 as it centres)
  // authored logo svgs come in at different sizes — pin the ones that need it, by data-dest.
  // anything not listed keeps whatever Webflow gave it.
  var LOGO_SIZE    = { gmail: 34 };
  var LOGO_TOP     = 48;       // px between the card's TOP edge and the logo row. 0 = leave authored

  var CARD_TARGET  = 0.5;    // viewport fraction the card centres on during the ride
  var CARD_W       = 400;    // px final card width after the shrink (clamped to stage)
  var CARD_H       = 'auto'; // px number, or 'auto' to fit the in-flow content of [data-flow="screen"]
  var CARD_H_FALLBACK = 560; // used when 'auto' but no screen wrapper is found to measure
  var CARD_H_MAX   = 0.92;   // never let the card exceed this fraction of the stage height
  var CARD_PAD_BOTTOM = 42;  // px added below the measured content (breathing room under the pills)
  var HEAD_TOP     = 0.16;   // fraction of card height both wpm headings are pinned to (keeps them level)
  // ...or pin them to a fraction of the VIEWPORT instead, so they ride the screen height rather than
  // the stage's. both cards use the same number either way, so they stay level. 0 = use HEAD_TOP.
  var HEAD_TOP_VH  = 0.05;
  var MQ_TOP       = 0.48;   // fraction of card height both marquees are pinned to
  var MQ_NUDGE_KB   = 0;     // px fine-tune, kb marquee only (+ down / − up)
  var MQ_NUDGE_CARD = -35;   // px fine-tune, flow marquee only (+ down / − up)
  // the 220 wave is CENTRED in its card the whole way through. false = the old behaviour, where it
  // tracked the card's left edge during the reveal and only eased to centred over the shrink.
  var MQ_CARD_CENTER = true;
  // width of the 220 wave as a fraction of the STAGE (not the card). the svg scales by its width
  // ratio, so this shrinks the curve and its text together. anything below 1 also shrinks the svg's
  // height, which clips the text against the card during the shrink — leave at 1 unless that's fixed.
  var MQ_CARD_W    = 1;
  // how much of the viewBox width the 220 CURVE spans, centred — reshapes the path, not the svg.
  // x only, so the wave keeps its height and gets a touch steeper. 1 = the authored full-width curve.
  var MQ_PATH_W    = 0.85;
  // ...then run the text on STRAIGHT tails out from both ends of that curve, so the wave keeps its
  // shape but the line carries on level to the edges instead of ending with the curve.
  var MQ_PATH_TAILS = true;
  var MQ_PATH_OVER  = 0;     // viewBox units the tails run PAST each edge (0 = stop at the edge)
  var CARD_DIP     = 70;     // px the card sags below centre mid-ride (0 at start and landing)
  var RADIUS_FULL  = 40;     // px card radius before/at full bleed (matches the Webflow class)
  var RADIUS_END   = 16;     // px card radius after the shrink
  var CARD_GAP     = 0;      // px gap between the two cards while both are visible
  // 20% width threshold shared by both comparison cards: below it the keyboard card collapses
  // smoothly to 0 width (no thin sliver of spilling text), and the flow card's "220 wpm" only
  // shows once the card is at least this wide (so the label never spills a too-narrow card).
  var CARD_MIN_W   = 0.20;
  // kb (left) column width at reveal start, as a fraction of the stage. lower = the 45 card is
  // already further into its collapse when the section scrolls in. 1.0 = kb full-width (original)
  var SPLIT_START  = 0.28;
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
  var MQ_FLOW_FILL = true;   // flow (220) marquee starts already filled (like kb) instead of streaming in
                             // from off-screen right. false = old (empty at start, streams in on scroll)
  var MQ_AUTOPLAY  = true;   // text waves move on their OWN clock (already moving on view), not tied to
                             // scroll. false = old scroll-scrubbed motion.
  var MQ_DUR       = 30;     // seconds per loop for the FLOW curve (matches homepage <animate dur="30s">)
  var MQ_DUR_KB    = 100;    // seconds per loop for the KEYBOARD straight marquee (homepage dur="100s")

  // audio recorder: <rect> bars inside [data-anim="audio"] pulse in height on scroll (pure
  // scrub, like the marquee). each bar grows from its own centre; a per-bar phase offset
  // makes the set ripple like a live waveform.
  var AUDIO_SEL    = '[data-anim="audio"]';
  var AUDIO_MIN    = 0.24;   // shortest a bar ever gets, as a fraction of the svg viewBox height
  var AUDIO_MAX    = 0.98;   // tallest a bar can reach, as a fraction of the viewBox height
  var AUDIO_CYCLES = 8;      // base activity rate across the WHOLE pin (higher = busier)
  var AUDIO_ENV    = 0.22;   // 0 = per-bar jitter only, 1 = strong syllable bursts (loud/quiet swells)
  var AUDIO_SPEED  = 2.4;    // live clock (cycles/sec) so bars stay alive when scroll is idle. 0 = scroll-only
  var AUDIO_WAVE   = 0.72;   // 0 = jagged speech bursts, 1 = smooth traveling wave across the row
  var AUDIO_WAVE_SPAN = 1.7; // wave crests spanning the row (higher = more ripples)

  // slight lerp on the scrub: marquee + audio ease toward the scroll position instead of
  // snapping to it, so motion feels smooth and settles gently when scroll stops. 1 = no lerp
  // (instant), smaller = more trailing. morph/card position stay 1:1 with scroll (not lerped).
  var SCRUB_LERP   = 0.18;

  var GREEN_RADIUS = '80px'; // auto-tags the green panel for the corners module. '' = off
  var GREEN_RADIUS_VAR = '--_spacing---section-radius--large';
  var GREEN_RADIUS_BP = [
    { min: 768, px: 80 },
    { min: 0,   rem: 2.5 }
  ];
  var BG_SMOOTH    = 0.12;
  var BG_TRIGGER   = true;
  var BG_DRAW_MS   = 900;
  var BG_DRAW_EASE = 'cubic-bezier(.4,0,.2,1)';
  var SNAP         = true;   // snap to each tab so it lands as a stop, then autoplays
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

  function resolveRadius(el) {
    var fallback = parseFloat(GREEN_RADIUS) || 80;
    if (GREEN_RADIUS_BP && GREEN_RADIUS_BP.length) {
      var w = window.innerWidth, rootPx = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
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
    if (!raw) {
      try { raw = window.getComputedStyle(el).borderTopLeftRadius; } catch (e3) {}
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

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[flow-stack] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    // ignore the mobile address-bar show/hide (it changes viewport height during scroll). without
    // this, ScrollTrigger re-measures mid-scroll and every pinned section on the page glitches.
    if (ScrollTrigger.config) { ScrollTrigger.config({ ignoreMobileResize: true }); }

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
        // the crest transforms each word, so they need a block box. inline-block keeps the wrap
        // (whitespace between words stays a text node) but makes transform/scale apply.
        ((WAVE_MOTION || POLISH_WAVE)
          ? '.flow_w,.flow_pw{display:inline-block;vertical-align:baseline;will-change:transform;}'
          : '') +
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
        // centred "voice mode" waveform row, height locked to BAR_MAX so growing bars never resize it
        // (padding lives on the capsule below). content-box for exact math.
        '.flow_pill-dots{display:none;align-items:center;justify-content:center;box-sizing:content-box;' +
          'height:' + BAR_MAX + 'px;padding:' + DOTS_PAD_Y + 'px 0;' +
          'gap:' + BAR_GAP + 'px;pointer-events:none;position:relative;z-index:1;}' +
        // voice mode: the pill padding goes on the WRAPPER (the black fill element), so it's the space
        // between the bars and the fill edge. zero the outer capsule so its authored 12px doesn't add.
        '[data-pill="polishing"].is-in{padding:0 !important;}' +
        '[data-pill="polishing"].is-in .flow_pill-polish_wrap{padding:' + PILL_PAD_Y + 'px ' + PILL_WAVE_PAD_X + 'px !important;}' +
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
        // DOTS capsule (ch2): the is-in stage before is-wave. own dot size, gap, colour and side
        // padding so the capsule still lands at PILL_WAVE_W — the wave bars are a different size.
        '[data-pill="polishing"].is-in:not(.is-wave) .flow_pill-dots{gap:' + DOT_GAP + 'px;}' +
        '[data-pill="polishing"].is-in:not(.is-wave) .flow_pill-dot{width:' + DOT_W + 'px;height:' +
          DOT_W + 'px;background:' + DOT_COLOR + ';}' +
        '[data-pill="polishing"].is-in:not(.is-wave) .flow_pill-polish_wrap{padding:' + PILL_PAD_Y +
          'px ' + DOTS_PAD_X + 'px !important;}' +
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
        '[data-type="raw"].is-polishing{background-image:' + POLISH_GRAD_CSS + ';background-size:220% 100%;' +
          '-webkit-background-clip:text;background-clip:text;' +
          'animation:flowPolish 3.2s ease-in-out infinite alternate;}' +
        // WORD_GRAD: the container hands the paint job to the individual words (see gradPaint) —
        // a transformed word composites out of the container's clip and would render as nothing.
        '[data-type="raw"].is-polishing.is-wordgrad{background-image:none;animation:none;}' +
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
      // narrow the WAVE ITSELF, not its box: scale the curve's x coords about the viewBox centre so
      // it spans MQ_PATH_W of the width, centred. the svg keeps its width/height/aspect, so nothing
      // shifts or clips. text that runs past the (now shorter) path simply isn't drawn — which is
      // what keeps it off the green instead of overhanging the card.
      // every command here takes coordinate PAIRS (M/L/C/S/Q/T), so numbers alternate x,y. A/H/V
      // would break that assumption, so those bail out.
      function narrowPath(pathEl, vbw, k) {
        if (!pathEl || !k || k >= 1) { return; }
        var d0 = pathEl._d0 || (pathEl._d0 = pathEl.getAttribute('d') || '');
        if (!d0) { return; }
        if (/[aAhHvV]/.test(d0)) {
          console.warn('[flow-stack] MQ_PATH_W: path uses A/H/V commands — left alone', pathEl);
          return;
        }
        var cx = vbw / 2, n = -1;
        var d1 = d0.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, function (num) {
          n++;
          if (n % 2) { return num; }                                  // odd index = y, untouched
          return String(Math.round((cx + (parseFloat(num) - cx) * k) * 1000) / 1000);
        });
        // straight tails: the curve leaves both ends horizontally (its end control points share the
        // endpoint's y), so a plain L out to the edge joins seamlessly and the text just keeps
        // running level instead of stopping where the wave does.
        if (MQ_PATH_TAILS) {
          var head = /^\s*M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d1);
          var nums = d1.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
          if (head && nums && nums.length >= 2) {
            var y0 = head[2], yN = nums[nums.length - 1];
            d1 = 'M' + (-MQ_PATH_OVER) + ' ' + y0 + ' L' + head[1] + ' ' + y0 +
                 d1.slice(head[0].length) +
                 ' L' + (vbw + MQ_PATH_OVER) + ' ' + yN;
          }
        }
        pathEl.setAttribute('d', d1);
        teardown.push(function () { pathEl.setAttribute('d', d0); });
      }
      var marquees = [];
      Array.prototype.forEach.call(section.querySelectorAll('[' + FLOW + '="marquee"]'), function (wrapEl) {
        var textEl = wrapEl.querySelector('text');
        var svgEl  = wrapEl.querySelector('svg');
        if (!textEl) { return; }
        var period = Math.abs(parseFloat(textEl.getAttribute('x'))) || 4000;
        var vbw    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width)  || 928;
        var vbh    = (svgEl && svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.height) || 76;
        // kb marquee starts FILLED from the div's left edge (text spans the whole card at p=0); the
        // flow wave still streams in from off-screen right.
        var isKb   = !!(kb && kb.contains(wrapEl));
        if (!isKb) { narrowPath(wrapEl.querySelector('path'), vbw, MQ_PATH_W); }   // the 220 wave only
        var startX = (isKb || MQ_FLOW_FILL) ? 0 : (vbw + MQ_PAD);
        marquees.push({
          text: textEl, svg: svgEl, period: period, start: startX, isKb: isKb,
          vbw: vbw, vbh: vbh, len: 0,
          rand: Math.random(),                  // per-pageload loop offset: different words each visit
          mult: parseFloat(wrapEl.getAttribute('data-speed')) || 1
        });
        textEl.setAttribute('x', String(startX));              // initial paint
      });

      // marquee position = pure function of pin progress p (driven from applyScroll). Every
      // string runs off the SAME clock (p) so the two text lines stay locked together; their
      // data-speed is a PURE speed knob (higher = faster), independent of each string's period
      // — period only sets where the loop wraps below. Speed = MQ_TRAVEL × data-speed.
      var mqClock = 0;   // live time accumulator (s) for autoplay marquee motion — see MQ_AUTOPLAY
      function updateMarquees(p) {
        for (var i = 0; i < marquees.length; i++) {
          var m = marquees[i];
          if (MQ_AUTOPLAY) {
            // homepage model: sweep -loopLen -> 0 over a fixed duration; loopLen capped to text so never empty
            var dur = m.isKb ? MQ_DUR_KB : MQ_DUR;
            var frac = ((mqClock / dur) % 1 + 1) % 1;                  // 0..1 through the loop
            var loopLen = (m.len > m.vbw) ? Math.min(m.period, m.len - m.vbw) : m.period;
            m.text.setAttribute('x', String(-loopLen * (1 - frac)));
            continue;
          }
          // scroll-tied (old): pace normalised by the svg's rendered scale so it's width-independent
          var svgW  = m.svg ? m.svg.getBoundingClientRect().width : 0;
          if (svgW <= 0) { continue; }                                  // display:none / unmeasured
          var scale = svgW / m.vbw;
          var travel = -MQ_DIR * p * (MQ_TRAVEL * m.mult) / scale;      // 0 at p=0
          var x = m.start - travel;
          if (x < 0) {
            var per = m.len > 0 ? Math.min(m.period, Math.max(100, m.len - m.vbw - MQ_PAD)) : m.period;
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
            ceil: AUDIO_MIN + (AUDIO_MAX - AUDIO_MIN) * (0.82 + 0.18 * Math.random()), // per-bar max
            // two detuned frequencies + random phase per bar → bars move independently, no clean wave
            f1: 0.8 + Math.random() * 1.5, f2: 2.0 + Math.random() * 3.0,
            ph1: Math.random() * 6.2832, ph2: Math.random() * 6.2832
          });
        });
        if (DEBUG) { console.log('[flow-stack] audio bars:', audioBars.length, 'vbh', vbh); }
      }());

      var envPh1 = Math.random() * 6.2832, envPh2 = Math.random() * 6.2832;   // per-load syllable phase
      var audioClock = 0;   // live time accumulator (s), advanced each frame — see AUDIO_SPEED

      function updateAudio(p) {
        var TWO_PI = Math.PI * 2;
        var t = p * AUDIO_CYCLES + audioClock * AUDIO_SPEED;
        // global loudness envelope: two beat frequencies multiply → uneven bursts and near-silent
        // gaps, the way speech has loud syllables and pauses (not a steady hum)
        var e = (0.5 + 0.5 * Math.sin(t * TWO_PI * 0.9 + envPh1)) *
                (0.5 + 0.5 * Math.sin(t * TWO_PI * 2.3 + envPh2));               // 0..1, spends time low
        var n = audioBars.length;
        for (var i = 0; i < n; i++) {
          var b = audioBars[i];
          // jagged speech model: detuned sines, unique phase, loud/quiet envelope
          var v = 0.55 * Math.sin(t * TWO_PI * b.f1 + b.ph1) +
                  0.45 * Math.sin(t * TWO_PI * b.f2 + b.ph2);
          var sJag = (0.5 + 0.5 * v) * (AUDIO_ENV * e + (1 - AUDIO_ENV));
          // smooth traveling wave: phase follows bar position, so crests glide across the row
          var xi = n > 1 ? i / (n - 1) : 0.5;
          var wave = 0.6 * Math.sin((xi * AUDIO_WAVE_SPAN - t) * TWO_PI) +
                     0.4 * Math.sin((xi * AUDIO_WAVE_SPAN * 0.5 - t * 0.6) * TWO_PI + 1.7);
          var sWav = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));  // gentle centre lift
          var s = AUDIO_WAVE * sWav + (1 - AUDIO_WAVE) * sJag;
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
        // stacked, opacity is the only thing that shows/hides them (JS drives the crossfade).
        im.style.setProperty('display', 'block', 'important');
        im.style.setProperty('visibility', 'visible', 'important');
        im.style.position = 'absolute';
        im.style.top = '0'; im.style.left = '0';
        im.style.width = '100%'; im.style.height = '100%';
        im.style.objectFit = 'cover';
        im.style.zIndex = '0';                            // behind the card content (screen/composer)
        im.style.pointerEvents = 'none';
        im.style.opacity = k === 0 ? '1' : '0';           // start on the wpm image
      });

      // bg layer: holds the chapter images + the melt canvas, below the card content
      var bgWrap = null;
      if (bgImgs.length) {
        bgWrap = card.querySelector('.flow-bg-layer');
        if (!bgWrap) {
          bgWrap = document.createElement('div');
          bgWrap.className = 'flow-bg-layer';
          card.insertBefore(bgWrap, card.firstChild);
        }
        bgWrap.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:inherit;' +
          'z-index:0;pointer-events:none;';
        bgImgs.forEach(function (im) { bgWrap.appendChild(im); });
      }

      // ---- WebGL melt: a canvas overlays the card ONLY during a bg swap and runs a texture-clamped
      // displacement crossfade between the two chapter images (codrops technique, self-contained — no
      // three.js). texture clamp = no edge gaps; smooth dual-image mix (not a hard swap) = matches the
      // demo; GPU = no jank. the <img>s stay for the idle state + the grow reveal; the canvas only
      // appears mid-swap. if WebGL/CORS is unavailable it silently falls back to a plain crossfade.
      var meltGL = null;
      (function initMeltGL() {
        if (!bgWrap || bgImgs.length < 2 || MELT_INTENSITY <= 0) { return; }
        var canvas = document.createElement('canvas');
        canvas.className = 'flow-melt-canvas';
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:1;';
        bgWrap.appendChild(canvas);
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
          ' vec2 uF=clamp(vUv+vec2(amt*uDisp,0.0),0.,1.)*uCoverFrom.xy+uCoverFrom.zw;',       // X only = horizontal',
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
        var meta = bgImgs.map(function (im) {
          var m = { tex: mkTex(), w: 1, h: 1, ready: false };
          var ld = new Image(); ld.crossOrigin = 'anonymous';
          ld.onload = function () {
            try {
              gl.bindTexture(gl.TEXTURE_2D, m.tex);
              gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ld);
              m.w = ld.naturalWidth || 1; m.h = ld.naturalHeight || 1; m.ready = true;
            } catch (e) { console.warn('[melt] texture upload failed (CORS?) — plain crossfade fallback', e); }
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

      var bgShown = 0, bgMeltTween = null;
      function setBgChapter(idx) {                          // recording+ch1 -> 0, ch2 -> 1, ch3 -> 2
        if (bgImgs.length < 2) { return; }
        var want = idx < 1 ? 0 : Math.min(idx, bgImgs.length - 1);
        if (want === bgShown) { return; }
        var prev = bgShown;
        bgShown = want;
        if (bgMeltTween) { bgMeltTween.kill(); bgMeltTween = null; }
        if (meltGL && meltGL.ready(prev, want)) {
          meltGL.render(prev, want, 0);                    // paint the "from" frame before showing (no flash)
          meltGL.show(true);
          bgImgs[prev].style.opacity = '0'; bgImgs[want].style.opacity = '0';
          var proxy = { p: 0 };
          bgMeltTween = gsap.to(proxy, {
            p: 1, duration: BG_FADE_MS / 1000, ease: 'power1.inOut',
            onUpdate: function () { meltGL.render(prev, want, proxy.p); },
            onComplete: function () {
              bgImgs[want].style.opacity = '1';             // settle onto the real img
              meltGL.show(false);
              for (var b = 0; b < bgImgs.length; b++) { if (b !== want) { bgImgs[b].style.opacity = '0'; } }
              bgMeltTween = null;
            }
          });
        } else {                                            // no GL / textures not ready / CORS → crossfade
          for (var b = 0; b < bgImgs.length; b++) { bgImgs[b].style.opacity = b === want ? '1' : '0'; }
        }
      }
      teardown.push(function () { if (bgMeltTween) { bgMeltTween.kill(); } });
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
        if (!isDesktop) {
          for (var hm = 0; hm < headEls.length; hm++) { headEls[hm].style.top = ''; }
          return;
        }
        // viewport-relative when HEAD_TOP_VH is set: the stage can stay tall while the screen gets
        // short, which is when these ended up sitting low with a stage-derived offset.
        var headPx = (HEAD_TOP_VH ? (window.innerHeight * HEAD_TOP_VH) : (HEAD_TOP * stageH)) + 'px';
        for (var hi = 0; hi < headEls.length; hi++) { headEls[hi].style.top = headPx; }
        var mqBase = MQ_TOP * stageH;
        if (kbMq)   { kbMq.style.top   = (mqBase + MQ_NUDGE_KB)   + 'px'; }
        if (cardMq) { cardMq.style.top = (mqBase + MQ_NUDGE_CARD) + 'px'; }
      }

      var stageW = 0, stageH = 0, padL = 0, padT = 0, cardHpx = CARD_H_FALLBACK, msgCollapsedH = 0, msgExpandedH = 0, msgContainBaseH = 0, transcriptH = 0;
      var heightsOK = false, heightsRetryT = 0;   // message-box heights measured to something real
      var cardMqW = 0;   // the 220 wave's own width (see MQ_CARD_W) — the kb marquee stays stage-wide
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
        cardMqW = stageW * MQ_CARD_W;
        if (kbMq)   { kbMq.style.width   = stageW + 'px'; }
        if (cardMq) { cardMq.style.width = cardMqW + 'px'; }
        // size each svg to its viewBox aspect at the stage width: scale is then exactly the
        // width ratio (no meet/slice bands), so text always spans the full width. also
        // re-measure text lengths (webfonts change them) for the loop clamp below.
        for (var mi = 0; mi < marquees.length; mi++) {
          var mm = marquees[mi];
          if (mm.svg) {
            var mw = mm.isKb ? stageW : cardMqW;
            mm.svg.style.width    = mw + 'px';
            mm.svg.style.height   = (mw * mm.vbh / mm.vbw) + 'px';
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
            // a measurement taken before layout (hidden wrapper, mid-transition, a frame too early)
            // comes back 0 — and every height write below would then pin the box to 0px with
            // overflow:hidden, i.e. the message UI silently disappears. Only trust a real number.
            heightsOK = msgCollapsedH > 0;
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
          var Lp = stageW * SPLIT_START * (1 - snapEnds(gt));   // width of the left (kb) column
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
          var ca = MQ_CARD_CENTER ? 1 : phaseT(p, pBh, pC);
          cardMq.style.left = (ca * (cardW - cardMqW) / 2) + 'px';   // centre the wave's OWN width
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
      if (canLeave && (GREEN_RADIUS || (GREEN_RADIUS_BP && GREEN_RADIUS_BP.length))) {
        var setGreenRadius = function () {
          var v = String(resolveRadius(greenPanel));
          if (greenPanel.getAttribute('data-corners') !== v) {
            greenPanel.setAttribute('data-corners', v);
            if (DEBUG) { console.log('[flow-stack] green radius ' + v + 'px at ' + window.innerWidth + 'px'); }
          }
        };
        setGreenRadius();
        window.addEventListener('resize', setGreenRadius);
        teardown.push(function () { window.removeEventListener('resize', setGreenRadius); });
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
      var autoTp = 0, autoPlaying = false, autoDur = 2000, autoDone = {}, sceneLastP = 0;
      var loopWaitT = 0;   // ticker time at which a looping tab restarts (see LOOP_GAP_MS)
      function tabLoops(n) {
        return AUTOPLAY_LOOP || (n >= 0 && AUTOPLAY_LOOP_TABS.indexOf(n) !== -1);
      }
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
      // extras are hidden (display:none, so no flex gap widens the pill) until they scale out to
      // PILL_ICON_SIZE on the handoff
      pillExtras.forEach(function (el) {
        guardStyle(el);
        el.style.flex = '0 0 auto';
        el.style.overflow = 'hidden';
        el.style.opacity = '0';
        el.style.width = '0px';
        el.style.height = '0px';
        el.style.display = 'none';
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
      var fanWasShown = false, fanPlacedAt = 0;   // re-place on re-entry / if the frame resized
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
      destLogos.forEach(function (el) {
        guardStyle(el); el.style.transformOrigin = '50% 50%'; el.style.opacity = '0';
        var lk = (el.getAttribute('data-dest') || '').trim().toLowerCase();
        if (LOGO_SIZE[lk]) { el.style.width = LOGO_SIZE[lk] + 'px'; el.style.height = 'auto'; }
      });
      // place the absolute cards over the live note; each card's lift centres its OWN box in the
      // frame (regardless of height → no downward drift).
      // placed by RECT, not offsetTop: the extra cards live in fanLayer (which this script makes
      // absolute), so they don't share the composer's offsetParent — feeding them the composer's
      // offsetTop dropped them below it. measuring both against the screen removes the guesswork.
      // the fan cards carry their own msg-grow with no polished text in it, so nothing ever tightened
      // them on desktop — the box kept its authored height and left dead space under the message.
      // mobile already does this via mobileFitBox; same idea, own trim. width is untouched.
      // the authored copies pad their message out with trailing <br>s, which is the dead space under
      // the text. strip them (restored on teardown) — nothing else reads them.
      function stripTrailingBr(root) {
        if (!FAN_STRIP_BR || !root) { return; }
        var hosts = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
        hosts.forEach(function (h) {
          var n = h.lastChild, removed = [];
          while (n) {
            var prev = n.previousSibling;
            if (n.nodeType === 3 && !(n.nodeValue || '').trim()) { removed.push(n); }
            else if (n.nodeType === 1 && n.tagName === 'BR')     { removed.push(n); }
            else { break; }
            n = prev;
          }
          if (!removed.length) { return; }
          removed.forEach(function (node) { h.removeChild(node); });
          teardown.push(function () {
            for (var i = removed.length - 1; i >= 0; i--) { h.appendChild(removed[i]); }
          });
        });
      }

      function fitFanBox(el) {
        if (!el) { return; }
        stripTrailingBr(el);
        if (!FAN_FIT_BOX) { return; }
        var mg = el.querySelector('[' + FLOW + '="msg-grow"]');
        if (!mg) { return; }
        var sv = mg.style.cssText;
        mg.style.height = 'auto'; mg.style.maxHeight = 'none'; mg.style.overflow = 'visible';
        var bottom = mobileTextBottom(mg);
        var fit = bottom ? Math.round(bottom - mg.getBoundingClientRect().top +
          (parseFloat(window.getComputedStyle(mg).paddingBottom) || 0)) : null;
        mg.style.cssText = sv;
        if (fit && fit > 0) {
          guardStyle(mg);
          mg.style.height = Math.max(0, fit + FAN_BOX_PAD) + 'px';
          mg.style.overflow = 'hidden';
        }
      }

      // returns false when the geometry isn't trustworthy yet, so the caller can retry instead of
      // latching a bad placement for the rest of the session
      function positionFanCards() {
        if (!composerEl) { return false; }
        var scr = screenEl || composerEl.offsetParent;
        var sr  = scr ? scr.getBoundingClientRect() : { top: 0, left: 0, height: 0 };
        var cr  = composerEl.getBoundingClientRect();
        var scH = sr.height || (scr ? scr.clientHeight : 0);
        // mid-shrink, hidden panel, or a frame before layout — measuring here parks the cards
        // somewhere arbitrary and they never come back
        if (!scH || !cr.width || !cr.height) { return false; }
        // slack: centre by TEXT height only (SLACK_PAD grows the box DOWN, doesn't lift it)
        composerEl._fanCY = Math.round(scH / 2 - ((cr.top - sr.top) + cr.height / 2));
        for (var i = 0; i < destExtra.length; i++) {
          var el = destExtra[i];
          var prevT = el.style.transform;
          el.style.transform = 'none';                 // measure the untransformed box
          el.style.width = cr.width + 'px';
          fitFanBox(el);                               // clamp the box to its text BEFORE measuring
          var er   = el.getBoundingClientRect();
          var curT = parseFloat(el.style.top)  || 0;
          var curL = parseFloat(el.style.left) || 0;
          el.style.top  = (curT + (cr.top  - er.top))  + 'px';   // nudge onto the composer, whatever the anchor
          el.style.left = (curL + (cr.left - er.left)) + 'px';
          // centre the box you can SEE. measured after the nudge, so it accounts for the visible box
          // sitting at an offset inside its wrapper.
          el.style.transform = prevT;
          var bx = (FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el;
          var br = bx.getBoundingClientRect();
          fanMeasure(el, sr, scH);        // the box can still settle taller — watchFanBox re-derives
          watchFanBox(el, bx);
          if (DEBUG) {
            console.log('[fan] ' + (el.getAttribute('data-dest') || '?') +
              ' wrapper=' + Math.round(er.height) + 'h box=' + Math.round(br.height) + 'h' +
              ' boxTopInScreen=' + Math.round(br.top - sr.top) +
              ' centreTarget=' + Math.round(scH / 2) + ' cy=' + el._fanCY +
              ' boxIsWrapper=' + (bx === el));
          }
        }
        if (DEBUG) {
          console.log('[fan] screen=' + Math.round(sr.height) + 'h (' + (screenEl ? 'screenEl' : 'offsetParent') +
            ') composer=' + Math.round(cr.height) + 'h topInScreen=' + Math.round(cr.top - sr.top) +
            ' cy=' + composerEl._fanCY);
        }
        placeLogoRow();
        fanPlacedAt = sr.height;                    // what the placement was measured against
        // live probe: what the boxes ACTUALLY occupy on screen right now, transforms and all.
        // run window.fanBoxes() from the console while parked on a card.
        if (DEBUG) {
          // live dial: fanNudge(-12) etc. re-derives the lift from the CURRENT box height and
          // repaints, so the offset can be eyeballed instead of guessed. report the number that lands.
          window.fanNudge = function (px) {
            FAN_CARD_NUDGE = px;
            var s = fanFrame(); if (!s) { return; }
            for (var i = 0; i < destExtra.length; i++) { fanMeasure(destExtra[i], s, s.height); }
            fanRender(fanFCur, fanLiftCur, fanShownState);
            console.log('[fan] FAN_CARD_NUDGE = ' + px + 'px (same baseline as page load)');
          };
          window.fanBoxes = function () {
            var s = (screenEl || composerEl.offsetParent).getBoundingClientRect();
            [composerEl].concat(destExtra).forEach(function (el) {
              var b = ((FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el).getBoundingClientRect();
              console.log('[fanBox] ' + (el.getAttribute('data-dest') || 'slack') +
                ' top=' + Math.round(b.top - s.top) + ' bottom=' + Math.round(s.bottom - b.bottom) +
                ' h=' + Math.round(b.height) + ' centre=' + Math.round(b.top - s.top + b.height / 2) +
                ' (frame centre ' + Math.round(s.height / 2) + ')' +
                ' cy=' + el._fanCY + ' transform=' + (el.style.transform || 'none'));
            });
          };
        }
        return true;
      }
      // the lift is measured once, lazily — but the box it's measured from can still change height
      // (font swap, late layout). watch it and re-derive the lift from the cached frame geometry, so
      // a card that settles taller re-centres instead of sitting low.
      // ONE baseline for the lift, used by every path (first placement, resize, live dial). the card
      // carries a transform while parked, so it's neutralised before measuring — otherwise the same
      // formula lands somewhere different depending on when it runs.
      function fanFrame() {
        var scr = screenEl || (composerEl && composerEl.offsetParent);
        return scr ? scr.getBoundingClientRect() : null;
      }
      function fanMeasure(el, sr, scH) {
        var prev = el.style.transform;
        el.style.transform = 'none';
        var bx = (FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el;
        var b  = bx.getBoundingClientRect();
        el._fanBoxTop = b.top - sr.top;
        el._fanBoxH   = b.height;      // needed to re-centre after FAN_CARD_SCALE (pivot is the bottom)
        el._fanScH    = scH;
        el._fanCY     = Math.round(scH / 2 - (el._fanBoxTop + b.height / 2)) + FAN_CARD_NUDGE;
        el.style.transform = prev;
        return el._fanCY;
      }
      var fanRO = null;
      function watchFanBox(card3, box) {
        if (typeof ResizeObserver !== 'function' || box._fanWatched) { return; }
        box._fanWatched = true;
        box._fanOwner = card3;
        if (!fanRO) {
          fanRO = new ResizeObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
              var b = entries[i].target, owner = b._fanOwner;
              if (!owner || owner._fanScH == null) { continue; }
              var sr = fanFrame(); if (!sr) { continue; }
              var was = owner._fanCY;
              var next = fanMeasure(owner, sr, sr.height || owner._fanScH);   // same baseline as everywhere
              if (next !== was) {
                if (DEBUG) {
                  console.log('[fan] ' + (owner.getAttribute('data-dest') || '?') +
                    ' box settled — cy ' + was + ' → ' + next);
                }
                fanRender(fanFCur, fanLiftCur, fanShownState);   // repaint at the corrected lift
              }
            }
          });
          teardown.push(function () { fanRO.disconnect(); fanRO = null; });
        }
        fanRO.observe(box);
      }
      // logo row sits LOGO_TOP px below the card's top edge. measured and corrected rather than set,
      // so the card's own padding doesn't add on top of it.
      function placeLogoRow() {
        if (!destWrap || !LOGO_TOP || !card) { return; }
        var cr = card.getBoundingClientRect(), wr = destWrap.getBoundingClientRect();
        if (!cr.height || !wr.height) { return; }
        var m = parseFloat(window.getComputedStyle(destWrap).marginTop) || 0;
        destWrap.style.marginTop = (m + (LOGO_TOP - (wr.top - cr.top))) + 'px';
      }
      var pillEls      = Array.prototype.slice.call(section.querySelectorAll('[data-pill]'));
      var pillMap = {};
      // the mobile blocks sit INSIDE the section and hold duplicated cards with the same data-pill keys.
      // pillMap must never bind one: last-in-DOM would win, and on desktop the mobile wrap is
      // display:none, so the desktop pill silently never lights up. Char-wrapping still runs on every
      // pill so the clones keep their label ripple.
      var mobRoot = section.querySelector(MOBILE_SEL);
      pillEls.forEach(function (el) {
        guardStyle(el);
        var key = (el.getAttribute('data-pill') || '').trim().toLowerCase();
        if (key && !(mobRoot && mobRoot.contains(el))) { pillMap[key] = el; }
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

      // collapse the pill row onto one anchor (see PILL_ANCHOR). only parents whose element children
      // are ALL pills get converted — anything else in there would get stacked on top of them.
      if (PILL_ANCHOR && pillEls.length) {
        var pillParents = [];
        pillEls.forEach(function (el) {
          var pp = el.parentNode;
          if (pp && pp.nodeType === 1 && pillParents.indexOf(pp) < 0) { pillParents.push(pp); }
        });
        var anchored = 0;
        pillParents.forEach(function (pp) {
          var kids = Array.prototype.filter.call(pp.childNodes, function (k) { return k.nodeType === 1; });
          var mine = kids.filter(function (k) { return k.hasAttribute('data-pill'); });
          if (mine.length < 2) { return; }
          if (mine.length !== kids.length) {
            if (DEBUG) { console.warn('[flow-stack] pill anchor skipped — parent holds non-pill children', pp); }
            return;
          }
          guardStyle(pp);
          // a flex column's align-items is the horizontal axis; in grid that's justify-items
          var ai = window.getComputedStyle(pp).alignItems;
          pp.style.display = 'grid';
          pp.style.gridTemplateColumns = 'auto';
          pp.style.gridTemplateRows    = 'auto';
          pp.style.justifyItems = (ai === 'center') ? 'center'
            : ((ai === 'end' || ai === 'flex-end') ? 'end' : 'start');
          pp.style.alignItems = 'center';
          pp.style.gap = '0px';
          mine.forEach(function (k) { guardStyle(k); k.style.gridArea = '1 / 1'; });
          anchored++;
        });
        if (DEBUG) {
          console.log('[flow-stack] pill anchor: ' + anchored + '/' + pillParents.length +
            ' parent(s) stacked, pills=' + pillEls.length);
        }
      }

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
      if (!polishPill && isDesktop) {
        console.warn('[flow-stack] no [data-pill="polishing"] in the DESKTOP card (mobile clones do not count)');
      }
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
      // voice-mode bars run a live wavy loop (same clock as the recorder) once they've grown out —
      // set heights inline per frame with transitions off so it isn't laggy. see voiceTick.
      var voiceDots = polishPill ? Array.prototype.slice.call(polishPill.querySelectorAll('.flow_pill-dot')) : [];
      var voiceLive = false;
      function setVoiceLive(on) {
        voiceLive = on;
        for (var vd = 0; vd < voiceDots.length; vd++) {
          if (on) { voiceDots[vd].style.transition = 'none'; }
          else { voiceDots[vd].style.transition = ''; voiceDots[vd].style.height = ''; }
        }
      }
      // chapter-3 pill choreography: STAGE1 is-done (spinner+label out, ring draws) → STAGE2 is-in
      // (row grows bouncy + bullets wave in) → STAGE3 is-wave (bars grow to audio heights).
      // leaving ch3 drops all three so it replays from scratch next time.
      var pillDoneOn = false, pillWave = false, pillCalls = [], pillOffCall = null, voiceLatched = false;
      function killPillCalls() { for (var c = 0; c < pillCalls.length; c++) { pillCalls[c].kill(); } pillCalls = []; }
      // wave=false stops at the DOTS capsule (stage 2) — that's the ch2 state, reached as the text
      // waves out. wave=true carries on into the ch3 voice waveform.
      function pillStageIn() {
        if (!polishPill || polishPill.classList.contains('is-in')) { return; }
        polishPill.classList.add('is-in');
        var row = polishPill.querySelector('.flow_pill-dots');
        if (row) {
          row.style.transition = 'none';
          row.style.height = '0px';
          void row.offsetHeight;
          row.style.transition = 'height .5s cubic-bezier(.34,1.56,.64,1)';
          row.style.height = BAR_MAX + 'px';
        }
      }
      function setPillDone(on, wave) {
        if (!polishPill) { return; }
        wave = !!wave;
        if (on) {
          if (pillOffCall) { pillOffCall.kill(); pillOffCall = null; }   // a brief dip below ch3 — cancel the exit
          if (pillDoneOn && pillWave === wave) { return; }
          if (pillDoneOn && wave && !pillWave) {                         // dots → waveform, no restart
            pillWave = true;
            killPillCalls();
            pillStageIn();
            polishPill.classList.add('is-wave');
            pillCalls.push(gsap.delayedCall(0.5, function () { setVoiceLive(true); }));
            return;
          }
          if (pillDoneOn && !wave && pillWave) {                         // scrubbed back into ch2
            pillWave = false;
            killPillCalls();
            setVoiceLive(false);
            polishPill.classList.remove('is-wave');
            return;
          }
          pillDoneOn = true; pillWave = wave;
          killPillCalls();
          polishPill.classList.add('is-done');                                   // stage 1
          pillCalls.push(gsap.delayedCall(PILL_OUT_MS / 1000, pillStageIn));
          if (wave) {
            pillCalls.push(gsap.delayedCall((PILL_OUT_MS + BULLET_MS) / 1000, function () {
              polishPill.classList.add('is-wave');                               // stage 3: grow out
            }));
            pillCalls.push(gsap.delayedCall((PILL_OUT_MS + BULLET_MS + 500) / 1000, function () {
              setVoiceLive(true);                                                // stage 4: live wavy loop
            }));
          }
        } else {
          if (!pillDoneOn || pillOffCall) { return; }
          // debounce the exit: only leave voice mode if we STAY below ch3 — a one-frame scrub dip at
          // the ch2/ch3 boundary must not tear down + re-draw the white ring (that was the "twice").
          pillOffCall = gsap.delayedCall(0.2, function () {
            pillOffCall = null; pillDoneOn = false; pillWave = false; killPillCalls();
            setVoiceLive(false);
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

      // per-word diagonal phase (0..1) for the polish wavefront: dominated by vertical position
      // (line-by-line) with a horizontal tilt (GLOW_DIAG) so the sweep runs diagonally across the
      // block. measured lazily once the card has landed (real wrap), re-measured on refresh.
      var diagMeasured = false;
      // per-word gradient state: offsets are layout-dependent, so they re-measure whenever the diag does
      var wordEls = [], gradW = 0, gradReady = false;
      function measureWordDiag() {
        if (!transcriptEl || !words.length) { return; }
        var base = transcriptEl.getBoundingClientRect();
        var W = base.width || 1, H = base.height || 1, i, r, v, mn = Infinity, mx = -Infinity;
        for (i = 0; i < words.length; i++) {
          r = words[i].el.getBoundingClientRect();
          v = ((r.top + r.height / 2 - base.top) / H) + ((r.left + r.width / 2 - base.left) / W) * GLOW_DIAG;
          words[i]._v = v;
          if (v < mn) { mn = v; }
          if (v > mx) { mx = v; }
        }
        var span = (mx - mn) || 1;
        for (i = 0; i < words.length; i++) { words[i].diag = (words[i]._v - mn) / span; }
      }

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
      var msgPadL = 0, msgPadR = 0, msgBorderL = '', msgBorderR = '', msgBorderT = '';
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
          msgPadL = (parseFloat(ccs.paddingLeft) || 0) + (parseFloat(ccs.borderLeftWidth) || 0);
          msgPadR = (parseFloat(ccs.paddingRight) || 0) + (parseFloat(ccs.borderRightWidth) || 0);
          if ((parseFloat(ccs.borderLeftWidth) || 0) > 0 && ccs.borderLeftStyle !== 'none') {
            msgBorderL = ccs.borderLeftWidth + ' ' + ccs.borderLeftStyle + ' ' + ccs.borderLeftColor;
            msgBorderR = ccs.borderRightWidth + ' ' + ccs.borderRightStyle + ' ' + ccs.borderRightColor;
            msgBorderT = ccs.borderTopWidth + ' ' + ccs.borderTopStyle + ' ' + ccs.borderTopColor;
          }
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
      function paintBg(n) {
        var N = bgSvgs.length; if (!N) { return; }
        for (var i = 0; i < N; i++) {
          var on = (i === n);
          Array.prototype.forEach.call(bgSvgs[i].querySelectorAll('path'), function (p) {
            p.style.transition = 'stroke-dashoffset ' + BG_DRAW_MS + 'ms ' + BG_DRAW_EASE;
            p.style.strokeDashoffset = on ? '0' : String(p._len);
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
        if (BG_TRIGGER) { paintBg(n); }
        startAutoplay(n);
      }
      // in-card autoplay: on tab entry, tween tp 0->1 once (advanced by autoTick); sceneUpdate reads
      // autoTp for the active tab instead of the scroll-derived tp.
      function startAutoplay(n) {
        if (!AUTOPLAY || !isDesktop || n < 0) { autoPlaying = false; return; }
        autoDur = AUTOPLAY_MS[n] || 2000;
        loopWaitT = 0;                                  // a fresh entry never inherits a pending loop hold
        if (tabLoops(n)) { autoDone[n] = false; }        // a looping tab is never "done"
        if (!AUTOPLAY_REPLAY && autoDone[n]) { autoTp = 1; autoPlaying = false; }
        else { autoTp = 0; autoPlaying = true; }
        sceneUpdate(sceneLastP);   // set targets to the fresh frame…
        snapEased();               // …and settle the eased curs onto them (no backward wipe on replay)
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
      var snapPoints = [], tabStops = [], tabCentres = [];   // tabStops: p-boundaries [pHold, end0, end1, …, 1]
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
        tabCentres = [];
        for (var tc = 0; tc < numTabs; tc++) { tabCentres.push((tabStops[tc] + tabStops[tc + 1]) / 2); }
        snapPoints = tabCentres.concat([1]);   // each tab, then release. intro (< pHold) is free-scrub
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
        for (var i = 0; i < words.length; i++) {
          words[i].el.style.color = ''; words[i].el.style.textShadow = ''; words[i].el.style.transform = '';
        }
        polishColored = false;
      }

      // chapter-3 fan: card 0 = live note (slack), then authored copies. tp scrubs which is centred;
      // offset-from-centre → rotate+translate about the pivot = arc. live note resets to normal when OFF.
      // fan smoothing state: fanUpdate sets TARGETS from scroll; fanTick eases the rendered
      // values (fanFCur/fanLiftCur) toward them and calls fanRender — so the fan glides + settles
      // on each beat instead of tracking raw scroll. fanShow flips draw on/off (ch3 only).
      var fanFCur = 0, fanFTgt = 0, fanLiftCur = 1, fanLiftTgt = 1, fanShow = false, fanShownState = null, fanN = 0;
      var fanAlpha = 1;   // whole-fan opacity multiplier — the fade-in at the top of each pass

      function fanUpdate(tp, show) {                 // set targets from the scrubbed tp (no render)
        var live = composerEl;
        var n = (live ? 1 : 0) + destExtra.length;
        fanN = n; fanShow = show;
        if (n < 2) { return; }                       // render handled in fanTick / fanRender
        if (fanLayer) { fanLayer.style.opacity = show ? '1' : '0'; }
        // re-check the placement every time chapter 3 is entered, and whenever the frame it was
        // measured against has changed height. the old code latched after ONE attempt, so a first
        // entry caught mid-shrink (or with the panel still hidden) left the cards parked off-screen
        // for good — which is what a lot of fast scrolling up and down tends to produce.
        if (show && !fanWasShown) { fanPositioned = false; }
        fanWasShown = show;
        if (show && fanPositioned && screenEl) {
          var nowH = screenEl.getBoundingClientRect().height;
          if (nowH && fanPlacedAt && Math.abs(nowH - fanPlacedAt) > 1) { fanPositioned = false; }
        }
        // retry until the geometry is real — positionFanCards reports whether it could trust it
        if (show && !fanPositioned) { fanPositioned = positionFanCards(); }
        // two scrubbed phases: LIFT the note to centre (no jump from ch2), then SWING the cards through
        fanLiftTgt = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);
        var swingTp = FAN_LIFT_END < 1 ? Math.max(0, (tp - FAN_LIFT_END) / (1 - FAN_LIFT_END)) : 0;
        if (FAN_EXIT > 0 && swingTp > FAN_EXIT_AT) {
          // tail: carry on past the last beat so the final card swings out the way the others did,
          // leaving an empty stage to restart from instead of cutting on a parked card
          var ex = (swingTp - FAN_EXIT_AT) / (1 - FAN_EXIT_AT);
          fanFTgt = (n - 1) + FAN_EXIT * smooth(ex < 0 ? 0 : (ex > 1 ? 1 : ex));
        } else {
          var mainT = FAN_EXIT > 0 && FAN_EXIT_AT > 0 ? Math.min(1, swingTp / FAN_EXIT_AT) : swingTp;
          fanFTgt = fanStep(mainT, n);   // parked beats at each card, fast swing between (see FAN_HOLD)
        }
        // and fade the whole fan back in at the top of each pass, so the restart reads as a beginning
        fanAlpha = FAN_IN_T > 0 ? smooth(Math.min(1, tp / FAN_IN_T)) : 1;
      }

      // render the fan at an explicit eased position (f = which card is centred, liftT = note lift)
      function fanRender(f, liftT, show) {
        var live = composerEl;
        var n = fanN;
        if (n < 2) { if (live && !show) { live.style.transform = ''; live.style.transformOrigin = ''; } return; }
        function place(el, i, isLive) {
          var rel = i - f, ar = Math.abs(rel);
          if (!show) {
            if (isLive) {
              el.style.transform = ''; el.style.transformOrigin = '';
              el.style.opacity = ''; el.style.zIndex = '';
            } else { el.style.opacity = '0'; }
            return;
          }
          var op = (1 - Math.max(0, Math.min(1, (ar - 1) / FAN_FADE))) * fanAlpha;
          var sc = FAN_CARD_SCALE * (1 - (1 - FAN_SCALE) * Math.min(1, ar));
          // the pivot is the card's BOTTOM, so scaling drops its centre by half the height lost —
          // take that back out or the smaller cards sit low
          var cy = ((el._fanCY || 0) + FAN_CENTER_NUDGE) * liftT - (1 - sc) * (el._fanBoxH || 0) / 2;
          el.style.transformOrigin = FAN_PIVOT;
          el.style.transform = 'translate(' + (FAN_TX * rel) + 'px,' + cy + 'px) rotate(' + (FAN_ANGLE * rel) +
            'deg) scale(' + sc + ')';
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
          destLogos[g].style.opacity   = String(Math.max(0, 1 - lar / LOGO_FADE) * fanAlpha);
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

      // ---- per-word gradient paint (see WORD_GRAD) ----
      // each word gets the same gradient image, sized to the whole block and shifted back by the
      // word's own offset, so the ramp is continuous across words. the shimmer that used to be a CSS
      // keyframe on the container is now a per-frame background-position slide (we already render
      // every frame here, and keyframes can't take a per-word offset).
      function gradMeasure(list, container) {
        if (!container || !list.length) { return 0; }
        var cr = container.getBoundingClientRect();
        for (var i = 0; i < list.length; i++) {
          list[i]._gx = list[i].getBoundingClientRect().left - cr.left;
        }
        return cr.width || 1;
      }
      function gradPaint(list) {
        for (var i = 0; i < list.length; i++) {
          var s = list[i].style;
          s.backgroundImage  = POLISH_GRAD_CSS;
          s.backgroundRepeat = 'no-repeat';
          s.setProperty('-webkit-background-clip', 'text');
          s.backgroundClip = 'text';
        }
      }
      function gradShift(list, w) {
        if (!w || !list.length) { return; }
        var span  = w * GRAD_SPAN;
        var t     = (gsap.ticker.time * 1000 / GRAD_SHIFT_MS) % 2;      // 0..2, folded = ping-pong
        var slide = (t > 1 ? 2 - t : t) * (span - w);                   // matches the old alternate keyframe
        var sz    = span.toFixed(1) + 'px 100%';
        for (var i = 0; i < list.length; i++) {
          list[i].style.backgroundSize = sz;
          list[i].style.backgroundPosition = (-(list[i]._gx || 0) - slide).toFixed(1) + 'px 0';
        }
      }

      // crest riding the wavefront: 0 at rest, 1 at the peak, back to 0 once the front has passed.
      // front and ph are both in sweep space, so the same call drives raw words and polished words.
      function setMsgBleed(on) {
        if (!msgGrowEl || !MSG_BLEED) { return; }
        var l = (MSG_BLEED_X >= 0) ? MSG_BLEED_X : msgPadL;
        var r = (MSG_BLEED_X >= 0) ? MSG_BLEED_X : msgPadR;
        msgGrowEl.style.marginLeft  = on ? (-l) + 'px' : '';
        msgGrowEl.style.marginRight = on ? (-r) + 'px' : '';
        if (MSG_BORDER && msgBorderL) {
          msgGrowEl.style.boxSizing   = on ? 'border-box' : '';
          msgGrowEl.style.borderLeft  = on ? msgBorderL : '';
          msgGrowEl.style.borderRight = on ? msgBorderR : '';
          msgGrowEl.style.borderTop   = on ? msgBorderT : '';
        }
      }
      function outPow(t) {
        if (!(BOX_OUT_POW > 1)) { return smooth(t); }
        var c = t < 0 ? 0 : (t > 1 ? 1 : t);
        return 1 - Math.pow(1 - c, BOX_OUT_POW);
      }
      function crestAt(front, ph) {
        var d = front - ph;
        if (d <= 0 || d >= WAVE_BAND) { return 0; }
        return Math.sin(Math.PI * (d / WAVE_BAND));
      }
      function crestCSS(w, extraY) {
        var y = (extraY || 0) - WAVE_AMP * w;
        var t = '';
        if (y) { t += 'translateY(' + y.toFixed(2) + 'px)'; }
        if (WAVE_SCALE && w) { t += ' scale(' + (1 + WAVE_SCALE * w).toFixed(4) + ')'; }
        if (WAVE_ROT && w)   { t += ' rotate(' + (WAVE_ROT * w).toFixed(2) + 'deg)'; }
        return t;
      }
      // the raw-out dissolve runs down the SAME diagonal the gradient travelled. 180deg = straight
      // down; tilting toward 135deg (down-right) by GLOW_DIAG matches the wavefront's own tilt.
      var RAW_OUT_ANGLE = (180 - 45 * GLOW_DIAG).toFixed(1) + 'deg';
      function rawOutMask(wipe) {
        if (!RAW_OUT_WAVE) {                                   // legacy bottom→top wipe
          var soft = 16, stop = wipe * (100 + soft);
          return 'linear-gradient(to top, transparent ' + Math.max(0, stop - soft).toFixed(1) +
            '%, #000 ' + stop.toFixed(1) + '%)';
        }
        // travel from before the top-left corner to past the bottom-right so both ends clear fully
        var s = wipe * (100 + RAW_OUT_SOFT * 2) - RAW_OUT_SOFT;
        return 'linear-gradient(' + RAW_OUT_ANGLE + ', transparent ' + s.toFixed(1) +
          '%, #000 ' + (s + RAW_OUT_SOFT).toFixed(1) + '%)';
      }

      // ---- chapter 2 (polish) render, driven by an eased tp (see polishTick) ----
      // gradient waves onto the raw text, raw wipes out bottom→top, polished staggers in as the
      // message box grows. all a pure function of tp so it can be lerped exactly like the fan.
      // damped oscillation over the wiggle window, as a function of tp. squared decay so the first
      // swing is the one you read and the rest settle out fast.
      function wiggleAt(tp) {
        if (!PASTE_MODE) { return 0; }
        var t = phaseT(tp, CARD_WIGGLE[0], CARD_WIGGLE[1]);
        if (t <= 0 || t >= 1) { return 0; }
        var decay = (1 - t) * (1 - t);
        return Math.sin(t * Math.PI * 2 * CARD_WIGGLE_CYCLES) * decay;
      }

      function renderPolish(tp) {
        var n = words.length, np = pwords.length;
        if (GLOW_EDGE && !diagMeasured) { measureWordDiag(); diagMeasured = true; }
        if (WORD_GRAD) {
          if (!gradReady) {
            if (!wordEls.length) { for (var wi = 0; wi < n; wi++) { wordEls.push(words[wi].el); } }
            gradW = gradMeasure(wordEls, transcriptEl);
            gradPaint(wordEls);
            gradReady = true;
          }
          gradShift(wordEls, gradW);
        }
        // gradient-in front: each word switches into the gradient (colour → transparent) as it passes
        var Fg = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * 1.08;
        // glow front overshoots past 1 + band so the light band fully sweeps OFF the last words
        var Fglow = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * (1 + GLOW_BAND + 0.05);
        // polished-in front: polished staggers in behind the box grow (later window)
        var F  = outPow(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1])) *
                 (PASTE_MODE ? POLISH_FAST : 1) * (1 + POLISH_GAP + POLISH_BAND);
        for (var i = 0; i < n; i++) {
          var ph = (words[i].diag != null) ? words[i].diag : (n > 1 ? i / (n - 1) : 0);
          words[i].el.style.color = (Fg > ph) ? 'transparent' : '';     // gradient waves on (diagonal)
          if (GLOW_EDGE) {                                              // light band trailing the wavefront
            var df = Fglow - ph;                                       // >0 once the front has passed this word
            var g = (df >= 0 && df < GLOW_BAND) ? (1 - df / GLOW_BAND) : 0;
            words[i].el.style.textShadow = g > 0.02
              ? ('0 0 ' + (GLOW_MAX * g).toFixed(1) + 'px rgba(' + GLOW_COLOR + ',' + (0.9 * g).toFixed(2) + ')')
              : '';
          }
          if (WAVE_MOTION) {                                            // the crest lifts each word as it passes
            var cw = crestAt(Fglow, ph);
            words[i].el.style.transform = cw > 0.002 ? crestCSS(cw, 0) : '';
          }
        }
        // raw-out: a soft mask dissolves the transcript along the wavefront's diagonal (needs a
        // wrapper mask — per-word opacity can't fade the gradient painted at the container via
        // background-clip:text, so the fade has to happen one level up).
        if (rawWrap) {
          var rawT = smooth(phaseT(tp, POLISH_RAWOUT[0], POLISH_RAWOUT[1]));
          // the dissolve runs AHEAD of the travel: the text has to be gone by the time it reaches
          // the box, or it visibly slides over the composer instead of disappearing into it
          var m = rawOutMask(PASTE_MODE ? Math.min(1, rawT * RAW_FADE_FAST) : rawT);
          rawWrap.style.webkitMaskImage = m;
          rawWrap.style.maskImage = m;
          if (PASTE_MODE) {
            // safe to transform the WRAPPER: WORD_GRAD gives every word its own gradient, so
            // there is no container-level background-clip:text here for a transform to break
            rawWrap.style.transformOrigin = '50% 100%';
            rawWrap.style.transform = rawT > 0.0005
              ? ('translateY(' + (RAW_PUSH_Y * rawT).toFixed(2) + 'px)' +
                 (RAW_PUSH_SCALE === 1 ? '' :
                   ' scale(' + (1 - (1 - RAW_PUSH_SCALE) * rawT).toFixed(4) + ')'))
              : '';
          }
        }
        for (var j = 0; j < np; j++) {
          var pph = np > 1 ? j / (np - 1) : 0;
          var o = smooth((F - pph - POLISH_GAP) / POLISH_BAND);
          pwords[j].style.opacity = String(o);
          if (POLISH_WAVE) {   // same crest, carried into the UI: rise into place, swell as it lands
            pwords[j].style.transform = crestCSS(crestAt(F, pph) * 0.6, POLISH_AMP * (1 - o));
          }
        }
        var grow = outPow(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1]));
        if (PASTE_MODE && BOX_GROW_FAST > 0) { grow = Math.pow(grow, 1 / BOX_GROW_FAST); }
        var gpx  = (msgExpandedH - msgCollapsedH) * grow;         // how far the box has grown
        // grow upward: bottom (icons) stays put, top rises over the faded transcript. footprint
        // constant (marginTop cancels the extra height) → card holds. box is white → white rises.
        if (msgGrowEl && heightsOK) {
          msgGrowEl.style.height = (msgCollapsedH + gpx) + 'px';
          msgGrowEl.style.marginTop = (-gpx) + 'px';
          setMsgBleed(gpx > 0.5);
        }

        // the impact, carried by the whole card so nothing shears against anything else inside it.
        // NOT written to card.style.transform: GSAP owns that matrix for the card ride, and a
        // direct write clobbers the ride's y every frame (and an empty one strands the card off
        // screen entirely). the offset is published here and folded into the ride's own gsap.set.
        cardWiggle = PASTE_MODE ? wiggleAt(tp) : 0;
        if (placeholderEl){ placeholderEl.style.opacity = String(1 - smooth(Math.min(1, grow * PLACEHOLDER_OUT))); }
      }

      // ease the ch2 render toward the scrubbed tp; while inactive, track silently so re-entry is clean
      var polishCur = 0, polishTgt = 0, polishActive = false;
      var cardWiggle = 0;   // ch2 paste impact, applied by the card ride's gsap.set

      function polishTick() {
        // leaving chapter 2 stops renderPolish, so the offset has to be cleared here or the card
        // stays parked at whatever the wobble held when the chapter handed over
        if (!polishActive) { polishCur = polishTgt; cardWiggle = 0; return; }
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
          var ex = pillExtras[pe];
          if (ei <= 0.001) { ex.style.display = 'none'; }   // out of flow → no gap width when hidden
          else {
            ex.style.display = '';
            ex.style.opacity = String(ei);
            ex.style.width  = isz;
            ex.style.height = isz;
          }
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
        sceneLastP = p;
        // intro (220 wpm): shows once the flow card is at least CARD_MIN_W wide (so the label never
        // spills a too-narrow card), stays in view through the reveal, then fades out at the shrink
        // start. the show/hide is a quick TIMED fade (opacity + CSS transition, 0.25s), not scrubbed.
        if (introEl) {
          var gt2 = (pB > pA) ? (p - pA) / (pB - pA) : (p >= pB ? 1 : 0);
          gt2 = gt2 < 0 ? 0 : (gt2 > 1 ? 1 : gt2);
          var cardFrac = (p < pB) ? (1 - SPLIT_START * (1 - snapEnds(gt2))) : 1;   // mirror applyMorph's split
          introEl.style.opacity = (cardFrac >= CARD_MIN_W && p < pBh) ? '1' : '0';
        }

        // audio pill: hand the scrubbed handoff progress (shrink→land window) to the eased ticker
        if (pillAudioEl) {
          pillTgt = phaseT(p, pBh, pHold);                       // 0 recording → 1 landed (authored spot)
        }

        // A bad height measurement must never be permanent: retry once the card actually has a box.
        // Until it succeeds the height writes are skipped, so the box keeps its authored size rather
        // than being pinned to 0 — visible and roughly right beats invisible.
        if (!heightsOK && msgGrowEl && stage) {
          var nowH = Date.now();
          if (nowH - heightsRetryT > 400) {
            heightsRetryT = nowH;
            var sr2 = stage.getBoundingClientRect();
            if (sr2.width > 2 && sr2.height > 2) {
              measurePositions();
              if (DEBUG) {
                console.log('[flow-stack] re-measured message box: collapsed=' + msgCollapsedH +
                  ' expanded=' + msgExpandedH + ' ok=' + heightsOK);
              }
            }
          }
        }

        // WATCHDOG: tabFade parks the scene at opacity 0 and hands ownership to the click's fade
        // chain. If anything breaks that chain — a ScrollTrigger refresh, a programmatic scroll, a
        // scrollbar drag, any interruption that isn't wheel/touch/key — the flag stays true and the
        // message UI is left invisible with nothing to paint it back. It can never legitimately be
        // held longer than the two fades, so past that, take ownership back.
        if (tabFade && tabFadeT && (Date.now() - tabFadeT) > (TAB_FADE_MS * 2 + 400)) {
          killTabFade(); tabFade = false; clearSceneTransition();
        }

        if (MSG_BOX_GUARD && msgGrowEl && p >= pHold && !tabFade) {
          var mbr = msgGrowEl.getBoundingClientRect();
          if (mbr.width > 2 && mbr.height < 2) {
            msgGrowEl.style.height = '';
            msgGrowEl.style.marginTop = '0px';
            heightsOK = false;
            if (DEBUG) { console.warn('[flow-stack] message box measured 0 tall — restored'); }
          }
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
        if (p >= pHold) {
          var loc = tabLocal(p); idx = loc.idx;
          // autoplay owns tp for the active tab; scroll only picks which tab (idx)
          tp = (AUTOPLAY && isDesktop) ? ((idx === activeTab) ? autoTp : (autoDone[idx] ? 1 : 0)) : loc.tp;
        }

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
          if (transcriptEl) {
            transcriptEl.classList.add('is-polishing');
            if (WORD_GRAD) { transcriptEl.classList.add('is-wordgrad'); }   // words own the paint
            transcriptEl.style.transform = ''; transcriptEl.style.opacity = '';
          }
          // hand the scrubbed tp to the eased ticker (polishTick → renderPolish); no direct draw here
          polishTgt = tp; polishActive = true;
          wordsShown = -1; polishColored = true;                    // force ch1 re-reveal + colour reset later
        } else if (idx >= 2) {                                       // chapter 3: polished only
          polishActive = false;
          if (transcriptEl) { transcriptEl.classList.remove('is-polishing'); transcriptEl.style.transform = ''; transcriptEl.style.opacity = '0'; }
          if (rawWrap) { rawWrap.style.webkitMaskImage = ''; rawWrap.style.maskImage = ''; rawWrap.style.transform = ''; }
          resetPolishColor();
          for (var j2 = 0; j2 < np; j2++) { pwords[j2].style.opacity = '1'; pwords[j2].style.transform = ''; }
          // extend the box DOWN by SLACK_PAD (white below the text), eased in over the lift
          var padLiftT = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);
          if (msgGrowEl && heightsOK) { msgGrowEl.style.height = (msgExpandedH + SLACK_PAD * padLiftT) + 'px'; msgGrowEl.style.marginTop = (-(msgExpandedH - msgCollapsedH)) + 'px'; setMsgBleed(true); }
          if (placeholderEl){ placeholderEl.style.opacity = '0'; }
        } else {                                                     // recording / chapter 1: raw only
          polishActive = false;
          if (transcriptEl) { transcriptEl.classList.remove('is-polishing'); transcriptEl.style.transform = ''; transcriptEl.style.opacity = ''; }
          if (rawWrap) { rawWrap.style.webkitMaskImage = ''; rawWrap.style.maskImage = ''; rawWrap.style.transform = ''; }
          resetPolishColor();
          for (var j3 = 0; j3 < np; j3++) { pwords[j3].style.opacity = '0'; pwords[j3].style.transform = ''; }
          if (msgGrowEl)    { msgGrowEl.style.height = msgCollapsedH ? (msgCollapsedH + 'px') : ''; msgGrowEl.style.marginTop = '0px'; setMsgBleed(false); }
          if (placeholderEl){ placeholderEl.style.opacity = ''; }
        }

        // pill: ch1 → latest highlight category; ch2+3 → "polishing" (same pill, stays ON across 2→3;
        // ch3 flips its inner state to the "done" dots via is-done).
        var activePill = null;
        // only a category that OWNS a pill counts. a colour-only span still yields a category, and
        // taking it would switch every pill off — the current one animates away, nothing comes in.
        if (idx === 0) {
          for (var j = count - 1; j >= 0; j--) {
            if (words[j].cat && pillMap[words[j].cat]) { activePill = words[j].cat; break; }
          }
        }
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
        // ch2: once the text starts waving out, the "cleaning up" spinner gives way to the dots
        // capsule. ch3 then carries those same dots on into the voice waveform.
        var wantDots = (idx === 1 && tp >= PILL_DOTS_AT);
        setPillDone(voiceLatched || wantDots, voiceLatched);

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
          // the chapter-2 paste impact rides along here rather than on its own transform, so the
          // ride and the wobble stay in one matrix that GSAP owns end to end
          gsap.set(card, {
            y: S - Math.min(cardRiseDist, Math.max(0, S - sCardStart)) + dip + CARD_WIGGLE_Y * cardWiggle,
            x: CARD_WIGGLE_X * cardWiggle,
            rotation: CARD_WIGGLE_ROT * cardWiggle
          });
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
        diagMeasured = false;                  // re-measure word positions (wrap may have changed)
        gradReady = false;                     // ...and the per-word gradient offsets with them
        // a refresh mid-crossfade pulls the geometry out from under the fade chain — release scene
        // opacity here or it can be left parked at 0
        if (tabFade || tabFadeCall) { killTabFade(); tabFade = false; clearSceneTransition(); }
        fanPositioned = false;                 // re-place cards on next fan show (layout may have changed)
        applyScroll(st ? st.progress : 0);
        pSmooth = pTarget; painted = -1;      // no scrub sweep from 0 on load/rebuild
        fanFCur = fanFTgt; fanLiftCur = fanLiftTgt;   // fan starts settled, no glide-in on load
        polishCur = polishTgt;                        // ch2 starts settled too (no wipe sweep on load)
        pillCur = pillTgt;                            // pill starts settled (no glide-in on load)
        updateMarquees(pSmooth); updateAudio(pSmooth);
        if (activeTab >= 0) { moveIndicator(activeTab); }
      }

      // ---- MOBILE chapter driver: you duplicate the desktop card into each [data-flow-play] block
      // (mobile-sized, in Webflow); this plays that chapter's animation on scroll-into-view ----
      var mobUid = 0;
      function uniquifyIds(root) {                       // rename ids + refs so duplicate cards don't clash
        var ided = root.querySelectorAll('[id]');
        if (!ided.length) { return; }
        var suffix = '_m' + (++mobUid), map = {}, i;
        for (i = 0; i < ided.length; i++) { var o = ided[i].id; map[o] = o + suffix; ided[i].id = map[o]; }
        var all = root.querySelectorAll('*'), XL = 'http://www.w3.org/1999/xlink';
        for (i = 0; i < all.length; i++) {
          var el = all[i];
          var h = el.getAttribute('href');
          if (h && h.charAt(0) === '#' && map[h.slice(1)]) { el.setAttribute('href', '#' + map[h.slice(1)]); }
          var xh = el.getAttributeNS ? el.getAttributeNS(XL, 'href') : null;
          if (xh && xh.charAt(0) === '#' && map[xh.slice(1)]) { el.setAttributeNS(XL, 'href', '#' + map[xh.slice(1)]); }
          var attrs = ['clip-path', 'mask', 'fill', 'stroke', 'filter'], a;
          for (a = 0; a < attrs.length; a++) {
            var v = el.getAttribute(attrs[a]);
            if (v && v.indexOf('url(#') !== -1) {
              for (var k in map) { if (map.hasOwnProperty(k)) { v = v.split('url(#' + k + ')').join('url(#' + map[k] + ')'); } }
              el.setAttribute(attrs[a], v);
            }
          }
        }
      }
      function mobileChIndex(ch) { return ch === 'ch2' ? 1 : ch === 'ch3' ? 2 : 0; }
      function mobileHasPill(pills, cat) {
        for (var p = 0; p < pills.length; p++) { if (pills[p].getAttribute('data-pill') === cat) { return true; } }
        return false;
      }
      function mobileSetPill(pills, cat) {
        for (var p = 0; p < pills.length; p++) { pills[p].classList.toggle('is-on', pills[p].getAttribute('data-pill') === cat); }
      }
      function mobilePlay(host, ch) {
        if (ch === 'ch2') { mobileCh2Play(host); return; }   // polish sequence, not typing
        if (ch === 'ch3') { mobileCh3Play(host); return; }   // fan swing + logo rotation
        var ws = host.querySelectorAll('.flow_w'), n = ws.length;
        if (!n) { return; }
        var pills = host.querySelectorAll('[data-pill="filler"],[data-pill="correction"],[data-pill="repetition"]');
        var obj = host._mobTween || (host._mobTween = { c: 0 });
        gsap.killTweensOf(obj); obj.c = 0;
        gsap.to(obj, { c: n, duration: (MOBILE_CH_MS[mobileChIndex(ch)] || 4000) / 1000, ease: 'none', overwrite: true,
          onUpdate: function () {
            var k = Math.round(obj.c), i;
            for (i = 0; i < n; i++) { ws[i].style.opacity = i < k ? '1' : '0'; }
            if (pills.length) {                        // pill = category of the latest revealed word
              var cat = null;
              for (i = k - 1; i >= 0; i--) {                 // ignore categories with no pill of their own
                var c = ws[i].getAttribute('data-cat');
                if (c && mobileHasPill(pills, c)) { cat = c; break; }
              }
              mobileSetPill(pills, cat);
            }
          } });
      }
      function mobileReset(host, ch) {
        if (ch === 'ch2') { mobileCh2Reset(host); return; }
        if (ch === 'ch3') { mobileCh3Reset(host); return; }
        if (host._mobTween) { gsap.killTweensOf(host._mobTween); }
        var ws = host.querySelectorAll('.flow_w');
        for (var i = 0; i < ws.length; i++) { ws[i].style.opacity = '0'; }
        var pills = host.querySelectorAll('[data-pill="filler"],[data-pill="correction"],[data-pill="repetition"]');
        mobileSetPill(pills, null);
      }

      // ---- ch2 (polish): raw shown → gradient wave → raw wipes out → box grows + polished fills in ----
      function mobileWrapPolished(polished) {
        if (!polished || polished.querySelector('.flow_pw')) { return; }
        var kids = Array.prototype.slice.call(polished.childNodes);
        for (var i = 0; i < kids.length; i++) {
          var n = kids[i];
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (chunk) {
              if (chunk === '') { return; }
              if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(chunk)); return; }
              var w = document.createElement('span'); w.className = 'flow_pw'; w.textContent = chunk; w.style.opacity = '0';
              frag.appendChild(w);
            });
            polished.replaceChild(frag, n);
          }
        }
      }
      // same normalise as desktop buildPolished: authored opacity:0 / height:0 / position:absolute would
      // keep the text invisible and out of flow (so it can't grow the box). words do the fade.
      function mobileNormalisePolished(el) {
        if (!el) { return; }
        guardStyle(el);
        if (window.getComputedStyle(el).display === 'none') { el.style.display = 'block'; }
        el.style.position  = 'relative';
        el.style.overflow  = 'visible';
        el.style.opacity   = '1';
        el.style.height    = 'auto';
        el.style.transform = 'translateY(-' + POLISH_RISE + 'px)';   // sit where the placeholder was
      }
      function mobileCh2Prep(host) {
        var ctx = host._ch2 = {};
        ctx.rawTr = host.querySelector('[data-type="raw"]');
        mobileWrapWords(host);
        if (ctx.rawTr) { ctx.rawTr.classList.add('is-polishing'); }
        ctx.rawWords = ctx.rawTr ? ctx.rawTr.querySelectorAll('.flow_w') : [];
        // mask the WRAPPER for the raw-out (per-word opacity can't fade a gradient painted on the
        // container via background-clip:text) — same as desktop's rawWrap
        ctx.rawWrap = (ctx.rawTr && ctx.rawTr.parentNode && ctx.rawTr.parentNode.nodeType === 1)
          ? ctx.rawTr.parentNode : ctx.rawTr;
        if (ctx.rawWrap) { guardStyle(ctx.rawWrap); }
        ctx.polished = host.querySelector('[data-type="polished"]');
        mobileWrapPolished(ctx.polished);
        mobileNormalisePolished(ctx.polished);
        ctx.pwords = ctx.polished ? ctx.polished.querySelectorAll('.flow_pw') : [];
        ctx.msgGrow = host.querySelector('[' + FLOW + '="msg-grow"]');
        if (ctx.msgGrow) {
          guardStyle(ctx.msgGrow);
          ctx.msgGrow.style.overflow = 'hidden';        // so the height grow REVEALS the message (opens)
          var mc = ctx.msgGrow.parentNode;
          if (mc && mc.nodeType === 1) {
            var ccs = window.getComputedStyle(mc);      // the growing box must BE the white composer surface
            if (ccs.backgroundColor && ccs.backgroundColor !== 'rgba(0, 0, 0, 0)') { ctx.msgGrow.style.backgroundColor = ccs.backgroundColor; }
            ctx.msgGrow.style.borderTopLeftRadius  = ccs.borderTopLeftRadius;
            ctx.msgGrow.style.borderTopRightRadius = ccs.borderTopRightRadius;
            guardStyle(mc); mc.style.overflow = 'visible';   // must not clip the upward-grown box
          }
        }
        ctx.placeholder = host.querySelector('.flow_message-placeholder');
        // "cleaning up" pill — the global [data-pill] rule keeps it at opacity 0 until .is-on, so the
        // clone's pill is invisible unless ch2 turns it on. hug content (beat the authored width rule).
        ctx.polishPill = host.querySelector('[data-pill="polishing"]');
        if (ctx.polishPill) {
          guardStyle(ctx.polishPill);
          ctx.polishPill.style.setProperty('align-self', 'center', 'important');
          ctx.polishPill.style.setProperty('flex', '0 0 auto', 'important');
          ctx.polishPill.style.setProperty('width', 'fit-content', 'important');
          ctx.polishPill.style.setProperty('min-width', '0', 'important');
          ctx.polishPill.style.setProperty('max-width', '100%', 'important');
          if (MOBILE_PILL_Y) { ctx.polishPill.style.position = 'relative'; ctx.polishPill.style.top = MOBILE_PILL_Y + 'px'; }
        } else {
          console.warn('[flow-stack] mobile ch2: no [data-pill="polishing"] inside this block');
        }
        ctx.pillAudio = host.querySelector('[' + FLOW + '="pill-audio"]');
        ctx.measured = false;
      }
      // the open box must hug the POLISHED text, not the box's auto height: rows that are invisible but
      // still in flow (the masked-out raw transcript, the faded placeholder) keep inflating `auto`, and
      // the polished block is visually lifted POLISH_RISE by a transform (layout doesn't shrink with it).
      // → height = polished's visual bottom + the box's own bottom padding.
      // GOTCHA: the message blocks are authored with trailing <br>s, so a box's own height runs far
      // taller than its text. measure to the last TEXT NODE's rect (a Range ignores the <br>s, and
      // rects already include the POLISH_RISE transform) — works for polished spans and plain text.
      function mobileTextBottom(root) {
        var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n, last = null;
        while ((n = walk.nextNode())) { if ((n.textContent || '').trim()) { last = n; } }
        if (!last) { return null; }
        var r = document.createRange(); r.selectNodeContents(last);
        var rect = r.getBoundingClientRect(); r.detach && r.detach();
        return rect.bottom || null;
      }
      // clamp an open message box to its own text. returns the px height it was set to (null = skipped)
      function mobileFitBox(mg, apply) {
        if (!mg) { return null; }
        var sv = mg.style.cssText;
        mg.style.height = 'auto'; mg.style.maxHeight = 'none'; mg.style.overflow = 'visible';
        var bottom = mobileTextBottom(mg);
        var fit = bottom ? Math.round(bottom - mg.getBoundingClientRect().top +
          (parseFloat(window.getComputedStyle(mg).paddingBottom) || 0)) : null;
        mg.style.cssText = sv;
        if (fit && apply) {
          guardStyle(mg);
          mg.style.height = Math.max(0, fit - MOBILE_MSG_TRIM) + 'px';
          mg.style.overflow = 'hidden';
        }
        return fit;
      }
      function mobileBoxFit(ctx) { return mobileFitBox(ctx.msgGrow, false); }
      function mobileCh2Measure(ctx) {
        if (ctx.measured || !ctx.msgGrow) { ctx.measured = true; return; }
        var mg = ctx.msgGrow, sv = mg.style.cssText;
        mg.style.height = 'auto'; mg.style.maxHeight = 'none'; mg.style.overflow = 'visible';   // unclamp before measuring
        if (ctx.polished) { var pd = ctx.polished.style.display; ctx.polished.style.display = 'none'; ctx.collapsedH = mg.offsetHeight; ctx.polished.style.display = pd; }
        ctx.expandedH = mg.offsetHeight;
        if (ctx.collapsedH == null) { ctx.collapsedH = ctx.expandedH; }
        // fallback: if polished is absolutely positioned it won't add height -> grow to its own content
        if (ctx.polished && ctx.expandedH - ctx.collapsedH < 8) { ctx.expandedH = ctx.collapsedH + ctx.polished.scrollHeight; }
        var fit = mobileBoxFit(ctx);
        if (fit) { ctx.expandedH = Math.min(ctx.expandedH, fit); }                    // hug the polished text
        ctx.expandedH = Math.max(ctx.collapsedH, ctx.expandedH - MOBILE_MSG_TRIM);   // extra manual tighten
        mg.style.cssText = sv; mg.style.overflow = 'hidden';
        ctx.measured = true;
        console.log('[flow-stack] mobile ch2: collapsed=' + ctx.collapsedH + ' expanded=' + ctx.expandedH +
          ' rawWords=' + ctx.rawWords.length + ' polishedWords=' + ctx.pwords.length);
      }
      function mobileCh2Render(ctx, tp) {
        var rw = ctx.rawWords, pw = ctx.pwords, nR = rw.length, nP = pw.length, i;
        if (WORD_GRAD && nR) {
          if (!ctx.gradReady) {
            ctx.gradEls = Array.prototype.slice.call(rw);
            ctx.gradW = gradMeasure(ctx.gradEls, ctx.rawTr);
            gradPaint(ctx.gradEls);
            if (ctx.rawTr) { ctx.rawTr.classList.add('is-wordgrad'); }
            ctx.gradReady = true;
          }
          gradShift(ctx.gradEls, ctx.gradW);
        }
        var Fg = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * 1.08;
        var Fglow = phaseT(tp, POLISH_GRAD[0], POLISH_GRAD[1]) * (1 + GLOW_BAND + 0.05);
        for (i = 0; i < nR; i++) {
          var ph = nR > 1 ? i / (nR - 1) : 0;
          rw[i].style.color = (Fg > ph) ? 'transparent' : '';
          if (GLOW_EDGE) {                                            // light band trailing the wavefront
            var df = Fglow - ph, g = (df >= 0 && df < GLOW_BAND) ? (1 - df / GLOW_BAND) : 0;
            rw[i].style.textShadow = g > 0.02
              ? ('0 0 ' + (GLOW_MAX * g).toFixed(1) + 'px rgba(' + GLOW_COLOR + ',' + (0.9 * g).toFixed(2) + ')')
              : '';
          }
          if (WAVE_MOTION) {                                          // crest lifts each word as it passes
            var cw = crestAt(Fglow, ph);
            rw[i].style.transform = cw > 0.002 ? crestCSS(cw, 0) : '';
          }
        }
        var wipe = smooth(phaseT(tp, POLISH_RAWOUT[0], POLISH_RAWOUT[1]));
        if (ctx.rawWrap) {                                            // raw dissolves down the diagonal
          var m = rawOutMask(wipe);
          ctx.rawWrap.style.webkitMaskImage = m;
          ctx.rawWrap.style.maskImage = m;
        }
        var grow = smooth(phaseT(tp, POLISH_DROP[0], POLISH_DROP[1]));
        var gpx  = (ctx.expandedH - ctx.collapsedH) * grow;
        // grow UPWARD: negative marginTop cancels the extra height, so the icons below stay put
        if (ctx.msgGrow && ctx.measured) { ctx.msgGrow.style.height = (ctx.collapsedH + gpx) + 'px'; ctx.msgGrow.style.marginTop = (-gpx) + 'px'; }
        var F = phaseT(tp, POLISH_DROP[0], POLISH_DROP[1]) * (1 + POLISH_GAP + POLISH_BAND);
        for (i = 0; i < nP; i++) {
          var pph = nP > 1 ? i / (nP - 1) : 0;
          var o = smooth((F - pph - POLISH_GAP) / POLISH_BAND);
          pw[i].style.opacity = String(o);
          if (POLISH_WAVE) { pw[i].style.transform = crestCSS(crestAt(F, pph) * 0.6, POLISH_AMP * (1 - o)); }
        }
        if (ctx.placeholder) { ctx.placeholder.style.opacity = String(1 - smooth(Math.min(1, grow * PLACEHOLDER_OUT))); }
        var pillOn = tp >= MOBILE_PILL_AT;                       // audio pill out, polishing pill in
        if (ctx.polishPill) { ctx.polishPill.classList.toggle('is-on', pillOn); }
        if (ctx.pillAudio) { ctx.pillAudio.style.opacity = pillOn ? '0' : '1'; }
      }
      function mobileCh2Reset(host) {
        var ctx = host._ch2; if (!ctx) { return; }
        if (host._mobTween) { gsap.killTweensOf(host._mobTween); }
        var i;
        for (i = 0; i < ctx.rawWords.length; i++) {   // raw fully shown (wrapWords left them at 0)
          ctx.rawWords[i].style.color = ''; ctx.rawWords[i].style.opacity = '1'; ctx.rawWords[i].style.textShadow = '';
          ctx.rawWords[i].style.transform = '';
        }
        if (ctx.rawTr) { ctx.rawTr.style.opacity = '1'; }
        if (ctx.rawWrap) { ctx.rawWrap.style.webkitMaskImage = ''; ctx.rawWrap.style.maskImage = ''; ctx.rawWrap.style.transform = ''; }
        for (i = 0; i < ctx.pwords.length; i++) { ctx.pwords[i].style.opacity = '0'; ctx.pwords[i].style.transform = ''; }
        if (ctx.measured && ctx.msgGrow) { ctx.msgGrow.style.height = ctx.collapsedH + 'px'; ctx.msgGrow.style.marginTop = '0px'; }
        if (ctx.placeholder) { ctx.placeholder.style.opacity = '1'; }
        if (ctx.polishPill) { ctx.polishPill.classList.remove('is-on', 'is-done', 'is-in', 'is-wave'); }
        if (ctx.pillAudio) { ctx.pillAudio.style.opacity = '1'; }
      }
      function mobileCh2Play(host) {
        var ctx = host._ch2; if (!ctx) { return; }
        mobileCh2Measure(ctx);
        mobileCh2Reset(host);
        var obj = host._mobTween || (host._mobTween = { c: 0 });
        gsap.killTweensOf(obj); obj.c = 0;
        gsap.to(obj, { c: 1, duration: (MOBILE_CH_MS[1] || 3000) / 1000, ease: 'none', overwrite: true,
          onUpdate: function () { mobileCh2Render(ctx, obj.c); } });
      }

      // ---- ch3 (distribute): note + destination cards swing through centre, logos rotate in. same
      // math as the desktop fan (fanRender/fanStep), scoped to one block and driven by time ----
      function mobileCh3Prep(host) {
        var ctx = host._ch3 = {}, slice = Array.prototype.slice;
        ctx.host = host;                       // the block's own card — anchors the logo-row gap
        ctx.screen = host.querySelector('[' + FLOW + '="screen"]');
        ctx.live   = host.querySelector('[' + FLOW + '="composer"]');      // card 0 = the live note (slack)
        ctx.wrap   = host.querySelector('.flow_icons-destination');
        ctx.logos  = ctx.wrap ? slice.call(ctx.wrap.querySelectorAll('[data-dest]')) : [];
        ctx.layer  = host.querySelector('[' + FLOW + '="fan"]');
        ctx.cards  = slice.call(host.querySelectorAll('[data-dest]')).filter(function (el) {
          if (ctx.wrap && ctx.wrap.contains(el)) { return false; }          // it's a logo, not a card
          return (el.getAttribute('data-dest') || '').trim().toLowerCase() !== 'slack';
        });
        ctx.cards.sort(function (a, b) {
          return (DEST_ORDER[a.getAttribute('data-dest')] || 9) - (DEST_ORDER[b.getAttribute('data-dest')] || 9);
        });
        // the fan layer must be anchored by the block's screen — in the mobile clone it's usually
        // static (desktop's is an absolute cover), so give it a positioning context
        if (ctx.screen && window.getComputedStyle(ctx.screen).position === 'static') {
          guardStyle(ctx.screen); ctx.screen.style.position = 'relative';
        }
        if (ctx.layer) { guardStyle(ctx.layer); ctx.layer.style.position = 'absolute'; ctx.layer.style.opacity = '0'; }
        ctx.cards.forEach(function (el) {
          guardStyle(el);
          el.style.position = 'absolute';            // out of flow so they don't inflate the card
          el.style.transformOrigin = FAN_PIVOT;
          el.style.backfaceVisibility = 'hidden';
          el.style.willChange = 'transform,opacity';
          el.style.pointerEvents = 'none';
          el.style.opacity = '0';
        });
        ctx.logos.forEach(function (el) {
          guardStyle(el); el.style.transformOrigin = '50% 50%'; el.style.opacity = '0';
          var lk = (el.getAttribute('data-dest') || '').trim().toLowerCase();
          if (LOGO_SIZE[lk]) { el.style.width = LOGO_SIZE[lk] + 'px'; el.style.height = 'auto'; }
        });
        if (ctx.wrap) { guardStyle(ctx.wrap); }
        if (ctx.live) { guardStyle(ctx.live); }
        // ch3 opens on the FINISHED message: raw gone, polished full, box already open
        ctx.rawTr = host.querySelector('[data-type="raw"]');
        if (ctx.rawTr) { guardStyle(ctx.rawTr); }
        ctx.polished = host.querySelector('[data-type="polished"]');
        mobileWrapPolished(ctx.polished);
        mobileNormalisePolished(ctx.polished);
        ctx.pwords  = ctx.polished ? ctx.polished.querySelectorAll('.flow_pw') : [];
        ctx.msgGrow = host.querySelector('[' + FLOW + '="msg-grow"]');
        if (ctx.msgGrow) { guardStyle(ctx.msgGrow); }
        ctx.placeholders = slice.call(host.querySelectorAll('.flow_message-placeholder'));   // one per fan card
        ctx.placeholders.forEach(function (el) { guardStyle(el); });
        ctx.n = (ctx.live ? 1 : 0) + ctx.cards.length;
        ctx.positioned = false;
      }
      // place the absolute cards over the live note; each card's lift centres its OWN box in the frame
      function mobileCh3Position(ctx) {
        if (!ctx.live) { return; }
        var scr = ctx.screen || ctx.live.offsetParent;
        var sr  = scr ? scr.getBoundingClientRect() : { top: 0, left: 0, height: 0 };
        var cr  = ctx.live.getBoundingClientRect();
        var scH = sr.height || (scr ? scr.clientHeight : 0);
        ctx.live._fanCY = Math.round(scH / 2 - ((cr.top - sr.top) + cr.height / 2));
        for (var i = 0; i < ctx.cards.length; i++) {
          var el = ctx.cards[i];
          var prevT = el.style.transform;
          el.style.transform = 'none';                 // measure the untransformed box (see positionFanCards)
          el.style.width = cr.width + 'px';
          // clamp AFTER the width lands (wrap changes the text height) — these cards carry their own
          // msg-grow with no [data-type="polished"], so nothing else tightens them
          mobileFitBox(el.querySelector('[' + FLOW + '="msg-grow"]'), true);
          var er   = el.getBoundingClientRect();
          var curT = parseFloat(el.style.top)  || 0;
          var curL = parseFloat(el.style.left) || 0;
          el.style.top  = (curT + (cr.top  - er.top))  + 'px';
          el.style.left = (curL + (cr.left - er.left)) + 'px';
          var bx = (FAN_CENTER_BY && el.querySelector(FAN_CENTER_BY)) || el;   // centre the visible box
          var br = bx.getBoundingClientRect();
          el._fanCY = Math.round(scH / 2 - ((br.top - sr.top) + br.height / 2)) + FAN_CARD_NUDGE;
          el.style.transform = prevT;
          if (DEBUG) {
            console.log('[fan/mobile] ' + (el.getAttribute('data-dest') || '?') +
              ' box=' + Math.round(br.height) + 'h boxTopInScreen=' + Math.round(br.top - sr.top) +
              ' centreTarget=' + Math.round(scH / 2) + ' cy=' + el._fanCY + ' boxIsWrapper=' + (bx === el));
          }
        }
        // logo row gap, measured against this block's own card
        if (ctx.wrap && LOGO_TOP && ctx.host) {
          var hr = ctx.host.getBoundingClientRect(), wr = ctx.wrap.getBoundingClientRect();
          if (hr.height && wr.height) {
            var m = parseFloat(window.getComputedStyle(ctx.wrap).marginTop) || 0;
            ctx.wrap.style.marginTop = (m + (LOGO_TOP - (wr.top - hr.top))) + 'px';
          }
        }
      }
      function mobileCh3Static(ctx) {          // the message state ch3 inherits from ch2's end
        if (ctx.rawTr) { ctx.rawTr.classList.remove('is-polishing'); ctx.rawTr.style.opacity = '0'; }
        for (var i = 0; i < ctx.pwords.length; i++) { ctx.pwords[i].style.opacity = '1'; ctx.pwords[i].style.transform = ''; }
        if (ctx.msgGrow) {
          // same as ch2's end state — clamp to the text (auto keeps the invisible rows + <br> padding)
          if (!mobileFitBox(ctx.msgGrow, true)) { ctx.msgGrow.style.height = 'auto'; ctx.msgGrow.style.overflow = 'visible'; }
          ctx.msgGrow.style.marginTop = '0px';
        }
        for (var q = 0; q < ctx.placeholders.length; q++) { ctx.placeholders[q].style.opacity = '0'; }
      }
      function mobileCh3Render(ctx, tp, show) {
        var n = ctx.n; if (n < 2) { return; }
        var liftT   = smooth(FAN_LIFT_END > 0 ? Math.min(1, tp / FAN_LIFT_END) : 1);   // note rises to centre
        var swingTp = FAN_LIFT_END < 1 ? Math.max(0, (tp - FAN_LIFT_END) / (1 - FAN_LIFT_END)) : 0;
        var f = fanStep(swingTp, n);           // parked beat per card, fast swing between (FAN_HOLD)
        if (ctx.layer) { ctx.layer.style.opacity = show ? '1' : '0'; }
        if (ctx.wrap)  { ctx.wrap.style.opacity  = show ? '1' : '0'; }
        function place(el, i, isLive) {
          var rel = i - f, ar = Math.abs(rel);
          if (!show) {
            if (isLive) {
              el.style.transform = ''; el.style.transformOrigin = '';
              el.style.opacity = ''; el.style.zIndex = '';
            } else { el.style.opacity = '0'; }
            return;
          }
          var op = 1 - Math.max(0, Math.min(1, (ar - 1) / FAN_FADE));
          var cy = ((el._fanCY || 0) + FAN_CENTER_NUDGE) * liftT;
          el.style.transformOrigin = FAN_PIVOT;
          el.style.transform = 'translate(' + (FAN_TX * rel) + 'px,' + cy + 'px) rotate(' + (FAN_ANGLE * rel) +
            'deg) scale(' + (1 - (1 - FAN_SCALE) * Math.min(1, ar)) + ')';
          el.style.opacity = String(op < 0 ? 0 : op);
          el.style.zIndex  = String(100 - Math.round(ar * 10));
        }
        var ci = 0;
        if (ctx.live) { place(ctx.live, ci++, true); }
        for (var e = 0; e < ctx.cards.length; e++) { place(ctx.cards[e], ci++, false); }
        for (var g = 0; g < ctx.logos.length; g++) {   // each logo tracks its card's offset from centre
          var lk = (ctx.logos[g].getAttribute('data-dest') || '').trim().toLowerCase();
          var li = (lk === 'slack') ? 0 : -1;
          if (li < 0) {
            for (var x = 0; x < ctx.cards.length; x++) {
              if ((ctx.cards[x].getAttribute('data-dest') || '').trim().toLowerCase() === lk) { li = x + 1; break; }
            }
          }
          if (!show || li < 0) { ctx.logos[g].style.opacity = '0'; continue; }
          var lrel = (li === 0) ? ((li - f) + (1 - liftT)) : (li - f);   // slack enters via the lift
          var lar  = Math.abs(lrel);
          ctx.logos[g].style.opacity   = String(Math.max(0, 1 - lar / LOGO_FADE));
          ctx.logos[g].style.transform = 'rotate(' + (LOGO_ROT * lrel) + 'deg) scale(' +
            (1 - (1 - LOGO_SCALE) * Math.min(1, lar)) + ')';
        }
      }
      function mobileCh3Reset(host) {
        var ctx = host._ch3; if (!ctx) { return; }
        if (host._mobTween) { gsap.killTweensOf(host._mobTween); }
        mobileCh3Static(ctx);
        mobileCh3Render(ctx, 0, false);
      }
      function mobileCh3Play(host) {
        var ctx = host._ch3; if (!ctx) { return; }
        mobileCh3Static(ctx);
        if (!ctx.positioned) { mobileCh3Position(ctx); ctx.positioned = true; }
        var obj = host._mobTween || (host._mobTween = { c: 0 });
        gsap.killTweensOf(obj); obj.c = 0;
        mobileCh3Render(ctx, 0, true);
        gsap.to(obj, { c: 1, duration: (MOBILE_CH_MS[2] || 3000) / 1000, ease: 'none', overwrite: true,
          onUpdate: function () { mobileCh3Render(ctx, obj.c, true); } });
      }
      // wrap each word of a transcript in a .flow_w span (opacity 0) so the mobile typer can reveal
      // them — the copied markup has category spans but not per-word spans
      function mobileWrapWords(root) {
        var tr = root.querySelector('[data-type="raw"]');
        if (!tr || tr.querySelector('.flow_w')) { return; }
        (function walk(node, cat) {
          var kids = Array.prototype.slice.call(node.childNodes);
          for (var i = 0; i < kids.length; i++) {
            var n = kids[i];
            if (n.nodeType === 3) {
              var frag = document.createDocumentFragment();
              n.textContent.split(/(\s+)/).forEach(function (chunk) {
                if (chunk === '') { return; }
                if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(chunk)); return; }
                var w = document.createElement('span');
                w.className = 'flow_w'; w.textContent = chunk; w.style.opacity = '0';
                if (cat) { w.setAttribute('data-cat', cat); }   // filler / correction / repetition
                frag.appendChild(w);
              });
              node.replaceChild(frag, n);
            } else if (n.nodeType === 1) {
              var m = /(?:^|\s)flow_type-([a-z]+)/.exec(n.className || '');
              walk(n, m ? m[1] : cat);
            }
          }
        }(tr, null));
      }
      // ---- MOBILE wpm cards: the 45 (kb) + 220 (flow) cards just stack in normal flow and their
      // marquee text autoplays. no pin, no morph, no chapter content (the mobile blocks own that).
      // undoes the desktop prep's absolute positioning / px widths so Webflow's own layout governs.
      function buildMobileWpm() {
        if (!stage || !MOBILE_WPM) { return false; }
        var wpmCard = (card && stage.contains(card)) ? card : one(stage, 'card');
        guardStyle(stage);
        stage.style.setProperty('display', 'flex', 'important');       // stack the two cards
        stage.style.setProperty('flex-direction', 'column', 'important');
        stage.style.alignItems    = 'stretch';
        stage.style.gap           = MOBILE_WPM_GAP + 'px';
        stage.style.position      = 'static';
        stage.style.width = ''; stage.style.height = '';               // authored 100vh — cards split it
        stage.style.overflow = 'hidden';
        [kb, wpmCard].forEach(function (c) {
          if (!c) { return; }
          guardStyle(c);
          c.style.width = '100%'; c.style.maxWidth = 'none';
          c.style.flex = '1 1 0'; c.style.height = 'auto'; c.style.minHeight = '0';
          c.style.transform = ''; c.style.visibility = ''; c.style.opacity = '1';
          c.style.position = 'relative'; c.style.left = ''; c.style.top = ''; c.style.margin = '0';
          c.style.overflow = 'hidden';
          c.style.display = 'flex'; c.style.flexDirection = 'column';
          c.style.alignItems = 'center'; c.style.justifyContent = 'center';
          c.style.gap = '8px'; c.style.boxSizing = 'border-box';
          c.style.padding = MOBILE_WPM_PAD + 'px';
          Array.prototype.forEach.call(c.querySelectorAll('img[data-bg]'), function (im) {
            guardStyle(im);
            im.style.position = 'absolute'; im.style.inset = '0'; im.style.zIndex = '0';
            im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'cover';
          });
        });
        for (var h = 0; h < headEls.length; h++) {      // pin both wpm headings to the same height
          if (!stage.contains(headEls[h])) { continue; }
          headEls[h].style.position = 'absolute';
          headEls[h].style.left = '0'; headEls[h].style.right = '0';
          if (MOBILE_HEAD_PIN) { headEls[h].style.top = MOBILE_WPM_HEAD_TOP + '%'; }
          headEls[h].style.transform = 'translateY(-50%)';
          headEls[h].style.margin = '0'; headEls[h].style.textAlign = 'center'; headEls[h].style.zIndex = '1';
        }
        [kbMq, cardMq].forEach(function (mq) {
          if (!mq) { return; }
          // absolute → containing block is the card's PADDING box, so left/right:0 spans the full card
          // width (100% in flow was inset by the padding); top is set in fitMarqueeText
          mq.style.position = 'absolute';
          mq.style.left = '0'; mq.style.right = '0'; mq.style.width = 'auto'; mq.style.marginRight = '0';
          mq.style.top = '0'; mq.style.transform = ''; mq.style.zIndex = '1';
          var svg = mq.querySelector('svg');
          if (svg) {
            guardStyle(svg);
            svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.maxWidth = 'none';
            svg.style.overflow = 'visible';            // the curve's crests ride above the viewBox
          }
        });
        // chapter layers + status pills off; the recorder pill stays (220 card = heading + text + pill)
        Array.prototype.forEach.call(stage.querySelectorAll('[' + FLOW + '="screen"],[data-pill]'),
          function (el) { guardStyle(el); el.style.display = 'none'; });
        if (pillAudioEl && stage.contains(pillAudioEl)) {
          pillAudioEl.style.display = ''; pillAudioEl.style.position = 'relative';
          pillAudioEl.style.transform = ''; pillAudioEl.style.opacity = '1'; pillAudioEl.style.zIndex = '1';
        }
        if (introEl && stage.contains(introEl)) { introEl.style.opacity = '1'; }   // build starts it at 0
        // the authored font-size (16px) is in VIEWBOX units: at width:100% in a ~300px card the svg
        // scales by 300/928, so the text renders ~5px. counter-scale it to a real px size.
        function fitMarqueeText() {
          if (!MOBILE_WPM_TEXT_PX) { return; }
          for (var i = 0; i < marquees.length; i++) {
            var m = marquees[i];
            if (!m.svg || !stage.contains(m.svg)) { continue; }
            var w = m.svg.getBoundingClientRect().width;
            if (w <= 0) { continue; }
            m.text.style.fontSize = (MOBILE_WPM_TEXT_PX * m.vbw / w).toFixed(1) + 'px';
            try { m.len = m.text.getComputedTextLength ? m.text.getComputedTextLength() : 0; } catch (e) { m.len = 0; }
            // slide the wrapper so the TEXT (not the svg box) lands at the target height
            var host = (kb && kb.contains(m.svg)) ? kb : wpmCard;
            var wrap = m.svg.parentNode;
            if (!host || !wrap || wrap.nodeType !== 1) { continue; }
            wrap.style.top = '0px';
            var hostR = host.getBoundingClientRect(), txtR = m.text.getBoundingClientRect();
            if (!txtR.height) { continue; }
            var want = hostR.top + hostR.height * (MOBILE_WPM_MQ_TOP / 100);
            wrap.style.top = Math.round(want - (txtR.top + txtR.height / 2)) + 'px';
          }
        }
        fitMarqueeText();
        if (typeof window.requestAnimationFrame === 'function') { window.requestAnimationFrame(fitMarqueeText); }
        var tick = function () {                       // marquee runs on mqClock (MQ_AUTOPLAY)
          mqClock += gsap.ticker.deltaRatio() / 60;
          updateMarquees(0);
        };
        gsap.ticker.add(tick);
        teardown.push(function () { gsap.ticker.remove(tick); });
        return true;
      }
      function buildMobileChapters() {
        var mob = section.querySelector('[' + ATTR + '="mobile"]');
        if (!mob) { return; }
        var blocks = Array.prototype.slice.call(mob.querySelectorAll('[data-flow-play]'));
        blocks.forEach(function (block) {
          var ch = block.getAttribute('data-flow-play');
          var host = block.querySelector('.mobile_visual_contain') || block;
          if (!host.children.length) { return; }        // nothing authored in this block yet → skip
          uniquifyIds(host);                            // your duplicated card(s) → make ids unique (safety)
          if (ch === 'ch2')      { mobileCh2Prep(host); }   // polish: wrap raw + polished, is-polishing, measure box
          else if (ch === 'ch3') { mobileCh3Prep(host); }   // fan: collect cards + logos, park the message open
          else { mobileWrapWords(host); }                   // typer: wrap transcript words
          mobileReset(host, ch);                        // start hidden
          if (typeof window.IntersectionObserver === 'function') {
            var io = new IntersectionObserver(function (entries) {
              for (var e = 0; e < entries.length; e++) {
                if (entries[e].isIntersecting) { mobilePlay(host, ch); } else { mobileReset(host, ch); }
              }
            }, { threshold: 0, rootMargin: '0px 0px ' + MOBILE_IO_MARGIN + ' 0px' });
            io.observe(block);
            teardown.push(function () { io.disconnect(); });
          } else { mobilePlay(host, ch); }
        });
      }

      var st = null, lastSnapP = null;   // lastSnapP = the stop we last committed to (see snapTo)
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
          // free scrub through the intro + card ride (value < pHold); only the tab region snaps. there:
          // move ONE stop away from the last committed stop in whichever way you scrolled (compared to
          // the committed stop, not instantaneous direction — no jitter bounce).
          snap: SNAP ? { snapTo: function (value) {
            if (value < pHold - 0.001) { lastSnapP = null; return value; }   // intro + card ride: free scrub
            var pts = snapPoints, si, d;
            if (lastSnapP == null) {                    // entering the tab region → init to nearest stop
              lastSnapP = pts[0]; var b0 = Math.abs(value - pts[0]);
              for (si = 1; si < pts.length; si++) { d = Math.abs(value - pts[si]); if (d < b0) { b0 = d; lastSnapP = pts[si]; } }
            }
            var eps = 0.004, target = lastSnapP;
            if (value > lastSnapP + eps) {              // scrolled down off the stop → next stop up
              for (si = 0; si < pts.length; si++) { if (pts[si] > lastSnapP + 0.0005) { target = pts[si]; break; } }
            } else if (value < lastSnapP - eps) {       // scrolled up off the stop → next stop down
              for (si = pts.length - 1; si >= 0; si--) { if (pts[si] < lastSnapP - 0.0005) { target = pts[si]; break; } }
            }
            lastSnapP = target;
            return target;
          }, duration: SNAP_DUR, ease: 'power1.inOut', inertia: false, directional: false } : false
        });
        // ease the marquee + audio toward the scroll position; settles gently when scroll stops
        var scrubTick = function () {
          var dr = gsap.ticker.deltaRatio();
          audioClock += dr / 60;                 // advance the live waveform clock (~seconds)
          mqClock    += dr / 60;                 // advance the autoplay marquee clock
          if (SCRUB_LERP >= 1) { pSmooth = pTarget; }
          else {
            var k = 1 - Math.pow(1 - SCRUB_LERP, dr);
            pSmooth += (pTarget - pSmooth) * k;
            if (Math.abs(pTarget - pSmooth) < 0.0002) { pSmooth = pTarget; }
          }
          var moved = (pSmooth !== painted);
          if (moved) { painted = pSmooth; }
          // marquee: continuous when autoplay (every frame), else only on scroll move
          if (MQ_AUTOPLAY || moved) { updateMarquees(pSmooth); }
          // waveform runs the live clock continuously (not just on scroll) so the pill stays alive
          if (AUDIO_SPEED > 0 || moved) { updateAudio(pSmooth); }
        };
        gsap.ticker.add(scrubTick);
        teardown.push(function () { gsap.ticker.remove(scrubTick); });
        var autoTick = function () {
          if (!autoPlaying) { return; }
          autoTp += (gsap.ticker.deltaRatio() * (1000 / 60)) / autoDur;
          if (autoTp >= 1) {
            if (tabLoops(activeTab)) {
              // hold the finished frame for a beat, then restart — going straight back to 0 reads as
              // a stutter rather than a cycle
              autoTp = 1;
              if (!loopWaitT) { loopWaitT = gsap.ticker.time + LOOP_GAP_MS / 1000; }
              else if (gsap.ticker.time >= loopWaitT) {
                loopWaitT = 0; autoTp = 0;
                // the eased fan would REWIND through every card to get back to 0 — snap instead.
                // safe because the tail left the stage empty and fanAlpha starts the pass at 0.
                sceneUpdate(sceneLastP);
                snapEased();
              }
            } else {
              autoTp = 1; autoPlaying = false;
              if (activeTab >= 0) { autoDone[activeTab] = true; }
            }
          }
          sceneUpdate(sceneLastP);
        };
        gsap.ticker.add(autoTick);
        teardown.push(function () { gsap.ticker.remove(autoTick); });
        var voiceTick = function () {
          if (!voiceLive || !voiceDots.length) { return; }
          var TWO_PI = Math.PI * 2, t = audioClock * AUDIO_SPEED, N = voiceDots.length, i, xi, wave, s;
          for (i = 0; i < N; i++) {
            xi = N > 1 ? i / (N - 1) : 0.5;
            wave = 0.6 * Math.sin((xi * AUDIO_WAVE_SPAN - t) * TWO_PI) +
                   0.4 * Math.sin((xi * AUDIO_WAVE_SPAN * 0.5 - t * 0.6) * TWO_PI + 1.7);
            s = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));
            voiceDots[i].style.height = (BAR_MIN + s * (BAR_MAX - BAR_MIN)).toFixed(1) + 'px';
          }
        };
        gsap.ticker.add(voiceTick);
        teardown.push(function () { gsap.ticker.remove(voiceTick); });
        gsap.ticker.add(fanTick);
        teardown.push(function () { gsap.ticker.remove(fanTick); });
        gsap.ticker.add(polishTick);
        teardown.push(function () { gsap.ticker.remove(polishTick); });
        gsap.ticker.add(pillTick);
        teardown.push(function () { gsap.ticker.remove(pillTick); });
      } else {
        // mobile: wpm cards stacked + autoplaying, then the stacked chapter blocks
        if (!buildMobileWpm() && stage) { stage.style.display = 'none'; }
        buildMobileChapters();
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
        if (BG_TRIGGER) { return; }
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
      var clickLockP = null, clickLockT = 0, tabFade = false, tabFadeCall = null, tabFadeT = 0;
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
          tabFade = true; tabFadeT = Date.now();                 // stamped so the watchdog can free it
          setSceneOpacity(0, TAB_FADE_MS);                      // fade the current chapter out
          tabFadeCall = gsap.delayedCall(TAB_FADE_MS / 1000, function () {
            window.scrollTo(0, to);                             // jump while hidden — no scrub is seen
            lastSnapP = centreP;                               // commit the snap to the clicked tab (no bounce back through the tabs between)
            applyScroll(centreP);                              // set scene targets to the destination NOW
            if (AUTOPLAY) { startAutoplay(i); }                // replay the revealed tab from 0
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
      var lastVW = window.innerWidth, roTimer = null;
      var ro = new ResizeObserver(function () {
        // WIDTH-only. mobile browsers change innerHeight as the address bar shows/hides DURING
        // scroll; refreshing on that fired ScrollTrigger.refresh() mid-scroll and glitched every
        // pinned section on the page (incl. the wave slider). width changes only on a real resize /
        // orientation flip — the one time a re-measure is actually needed.
        if (window.innerWidth === lastVW) { return; }
        lastVW = window.innerWidth;
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
