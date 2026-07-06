(function () {

  // pinned horizontal "wave" slider: pin the section, scroll drives the card track
  // right -> left, and each card rides a gentle sine wave (vertical + rotation) as
  // it crosses the viewport. Works for any number of .slider_card children.

  var WRAP   = '.slider_wrap';
  var TRACK  = '.slider_inner_wrap';
  var CARD   = '.slider_card';

  var GAP      = 48;     // px between cards (applied to the track)
  var START_AT = 0.72;   // viewport fraction where the FIRST card's centre starts; HIGHER = further right (enters more), lower = more of it visible
  var END_AT   = 0.6;    // viewport fraction where the LAST card's centre rests at release; HIGHER = release earlier, lower = scroll further
  var SPEED    = 1;      // vertical-scroll : horizontal-travel ratio (1 = 1:1)

  var WAVE_AMP   = 70;       // px vertical wave amplitude
  var WAVE_LEN   = 820;      // px wavelength (horizontal distance per wave cycle)
  var WAVE_ROT   = 5;        // deg rotation amplitude
  var WAVE_PHASE = 0;        // phase offset (radians)

  var SMOOTH   = 0.09;       // 0..1 ease toward the scroll target each frame; lower = more inertia/glide
  var VEL_SKEW = 0.05;       // deg of skew per px/frame of velocity (cards lean into motion); 0 = off
  var VEL_MAX  = 10;         // clamp for the velocity skew (deg)

  // fallback card size, applied ONLY to cards that are still unstyled (~0 size) so
  // the slider is testable before the Webflow card styles land.
  var CARD_W = 360;
  var CARD_H = 240;

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[slider] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var wrap  = document.querySelector(WRAP);
    var track = document.querySelector(TRACK);
    if (!wrap || !track) { console.warn('[slider] .slider_wrap / .slider_inner_wrap not found'); return; }

    var cards = Array.prototype.slice.call(track.querySelectorAll(CARD));
    if (!cards.length) { console.warn('[slider] no .slider_card children'); return; }

    // lay the track out as a horizontal row
    track.style.display    = 'flex';
    track.style.flexWrap   = 'nowrap';
    track.style.gap        = GAP + 'px';
    track.style.willChange = 'transform';

    cards.forEach(function (c) {
      c.style.flex       = '0 0 auto';
      c.style.willChange = 'transform';
      if (c.offsetWidth  < 10) { c.style.width  = CARD_W + 'px'; }   // fallback only if unstyled
      if (c.offsetHeight < 10) { c.style.height = CARD_H + 'px'; }
    });

    var startX = 0, endX = 0, travel = 0;
    var base = cards.map(function () { return { left: 0, w: 0 }; });
    var targetP = 0, currentP = 0, prevX = 0;

    function measure() {
      var vw = window.innerWidth;
      gsap.set(track, { x: 0 });
      // card viewport positions at x:0 (bakes in the track's own left padding)
      cards.forEach(function (c, i) { var r = c.getBoundingClientRect(); base[i] = { left: r.left, w: r.width }; });

      var last = cards.length - 1;
      // place the first card's centre at START_AT and the last card's centre at
      // END_AT — independent of the track's padding, and no empty tail.
      startX = START_AT * vw - (base[0].left + base[0].w / 2);
      endX   = END_AT   * vw - (base[last].left + base[last].w / 2);
      travel = startX - endX;
      if (travel < 0) { travel = 0; }
    }

    // per-frame: slide the track and let each card ride the wave by its viewport x
    function render(p) {
      var x = startX + (endX - startX) * p;
      var vel = x - prevX; prevX = x;                                // px/frame -> lean the cards
      var skew = Math.max(-VEL_MAX, Math.min(VEL_MAX, vel * VEL_SKEW));
      gsap.set(track, { x: x });
      for (var i = 0; i < cards.length; i++) {
        var cx = base[i].left + x + base[i].w / 2;                   // card centre in the viewport
        var phase = (cx / WAVE_LEN) * Math.PI * 2 + WAVE_PHASE;
        gsap.set(cards[i], { y: WAVE_AMP * Math.sin(phase), rotation: WAVE_ROT * Math.cos(phase), skewX: skew });
      }
    }

    var st = ScrollTrigger.create({
      trigger: wrap, start: 'top top',
      end: function () { return '+=' + (travel * SPEED); },
      pin: true, invalidateOnRefresh: true,
      onRefreshInit: function () {
        measure();
        currentP = targetP = st ? st.progress : 0;                   // no lerp jump on refresh
        render(currentP);
      },
      onUpdate: function (self) { targetP = self.progress; }         // scroll sets the target; ticker eases to it
    });

    // ease the actual position toward the scroll target every frame (inertia/glide).
    // guarded so a stray error here can never stall GSAP's shared ticker (and with
    // it the rest of the page's scroll animations).
    gsap.ticker.add(function () {
      try {
        var diff = targetP - currentP;
        if (!st.isActive && Math.abs(diff) < 0.0001) { return; }     // idle when off-screen & settled
        var dt = gsap.ticker.deltaRatio();                           // ~1 at 60fps -> frame-rate independent
        currentP += diff * (1 - Math.pow(1 - SMOOTH, dt));
        render(currentP);
      } catch (e) { /* never let a slider hiccup break the global ticker */ }
    });

    function relayout() { ScrollTrigger.refresh(); }
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(relayout); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
