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
  var TYPE_CARET = true;   // blink a caret at the end of the typed text while it runs
  var PILL_KICK  = 1.06;   // scale the recorder pill jumps to when the mic opens

  // ---- beat 2: the hint is a HOVER state, not a notification ----
  // the pill is what you get for hovering the mic, so the mic button plays the hover with it:
  // the class is for Webflow to style, the scale is here so it reads even unstyled.
  var HOVER_CLASS = 'is-hover';
  var HOVER_SCALE = 1.08;

  // ---- ambient: the 11 + 7 wave bars ----
  // the bars are authored SVGs - a single <rect rx="2.25"> in a 5x11 box. scaling them on Y
  // stretches that radius into an oval, so the height is animated as GEOMETRY instead: the svg
  // height, its viewBox and the rect height all move together and rx never changes.
  var BAR_MIN     = 2.5;   // px: a bar at rest. equal to its width, so it reads as a dot
  var BAR_MAX     = 10;    // px: a bar at full voice
  var WAVE_SPEED  = 0.34;  // seconds per bar step. lower = busier
  var WAVE_STAG   = 0.05;  // seconds between neighbouring bars, so it reads as a travelling wave

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
  var STACK_PILLS  = true;
  var STACK_NAV    = true;
  var STACK_LAYERS = true;

  var RESPECT_RM = true;    // prefers-reduced-motion: show the call state, no loop
  var PAUSE_HIDDEN = true;  // stop the clocks while the tab is backgrounded
  var DEBUG = false;

  // ---- helpers ----
  var P = '.biz-animation_';
  function q(root, cls)  { return root.querySelector(P + cls); }
  function qa(root, cls) { return [].slice.call(root.querySelectorAll(P + cls)); }
  function log() { if (DEBUG) console.log.apply(console, ['[business]'].concat([].slice.call(arguments))); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

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

    // ---- layout the script owns ----
    if (STACK_PILLS) stack(pillWrap);
    if (STACK_NAV)   stack(nav);
    if (STACK_LAYERS) {
      stack(content, 'start');
      // the summary layer is taller than the transcript one; pin the row so the shorter state
      // does not collapse the panel and make the crossfade jump
      if (content) content.style.gridTemplateRows = 'minmax(0, 1fr)';
    }

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
      if (recorder) gsap.set(recorder, { scale: 1 });
      resetChat();
    }

    // the composer starts on its placeholder; the dictated line is typed into the same node
    var placeholder = chatText ? chatText.textContent : '';
    var placeholderCls = chatText && chatText.classList.contains('is-placeholder');
    function resetChat() {
      if (!chatText) return;
      chatText.textContent = placeholder;
      if (placeholderCls) chatText.classList.add('is-placeholder');
      chatText.style.removeProperty('--caret');
    }

    // ---- wave bars: resize the authored SVG, never scale it ----
    // returns a setter that takes a height in px. the svg keeps its authored width and corner
    // radius; only the box grows. falls back to the element's own CSS height when a bar is a bare
    // span with no svg inside it.
    function barSetter(bar) {
      var svg = bar.tagName.toLowerCase() === 'svg' ? bar : bar.querySelector('svg');
      if (!svg) {
        return function (h) { bar.style.height = h + 'px'; };
      }
      var rect = svg.querySelector('rect');
      var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(parseFloat);
      var w  = vb.length === 4 ? vb[2] : (parseFloat(svg.getAttribute('width')) || BAR_MIN);
      var h0 = vb.length === 4 ? vb[3] : (parseFloat(svg.getAttribute('height')) || BAR_MAX);
      // the authored rect is inset inside its box by a constant; keep that inset at every height
      var inset = rect ? h0 - (parseFloat(rect.getAttribute('height')) || h0) : 0;
      return function (h) {
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        svg.setAttribute('height', h);
        svg.style.height = h + 'px';
        if (rect) rect.setAttribute('height', Math.max(0, h - inset));
      };
    }

    // ---- ambient clocks: built once, run forever, paused when their owner is off screen ----
    var clocks = [];
    function ambientWave(container) {
      if (!container) return null;
      var bars = [].slice.call(container.querySelectorAll(P + 'wave-bar'));
      if (!bars.length) return null;
      var tl = gsap.timeline({ repeat: -1, paused: true });
      bars.forEach(function (bar, i) {
        // each bar walks its own random walk; the stagger offset makes the row read as one wave
        var set = barSetter(bar);
        var state = { h: BAR_MIN };
        set(BAR_MIN);
        var sub = gsap.timeline({ repeat: -1 });
        for (var k = 0; k < 6; k++) {
          sub.to(state, {
            h: rnd(BAR_MIN, BAR_MAX), duration: WAVE_SPEED, ease: 'sine.inOut',
            onUpdate: function () { set(state.h); }
          });
        }
        tl.add(sub, i * WAVE_STAG);
      });
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
      clocks.push(tl);
      return tl;
    }
    var navWaveTl  = ambientWave(navWave);
    var meetWaveTl = ambientWave(meetWave);
    var dotsTl     = ambientDots();

    // the red dot and the stop square breathe while anything is recording
    var pulse = gsap.timeline({ repeat: -1, yoyo: true, paused: true })
      .to([recBtn, meetStop].filter(Boolean), { opacity: 0.55, duration: REC_PULSE, ease: 'sine.inOut' });
    clocks.push(pulse);

    function run(tl, on) { if (tl) { on ? tl.play() : tl.pause(); } }

    // the panel clock ticks in real time for as long as the call is on screen. it runs OFF the
    // master timeline on purpose: appended as a tween it would push the summary beat out by its
    // own length, since everything after it lands at the timeline's new end.
    var clockTw = null;
    function startClock() {
      if (clockTw) clockTw.kill();
      if (!timer) return;
      timer.textContent = TIMER_FROM;
      if (!TIMER_TICK) return;
      var clock = { t: parseClock(TIMER_FROM) };
      clockTw = gsap.to(clock, {
        t: '+=' + Math.ceil(T_CALL + T_SUMMARY),
        duration: T_CALL + T_SUMMARY,
        ease: 'none',
        onUpdate: function () { timer.textContent = mmss(clock.t); }
      });
    }
    function stopClock() { if (clockTw) { clockTw.kill(); clockTw = null; } }

    // dots and wave live in the same recorder pill and never show together
    var dotsWrap = q(root, 'recorder-dots');
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
      // both sit in the recorder pill's slot
      stack(recorder);
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
    // text captured further down.
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
    });
    tlShow(master, hintPill, '<', { ease: POP_EASE });
    master.to({}, { duration: T_HINT });
    master.add(function () {
      if (micBtn) { micBtn.classList.remove(HOVER_CLASS); gsap.to(micBtn, { scale: 1, duration: 0.3, ease: OUT_EASE }); }
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
      if (chatText && placeholderCls) chatText.classList.remove('is-placeholder');
    });
    var typed = { n: 0 };
    master.fromTo(typed, { n: 0 }, {
      n: DICTATED.length,
      duration: reduced ? 0.01 : T_TYPE,
      ease: 'none',
      immediateRender: false,
      onUpdate: function () {
        if (!chatText) return;
        var s = DICTATED.slice(0, Math.round(typed.n));
        chatText.textContent = TYPE_CARET && typed.n < DICTATED.length ? s + '▏' : s;
      },
      onComplete: function () { if (chatText) chatText.textContent = DICTATED; }
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
    master.add(function () { resetChat(); });
    tlShow(master, navButtons, '<', { ease: POP_EASE });
    tlShow(master, meetWrap, '<+0.08', { ease: POP_EASE });
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
      tiles.forEach(function (t) { t.classList.remove(SPEAK_CLASS); });
    });
    master.to({}, { duration: T_RESET });

    log('master built, ' + master.duration().toFixed(2) + 's per loop');

    // a backgrounded tab throttles rAF, so an unpaused loop jumps on return. only the clocks that
    // were actually running are resumed - the rest belong to beats that are not on screen.
    if (PAUSE_HIDDEN) {
      var wasRunning = [];
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          wasRunning = clocks.filter(function (t) { return !t.paused(); });
          master.pause();
          clocks.forEach(function (t) { t.pause(); });
        } else {
          master.resume();
          wasRunning.forEach(function (t) { t.resume(); });
        }
      });
    }

    window.BizHero = { timeline: master, clocks: clocks };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
