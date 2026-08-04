/* business.js — business page hero.
 *
 * Load-triggered, autoplaying, looping. No ScrollTrigger, no pin, no scrub: one master timeline
 * runs the nine beats from the design frames and repeats forever. Ambient motion (the wave bars,
 * the idle dots, the recording pulse) runs on its own clocks underneath.
 *
 * Beats:
 *   1 idle      nav buttons alone
 *   2 hint      "Hold fn to dictate" pill in and out
 *   3 compose   chat composer in, the nav buttons hand over to the recorder's idle dots
 *   4 dictate   dots -> wave bars, the dictated line types into the composer
 *   5 slack     composer + recorder out, "Formatted for Slack" pill in and out
 *   6 invite    meeting card in and out, nav buttons back
 *   7 call      people tiles pop, the panel opens on Transcript, lines land one by one
 *   8 summary   tab moves to Summary, the two layers crossfade
 *   9 reset     everything clears and the loop starts over
 *
 * Selector-driven off the Webflow classes - no data attributes to author.
 */
(function () {
  'use strict';

  // ---- beat timing (seconds) ----
  var T_START      = 0.4;   // after ready, before beat 1 moves
  var T_IDLE       = 0.9;   // beat 1 hold
  var T_HINT       = 1.6;   // beat 2 hold, pill on screen
  var T_COMPOSE    = 0.5;   // beat 3 hold, empty composer before the typing starts
  var T_TYPE       = 2.8;   // beat 4, the dictated line typing out
  var T_TYPE_HOLD  = 0.9;   // beat 4 hold, full line on screen
  var T_SLACK      = 1.5;   // beat 5 hold
  var T_INVITE     = 2.0;   // beat 6 hold
  var T_CALL       = 3.2;   // beat 7 hold, after the last transcript line lands
  var T_SUMMARY    = 3.6;   // beat 8 hold
  var T_RESET      = 0.8;   // beat 9, blank before the loop repeats

  // ---- shared motion language (matches stack.js / flow-stack.js) ----
  var IN_DUR    = 0.55;   // seconds for an element to arrive
  var IN_Y      = 14;     // px it rises from
  var IN_SCALE  = 0.96;   // scale it grows from. 1 = fade only
  var IN_EASE   = 'power2.out';
  var OUT_DUR   = 0.4;    // seconds for an element to leave
  var OUT_Y     = -10;    // px it drifts as it goes
  var OUT_EASE  = 'power1.inOut';
  var POP_EASE  = 'back.out(2)';   // playful arrivals: pills, tiles

  // ---- beat 4: dictation ----
  var DICTATED =
    "Can you let the team know the launch is slipping to Monday? We're still waiting on legal to " +
    "sign off on the new terms page. We'll have a firm timeline by end of day Thursday.";
  // a blinking caret says "a cursor is sitting in this field waiting for keystrokes", which is the
  // opposite of the beat: nobody is typing, the words are being spoken. off by default. only worth
  // turning on alongside TYPE_MODE 'char', where the beat really is a typewriter.
  var TYPE_CARET = false;
  var PILL_KICK  = 1.06;   // scale the recorder pill jumps to when the mic opens

  // dictation is speech, not typing: whole words land at once, and the gap after a word is longer
  // when the word is long or when it closes a clause. every word gets a cost in these units and
  // the run is normalised to T_TYPE, so retiming the beat never means retuning the rhythm.
  var TYPE_MODE   = 'word';   // 'word' = speech cadence | 'char' = the old typewriter
  var WORD_DUR    = 0.22;     // seconds a single word takes to arrive
  var WORD_RISE   = 4;        // px a word lifts as it lands. 0 = fade only
  var LEN_WEIGHT  = 0.06;     // how much each character of a word slows the cadence after it
  var PAUSE_COMMA = 0.5;      // extra beats after , ; : — in units of one average word
  var PAUSE_STOP  = 1.1;      // extra beats after . ! ?
  var WORD_CLASS  = 'biz-animation_chat-word';   // stamped on each span, for Webflow to style
  // the composer is bottom-anchored in a centred stack, so a box that grows line by line pushes
  // the whole nav column upward mid-sentence. the final height is measured once at init and
  // pinned, and the hidden words hold their final positions - words fade in, nothing reflows.
  var RESERVE_BOX = true;
  var RESIZE_SETTLE = 200;   // ms after the last width change before the box is re-measured

  // ---- beat 2: the hint is a HOVER state, not a notification ----
  // the pill is what you get for hovering the mic, so the mic button plays the hover with it:
  // the class is for Webflow to style, the scale is here so it reads even unstyled.
  var HOVER_CLASS = 'is-hover';
  var HOVER_SCALE = 1.08;

  // ---- the two buttons that get pressed ----
  // the nav row is not decoration: twice in the loop a button is actually being used, and until
  // now nothing said so. the mic (centre) is pressed while the dictate hint is up, and the
  // recorder (right) is pressed when the meeting is joined and stays down for the whole call.
  // the background is swapped rather than the opacity faded, so it reads as a UI state and not
  // as the element dimming.
  var PRESS_BG    = '#30302F';
  var PRESS_CLASS = 'is-pressed';   // for Webflow to style; the bg below works unstyled
  var PRESS_DUR   = 0.2;            // seconds for the colour to move, each way

  // ---- ambient: the 11 + 7 wave bars ----
  // the bars are authored as SVGs - a single <rect rx="2.25"> in a 5x11 box - but they are NOT
  // animated as SVG. resizing the rect keeps rx at 2.25 while ry is silently clamped to half the
  // height, so anything shorter than 4.5px renders as a flat ellipse instead of a dot, and a bar
  // at rest looks like a dash. flow-stack.js already solved this: a plain box with
  // border-radius 999px is a capsule at EVERY height, because the radius clamps to half the
  // shorter side on its own. so the authored svg is read for its width and colour, then hidden,
  // and the .wave-bar element itself becomes the bar.
  // SVG bars (one <svg class="wave"> full of <rect class="wave-bar">) take their range from the
  // artwork itself, as multiples - a bar at rest is a circle the width of the bar, a bar at full
  // voice is as tall as it was DRAWN. so the wave peaks at the design's own silhouette whatever
  // the viewBox is, and there is no px number here to re-tune per breakpoint.
  var BAR_REST    = 1;     // × bar width. 1 = a perfect circle at rest. below 1 is clamped
  // the exported bars are fill="currentColor", which inherits the page's text colour - #1A1A1A
  // on this site. that paints near-black bars onto a dark pill: correct geometry, invisible ink.
  // the wave is always cream on dark here, the same constant flow-stack.js uses, so it is set
  // rather than inherited. '' hands the colour back to whatever the SVG was authored with.
  var BAR_COLOR   = '#FFFFEB';
  // the meeting recorder is the one that is actively capturing a call, so its wave is the
  // recording green rather than the cream the dictation pill uses. '' = fall back to BAR_COLOR.
  var BAR_COLOR_MEETING = '#34D399';
  // rebuild <path>/<circle>/<polygon> bars as <rect> so they can be animated at all. off = leave
  // them alone, which also means leave them still.
  var CONVERT_PATHS = true;

  // HTML bars (a <span class="wave-bar"> per bar) have no artwork to measure, so they are px
  var BAR_W       = 0;     // px width of a bar. 0 = keep the width the SVG was authored at
  var BAR_GAP     = 0;     // px between bars. 0 = keep whatever gap Webflow sets
  var BAR_MIN     = 3;     // px: a bar at rest
  var BAR_MAX     = 14;    // px: a bar at full voice
  var BAR_LOCK_ROW = true; // pin the row to BAR_MAX so the pill never resizes as bars grow
  // the motion model is ported from flow-stack.js, which is the look these pills already have
  // elsewhere on the site. it is not a row of independent random walks - that reads as noise -
  // but a waveform, and three things stack up to make it read as a voice:
  //
  //   a syllable envelope  two beat frequencies MULTIPLIED, so loudness arrives in uneven bursts
  //                        with near-silent gaps, the way speech has loud syllables and pauses.
  //                        a single sine would just hum.
  //   a travelling wave    each bar's phase follows its position in the row, so crests glide
  //                        along it instead of every bar peaking at once
  //   per-bar detune       two sines at a random frequency and phase per bar, so nothing is
  //                        visibly in lockstep
  //
  // AUDIO_WAVE crossfades between the last two: all the way down is jagged speech bursts, all
  // the way up is a smooth glide. heights are fractions of the row's full height, so the same
  // numbers hold whatever the viewBox or the pill size is.
  var AUDIO_MIN   = 0.24;  // shortest a bar ever gets
  // tallest a bar can reach. above 1 it deliberately overflows the artwork's own box - the wave
  // svg is set to overflow:visible for exactly this, and a Figma waveform is usually drawn with
  // its tallest bar touching the viewBox edge, so 1.0 is only ever "as tall as it was drawn".
  var AUDIO_MAX   = 1.1;
  var AUDIO_ENV   = 0.22;  // 0 = per-bar jitter only, 1 = strong loud/quiet syllable swells
  var AUDIO_SPEED = 2.4;   // cycles per second. higher = busier
  var AUDIO_WAVE  = 0.72;  // 0 = jagged speech bursts, 1 = a smooth travelling wave
  var AUDIO_WAVE_SPAN = 1.7;  // crests spanning the row. higher = more ripples

  // ---- ambient: the 9 recorder dots (idle, pre-speech) ----
  var DOT_MIN     = 0.35;  // dimmest a dot goes
  var DOT_SPEED   = 0.9;   // seconds per dot cycle
  var DOT_STAG    = 0.08;  // seconds between dots

  // ---- beat 7/8: the call ----
  var TILE_STAG    = 0.14;  // seconds between people tiles popping in
  var LINE_STAG    = 0.55;  // seconds between transcript lines landing
  var LINE_DUR     = 0.5;   // seconds per line
  var SPEAK_CLASS  = 'is-speaking';  // stamped on the tile whose speaker is talking
  var TIMER_FROM   = '28:30';        // where the panel clock starts
  var TIMER_TICK   = true;           // count it up while the panel is open
  var TAB_ACTIVE   = 'is-active';    // the class Webflow uses on the live tab
  var REC_PULSE    = 1.4;            // seconds per pulse of the recording button / stop square

  // transcript line -> people tile. the tiles carry data-biz-speaker, the lines carry the name in
  // .biz-animation_transcript-speaker; matched case-insensitively on either, with this as a fallback
  // for the placeholder attribute values still on the tiles.
  var SPEAKER_MAP = { anouk: 'mikel', emeka: 'zharia', bastien: 'hayle' };

  // ---- layout the script owns ----
  // three places in the design put two states in the SAME slot: the two pills, the nav buttons vs
  // the recorder, and the transcript vs summary layer. Webflow can only stack them by absolute
  // positioning, which loses the parent's height. one grid cell keeps the box and centres both.
  // Webflow's tablet breakpoint. the beats are identical below it - what changes is the layout,
  // which the Designer owns; the script only needs to re-establish the stacks it stamps inline
  // and re-measure the composer against the new width.
  var MOBILE_BP    = 991;

  var STACK_PILLS  = true;
  var STACK_NAV    = true;
  var STACK_LAYERS = true;

  // ---- carriers: authored at opacity 0 in Webflow, owned by the script ----
  // the Designer hides everything that is not in the idle pose so the canvas stays readable. the
  // script only ever animates the element that MOVES - a pill, the panel, a tile - so any wrapper
  // or inner card that Webflow also left at 0 never comes back: the child reaches autoAlpha 1
  // inside a parent that is still transparent, and the beat plays into nothing.
  // these are forced opaque once at init. every one of them is a box the script controls the
  // visibility of through some other element, so nothing here should be carrying its own opacity.
  var CARRIERS = [
    'nav-wrap', 'pill-wrap', 'nav', 'chat', 'chat-body', 'chat-bar',
    'meeting-card', 'meeting-info-wrap', 'meeting-cta',
    'people-wrap', 'panel-wrap', 'inner-panel', 'panel-content',
    'meeting-recorder'
  ];

  var RESPECT_RM = true;    // prefers-reduced-motion: show the call state, no loop
  var PAUSE_HIDDEN = true;  // stop the clocks while the tab is backgrounded
  var DEBUG = false;

  // ---- helpers ----
  var P = '.biz-animation_';
  function q(root, cls)  { return root.querySelector(P + cls); }
  function qa(root, cls) { return [].slice.call(root.querySelectorAll(P + cls)); }
  function log() { if (DEBUG) console.log.apply(console, ['[business]'].concat([].slice.call(arguments))); }

  function mmss(total) {
    var m = Math.floor(total / 60), s = Math.floor(total % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function parseClock(str) {
    var p = String(str).split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  // one grid cell for every child, so states swap in place without absolute positioning
  function stack(el, align) {
    if (!el) return;
    el.style.display = 'grid';
    el.style.gridTemplateColumns = '1fr';
    el.style.alignItems = align || 'center';
    el.style.justifyItems = align === 'start' ? 'stretch' : 'center';
    [].slice.call(el.children).forEach(function (c) {
      c.style.gridArea = '1 / 1';
    });
  }

  function init() {
    if (typeof window.gsap === 'undefined') {
      console.warn('[business] GSAP required before this script.');
      return;
    }

    var root = document.querySelector(P + 'wrap');
    if (!root) { log('no ' + P + 'wrap on this page'); return; }

    var reduced = RESPECT_RM &&
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- cast ----
    var pillWrap   = q(root, 'pill-wrap');
    var hintPill   = root.querySelector(P + 'pill.is-hint');
    var slackPill  = root.querySelector(P + 'pill.is-slack');
    var chatWrap   = q(root, 'chat-wrap');
    var chatText   = q(root, 'chat-text');
    var meetWrap   = q(root, 'meeting-wrap');
    var nav        = q(root, 'nav');
    var navButtons = q(root, 'nav-buttons');
    var recorder   = q(root, 'recorder');
    var recDots    = qa(root, 'recorder-dot');
    var dotsWrap   = q(root, 'recorder-dots');
    var navWave    = root.querySelector(P + 'recorder ' + P + 'wave');
    var recBtn     = root.querySelector(P + 'nav-button.is-recording');
    var micBtn     = root.querySelector(P + 'nav-button.is-mic');

    var panelWrap  = q(root, 'panel-wrap');
    var peopleWrap = q(root, 'people-wrap');
    var tiles      = qa(root, 'people-item');
    var panel      = q(root, 'panel');
    var tabs       = qa(root, 'panel-tab');
    var content    = q(root, 'panel-content');
    var trLayer    = root.querySelector(P + 'panel-layer.is-transcript');
    var sumLayer   = root.querySelector(P + 'panel-layer.is-summary');
    var trLines    = qa(root, 'transcript-line');
    var timer      = q(root, 'timer');
    var sumBits    = [q(root, 'summary-badge'), q(root, 'summary-paragraph'),
                      q(root, 'summary-heading')]
                     .concat(qa(root, 'summary-item'))
                     .concat([q(root, 'bottom_wrap')])
                     .filter(Boolean);

    var meetRecWrap = q(root, 'meeting-recorder-wrap');
    var meetWave    = root.querySelector(P + 'wave.is-meeting');
    var meetStop    = q(root, 'meeting-recorder-stop');

    // ---- un-hide the carriers before any beat runs ----
    // done once at init, not in armStart: these are inline styles that never need to change again,
    // and re-stamping them every loop would fight recorderMode over the boxes it does own.
    CARRIERS.forEach(function (cls) {
      qa(root, cls).forEach(function (el) {
        gsap.set(el, { autoAlpha: 1 });
      });
    });

    // ---- layout the script owns ----
    // re-applied whenever the breakpoint changes, not just at init. these are INLINE styles, and
    // inline beats any stylesheet - so once Webflow's <=991px rules swap in, the grid stamped at
    // desktop is still sitting on the element and still winning. re-running it re-centres each
    // stack against the layout that is actually in force.
    function applyOwnedLayout() {
      if (STACK_PILLS) stack(pillWrap);
      if (STACK_NAV)   stack(nav);
      if (STACK_LAYERS) {
        stack(content, 'start');
        // the summary layer is taller than the transcript one; pin the row so the shorter state
        // does not collapse the panel and make the crossfade jump
        if (content) content.style.gridTemplateRows = 'minmax(0, 1fr)';
      }
      // the recorder pill holds the idle dots and the wave in one slot; it is stacked here rather
      // than beside the others because it only makes sense once both of them exist
      if (dotsWrap && navWave) stack(recorder);
    }
    applyOwnedLayout();

    // ---- initial state, set from JS so the Webflow Designer still shows everything ----
    // every element that comes and goes is re-armed to the SAME entry pose at the top of each
    // loop. without it a second pass enters from the exit pose (y above, not below) and the
    // whole hero starts drifting downward instead of rising.
    var cast = [hintPill, slackPill, chatWrap, meetWrap, recorder, meetRecWrap, navButtons, panel]
      .filter(Boolean).concat(tiles);
    function armStart() {
      gsap.set(cast, { autoAlpha: 0, y: IN_Y, scale: IN_SCALE });
      gsap.set(panelWrap, { autoAlpha: 1, y: 0, scale: 1 });   // wrapper only carries the children
      gsap.set(trLines.concat(sumBits), { autoAlpha: 0, y: 10 });
      gsap.set(trLayer, { autoAlpha: 1 });
      gsap.set(sumLayer, { autoAlpha: 0 });
      setTab('transcript');
      if (timer) timer.textContent = TIMER_FROM;
      if (micBtn) { micBtn.classList.remove(HOVER_CLASS); gsap.set(micBtn, { scale: 1 }); }
      releaseAll();
      if (recorder) gsap.set(recorder, { scale: 1 });
      tiles.forEach(function (t) { t.classList.remove(SPEAK_CLASS); gsap.set(t, { scale: IN_SCALE }); });
      restAll();
      stopClock();
      resetChat();
    }

    // the composer starts on its placeholder; the dictated line lands in the same node
    var placeholder = chatText ? chatText.textContent : '';
    var placeholderCls = chatText && chatText.classList.contains('is-placeholder');
    var phEl = null;
    function resetChat() {
      if (!chatText) return;
      if (TYPE_MODE === 'char') {
        chatText.textContent = placeholder;
      } else {
        hideWords();
        dictating = false;
        if (phEl) gsap.set(phEl, { autoAlpha: 1 });
      }
      stopCaret();
      if (placeholderCls) chatText.classList.add('is-placeholder');
      chatText.style.removeProperty('--caret');
    }

    // ---- beat 4: word cadence ----
    // at[i] is the fraction of the beat at which word i lands. costs are relative, so the plan is
    // built once and stays valid whatever T_TYPE becomes.
    function wordPlan(text) {
      var words = text.split(/\s+/).filter(Boolean);
      var costs = words.map(function (w) {
        var c = 1 + w.length * LEN_WEIGHT;
        if (/[.!?]["')\]]?$/.test(w))      c += PAUSE_STOP;
        else if (/[,;:]["')\]]?$/.test(w)) c += PAUSE_COMMA;
        return c;
      });
      var total = costs.reduce(function (a, b) { return a + b; }, 0) || 1;
      var at = [], run = 0;
      for (var i = 0; i < costs.length; i++) { at.push(run / total); run += costs[i]; }
      return { words: words, at: at };
    }
    var PLAN = wordPlan(DICTATED);

    var wordEls = [];
    var shown = 0;

    // the caret is zero-width on purpose: it rides between the last shown word and the next hidden
    // one, and a caret that took real width would nudge the rest of the line every time it moved.
    var caret = null, caretTl = null;
    function makeCaret() {
      if (!TYPE_CARET || caret) return;
      caret = document.createElement('span');
      caret.textContent = '▏';
      caret.style.display = 'inline-block';
      caret.style.width = '0';
      caret.style.overflow = 'visible';
      caret.style.whiteSpace = 'pre';
      caretTl = gsap.timeline({ repeat: -1, paused: true })
        .to(caret, { opacity: 0, duration: 0.5, ease: 'steps(1)' })
        .to(caret, { opacity: 1, duration: 0.5, ease: 'steps(1)' });
      caretTl.rest = function () { gsap.set(caret, { opacity: 1 }); };
      clocks.push(caretTl);
    }
    function placeCaret() {
      if (!caret || !chatText) return;
      chatText.insertBefore(caret, wordEls[shown] || null);
    }
    function stopCaret() {
      if (!caretTl) return;
      caretTl.pause();
      if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
    }

    // the spans are built ONCE, at init, and live in the DOM for the whole loop - the beat only
    // ever changes their visibility. an earlier version rebuilt them at the top of beat 4, which
    // broke on any seek and on the loop itself: GSAP renders a callback and a tween that share a
    // start time in insertion order, but a seek can land the tween's onUpdate first, so the words
    // were revealed and then immediately replaced by a fresh hidden set.
    //
    // visibility:hidden still takes up its box, so every word already sits at its final position
    // and the reveal is a pure fade - no reflow behind the text as the line fills in.
    function buildWords() {
      if (!chatText) return;
      chatText.textContent = '';
      chatText.style.position = chatText.style.position || 'relative';

      // the placeholder is taken OUT of flow: in flow it would add its own line to the box, and
      // the height reserved below would be one line taller than the finished sentence.
      phEl = document.createElement('span');
      phEl.className = 'biz-animation_chat-placeholder';
      phEl.textContent = placeholder;
      phEl.style.position = 'absolute';
      phEl.style.left = '0';
      phEl.style.top = '0';
      chatText.appendChild(phEl);

      // the separating space is a text node BETWEEN the spans, never inside one: a word span has to
      // be inline-block for the y-lift to apply, and leading whitespace inside an inline-block
      // collapses away - every word would butt against the last.
      wordEls = PLAN.words.map(function (w, i) {
        if (i) chatText.appendChild(document.createTextNode(' '));
        var s = document.createElement('span');
        s.className = WORD_CLASS;
        s.textContent = w;
        chatText.appendChild(s);
        return s;
      });
      gsap.set(wordEls, { display: 'inline-block' });
      makeCaret();
    }
    function hideWords() {
      if (!wordEls.length) return;
      gsap.set(wordEls, { autoAlpha: 0, y: WORD_RISE });
      shown = 0;
      lastP = 0;
    }
    // called from the typing tween's onStart, not from a callback beside it, so the reset can
    // never land after the first reveal however the beat was entered
    var dictating = false;
    function startDictation() {
      if (!chatText || TYPE_MODE !== 'word') return;
      dictating = true;
      if (placeholderCls) chatText.classList.remove('is-placeholder');
      if (phEl) gsap.set(phEl, { autoAlpha: 0 });
      hideWords();
      placeCaret();
      if (caretTl) caretTl.restart();
    }
    var lastP = 0;
    function revealTo(p) {
      if (p < lastP) hideWords();   // scrubbed backwards: re-arm and re-walk
      lastP = p;
      var moved = false;
      while (shown < PLAN.at.length && PLAN.at[shown] <= p) {
        gsap.to(wordEls[shown], {
          autoAlpha: 1, y: 0, duration: WORD_DUR, ease: IN_EASE, overwrite: true
        });
        shown++;
        moved = true;
      }
      if (moved) placeCaret();
    }

    // the composer's final height, measured once with every word laid out, then pinned. without it
    // the box is placeholder-sized at beat 3 and jumps the instant the first word lands.
    // hideWords before the measure, not after: buildWords leaves the spans plainly visible, and
    // between init and the first paint that is a full sentence sitting in the composer
    function reserveBox() {
      if (!chatText || TYPE_MODE !== 'word') return;
      buildWords();
      hideWords();
      measureBox();
      resetChat();
    }

    // the reserved height is only true for the width it was measured at. a narrower composer
    // wraps the same sentence onto more lines, so a box pinned at desktop width clips the text on
    // a phone - and the pin has to be dropped before re-measuring or it floors the new value.
    // nothing here changes what is on screen. autoAlpha:0 is visibility:hidden, which still holds
    // each word's box, so the hidden line measures exactly as tall as the finished one - revealing
    // the words to measure them (what this used to do) only risked painting the whole sentence,
    // since the callers fire on webfont load and on a breakpoint change, i.e. possibly mid-beat.
    function measureBox() {
      if (!RESERVE_BOX || !chatText || !wordEls.length) return;
      chatText.style.removeProperty('min-height');
      var h = chatText.offsetHeight;
      if (h) chatText.style.minHeight = h + 'px';
    }

    // re-measure without losing the beat: measureBox no longer touches visibility, so whatever is
    // on screen mid-dictation stays exactly as it is and a resize just re-wraps
    function remeasureBox() {
      if (!RESERVE_BOX || !chatText || TYPE_MODE !== 'word' || !wordEls.length) return;
      measureBox();
    }

    // ---- wave bars: the bar element IS the bar ----
    // the authored svg is only a source of truth for width and colour. it is hidden, and the
    // .wave-bar element it sat in is restyled as a capsule whose height is what animates. a
    // border-radius of 999px clamps to half the shorter side, so the ends stay perfectly round
    // from a 3px dot up to a 14px bar with nothing to keep in sync.
    // returns a setter that takes a height in px.
    // a colour the bar can actually be painted with. the outer <svg> of an exported icon almost
    // always carries fill="none" - that is the SVG's own default, not the bar's colour, which
    // lives on the shape inside it. taking the outer value paints the bar with nothing and the
    // whole wave disappears. so: every candidate is checked against a blocklist, the shapes are
    // asked before the svg, and the computed fill is asked before falling back to the pill's own
    // text colour. must run BEFORE the svg is hidden - a display:none node computes to nothing.
    var NO_PAINT = /^\s*(none|transparent|rgba\(0,\s*0,\s*0,\s*0\))\s*$/i;
    function usable(c) { return c && !NO_PAINT.test(c) && c !== 'currentColor'; }
    function resolveFill(svg, bar, color) {
      if (color) return color;
      var shapes = svg ? svg.querySelectorAll('rect,path,circle,ellipse,polygon,polyline') : [];
      for (var i = 0; i < shapes.length; i++) {
        if (usable(shapes[i].getAttribute('fill'))) return shapes[i].getAttribute('fill');
        if (usable(shapes[i].style.fill)) return shapes[i].style.fill;
        var comp = getComputedStyle(shapes[i]).fill;
        if (usable(comp)) return comp;
      }
      if (svg && usable(svg.getAttribute('fill'))) return svg.getAttribute('fill');
      var col = getComputedStyle(bar).color;
      return usable(col) ? col : '#FFFFEB';
    }
    function resolveWidth(svg, bar) {
      if (BAR_W) return BAR_W;
      var shape = svg && svg.querySelector('rect');
      var w = parseFloat(shape && shape.getAttribute('width')) ||
              parseFloat(svg && svg.getAttribute('width')) ||
              bar.getBoundingClientRect().width || 0;
      return w > 0 ? w : 4;
    }

    // a bar exported as a <path> (or a <circle>, or a rounded <polygon>) cannot be animated the
    // way a <rect> can - there is no height attribute to move, and scaling it on Y would stretch
    // its round caps into ovals, which is the whole problem this file already solved once. so any
    // non-rect bar is measured and rebuilt as the rect it was drawn as. for a capsule - which is
    // what every one of these is - the bounding box IS the shape, so nothing is lost.
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var BAR_CLASS = P.slice(1) + 'wave-bar';

    // build the rect a shape was drawn as, from its bounding box. for a capsule the box IS the
    // shape, so nothing is lost. the bar class is stamped on so everything downstream - and any
    // later inspection - finds it the normal way.
    function rectFrom(bb, src) {
      var r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', bb.x);
      r.setAttribute('y', bb.y);
      r.setAttribute('width', bb.width);
      r.setAttribute('height', bb.height);
      ['fill', 'fill-opacity', 'opacity', 'style'].forEach(function (a) {
        var v = src.getAttribute(a);
        if (v) r.setAttribute(a, v);
      });
      var cls = src.getAttribute('class') || '';
      r.setAttribute('class', cls.indexOf(BAR_CLASS) === -1 ? (cls + ' ' + BAR_CLASS).trim() : cls);
      return r;
    }

    function toRect(el) {
      var bb;
      try { bb = el.getBBox(); } catch (e) { return null; }
      if (!bb || bb.width <= 0 || bb.height <= 0) return null;
      var r = rectFrom(bb, el);
      el.parentNode.replaceChild(r, el);
      return r;
    }

    // Figma exports a waveform as ONE path with a subpath per bar - five capsules, one <path>,
    // no per-bar element to animate and no class to find them by. each subpath is measured on its
    // own by handing it to a throwaway <path> and reading the bounding box back, then rebuilt as
    // a rect. splitting on the move commands is enough: every subpath starts with M or m.
    function splitPath(el) {
      var d = el.getAttribute('d') || '';
      var subs = d.match(/[Mm][^Mm]*/g);
      if (!subs || subs.length < 2) return null;
      var svg = el.ownerSVGElement;
      if (!svg) return null;

      var probe = document.createElementNS(SVG_NS, 'path');
      svg.appendChild(probe);
      var boxes = [];
      subs.forEach(function (sub) {
        probe.setAttribute('d', sub);
        var bb;
        try { bb = probe.getBBox(); } catch (e) { bb = null; }
        if (bb && bb.width > 0 && bb.height > 0) boxes.push(bb);
      });
      svg.removeChild(probe);
      if (boxes.length < 2) return null;

      var made = boxes.map(function (bb) { return rectFrom(bb, el); });
      made.forEach(function (r) { el.parentNode.insertBefore(r, el); });
      el.parentNode.removeChild(el);
      log('split one compound path into', made.length, 'bars');
      return made;
    }

    // no element carries the bar class: treat the shapes inside the wave as the bars, splitting
    // any that turn out to hold more than one
    function discoverBars(container) {
      var shapes = [].slice.call(
        container.querySelectorAll('path,rect,circle,ellipse,polygon,polyline'));
      var out = [];
      shapes.forEach(function (el) {
        if (el.tagName.toLowerCase() === 'path') {
          var split = splitPath(el);
          if (split) { out = out.concat(split); return; }
        }
        var r = el.tagName.toLowerCase() === 'rect' ? el : toRect(el);
        if (r) {
          var cls = r.getAttribute('class') || '';
          if (cls.indexOf(BAR_CLASS) === -1) {
            r.setAttribute('class', (cls + ' ' + BAR_CLASS).trim());
          }
          out.push(r);
        }
      });
      return out;
    }

    // two shapes of markup reach this, and they need opposite treatment:
    //
    //   SVG   one <svg class="wave"> holding a <rect class="wave-bar"> per bar. background and
    //         border-radius do NOTHING on an SVG element - only fill paints it - so the bar is
    //         animated as geometry. height alone grows downward from y, so y moves with it to
    //         hold the bar on its authored centre line, and rx/ry are pinned to half the WIDTH
    //         so the ends are round at every height.
    //   HTML  a <span class="wave-bar"> per bar, each wrapping its own icon. here the element
    //         itself becomes a capsule: fixed width, border-radius 999px, animated height.
    //
    // returns { set, min, max } - the range travels with the bar because SVG bars are measured
    // in viewBox units off the authored artwork, while HTML bars are in px from the config.
    function barSetter(bar, color) {
      var tag = bar.tagName.toLowerCase();

      // ---- SVG shape ---- (only rect reaches here; the rest were rebuilt as rects above)
      if (tag === 'rect') {
        var w0 = parseFloat(bar.getAttribute('width'))  || 4.5;
        var h0 = parseFloat(bar.getAttribute('height')) || w0;
        var y0 = parseFloat(bar.getAttribute('y'))      || 0;
        var cy = y0 + h0 / 2;   // this bar's own centre line, kept for every height

        if (color) bar.setAttribute('fill', color);
        bar.setAttribute('rx', w0 / 2);
        bar.setAttribute('ry', w0 / 2);
        // any px height left on the element by an earlier build would win over the attribute
        bar.style.removeProperty('height');
        bar.style.removeProperty('width');
        bar.style.removeProperty('background');
        bar.style.removeProperty('border-radius');

        return {
          // what this bar was DRAWN at. the row's shared scale is worked out from the tallest of
          // these, not from the viewBox: an icon exported at 48x48 with a 34-tall tallest bar has
          // padding baked into its box, and scaling to the box would run every bar ~40% over the
          // height it was designed at.
          drawn: h0,
          full: h0,
          // a bar never goes below its own width: at exactly the width it is a circle, and
          // anything shorter is an ellipse - a squashed dash, which is what the old build showed
          min: Math.max(w0, w0 * BAR_REST),
          set: function (h) {
            var y = cy - h / 2;
            // BOTH, deliberately: an inline style wins if Webflow authored the height in CSS,
            // and the attribute is what applies when it did not
            bar.setAttribute('height', h);
            bar.setAttribute('y', y);
            bar.style.setProperty('height', h + 'px');
            bar.style.setProperty('y', y + 'px');
          }
        };
      }

      // ---- HTML element ----
      var svg  = tag === 'svg' ? bar : bar.querySelector('svg');
      var fill = resolveFill(svg, bar, color);
      var w    = resolveWidth(svg, bar);
      log('html bar fill', fill, 'width', w);

      if (svg) {
        // when the svg IS the bar there is nothing to hide it inside of: empty it and let the
        // element carry the capsule itself
        if (svg === bar) { svg.textContent = ''; svg.removeAttribute('viewBox'); }
        else { svg.style.display = 'none'; }
      }

      bar.style.display      = 'block';
      bar.style.flex         = '0 0 auto';
      bar.style.width        = w + 'px';
      bar.style.minWidth     = w + 'px';
      bar.style.borderRadius = '999px';
      bar.style.background   = fill;
      bar.style.opacity      = '1';

      return {
        full: BAR_MAX,
        min: Math.max(BAR_MIN, w),
        set: function (h) { bar.style.height = h + 'px'; }
      };
    }

    // ---- ambient clocks: built once, run forever, paused when their owner is off screen ----
    var clocks = [];
    var waveInfo = [];   // measured per wave at build time, read back off window.BizHero
    function ambientWave(container, color) {
      color = color || BAR_COLOR;
      if (!container) return null;
      var bars = [].slice.call(container.querySelectorAll(P + 'wave-bar'));

      // rebuild path/circle/polygon bars as rects BEFORE anything measures or animates them, so
      // everything downstream only ever deals with one shape
      var rebuilt = 0;
      bars = bars.map(function (el) {
        if (!CONVERT_PATHS || el.tagName.toLowerCase() === 'rect') return el;
        if (!el.getBBox) return el;   // an HTML element, not an SVG shape
        var r = toRect(el);
        if (r) rebuilt++;
        return r || el;
      });
      if (rebuilt) log('rebuilt', rebuilt, 'path bars as rects');

      // nothing carried the bar class. that is the normal case for an icon dropped straight out
      // of Figma: the class lands on the <svg>, and the bars are anonymous shapes inside it -
      // often a single compound path holding the whole row.
      if (!bars.length && CONVERT_PATHS && container.querySelector) {
        bars = discoverBars(container);
        if (bars.length) log('no .wave-bar elements - discovered', bars.length, 'bars inside the svg');
      }
      if (!bars.length) return null;

      // authored order is not layout order - the subpaths in a Figma waveform come out in
      // whatever order they were drawn (17, 25, 9, 33, 41 in one of these). the travelling wave
      // reads position off the index, so the row has to be sorted left to right or the crest
      // jumps around instead of gliding.
      if (bars[0] && bars[0].getBBox) {
        bars.sort(function (a, b) {
          try { return a.getBBox().x - b.getBBox().x; } catch (e) { return 0; }
        });
      }

      // an <svg> container is laid out by its own viewBox - the bars are rects at fixed x, not
      // flex children - so flex/gap/height would only fight it. only an HTML row gets pinned to
      // the tallest a bar can reach, which stops the pill being re-laid-out every frame by
      // whichever bar is currently longest.
      if (container.tagName.toLowerCase() === 'svg') {
        // an svg exported with width="100%" and NO height has nothing to resolve against inside a
        // shrink-to-fit flex pill: the percentage collapses to zero, the box has no size, and the
        // bars animate correctly inside a element nobody can see. fall back to the viewBox's own
        // units as px, which is the size the artwork was drawn at.
        container.style.flex = '0 0 auto';
        container.style.overflow = 'visible';
        var vb = (container.getAttribute('viewBox') || '').split(/[\s,]+/).map(parseFloat);
        var box = container.getBoundingClientRect();
        // 4px, not 1: a box a couple of px tall is just as invisible as a zero one, and a wave
        // that small is never intentional
        if (vb.length === 4 && (box.width < 4 || box.height < 4)) {
          container.style.width  = vb[2] + 'px';
          container.style.height = vb[3] + 'px';
          log('wave svg had collapsed to', box.width + 'x' + box.height,
              '- pinned to viewBox', vb[2] + 'x' + vb[3]);
        }
        var after = container.getBoundingClientRect();
        var pill  = container.parentNode;
        var pillBox = pill && pill.getBoundingClientRect ? pill.getBoundingClientRect() : null;
        waveInfo.push({
          cls: container.getAttribute('class'),
          viewBox: vb.length === 4 ? vb[2] + 'x' + vb[3] : '(none)',
          waveBox: Math.round(box.width) + 'x' + Math.round(box.height) +
                   ' -> ' + Math.round(after.width) + 'x' + Math.round(after.height),
          bars: bars.length,
          barFill: bars[0] ? getComputedStyle(bars[0]).fill : '?',
          pillBg: pill ? getComputedStyle(pill).backgroundColor : '?',
          pillBox: pillBox ? Math.round(pillBox.width) + 'x' + Math.round(pillBox.height) +
                             ' @' + Math.round(pillBox.left) + ',' + Math.round(pillBox.top) : '?',
          pillOverflow: pill ? getComputedStyle(pill).overflow : '?'
        });
      } else {
        container.style.display    = 'flex';
        container.style.alignItems = 'center';
        if (BAR_LOCK_ROW) container.style.height = BAR_MAX + 'px';
        if (BAR_GAP)      container.style.gap    = BAR_GAP + 'px';
      }

      // per-bar constants, drawn once: a ceiling just under the max so the row is not flat across
      // the top, and two detuned frequencies with random phase so no two bars move alike
      var TWO_PI = Math.PI * 2;
      var kit = bars.map(function (bar) {
        var b = barSetter(bar, color);
        b.ceil = AUDIO_MIN + (AUDIO_MAX - AUDIO_MIN) * (0.82 + 0.18 * Math.random());
        b.f1 = 0.8 + Math.random() * 1.5;
        b.f2 = 2.0 + Math.random() * 3.0;
        b.ph1 = Math.random() * TWO_PI;
        b.ph2 = Math.random() * TWO_PI;
        b.set(b.min);
        return b;
      });
      // ONE scale for the whole row, taken from the tallest bar in the artwork. every bar then
      // shares it, so the silhouette comes from the motion rather than from how tall each bar
      // happened to be drawn - which is what makes it read as audio instead of as a decorated
      // static shape.
      var rowFull = 0;
      kit.forEach(function (b) { if (b.drawn > rowFull) rowFull = b.drawn; });
      if (rowFull > 0) kit.forEach(function (b) { b.full = rowFull; });
      log('row scale', rowFull, 'over', kit.length, 'bars');

      var envPh1 = Math.random() * TWO_PI, envPh2 = Math.random() * TWO_PI;
      var n = kit.length;

      function frame(t) {
        // loudness for the whole row. two beat frequencies multiplied spend most of their time
        // low and occasionally line up - uneven bursts and near-silent gaps, not a steady hum
        var e = (0.5 + 0.5 * Math.sin(t * TWO_PI * 0.9 + envPh1)) *
                (0.5 + 0.5 * Math.sin(t * TWO_PI * 2.3 + envPh2));
        for (var i = 0; i < n; i++) {
          var b = kit[i];
          // jagged: this bar's own two detuned sines, scaled by the syllable envelope
          var v = 0.55 * Math.sin(t * TWO_PI * b.f1 + b.ph1) +
                  0.45 * Math.sin(t * TWO_PI * b.f2 + b.ph2);
          var sJag = (0.5 + 0.5 * v) * (AUDIO_ENV * e + (1 - AUDIO_ENV));
          // smooth: phase follows position in the row, so crests glide along it
          var xi = n > 1 ? i / (n - 1) : 0.5;
          var wave = 0.6 * Math.sin((xi * AUDIO_WAVE_SPAN - t) * TWO_PI) +
                     0.4 * Math.sin((xi * AUDIO_WAVE_SPAN * 0.5 - t * 0.6) * TWO_PI + 1.7);
          var sWav = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));  // gentle centre lift
          var s = AUDIO_WAVE * sWav + (1 - AUDIO_WAVE) * sJag;
          b.set(Math.max(b.min, (AUDIO_MIN + (b.ceil - AUDIO_MIN) * s) * b.full));
        }
      }

      // a long linear tween is the clock: its elapsed time IS the waveform's phase. driving it
      // this way rather than off gsap.ticker keeps the play/pause/rest contract the beats and the
      // visibility handler already use, and means a backgrounded tab freezes the wave with
      // everything else instead of letting it run on.
      var clock = { t: 0 };
      var tl = gsap.to(clock, {
        t: 1e7, duration: 1e7, ease: 'none', paused: true,
        onUpdate: function () { frame(clock.t * AUDIO_SPEED); }
      });
      // a paused clock freezes its targets wherever it happened to be. every ambient clock carries
      // the pose it should be parked in, so the next time its owner comes back on screen it starts
      // from rest instead of from a random mid-frame.
      tl.rest = function () { kit.forEach(function (b) { b.set(b.min); }); };
      clocks.push(tl);
      return tl;
    }
    function ambientDots() {
      if (!recDots.length) return null;
      var tl = gsap.timeline({ repeat: -1, paused: true })
        .to(recDots, {
          opacity: DOT_MIN, duration: DOT_SPEED, ease: 'sine.inOut',
          stagger: { each: DOT_STAG, yoyo: true, repeat: 1 }
        });
      tl.rest = function () { gsap.set(recDots, { opacity: 1 }); };
      clocks.push(tl);
      return tl;
    }
    var navWaveTl  = ambientWave(navWave, BAR_COLOR);
    var meetWaveTl = ambientWave(meetWave, BAR_COLOR_MEETING || BAR_COLOR);
    var dotsTl     = ambientDots();

    // the red dot and the stop square breathe while anything is recording
    // ---- press state ----
    // the resting colour is read off the live element once, so releasing restores whatever
    // Webflow styles the button as instead of a colour hardcoded here.
    [micBtn, recBtn].forEach(function (el) {
      if (el) el._bizBaseBg = getComputedStyle(el).backgroundColor;
    });
    function press(el, on) {
      if (!el) return;
      el.classList.toggle(PRESS_CLASS, !!on);
      gsap.to(el, {
        backgroundColor: on ? PRESS_BG : (el._bizBaseBg || 'rgba(0,0,0,0)'),
        duration: PRESS_DUR, ease: OUT_EASE, overwrite: 'auto'
      });
    }
    function releaseAll() {
      [micBtn, recBtn].forEach(function (el) {
        if (!el) return;
        el.classList.remove(PRESS_CLASS);
        // kill first: a press still in flight would go on writing its colour over this set,
        // and the loop can re-arm mid-press
        gsap.killTweensOf(el);
        gsap.set(el, { backgroundColor: el._bizBaseBg || 'rgba(0,0,0,0)' });
      });
    }

    // the recording dot lives in the nav row, which is off screen for both beats this pulse runs
    // in - so pulsing it only ever left it parked at a random opacity for beat 6 to show. the
    // stop square is the one that is actually on screen while recording.
    var pulseTargets = [meetStop].filter(Boolean);
    var pulse = gsap.timeline({ repeat: -1, yoyo: true, paused: true })
      .to(pulseTargets, { opacity: 0.55, duration: REC_PULSE, ease: 'sine.inOut' });
    pulse.rest = function () { if (pulseTargets.length) gsap.set(pulseTargets, { opacity: 1 }); };
    clocks.push(pulse);

    // stopping an ambient clock parks its targets at rest, and starting one rewinds it. without the
    // park, the nav's recording dot comes back in beat 6 at whatever opacity the pause caught it at
    // and the wave bars re-open frozen at their last random heights.
    function run(tl, on) {
      if (!tl) return;
      if (on) {
        if (tl.paused()) tl.restart();
      } else {
        tl.pause();
        if (tl.rest) tl.rest();
      }
    }
    function restAll() { clocks.forEach(function (t) { t.pause(); if (t.rest) t.rest(); }); }

    // the panel clock ticks in real time for as long as the call is on screen. it runs OFF the
    // master timeline on purpose: appended as a tween it would push the summary beat out by its
    // own length, since everything after it lands at the timeline's new end.
    // it is open-ended rather than sized to T_CALL + T_SUMMARY: beat 7 also spends the tile pops
    // and the staggered transcript lines on screen, so a clock cut to the two holds froze mid-beat
    // while the panel was still up. beat 9 stops it.
    var clockTw = null;
    function startClock() {
      if (clockTw) clockTw.kill();
      if (!timer) return;
      timer.textContent = TIMER_FROM;
      if (!TIMER_TICK) return;
      var clock = { t: parseClock(TIMER_FROM) };
      clockTw = gsap.to(clock, {
        t: '+=3600', duration: 3600, ease: 'none',
        onUpdate: function () { timer.textContent = mmss(clock.t); }
      });
    }
    function stopClock() { if (clockTw) { clockTw.kill(); clockTw = null; } }

    // dots and wave live in the same recorder pill and never show together
    function recorderMode(mode) {   // 'dots' | 'wave' | 'off'
      // overwrite:true - the beats can re-fire (loop, resize, a seek) and without it the queued
      // fades stack up on the same element and the last one to be created does not necessarily win
      gsap.to(dotsWrap, { autoAlpha: mode === 'dots' ? 1 : 0, duration: 0.25, ease: OUT_EASE, overwrite: true });
      gsap.to(navWave,  { autoAlpha: mode === 'wave' ? 1 : 0, duration: 0.25, ease: OUT_EASE, overwrite: true });
      run(dotsTl, mode === 'dots');
      run(navWaveTl, mode === 'wave');
      // dots -> wave is the moment the mic opens: the pill itself kicks so the swap reads as
      // "recording started" rather than one row of glyphs quietly replacing another
      if (mode === 'wave' && recorder) {
        gsap.fromTo(recorder, { scale: 1 },
          { scale: PILL_KICK, duration: 0.22, ease: POP_EASE, yoyo: true, repeat: 1 });
      }
    }
    if (dotsWrap && navWave) {
      // both sit in the recorder pill's slot; applyOwnedLayout stacks it, here and on every
      // breakpoint change
      applyOwnedLayout();
      gsap.set(navWave, { autoAlpha: 0 });
    }

    // ---- reusable beats ----
    // every arrival is a fromTo, never a to. a plain .to() records its start values the first time
    // it renders and keeps them for the life of the timeline, so on the second loop each element
    // would tween from wherever the previous loop left it - which is "already visible", i.e. the
    // whole hero plays once and then sits still. immediateRender:false keeps the from-state from
    // being stamped at build time, when the element should still be showing its idle pose.
    function tlShow(tl, el, at, opts) {
      if (!el || (el.length === 0)) return tl;
      opts = opts || {};
      return tl.fromTo(el,
        { autoAlpha: 0, y: opts.fromY != null ? opts.fromY : IN_Y, scale: opts.scale || IN_SCALE },
        {
          autoAlpha: 1, y: 0, scale: 1,
          duration: opts.duration || IN_DUR,
          ease: opts.ease || IN_EASE,
          stagger: opts.stagger || 0,
          immediateRender: false
        }, at);
    }
    function tlHide(tl, el, at, opts) {
      if (!el || (el.length === 0)) return tl;
      opts = opts || {};
      return tl.to(el, {
        autoAlpha: 0, y: OUT_Y, scale: IN_SCALE,
        duration: opts.duration || OUT_DUR,
        ease: OUT_EASE,
        stagger: opts.stagger || 0
      }, at);
    }

    // ---- tabs + layers ----
    function setTab(name) {   // 'transcript' | 'summary'
      var want = name === 'summary' ? 2 : 1;   // 0 My thoughts, 1 Transcript, 2 Summary
      tabs.forEach(function (t, i) { t.classList.toggle(TAB_ACTIVE, i === want); });
    }

    // ---- speaker highlight ----
    function tileFor(name) {
      var key = String(name || '').trim().toLowerCase();
      var mapped = SPEAKER_MAP[key] || key;
      for (var i = 0; i < tiles.length; i++) {
        var attr = (tiles[i].getAttribute('data-biz-speaker') || '').toLowerCase();
        if (attr === key || attr === mapped) return tiles[i];
      }
      return tiles[Object.keys(SPEAKER_MAP).indexOf(key)] || null;
    }
    function speak(name) {
      tiles.forEach(function (t) { t.classList.remove(SPEAK_CLASS); });
      var t = tileFor(name);
      if (!t) return;
      t.classList.add(SPEAK_CLASS);
      gsap.fromTo(t, { scale: 1 }, { scale: 1.04, duration: 0.3, ease: POP_EASE, yoyo: true, repeat: 1 });
    }

    // ---- master timeline ----
    // armStart runs here, not where it is defined: it calls resetChat, which needs the placeholder
    // text captured further down. reserveBox comes first and for the same reason - it needs the
    // clocks array to exist before it makes the caret.
    reserveBox();
    armStart();
    var master = gsap.timeline({
      repeat: reduced ? 0 : -1,
      delay: T_START,
      onRepeat: function () { master.invalidate(); armStart(); }
    });

    // 1 idle -------------------------------------------------------------
    tlShow(master, navButtons, 0, { ease: POP_EASE });
    master.to({}, { duration: T_IDLE });

    // 2 hint -------------------------------------------------------------
    // reads as a hover on the mic: the button takes the hover state for exactly as long as the
    // pill is up, and drops it as the pill leaves
    master.add(function () {
      if (micBtn) { micBtn.classList.add(HOVER_CLASS); gsap.to(micBtn, { scale: HOVER_SCALE, duration: 0.25, ease: POP_EASE }); }
      press(micBtn, true);
    });
    tlShow(master, hintPill, '<', { ease: POP_EASE });
    master.to({}, { duration: T_HINT });
    master.add(function () {
      if (micBtn) { micBtn.classList.remove(HOVER_CLASS); gsap.to(micBtn, { scale: 1, duration: 0.3, ease: OUT_EASE }); }
      press(micBtn, false);
    });
    tlHide(master, hintPill, '<');

    // 3 compose ----------------------------------------------------------
    master.add(function () { resetChat(); recorderMode('dots'); }, '>-0.1');
    tlHide(master, navButtons, '<');
    tlShow(master, chatWrap, '<+0.1');
    tlShow(master, recorder, '<+0.05', { ease: POP_EASE });
    master.to({}, { duration: T_COMPOSE });

    // 4 dictate ----------------------------------------------------------
    master.add(function () {
      recorderMode('wave');
      run(pulse, true);
      if (chatText && placeholderCls && TYPE_MODE === 'char') chatText.classList.remove('is-placeholder');
    });
    // one linear tween drives the whole line; the cadence lives in PLAN.at, not in the ease, so
    // scrubbing or seeking the master lands on exactly the words that should be up at that time.
    var typed = { p: 0 };
    master.fromTo(typed, { p: 0 }, {
      p: 1,
      duration: reduced ? 0.01 : T_TYPE,
      ease: 'none',
      immediateRender: false,
      onStart: startDictation,
      onUpdate: function () {
        if (!chatText) return;
        if (TYPE_MODE === 'word') { revealTo(typed.p); return; }
        var n = typed.p * DICTATED.length;
        var s = DICTATED.slice(0, Math.round(n));
        chatText.textContent = TYPE_CARET && typed.p < 1 ? s + '▏' : s;
      },
      onComplete: function () {
        if (!chatText) return;
        if (TYPE_MODE === 'word') { revealTo(1.0001); stopCaret(); return; }
        chatText.textContent = DICTATED;
      }
    });
    master.to({}, { duration: T_TYPE_HOLD });

    // 5 slack ------------------------------------------------------------
    master.add(function () { recorderMode('off'); run(pulse, false); });
    tlHide(master, chatWrap, '<');
    tlHide(master, recorder, '<+0.06');
    tlShow(master, slackPill, '>-0.05', { ease: POP_EASE });
    master.to({}, { duration: T_SLACK });
    tlHide(master, slackPill, '>');

    // 6 invite -----------------------------------------------------------
    master.add(function () { resetChat(); releaseAll(); });
    tlShow(master, navButtons, '<', { ease: POP_EASE });
    tlShow(master, meetWrap, '<+0.08', { ease: POP_EASE });
    // the meeting is joined partway through the hold, not the instant the card lands - the press
    // has to read as a response to the card, so it needs the card on screen first
    master.add(function () { press(recBtn, true); }, '>+0.55');
    master.to({}, { duration: T_INVITE });
    tlHide(master, meetWrap, '>');
    tlHide(master, navButtons, '<+0.1');

    // 7 call -------------------------------------------------------------
    master.add(function () {
      setTab('transcript');
      gsap.set(trLayer, { autoAlpha: 1 });
      gsap.set(sumLayer, { autoAlpha: 0 });
      gsap.set(trLines, { autoAlpha: 0, y: 10 });
      gsap.set(sumBits, { autoAlpha: 0, y: 10 });
      tiles.forEach(function (t) { t.classList.remove(SPEAK_CLASS); });
      startClock();
      run(meetWaveTl, true);
      run(pulse, true);
    });
    tlShow(master, panel, '>', { duration: 0.6 });
    tlShow(master, tiles, '<+0.1', { ease: POP_EASE, stagger: TILE_STAG });
    tlShow(master, meetRecWrap, '<+0.15', { ease: POP_EASE });

    // lines land one at a time and light their speaker's tile
    trLines.forEach(function (line, i) {
      var who = line.querySelector(P + 'transcript-speaker');
      var name = who ? who.textContent : '';
      master.add(function () { speak(name); }, '>-' + (LINE_DUR * 0.5));
      master.fromTo(line, { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: LINE_DUR, ease: IN_EASE, immediateRender: false },
        i === 0 ? '>' : '>-' + Math.max(0, LINE_DUR - LINE_STAG));
    });

    master.to({}, { duration: T_CALL });

    // 8 summary ----------------------------------------------------------
    master.add(function () { setTab('summary'); });
    master.to(trLayer, { autoAlpha: 0, duration: 0.35, ease: OUT_EASE }, '<');
    master.fromTo(sumLayer, { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.35, ease: IN_EASE, immediateRender: false }, '<+0.15');
    master.fromTo(sumBits, { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.45, ease: IN_EASE, stagger: 0.07, immediateRender: false },
      '<+0.1');
    master.to({}, { duration: T_SUMMARY });

    // 9 reset ------------------------------------------------------------
    tlHide(master, tiles, '>', { stagger: TILE_STAG * 0.6 });
    tlHide(master, panel, '<');
    tlHide(master, meetRecWrap, '<+0.05');
    master.add(function () {
      run(meetWaveTl, false);
      run(pulse, false);
      stopClock();
      releaseAll();
      tiles.forEach(function (t) { t.classList.remove(SPEAK_CLASS); });
    });
    master.to({}, { duration: T_RESET });

    log('master built, ' + master.duration().toFixed(2) + 's per loop');

    // ---- re-measure on anything that changes text metrics ----
    // WIDTH only. a phone fires resize continuously as the URL bar collapses and expands, and
    // that is a height change - re-measuring on it would thrash the box every scroll.
    function reflow() { applyOwnedLayout(); remeasureBox(); }

    var lastW = window.innerWidth;
    var reflowT = null;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(reflowT);
      reflowT = setTimeout(reflow, RESIZE_SETTLE);
    });

    // the breakpoint itself, separately from resize: crossing it swaps a whole stylesheet in, and
    // that fires before the debounce would have run. matchMedia also catches an orientation flip
    // on a tablet, where the width changes in one step rather than being dragged.
    if (window.matchMedia) {
      var mq = window.matchMedia('(max-width: ' + MOBILE_BP + 'px)');
      var onBreak = function () {
        log('breakpoint ->', mq.matches ? 'tablet and down' : 'desktop');
        reflow();
      };
      if (mq.addEventListener) mq.addEventListener('change', onBreak);
      else if (mq.addListener) mq.addListener(onBreak);   // Safari < 14
    }
    // webfonts land after this script runs and change every text metric with them, so the first
    // measurement is taken against fallback metrics and is usually a line out
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { remeasureBox(); });
    }

    // a backgrounded tab throttles rAF, so an unpaused loop jumps on return. only the clocks that
    // were actually running are resumed - the rest belong to beats that are not on screen.
    if (PAUSE_HIDDEN) {
      var wasRunning = [];
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          wasRunning = clocks.filter(function (t) { return !t.paused(); });
          master.pause();
          clocks.forEach(function (t) { t.pause(); });
          if (clockTw) clockTw.pause();
        } else {
          master.resume();
          wasRunning.forEach(function (t) { t.resume(); });
          if (clockTw) clockTw.resume();
        }
      });
    }

    // what the selectors actually matched on the live page. a beat that quietly does nothing is
    // almost always a name that changed in the Designer, and this says so in one line.
    var found = {
      navWave: navWave ? (navWave.tagName + ' ' + qa(root, 'wave-bar').length + ' bars total') : 'MISSING',
      meetWave: meetWave ? meetWave.tagName : 'MISSING',
      recorder: !!recorder, recDots: recDots.length, navButtons: !!navButtons,
      hintPill: !!hintPill, slackPill: !!slackPill, chatText: !!chatText,
      meetWrap: !!meetWrap, meetRecWrap: !!meetRecWrap, meetStop: !!meetStop, recBtn: !!recBtn,
      panel: !!panel, tiles: tiles.length, tabs: tabs.length,
      trLines: trLines.length, sumBits: sumBits.length, timer: !!timer
    };
    log('cast', found);

    window.BizHero = {
      timeline: master, clocks: clocks, waveInfo: waveInfo, found: found,
      remeasure: remeasureBox, reflow: reflow
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
