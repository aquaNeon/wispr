(function () {

  // pinned horizontal "wave" slider: pin the section, scroll drives the card track
  // right -> left, and each card rides a gentle sine wave (vertical + rotation) as
  // it crosses the viewport. Works for any number of .slider_card children.

  var WRAP   = '.slider_wrap';
  var TRACK  = '.slider_inner_wrap';
  var CARD   = '.slider_card';

  var GAP          = 48;     // px between cards (applied to the track)
  var START_OFFSET = 0.55;   // track starts pushed right by this fraction of the viewport (cards enter from the right)
  var END_PAD      = 0.25;   // trailing space (viewport fraction) after the last card
  var SPEED        = 1;      // vertical-scroll : horizontal-travel ratio (1 = 1:1)

  var WAVE_AMP   = 70;       // px vertical wave amplitude
  var WAVE_LEN   = 820;      // px wavelength (horizontal distance per wave cycle)
  var WAVE_ROT   = 5;        // deg rotation amplitude
  var WAVE_PHASE = 0;        // phase offset (radians)

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

    var startX = 0, endX = 0, travel = 0, trackBaseLeft = 0;
    var base = cards.map(function () { return { left: 0, w: 0 }; });

    function measure() {
      var vw = window.innerWidth;
      gsap.set(track, { x: 0 });
      var tr = track.getBoundingClientRect();
      trackBaseLeft = tr.left;                       // track's left at x:0 (pinned -> constant)
      cards.forEach(function (c, i) { base[i] = { left: c.offsetLeft, w: c.offsetWidth }; });

      var trackW = track.scrollWidth;
      startX = vw * START_OFFSET;                    // push the row off the right edge
      endX   = -(trackW - vw + vw * END_PAD);        // last card scrolled past the left + trailing pad
      if (endX > 0) { endX = 0; }
      travel = startX - endX;
    }

    // per-frame: slide the track and let each card ride the wave by its viewport x
    function render(p) {
      var x = startX + (endX - startX) * p;
      gsap.set(track, { x: x });
      for (var i = 0; i < cards.length; i++) {
        var cx = trackBaseLeft + x + base[i].left + base[i].w / 2;   // card centre in the viewport
        var phase = (cx / WAVE_LEN) * Math.PI * 2 + WAVE_PHASE;
        gsap.set(cards[i], { y: WAVE_AMP * Math.sin(phase), rotation: WAVE_ROT * Math.cos(phase) });
      }
    }

    var st = ScrollTrigger.create({
      trigger: wrap, start: 'top top',
      end: function () { return '+=' + (travel * SPEED); },
      pin: true, invalidateOnRefresh: true,
      onRefreshInit: function () { measure(); render(st ? st.progress : 0); },
      onUpdate: function (self) { render(self.progress); }
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
