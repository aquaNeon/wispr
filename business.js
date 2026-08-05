
(function () {
  'use strict';


  var T_START      = 0.4;
  var T_IDLE       = 0.9;
  var T_HINT       = 1.6;
  var T_COMPOSE    = 0.5;
  var T_TYPE       = 2.8;
  var T_TYPE_HOLD  = 0.9;
  var T_SLACK      = 1.5;
  var T_INVITE     = 2.0;
  var T_CALL       = 3.2;
  var T_SUMMARY    = 3.6;
  var T_RESET      = 0.8;


  var IN_DUR    = 0.55;
  var IN_Y      = 14;
  var IN_SCALE  = 0.96;
  var IN_EASE   = 'power2.out';
  var OUT_DUR   = 0.4;
  var OUT_Y     = -10;
  var OUT_EASE  = 'power1.inOut';
  var POP_EASE  = 'back.out(2)';


  var DICTATED =
    "Can you let the team know the launch is slipping to Monday? We're still waiting on legal to " +
    "sign off on the new terms page. We'll have a firm timeline by end of day Thursday.";



  var TYPE_CARET = false;
  var PILL_KICK  = 1.06;




  var TYPE_MODE   = 'word';
  var WORD_DUR    = 0.22;
  var WORD_RISE   = 4;
  var LEN_WEIGHT  = 0.06;
  var PAUSE_COMMA = 0.5;
  var PAUSE_STOP  = 1.1;
  var WORD_CLASS  = 'biz-animation_chat-word';



  var RESERVE_BOX = true;
  var RESIZE_SETTLE = 200;




  var HOVER_CLASS = 'is-hover';
  var HOVER_SCALE = 1.08;







  var PRESS_BG    = '#30302F';
  var PRESS_CLASS = 'is-pressed';
  var PRESS_DUR   = 0.2;













  var BAR_REST    = 1;




  var BAR_COLOR   = '#FFFFEB';


  var BAR_COLOR_MEETING = '#34D399';


  var CONVERT_PATHS = true;


  var BAR_W       = 0;
  var BAR_GAP     = 0;
  var BAR_MIN     = 3;
  var BAR_MAX     = 14;
  var BAR_LOCK_ROW = true;















  var AUDIO_MIN   = 0.24;



  var AUDIO_MAX   = 1.1;
  var AUDIO_ENV   = 0.22;
  var AUDIO_SPEED = 2.4;
  var AUDIO_WAVE  = 0.72;
  var AUDIO_WAVE_SPAN = 1.7;


  var DOT_MIN     = 0.35;
  var DOT_SPEED   = 0.9;
  var DOT_STAG    = 0.08;


  var TILE_STAG    = 0.14;
  var LINE_STAG    = 0.55;
  var LINE_DUR     = 0.5;
  var SPEAK_CLASS  = 'is-speaking';
  var TIMER_FROM   = '28:30';
  var TIMER_TICK   = true;
  var TAB_ACTIVE   = 'is-active';
  var REC_PULSE    = 1.4;

  var T_GEN        = 1.6;
  var T_REVEAL     = 2.2;
  var GEN_STAG     = 0.12;
  var REVEAL_STAG  = 0.25;
  var DOC_SCROLL   = '-54%';
  var DOC_DUR      = 0.9;
  var PAUSE_ON_SUMMARY = true;




  var SPEAKER_MAP = { anouk: 'mikel', emeka: 'zharia', bastien: 'hayle' };








  var MOBILE_BP    = 991;

  var STACK_PILLS  = true;
  var STACK_NAV    = true;
  var STACK_LAYERS = true;








  var CARRIERS = [
    'nav-wrap', 'pill-wrap', 'nav', 'chat', 'chat-body', 'chat-bar',
    'meeting-card', 'meeting-info-wrap', 'meeting-cta',
    'people-wrap', 'panel-wrap', 'inner-panel', 'panel-content',
    'meeting-recorder'
  ];

  var RESPECT_RM = true;
  var PAUSE_HIDDEN = true;
  var DEBUG = false;


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

    var tabLines   = qa(root, 'panel-tab-line');
    var sumGen     = q(root, 'summary-gen');
    var sumGenTtl  = q(root, 'summary-gen-title');
    var sumGenList = qa(root, 'summary-gen-list').reduce(function (all, ul) {
      return all.concat([].slice.call(ul.children));
    }, []);
    var sumBlock   = q(root, 'summary-block');
    var sumBlockKids = sumBlock ? [].slice.call(sumBlock.children) : [];
    var sumDoc     = q(root, 'summary-doc');
    var stoStop    = root.querySelector(P + 'sto-btn.is-stop');
    var stoResume  = root.querySelector(P + 'sto-btn.is-resume');
    var sumReveal  = sumBlockKids.length ? sumBlockKids : sumBits;
    if (sumBlockKids.length && sumBits.length) gsap.set(sumBits, { autoAlpha: 1, y: 0 });




    CARRIERS.forEach(function (cls) {
      qa(root, cls).forEach(function (el) {
        gsap.set(el, { autoAlpha: 1 });
      });
    });






    function applyOwnedLayout() {
      if (STACK_PILLS) stack(pillWrap);
      if (STACK_NAV)   stack(nav);
      if (STACK_LAYERS) {
        stack(content, 'start');


        if (content) content.style.gridTemplateRows = 'minmax(0, 1fr)';
      }


      if (dotsWrap && navWave) stack(recorder);
    }
    applyOwnedLayout();





    var cast = [hintPill, slackPill, chatWrap, meetWrap, recorder, meetRecWrap, navButtons, panel]
      .filter(Boolean).concat(tiles);
    function armStart() {
      gsap.set(cast, { autoAlpha: 0, y: IN_Y, scale: IN_SCALE });
      gsap.set(panelWrap, { autoAlpha: 1, y: 0, scale: 1 });
      gsap.set(trLines.concat(sumReveal), { autoAlpha: 0, y: 10 });
      gsap.set(trLayer, { autoAlpha: 1 });
      gsap.set(sumLayer, { autoAlpha: 0 });
      setTab('transcript');
      armSummary();
      if (timer) timer.textContent = TIMER_FROM;
      if (micBtn) { micBtn.classList.remove(HOVER_CLASS); gsap.set(micBtn, { scale: 1 }); }
      releaseAll();
      if (recorder) gsap.set(recorder, { scale: 1 });
      tiles.forEach(function (t) { t.classList.remove(SPEAK_CLASS); gsap.set(t, { scale: IN_SCALE }); });
      restAll();
      stopClock();
      resetChat();
    }


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









    function buildWords() {
      if (!chatText) return;
      chatText.textContent = '';
      chatText.style.position = chatText.style.position || 'relative';



      phEl = document.createElement('span');
      phEl.className = 'biz-animation_chat-placeholder';
      phEl.textContent = placeholder;
      phEl.style.position = 'absolute';
      phEl.style.left = '0';
      phEl.style.top = '0';
      chatText.appendChild(phEl);




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
      if (p < lastP) hideWords();
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





    function reserveBox() {
      if (!chatText || TYPE_MODE !== 'word') return;
      buildWords();
      hideWords();
      measureBox();
      resetChat();
    }








    function measureBox() {
      if (!RESERVE_BOX || !chatText || !wordEls.length) return;
      chatText.style.removeProperty('min-height');
      var h = chatText.offsetHeight;
      if (h) chatText.style.minHeight = h + 'px';
    }



    function remeasureBox() {
      if (!RESERVE_BOX || !chatText || TYPE_MODE !== 'word' || !wordEls.length) return;
      measureBox();
    }













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






    var SVG_NS = 'http://www.w3.org/2000/svg';
    var BAR_CLASS = P.slice(1) + 'wave-bar';




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













    function barSetter(bar, color) {
      var tag = bar.tagName.toLowerCase();


      if (tag === 'rect') {
        var w0 = parseFloat(bar.getAttribute('width'))  || 4.5;
        var h0 = parseFloat(bar.getAttribute('height')) || w0;
        var y0 = parseFloat(bar.getAttribute('y'))      || 0;
        var cy = y0 + h0 / 2;

        if (color) bar.setAttribute('fill', color);
        bar.setAttribute('rx', w0 / 2);
        bar.setAttribute('ry', w0 / 2);

        bar.style.removeProperty('height');
        bar.style.removeProperty('width');
        bar.style.removeProperty('background');
        bar.style.removeProperty('border-radius');

        return {




          drawn: h0,
          full: h0,


          min: Math.max(w0, w0 * BAR_REST),
          set: function (h) {
            var y = cy - h / 2;


            bar.setAttribute('height', h);
            bar.setAttribute('y', y);
            bar.style.setProperty('height', h + 'px');
            bar.style.setProperty('y', y + 'px');
          }
        };
      }


      var svg  = tag === 'svg' ? bar : bar.querySelector('svg');
      var fill = resolveFill(svg, bar, color);
      var w    = resolveWidth(svg, bar);
      log('html bar fill', fill, 'width', w);

      if (svg) {


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


    var clocks = [];
    var waveInfo = [];
    function ambientWave(container, color) {
      color = color || BAR_COLOR;
      if (!container) return null;
      var bars = [].slice.call(container.querySelectorAll(P + 'wave-bar'));



      var rebuilt = 0;
      bars = bars.map(function (el) {
        if (!CONVERT_PATHS || el.tagName.toLowerCase() === 'rect') return el;
        if (!el.getBBox) return el;
        var r = toRect(el);
        if (r) rebuilt++;
        return r || el;
      });
      if (rebuilt) log('rebuilt', rebuilt, 'path bars as rects');




      if (!bars.length && CONVERT_PATHS && container.querySelector) {
        bars = discoverBars(container);
        if (bars.length) log('no .wave-bar elements - discovered', bars.length, 'bars inside the svg');
      }
      if (!bars.length) return null;





      if (bars[0] && bars[0].getBBox) {
        bars.sort(function (a, b) {
          try { return a.getBBox().x - b.getBBox().x; } catch (e) { return 0; }
        });
      }





      if (container.tagName.toLowerCase() === 'svg') {




        container.style.flex = '0 0 auto';
        container.style.overflow = 'visible';
        var vb = (container.getAttribute('viewBox') || '').split(/[\s,]+/).map(parseFloat);
        var box = container.getBoundingClientRect();
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




      var rowFull = 0;
      kit.forEach(function (b) { if (b.drawn > rowFull) rowFull = b.drawn; });
      if (rowFull > 0) kit.forEach(function (b) { b.full = rowFull; });
      log('row scale', rowFull, 'over', kit.length, 'bars');

      var envPh1 = Math.random() * TWO_PI, envPh2 = Math.random() * TWO_PI;
      var n = kit.length;

      function frame(t) {


        var e = (0.5 + 0.5 * Math.sin(t * TWO_PI * 0.9 + envPh1)) *
                (0.5 + 0.5 * Math.sin(t * TWO_PI * 2.3 + envPh2));
        for (var i = 0; i < n; i++) {
          var b = kit[i];

          var v = 0.55 * Math.sin(t * TWO_PI * b.f1 + b.ph1) +
                  0.45 * Math.sin(t * TWO_PI * b.f2 + b.ph2);
          var sJag = (0.5 + 0.5 * v) * (AUDIO_ENV * e + (1 - AUDIO_ENV));

          var xi = n > 1 ? i / (n - 1) : 0.5;
          var wave = 0.6 * Math.sin((xi * AUDIO_WAVE_SPAN - t) * TWO_PI) +
                     0.4 * Math.sin((xi * AUDIO_WAVE_SPAN * 0.5 - t * 0.6) * TWO_PI + 1.7);
          var sWav = (0.5 + 0.5 * wave) * (0.7 + 0.3 * Math.sin(xi * Math.PI));
          var s = AUDIO_WAVE * sWav + (1 - AUDIO_WAVE) * sJag;
          b.set(Math.max(b.min, (AUDIO_MIN + (b.ceil - AUDIO_MIN) * s) * b.full));
        }
      }





      var clock = { t: 0 };
      var tl = gsap.to(clock, {
        t: 1e7, duration: 1e7, ease: 'none', paused: true,
        onUpdate: function () { frame(clock.t * AUDIO_SPEED); }
      });



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


        gsap.killTweensOf(el);
        gsap.set(el, { backgroundColor: el._bizBaseBg || 'rgba(0,0,0,0)' });
      });
    }




    var pulseTargets = [meetStop].filter(Boolean);
    var pulse = gsap.timeline({ repeat: -1, yoyo: true, paused: true })
      .to(pulseTargets, { opacity: 0.55, duration: REC_PULSE, ease: 'sine.inOut' });
    pulse.rest = function () { if (pulseTargets.length) gsap.set(pulseTargets, { opacity: 1 }); };
    clocks.push(pulse);




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


    function recorderMode(mode) {


      gsap.to(dotsWrap, { autoAlpha: mode === 'dots' ? 1 : 0, duration: 0.25, ease: OUT_EASE, overwrite: true });
      gsap.to(navWave,  { autoAlpha: mode === 'wave' ? 1 : 0, duration: 0.25, ease: OUT_EASE, overwrite: true });
      run(dotsTl, mode === 'dots');
      run(navWaveTl, mode === 'wave');


      if (mode === 'wave' && recorder) {
        gsap.fromTo(recorder, { scale: 1 },
          { scale: PILL_KICK, duration: 0.22, ease: POP_EASE, yoyo: true, repeat: 1 });
      }
    }
    if (dotsWrap && navWave) {


      applyOwnedLayout();
      gsap.set(navWave, { autoAlpha: 0 });
    }







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


    function armSummary() {
      if (sumGen)     gsap.set(sumGen, { autoAlpha: 1, y: 0 });
      if (sumGenTtl)  gsap.set(sumGenTtl, { autoAlpha: 0, y: 6 });
      if (sumGenList.length) gsap.set(sumGenList, { autoAlpha: 0, y: 5 });
      if (sumReveal.length)  gsap.set(sumReveal, { autoAlpha: 0, y: 10 });
      if (sumDoc)     gsap.set(sumDoc, { y: 0 });
      if (stoStop)    gsap.set(stoStop, { autoAlpha: 1 });
      if (stoResume)  gsap.set(stoResume, { autoAlpha: 0 });
    }

    function setTab(name, animate) {
      var want = name === 'summary' ? 2 : 1;
      tabs.forEach(function (t, i) { t.classList.toggle(TAB_ACTIVE, i === want); });
      if (!tabLines.length) return;
      tabLines.forEach(function (line, i) {
        var on = tabs[want] ? tabs[want].contains(line) : i === want;
        if (animate) {
          gsap.to(line, { scaleX: on ? 1 : 0, autoAlpha: on ? 1 : 0, transformOrigin: 'left center',
                          duration: 0.35, ease: on ? IN_EASE : OUT_EASE, overwrite: true });
        } else {
          gsap.set(line, { scaleX: on ? 1 : 0, autoAlpha: on ? 1 : 0, transformOrigin: 'left center' });
        }
      });
    }


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

    reserveBox();
    armStart();
    var master = gsap.timeline({
      repeat: reduced ? 0 : -1,
      delay: T_START,
      onRepeat: function () { master.invalidate(); armStart(); }
    });

    tlShow(master, navButtons, 0, { ease: POP_EASE });
    master.to({}, { duration: T_IDLE });

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

    master.add(function () { resetChat(); recorderMode('dots'); }, '>-0.1');
    tlHide(master, navButtons, '<');
    tlShow(master, chatWrap, '<+0.1');
    tlShow(master, recorder, '<+0.05', { ease: POP_EASE });
    master.to({}, { duration: T_COMPOSE });


    master.add(function () {
      recorderMode('wave');
      run(pulse, true);
      if (chatText && placeholderCls && TYPE_MODE === 'char') chatText.classList.remove('is-placeholder');
    });


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


    master.add(function () { recorderMode('off'); run(pulse, false); });
    tlHide(master, chatWrap, '<');
    tlHide(master, recorder, '<+0.06');
    tlShow(master, slackPill, '>-0.05', { ease: POP_EASE });
    master.to({}, { duration: T_SLACK });
    tlHide(master, slackPill, '>');


    master.add(function () { resetChat(); releaseAll(); });
    tlShow(master, navButtons, '<', { ease: POP_EASE });
    tlShow(master, meetWrap, '<+0.08', { ease: POP_EASE });


    master.add(function () { press(recBtn, true); }, '>+0.55');
    master.to({}, { duration: T_INVITE });
    tlHide(master, meetWrap, '>');
    tlHide(master, navButtons, '<+0.1');


    master.add(function () {
      setTab('transcript');
      gsap.set(trLayer, { autoAlpha: 1 });
      gsap.set(sumLayer, { autoAlpha: 0 });
      gsap.set(trLines, { autoAlpha: 0, y: 10 });
      gsap.set(sumReveal, { autoAlpha: 0, y: 10 });
      tiles.forEach(function (t) { t.classList.remove(SPEAK_CLASS); });
      startClock();
      run(meetWaveTl, true);
      run(pulse, true);
    });
    tlShow(master, panel, '>', { duration: 0.6 });
    tlShow(master, tiles, '<+0.1', { ease: POP_EASE, stagger: TILE_STAG });
    tlShow(master, meetRecWrap, '<+0.15', { ease: POP_EASE });


    trLines.forEach(function (line, i) {
      var who = line.querySelector(P + 'transcript-speaker');
      var name = who ? who.textContent : '';
      master.add(function () { speak(name); }, '>-' + (LINE_DUR * 0.5));
      master.fromTo(line, { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: LINE_DUR, ease: IN_EASE, immediateRender: false },
        i === 0 ? '>' : '>-' + Math.max(0, LINE_DUR - LINE_STAG));
    });

    master.to({}, { duration: T_CALL });

    master.add(function () {
      setTab('summary', true);
      if (PAUSE_ON_SUMMARY) { run(meetWaveTl, false); run(pulse, false); stopClock(); }
    });
    master.to(trLayer, { autoAlpha: 0, y: -6, duration: 0.35, ease: OUT_EASE }, '<');
    if (stoStop)   master.to(stoStop, { autoAlpha: 0, duration: 0.3, ease: OUT_EASE }, '<');
    if (stoResume) master.to(stoResume, { autoAlpha: 1, duration: 0.3, ease: IN_EASE }, '<+0.1');
    master.fromTo(sumLayer, { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.4, ease: IN_EASE, immediateRender: false }, '<+0.15');

    if (sumGenTtl || sumGenList.length) {
      if (sumGenTtl) {
        master.fromTo(sumGenTtl, { autoAlpha: 0, y: 6 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: IN_EASE, immediateRender: false }, '>-0.1');
      }
      if (sumGenList.length) {
        master.fromTo(sumGenList, { autoAlpha: 0, y: 5 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: IN_EASE, stagger: GEN_STAG, immediateRender: false },
          '<+0.15');
      }
      master.to({}, { duration: T_GEN });
      if (sumGen) master.to(sumGen, { autoAlpha: 0, y: -5, duration: 0.35, ease: OUT_EASE });
    }

    master.fromTo(sumReveal, { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.45, ease: IN_EASE, stagger: REVEAL_STAG, immediateRender: false },
      sumGen ? '>-0.15' : '<+0.1');
    master.to({}, { duration: T_REVEAL });

    if (sumDoc) {
      master.to(sumDoc, { y: DOC_SCROLL, duration: DOC_DUR, ease: 'power2.inOut' });
      master.to({}, { duration: T_SUMMARY });
    } else {
      master.to({}, { duration: T_SUMMARY });
    }


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




    function reflow() { applyOwnedLayout(); remeasureBox(); }

    var lastW = window.innerWidth;
    var reflowT = null;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(reflowT);
      reflowT = setTimeout(reflow, RESIZE_SETTLE);
    });




    if (window.matchMedia) {
      var mq = window.matchMedia('(max-width: ' + MOBILE_BP + 'px)');
      var onBreak = function () {
        log('breakpoint ->', mq.matches ? 'tablet and down' : 'desktop');
        reflow();
      };
      if (mq.addEventListener) mq.addEventListener('change', onBreak);
      else if (mq.addListener) mq.addListener(onBreak);
    }


    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { remeasureBox(); });
    }



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
