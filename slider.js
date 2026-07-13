(function () {

  // pinned horizontal "wave" slider. attribute contract:
  //   data-slider="wrap" -> pinned section, "track" -> flex row, "card" -> each card

  var ATTR   = 'data-slider';
  var A_WRAP  = 'wrap';
  var A_TRACK = 'track';
  var A_CARD  = 'card';

  var GAP      = 48;     // px between cards
  var START_AT = 0.72;   // viewport fraction: first card centre at pin start (higher = further right)
  var END_AT   = 0.6;    // viewport fraction: last card centre at release
  var SPEED    = 1;      // vertical-scroll : horizontal-travel ratio

  var WAVE_AMP   = 70;   // px vertical wave amplitude
  var WAVE_LEN   = 820;  // px wavelength
  var WAVE_ROT   = 5;    // deg rotation amplitude
  var WAVE_PHASE = 0;

  var SMOOTH   = 0.09;   // per-frame ease toward scroll target; lower = more glide
  var VEL_SKEW = 0.05;   // deg skew per px/frame of velocity; 0 = off
  var VEL_MAX  = 10;     // skew clamp (deg)

  var CARD_W = 360;      // fallback size, only for still-unstyled (~0 size) cards
  var CARD_H = 240;

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[slider] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var wrap  = document.querySelector('[' + ATTR + '="' + A_WRAP + '"]');
    var track = wrap && wrap.querySelector('[' + ATTR + '="' + A_TRACK + '"]');
    if (!wrap || !track) { console.warn('[slider] need data-slider="wrap" with a data-slider="track" inside'); return; }

    var cards = Array.prototype.slice.call(track.querySelectorAll('[' + ATTR + '="' + A_CARD + '"]'));
    if (!cards.length) { console.warn('[slider] no data-slider="card" children inside the track'); return; }

    track.style.display    = 'flex';
    track.style.flexWrap   = 'nowrap';
    track.style.gap        = GAP + 'px';
    track.style.willChange = 'transform';

    cards.forEach(function (c) {
      c.style.flex       = '0 0 auto';
      c.style.willChange = 'transform';
      if (c.offsetWidth  < 10) { c.style.width  = CARD_W + 'px'; }
      if (c.offsetHeight < 10) { c.style.height = CARD_H + 'px'; }
    });

    var startX = 0, endX = 0, travel = 0;
    var base = cards.map(function () { return { left: 0, w: 0 }; });
    var targetP = 0, currentP = 0, prevX = 0;

    function measure() {
      var vw = window.innerWidth;
      gsap.set(track, { x: 0 });
      cards.forEach(function (c, i) { var r = c.getBoundingClientRect(); base[i] = { left: r.left, w: r.width }; });

      var last = cards.length - 1;
      startX = START_AT * vw - (base[0].left + base[0].w / 2);
      endX   = END_AT   * vw - (base[last].left + base[last].w / 2);
      travel = startX - endX;
      if (travel < 0) { travel = 0; }
    }

    // slide the track; each card rides the sine wave by its viewport x
    function render(p) {
      var x = startX + (endX - startX) * p;
      var vel = x - prevX; prevX = x;
      var skew = Math.max(-VEL_MAX, Math.min(VEL_MAX, vel * VEL_SKEW));
      gsap.set(track, { x: x });
      for (var i = 0; i < cards.length; i++) {
        var cx = base[i].left + x + base[i].w / 2;
        var phase = (cx / WAVE_LEN) * Math.PI * 2 + WAVE_PHASE;
        gsap.set(cards[i], { y: WAVE_AMP * Math.sin(phase), rotation: WAVE_ROT * Math.cos(phase), skewX: skew });
      }
    }

    // seam guards (same recipe as the stack section): wrap runs 2px taller than the viewport
    // so the bottom seam hides offscreen while pinned; a fixed strip in the wrap's own
    // colour masks sub-pixel wobble at the top while docked.
    var topCover = null;
    var wrapBg   = window.getComputedStyle(wrap).backgroundColor;
    if (wrapBg && wrapBg !== 'rgba(0, 0, 0, 0)' && wrapBg !== 'transparent') {
      topCover = document.createElement('div');
      topCover.setAttribute('aria-hidden', 'true');
      topCover.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;pointer-events:none;' +
        'display:none;z-index:10;background:' + wrapBg + ';';
      document.body.appendChild(topCover);
    }

    var st = ScrollTrigger.create({
      trigger: wrap, start: 'top top',
      end: function () { return '+=' + (travel * SPEED); },
      pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onRefreshInit: function () {
        wrap.style.height = 'calc(100vh + 2px)';
        measure();
        currentP = targetP = st ? st.progress : 0;                   // no lerp jump on refresh
        render(currentP);
      },
      onUpdate: function (self) { targetP = self.progress; }
    });

    // ease toward the scroll target every frame; guarded so an error can't stall the shared ticker
    gsap.ticker.add(function () {
      try {
        if (topCover) {
          var wr = wrap.getBoundingClientRect();
          topCover.style.display = (wr.top <= 1 && wr.bottom > 3) ? 'block' : 'none';
        }
        var diff = targetP - currentP;
        if (!st.isActive && Math.abs(diff) < 0.0001) { return; }     // idle when off-screen & settled
        var dt = gsap.ticker.deltaRatio();
        currentP += diff * (1 - Math.pow(1 - SMOOTH, dt));
        render(currentP);
      } catch (e) {}
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
