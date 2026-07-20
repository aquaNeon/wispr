(function () {

  // "Images Flowing" — cards travel L→R across the viewport on scroll along a cylindrical curve:
  // the card at centre faces front, the others pitch away on the cylinder (MWG effect 068).
  //
  // reuses the same attribute contract as slider.js so the Webflow HTML is unchanged:
  //   data-slider="wrap"  -> the tall pin-height (provides the scroll distance)
  //   data-slider="track" -> the pinned 3D stage (perspective + overflow:hidden)
  //   data-slider="card"  -> each card
  //
  // slider.js is kept untouched as the known-good fallback.

  var ATTR    = 'data-slider';
  var A_WRAP  = 'wrap';
  var A_TRACK = 'track';
  var A_CARD  = 'card';

  var CARD_W    = null;       // force a card width (e.g. '14vw'); null = keep the Webflow-authored size
  var ORBIT_VW  = 26;         // cylinder radius (vw): the card pivots on an axis this far behind it,
                              // so rotateX sweeps it up/down along the curve. bigger = taller arc
  var PERSP     = '100vw';    // stage perspective — smaller = stronger 3D warp

  var ROT_IN    = -90;        // deg the card is pitched as it folds in (offstage left)
  var ROT_OUT   = 90;         // deg it pitches to as it folds out (offstage right)
  var DUR       = 1.1;        // per-card timeline duration (in master-time units)
  var EASE      = 'power1.inOut';
  var ZFLIP     = 0.55;       // when (from the end of a sweep) a card drops under the next one
  var SCROLL_VH = 600;        // pin-height in vh — how long the deck plays
  var SCRUB     = true;       // locked 1:1 to scroll; a number adds glide but a fast fling then flashes a card

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[wave-slider] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // Global guard: keep ScrollTrigger.refresh() from running mid-scroll. Other scripts on the page
    // (e.g. a page ScrollTrigger whose onUpdate calls refresh() every scroll tick) re-lay-out every
    // pin on each refresh, which makes pinned sections jump. Layout can't change during a scroll, so
    // we drop refreshes requested while scrolling and, once scroll settles, run one ONLY if the page
    // actually changed size — pointless per-tick calls become no-ops. Patches the shared instance,
    // so it protects every pin on the page, not just this slider.
    if (!ScrollTrigger.__refreshGuarded) {
      ScrollTrigger.__refreshGuarded = true;
      var origRefresh = ScrollTrigger.refresh.bind(ScrollTrigger);
      var IDLE = 400, lastScroll = 0, timer = null, lastDocH = -1, lastVW = -1;
      var changed = function () { return document.documentElement.scrollHeight !== lastDocH || window.innerWidth !== lastVW; };
      var stamp   = function () { lastDocH = document.documentElement.scrollHeight; lastVW = window.innerWidth; };
      window.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true });
      var settle = function () {
        var wait = IDLE - (Date.now() - lastScroll);
        if (wait > 0) { timer = setTimeout(settle, wait); return; }
        timer = null;
        if (changed()) { stamp(); origRefresh(); }
      };
      ScrollTrigger.refresh = function () {
        if (Date.now() - lastScroll < IDLE) { if (!timer) { timer = setTimeout(settle, IDLE); } return; }
        stamp();
        return origRefresh.apply(ScrollTrigger, arguments);
      };
    }

    var wrap  = document.querySelector('[' + ATTR + '="' + A_WRAP + '"]');
    var track = wrap && wrap.querySelector('[' + ATTR + '="' + A_TRACK + '"]');
    if (!wrap || !track) { console.warn('[wave-slider] need data-slider="wrap" with a data-slider="track" inside'); return; }

    var cards = Array.prototype.slice.call(track.querySelectorAll('[' + ATTR + '="' + A_CARD + '"]'));
    if (!cards.length) { console.warn('[wave-slider] no data-slider="card" children inside the track'); return; }

    // stage layout (the effect's CSS, applied inline so the Webflow HTML stays as-is)
    wrap.style.height          = SCROLL_VH + 'vh';        // pin-height
    track.style.height         = '100vh';                 // pinned viewport column
    track.style.overflow       = 'hidden';
    track.style.perspective    = PERSP;
    track.style.transformStyle = 'preserve-3d';
    track.style.position       = 'relative';              // anchors the absolute cards
    track.style.padding        = '0';                     // drop any Webflow padding that would offset the cards

    cards.forEach(function (media) {
      if (CARD_W) { media.style.width = CARD_W; media.style.height = 'auto'; }
      media.style.position         = 'absolute';
      media.style.right            = '100%';              // starts offstage to the left
      media.style.top              = '50vh';              // vertical centre comes from yPercent:-50 (below)
      media.style.transformStyle   = 'preserve-3d';
      media.style.backfaceVisibility = 'hidden';          // keep the flip clean
      media.style.margin           = '0';
    });

    // Orbit the whole card: the pivot axis is pushed ORBIT_VW behind it, so rotateX sweeps the card
    // up/down along the cylinder. Done on the card itself (not an inner <img> like the demo) so it
    // works with rich, wrapped cards. yPercent:-50 owns the vertical centre so the scrub can't drop it.
    var orbitPx = window.innerWidth * ORBIT_VW / 100;
    gsap.set(cards, { yPercent: -50, transformOrigin: '50% 50% -' + orbitPx + 'px' });

    // Master timeline: pin the track, scrub 1:1 across the wrap. Triggering on the track (not the
    // wrap) keeps the deck centred when a header sits above it inside the section.
    var master = gsap.timeline({
      scrollTrigger: {
        trigger: track, start: 'top top',
        endTrigger: wrap, end: 'bottom bottom',
        pin: track, pinType: 'transform', scrub: SCRUB
      }
    });

    var isPortrait = window.innerHeight > window.innerWidth;
    var step = (isPortrait ? 1.5 : 1) / cards.length;      // portrait spaces the passes out a bit more
    cards.forEach(function (media, i) {
      var tl = gsap.timeline();
      tl.fromTo(media,
        { rotateX: ROT_IN, zIndex: cards.length - i },
        { xPercent: 100, x: window.innerWidth, rotateX: ROT_OUT, ease: EASE, duration: DUR });
      tl.set(media, { zIndex: 0 }, '-=' + ZFLIP);          // drop the stacking order so the next pass sits on top
      master.add(tl, i * step);
    });

    // refresh once fonts/images settle so measurements are final
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
