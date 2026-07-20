(function () {

  // "Images Flowing" — cards travel L→R across the viewport on scroll, following a cylindrical
  // curve: the card at centre is straight, the others warp along the shape (MWG effect 068).
  //
  // reuses the SAME attribute contract as slider.js so the Webflow HTML is unchanged:
  //   data-slider="wrap"  -> the tall pin-height (provides the scroll distance)
  //   data-slider="track" -> the pinned 3D stage (perspective + overflow:hidden)  [= .container]
  //   data-slider="card"  -> each card (the .media); its <img> gets the depth push
  //
  // slider.js is kept untouched as the known-good fallback. iterate here.

  var ATTR    = 'data-slider';
  var A_WRAP  = 'wrap';
  var A_TRACK = 'track';
  var A_CARD  = 'card';

  var CARD_W    = null;       // force a card width (e.g. '14vw'); null = keep the Webflow-authored size
  var ORBIT_VW  = 26;         // cylinder radius as vw: the whole card pivots on an axis this far BEHIND
                              // it, so rotateX sweeps it up/down on the curve. bigger = taller arc.
  var PERSP     = '100vw';    // stage perspective — smaller = stronger 3D warp

  var ROT_IN    = -90;        // deg the card is pitched when it folds IN (offstage left)
  var ROT_OUT   = 90;         // deg it pitches to as it folds OUT (offstage right)
  var DUR       = 1.1;        // child-timeline duration (in master-time units)
  var EASE      = 'power1.inOut';
  var ZFLIP     = 0.55;       // when (from the end of the sweep) the card drops under the next one

  // pin length in vh. the pin span == the motion span (cards start moving as the pin engages, pin
  // releases as the last card leaves view), so this is the ONLY empty-space / pacing knob: lower =
  // tighter (less empty), higher = more buffer / slower. too low can reintroduce fast-scroll jitter.
  var SCROLL_VH = 420;
  var SCRUB     = 0.8;        // native scrub catch-up in seconds (glide); robust to fast scrolling

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[wave-slider] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var wrap  = document.querySelector('[' + ATTR + '="' + A_WRAP + '"]');
    var track = wrap && wrap.querySelector('[' + ATTR + '="' + A_TRACK + '"]');
    if (!wrap || !track) { console.warn('[wave-slider] need data-slider="wrap" with a data-slider="track" inside'); return; }

    var cards = Array.prototype.slice.call(track.querySelectorAll('[' + ATTR + '="' + A_CARD + '"]'));
    if (!cards.length) { console.warn('[wave-slider] no data-slider="card" children inside the track'); return; }

    // ---- stage layout (was the effect's CSS; applied inline so the Webflow HTML stays as-is) ----
    wrap.style.height = SCROLL_VH + 'vh';                 // .pin-height — buys the scroll distance

    track.style.height         = '100vh';                 // .container — the pinned viewport column
    track.style.overflow       = 'hidden';
    track.style.perspective    = PERSP;
    track.style.transformStyle = 'preserve-3d';
    track.style.position       = 'relative';              // anchors the absolute cards
    track.style.padding        = '0';                     // kill any Webflow padding that would offset the cards

    cards.forEach(function (media) {
      if (CARD_W) { media.style.width = CARD_W; media.style.height = 'auto'; }
      media.style.position         = 'absolute';
      media.style.right            = '100%';              // starts offstage to the left
      media.style.top              = '50vh';              // vertical centre comes from yPercent:-50 (set below)
      media.style.transformStyle   = 'preserve-3d';
      media.style.backfaceVisibility = 'hidden';          // keep the flip clean
      media.style.margin           = '0';
    });

    // orbit the WHOLE card: pivot axis pushed ORBIT_VW behind the card, so rotateX sweeps it up/down
    // along the cylinder (the diagonal/arc). done on the card itself — no dependency on the inner
    // structure (the demo's single <img> depth doesn't survive these rich, wrapped testimonial cards).
    // also own the vertical centre (yPercent) so the scrubbed sweep can't drop it (cards were low).
    var orbitPx = window.innerWidth * ORBIT_VW / 100;
    gsap.set(cards, { yPercent: -50, transformOrigin: '50% 50% -' + orbitPx + 'px' });

    // ---- master timeline: one equal window per card, pinned + natively scrubbed across the wrap ----
    // attached DIRECTLY to the ScrollTrigger (scrub = seconds of catch-up) — this is the smooth path;
    // driving the playhead through a proxy tween was what caused the jitter. the timeline's own span
    // is the motion span, so cards move the instant the pin engages and the pin frees the instant the
    // last card has left view. fastScrollEnd keeps a hard fling from lurching / leaking neighbours.
    var master = gsap.timeline({
      scrollTrigger: {
        trigger: track, start: 'top top',                  // pin from where the TRACK hits the top → centred
        endTrigger: wrap, end: 'bottom bottom',
        pin: track, anticipatePin: 1, invalidateOnRefresh: true,
        scrub: SCRUB, fastScrollEnd: true
      }
    });
    var isPortrait = window.innerHeight > window.innerWidth;
    var step = (isPortrait ? 1.5 : 1) / cards.length;      // portrait spaces the passes out a bit more
    cards.forEach(function (media, i) {
      // begins folded out of view with a high stacking value, then sweeps across while the pitch reverses
      var tl = gsap.timeline();
      tl.fromTo(media,
        { rotateX: ROT_IN, zIndex: cards.length - i },
        { xPercent: 100, x: function () { return window.innerWidth; }, rotateX: ROT_OUT,
          ease: EASE, duration: DUR });
      // partway through, drop the stacking order so the next pass sits on top
      tl.set(media, { zIndex: 0 }, '-=' + ZFLIP);
      master.add(tl, i * step);
    });

    // relayout once fonts/images settle so measurements (viewport, card sizes) are final
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
