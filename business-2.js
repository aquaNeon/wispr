(function () {
  var TYPE_DUR    = 4.2;
  var WORD_DUR    = 0.22;
  var WORD_RISE   = 4;
  var LEN_WEIGHT  = 0.06;
  var PAUSE_COMMA = 0.5;
  var PAUSE_STOP  = 1.1;
  var WORD_CLASS  = 'biz-animation_chat-word';
  var RESERVE_BOX = true;
  var RESIZE_SETTLE = 200;
  var SLACK_IN_NAV = true;
  var KEEP_CHAT_ON_SLACK = true;

  var TR_WORDS      = true;
  var TR_TYPE_DUR   = 0.8;
  var TR_WORD_DUR   = 0.26;
  var TR_WORD_RISE  = 3;
  var TR_GROW       = true;
  var TR_NAME_POP   = true;
  var TR_NAME_DUR   = 0.4;
  var TR_SVG        = true;
  var TR_SVG_MODE   = 'wave';
  var TR_SVG_DUR    = 0.45;
  var TR_SVG_HOLD   = 1.1;
  var TR_SVG_MIN    = 0.35;
  var TR_SVG_SEL    = 'svg';

  var STO_MODE          = 'text';
  var STO_LABEL_REST    = 'Stop';
  var STO_LABEL_SUMMARY = 'Resume';
  var REC_ICON_SWAP     = true;
  var REC_ICON_SVG =
    '<svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="2.91488" cy="2.91488" r="2.62339" fill="white" stroke="#059669" stroke-width="0.582976"/>' +
    '<circle cx="2.91339" cy="2.91535" r="1.09308" fill="#059669"/>' +
    '</svg>';

  var FOOTER_OUT    = true;
  var FOOTER_OUT_TEXT = /what did i miss/i;
  var FOOTER_OUT_SEL = '';
  var FOOTER_DUR    = 0.35;
  var STO_BTN_SEL   = '.biz-animation_sto-btn.is-stop, .biz-animation_sto-btn, .biz-animation_panel-footer-stop';

  var DARK_LINE       = true;
  var DARK_LINE_COLOR = '#1A1A1A';

  var RAINBOW       = true;
  var RAINBOW_COLORS = '#7b5cf0, #f0994a, #ef7fa8, #f0994a, #7b5cf0';
  var RAINBOW_SIZE  = 280;
  var RAINBOW_SPEED = 3.2;

  function initAllBizAnimations() {
    document.querySelectorAll('.biz-animation_wrap').forEach(initBizAnimation);
  }

  function initBizAnimation(root) {
    if (root._bizInitialized) return;
    root._bizInitialized = true;

    const q = (s) => root.querySelector(s);
    const qa = (s) => Array.from(root.querySelectorAll(s));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const chatText = q('.biz-animation_chat-text');
    const tabs = qa('.biz-animation_panel-tab');
    const tabLines = qa('.biz-animation_panel-tab-line');
    const transcriptLines = qa('.biz-animation_transcript-line');

    function tabIndex(re, fallback) {
      for (let i = 0; i < tabs.length; i++) {
        if (re.test((tabs[i].textContent || '').trim())) return i;
      }
      return fallback;
    }
    const TAB_TRANSCRIPT = tabIndex(/transcript/i, 0);
    const TAB_SUMMARY = tabIndex(/summar/i, 1);
    function tabLine(i) {
      const t = tabs[i];
      return (t && t.querySelector('.biz-animation_panel-tab-line')) || tabLines[i] || null;
    }
    const TR_LINE_EL = tabLine(TAB_TRANSCRIPT);
    const SUM_LINE_EL = tabLine(TAB_SUMMARY);

    const MESSAGE = "Can you let the team know the launch is slipping to Monday? We're still waiting on legal to sign off on the new terms page. We'll have a firm timeline by end of day Thursday.";

    const nav = q('.biz-animation_nav');
    const slackPill = q('.biz-animation_pill.is-slack');
    if (SLACK_IN_NAV && nav && slackPill) {
      nav.appendChild(slackPill);
      nav.style.display = 'grid';
      nav.style.gridTemplateColumns = '1fr';
      nav.style.alignItems = 'center';
      nav.style.justifyItems = 'center';
      Array.from(nav.children).forEach((c) => { c.style.gridArea = '1 / 1'; });
    }

    const placeholder = chatText ? chatText.textContent : '';
    const placeholderCls = !!(chatText && chatText.classList.contains('is-placeholder'));
    let phEl = null;
    let wordEls = [];
    let shown = 0;
    let lastP = 0;
    let dictating = false;

    function wordPlan(text) {
      const words = text.split(/\s+/).filter(Boolean);
      const costs = words.map((w) => {
        let c = 1 + w.length * LEN_WEIGHT;
        if (/[.!?]["')\]]?$/.test(w)) c += PAUSE_STOP;
        else if (/[,;:]["')\]]?$/.test(w)) c += PAUSE_COMMA;
        return c;
      });
      const total = costs.reduce((a, b) => a + b, 0) || 1;
      const at = [];
      let run = 0;
      for (let i = 0; i < costs.length; i++) { at.push(run / total); run += costs[i]; }
      return { words, at };
    }
    const PLAN = wordPlan(MESSAGE);

    function buildWords() {
      if (!chatText) return;
      chatText.textContent = '';
      if (!chatText.style.position) chatText.style.position = 'relative';

      phEl = document.createElement('span');
      phEl.className = 'biz-animation_chat-placeholder';
      phEl.textContent = placeholder;
      phEl.style.position = 'absolute';
      phEl.style.left = '0';
      phEl.style.top = '0';
      chatText.appendChild(phEl);

      wordEls = PLAN.words.map((w, i) => {
        if (i) chatText.appendChild(document.createTextNode(' '));
        const s = document.createElement('span');
        s.className = WORD_CLASS;
        s.textContent = w;
        chatText.appendChild(s);
        return s;
      });
      gsap.set(wordEls, { display: 'inline-block' });
    }

    function hideWords() {
      if (!wordEls.length) return;
      gsap.set(wordEls, { autoAlpha: 0, y: WORD_RISE });
      shown = 0;
      lastP = 0;
    }

    function measureBox() {
      if (!RESERVE_BOX || !chatText || !wordEls.length) return;
      chatText.style.removeProperty('min-height');
      const h = chatText.offsetHeight;
      if (h) chatText.style.minHeight = h + 'px';
    }

    function resetChat() {
      if (!chatText) return;
      hideWords();
      dictating = false;
      if (phEl) gsap.set(phEl, { autoAlpha: 1 });
      if (placeholderCls) chatText.classList.add('is-placeholder');
    }

    function startDictation() {
      if (!chatText) return;
      dictating = true;
      if (placeholderCls) chatText.classList.remove('is-placeholder');
      if (phEl) gsap.set(phEl, { autoAlpha: 0 });
      hideWords();
    }

    function revealTo(p) {
      if (!wordEls.length) return;
      if (p < lastP) hideWords();
      lastP = p;
      while (shown < PLAN.at.length && PLAN.at[shown] <= p) {
        gsap.to(wordEls[shown], {
          autoAlpha: 1, y: 0, duration: WORD_DUR, ease: 'power2.out', overwrite: true
        });
        shown++;
      }
    }

    if (chatText) {
      buildWords();
      hideWords();
      measureBox();
      resetChat();
    }

    const lineTypers = transcriptLines.map((line) => {
      const textEl = line.querySelector('.biz-animation_transcript-text');
      if (!TR_WORDS || !textEl) return null;
      const raw = textEl.textContent.trim();
      const plan = wordPlan(raw);
      textEl.textContent = '';
      if (TR_GROW) {
        textEl.style.display = 'inline-block';
        textEl.style.maxWidth = '100%';
      }
      const words = plan.words.map((w, i) => {
        const s = document.createElement('span');
        s.className = 'biz-animation_transcript-word';
        s.textContent = i === plan.words.length - 1 ? w : w + ' ';
        s.style.whiteSpace = 'pre-wrap';
        s.style.display = 'none';
        textEl.appendChild(s);
        return s;
      });
      const state = { shown: 0, last: 0 };
      return {
        line, textEl, words, at: plan.at, state,
        arm() {
          state.shown = 0;
          state.last = 0;
          words.forEach((w) => { w.style.display = 'none'; gsap.set(w, { autoAlpha: 0, y: TR_WORD_RISE }); });
        },
        reveal(p) {
          if (p < state.last) this.arm();
          state.last = p;
          while (state.shown < this.at.length && this.at[state.shown] <= p) {
            const w = words[state.shown];
            w.style.display = 'inline';
            gsap.to(w, { autoAlpha: 1, y: 0, duration: TR_WORD_DUR, ease: 'power2.out', overwrite: true });
            state.shown++;
          }
        },
        fill() { this.reveal(1.0001); }
      };
    });

    const lineSvgs = transcriptLines.map((line) => {
      if (!TR_SVG) return [];
      return Array.from(line.querySelectorAll(TR_SVG_SEL)).reduce((all, svg) => {
        const shapes = Array.from(svg.querySelectorAll('path, line, polyline, rect, circle, ellipse'));
        return all.concat(shapes.length ? shapes : [svg]);
      }, []).map((shape) => {
        const stroked = shape.getTotalLength &&
          getComputedStyle(shape).stroke !== 'none' &&
          parseFloat(getComputedStyle(shape).strokeWidth) > 0;
        let len = 0;
        if (stroked) { try { len = shape.getTotalLength(); } catch (e) { len = 0; } }
        return { shape, len: len || 0 };
      });
    });

    const lineNames = transcriptLines.map((l) => l.querySelector('.biz-animation_transcript-speaker'));
    const svgTweens = [];

    function armSvgs(i) {
      (lineSvgs[i] || []).forEach(({ shape, len }) => {
        shape.style.transformBox = 'fill-box';
        shape.style.transformOrigin = 'center';
        if (TR_SVG_MODE === 'draw' && len) {
          gsap.set(shape, { strokeDasharray: len, strokeDashoffset: len, autoAlpha: 1 });
        } else if (TR_SVG_MODE === 'wave') {
          gsap.set(shape, { autoAlpha: 1, scaleY: TR_SVG_MIN });
        } else {
          gsap.set(shape, { autoAlpha: 0, scaleY: 0.2 });
        }
      });
    }

    function drawSvgs(i) {
      (lineSvgs[i] || []).forEach(({ shape, len }, k) => {
        if (TR_SVG_MODE === 'draw' && len) {
          gsap.to(shape, { strokeDashoffset: 0, duration: TR_SVG_DUR, ease: 'power2.out', delay: k * 0.08, overwrite: true });
          return;
        }
        if (TR_SVG_MODE !== 'wave') {
          gsap.to(shape, { autoAlpha: 1, scaleY: 1, duration: TR_SVG_DUR, ease: 'back.out(2)', delay: k * 0.08, overwrite: true });
          return;
        }
        const wt = gsap.timeline({ delay: k * 0.06 });
        const beats = Math.max(2, Math.round(TR_SVG_HOLD / 0.26));
        for (let b = 0; b < beats; b++) {
          wt.to(shape, {
            scaleY: gsap.utils.random(TR_SVG_MIN, 1, 0.01),
            duration: gsap.utils.random(0.18, 0.32),
            ease: 'sine.inOut'
          });
        }
        wt.to(shape, { scaleY: TR_SVG_MIN, duration: 0.3, ease: 'sine.out' });
        svgTweens.push(wt);
      });
    }

    function popName(i) {
      const el = lineNames[i];
      if (!TR_NAME_POP || !el) return;
      gsap.fromTo(el, { autoAlpha: 0, y: 4, scale: 0.88 },
        { autoAlpha: 1, y: 0, scale: 1, duration: TR_NAME_DUR, ease: 'back.out(2.4)', overwrite: true });
    }

    function armTranscript() {
      lineTypers.forEach((t) => { if (t) t.arm(); });
      svgTweens.splice(0).forEach((t) => t.kill());
      transcriptLines.forEach((_, i) => armSvgs(i));
      if (TR_NAME_POP) {
        lineNames.filter(Boolean).forEach((el) => gsap.set(el, { autoAlpha: 0, y: 4, scale: 0.88 }));
      }
    }
    armTranscript();

    if ((RAINBOW || DARK_LINE) && tabLines.length) {
      const id = 'biz-tabline-style';
      if (!document.getElementById(id)) {
        const st = document.createElement('style');
        st.id = id;
        st.textContent =
          '@keyframes bizRainbow{from{background-position:0% 50%}to{background-position:' + RAINBOW_SIZE + '% 50%}}' +
          '.biz-animation_panel-tab-line.is-rainbow{' +
          'background-image:linear-gradient(90deg,' + RAINBOW_COLORS + ') !important;' +
          'background-size:' + RAINBOW_SIZE + '% 100%;' +
          'border-radius:999px;' +
          'animation:bizRainbow ' + RAINBOW_SPEED + 's linear infinite;}' +
          '.biz-animation_panel-tab-line.is-dark{' +
          'background-image:none !important;' +
          'background-color:' + DARK_LINE_COLOR + ' !important;' +
          'border-radius:999px;animation:none;}';
        document.head.appendChild(st);
      }
    }
    function darkLine(on) {
      if (!DARK_LINE || !TR_LINE_EL) return;
      TR_LINE_EL.classList.toggle('is-dark', !!on);
    }
    const stoStop = q('.biz-animation_sto-btn.is-stop');
    const stoResume = q('.biz-animation_sto-btn.is-resume');
    const recStop = q('.biz-animation_meeting-recorder-stop');
    const stoLabel = stoStop ? (stoStop.querySelector('.biz-animation_text') || stoStop) : null;
    const recIconRest = recStop ? recStop.innerHTML : '';
    const recBgRest = recStop ? recStop.style.background : '';

    const footerEls = (() => {
      if (!FOOTER_OUT) return [];
      if (FOOTER_OUT_SEL) return qa(FOOTER_OUT_SEL);
      const deepest = qa('*').filter((el) => {
        if (!FOOTER_OUT_TEXT.test((el.textContent || '').trim())) return false;
        return !Array.from(el.children).some((c) => FOOTER_OUT_TEXT.test((c.textContent || '').trim()));
      });
      const set = [];
      deepest.forEach((el) => {
        set.push(el);
        const own = (el.textContent || '').trim();
        let node = el;
        while (node.parentElement && node.parentElement !== root &&
               (node.parentElement.textContent || '').trim() === own) {
          node = node.parentElement;
          set.push(node);
        }
      });
      return set;
    })();

    const stoBtn = q(STO_BTN_SEL);
    let stoLabelNode = null;
    let stoIconHost = null;
    let stoIconRest = '';
    if (stoBtn) {
      const kid = Array.from(stoBtn.children).find(
        (c) => c.textContent.trim() && c.tagName.toLowerCase() !== 'svg' && !c.querySelector('svg')
      );
      if (kid) {
        stoLabelNode = kid;
      } else {
        stoLabelNode = Array.from(stoBtn.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim()) || null;
      }
      const icon = stoBtn.querySelector('svg') ||
        Array.from(stoBtn.children).find((c) => !c.textContent.trim() && c !== stoLabelNode);
      if (icon) {
        stoIconHost = document.createElement('span');
        stoIconHost.className = 'biz-animation_sto-icon';
        stoIconHost.style.display = 'inline-flex';
        icon.parentNode.insertBefore(stoIconHost, icon);
        stoIconHost.appendChild(icon);
        stoIconRest = stoIconHost.innerHTML;
      }
    }

    function stoSummary(on) {
      if (STO_MODE !== 'text') return;
      const label = on ? STO_LABEL_SUMMARY : STO_LABEL_REST;
      if (stoLabelNode) stoLabelNode.textContent = label;
      else if (stoLabel) stoLabel.textContent = label;
      if (!REC_ICON_SWAP) return;
      if (stoIconHost) {
        stoIconHost.innerHTML = on ? REC_ICON_SVG : stoIconRest;
      } else if (recStop) {
        recStop.innerHTML = on ? REC_ICON_SVG : recIconRest;
        recStop.style.background = on ? 'transparent' : recBgRest;
      }
    }

    function rainbow(on) {
      if (!RAINBOW || !SUM_LINE_EL) return;
      SUM_LINE_EL.classList.toggle('is-rainbow', !!on);
    }

    function buildWave(bars) {
      const wt = gsap.timeline({ paused: true });
      bars.forEach((bar, i) => {
        wt.to(
          bar,
          {
            scaleY: gsap.utils.random(0.45, 1, 0.01),
            duration: gsap.utils.random(0.18, 0.34),
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          },
          i * 0.05,
        );
      });
      return wt;
    }
    const waveDictation = buildWave(qa('.biz-animation_recorder .biz-animation_wave-bar'));
    const waveMeeting = buildWave(qa('.biz-animation_meeting-recorder-wrap .biz-animation_wave-bar'));

    const dotPulse = gsap.timeline({ repeat: -1, paused: true }).to('.biz-animation_recorder-dot', { opacity: 0.3, duration: 0.35, stagger: { each: 0.06, yoyo: true, repeat: 1 } });

    const stopPulse = gsap.timeline({ repeat: -1, paused: true }).to('.biz-animation_meeting-recorder-stop', { opacity: 0.35, scale: 0.9, duration: 0.45, yoyo: true, repeat: 1, ease: 'sine.inOut' });

    function setTab(index) {
      tabs.forEach((t, i) => t.classList.toggle('is-active', i === index));
    }

    function bounceSpeaker(name) {
      if (!name) return;
      const tile = q(`.biz-animation_people-item[data-biz-speaker="${name}"] .biz-animation_tile-visual`);
      if (!tile) return;
      gsap.timeline().to(tile, { y: '-.06em', scale: 1.03, duration: 0.16, ease: 'sine.out' }).to(tile, { y: 0, scale: 1, duration: 0.18, ease: 'sine.in' }).to(tile, { y: '-.05em', scale: 1.025, duration: 0.16, ease: 'sine.out' }, '+=0.15').to(tile, { y: 0, scale: 1, duration: 0.2, ease: 'sine.in' });
    }

    const ctx = gsap.context(() => {
      gsap.set('.biz-animation_chat', { opacity: 0, y: '1em', scale: 0.97 });
      gsap.set('.biz-animation_nav-button', { opacity: 0, y: '.625em', scale: 0.8 });
      gsap.set('.biz-animation_nav-buttons', { opacity: 0, scale: 0.7 });
      gsap.set(tabLines, { scaleX: 0, opacity: 0, transformOrigin: 'left center' });
      gsap.set(TR_LINE_EL, { scaleX: 1, opacity: 1, transformOrigin: 'left center' });
      gsap.set('.biz-animation_panel', { opacity: 0, y: '.75em', scale: 0.98 });
      gsap.set('.biz-animation_people-item', { opacity: 0, y: '.875em', scale: 0.9 });
      gsap.set('.biz-animation_meeting-recorder', { opacity: 0, scale: 0.8 });
      gsap.set('.biz-animation_meeting-recorder-wrap', { opacity: 0, scale: 0.8 });
      gsap.set('.biz-animation_meeting-card', { opacity: 0, y: '.625em' });
      gsap.set('.biz-animation_recorder', { opacity: 0, scale: 0.7 });
      gsap.set('.biz-animation_pill', { opacity: 0 });
      gsap.set('.biz-animation_sto-btn.is-stop', { opacity: 1 });
      gsap.set('.biz-animation_sto-btn.is-resume', { opacity: 0 });
      gsap.set('.biz-animation_summary-gen-title', { opacity: 0, y: '.4em' });
      gsap.set('.biz-animation_summary-gen-list li', { opacity: 0, y: '.3em' });
      gsap.set('.biz-animation_summary-doc', { y: 0 });

      if (reduced) {
        gsap.set('.biz-animation_pill.is-hint', { opacity: 1 });
        if (chatText) {
          startDictation();
          revealTo(1.0001);
        }
        return;
      }

      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power3.out' } });
      root._bizTimeline = tl;
      tl.call(() => { stoSummary(false); rainbow(false); darkLine(true); }, null, 0);

      tl.to('.biz-animation_nav-button', { opacity: 1, y: 0, scale: 1, stagger: 0.07, duration: 0.5 }).to('.biz-animation_nav-buttons', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, '<').addLabel('idle', '+=0.9');

      tl.to('.biz-animation_pill.is-hint', { opacity: 1, duration: 0.45 }, 'idle').from('.biz-animation_pill.is-hint', { scale: 0.82, y: '.5em', duration: 0.5, ease: 'back.out(2.2)' }, 'idle').to('.biz-animation_nav-button.is-mic', { backgroundColor: '#30302f', scale: 0.92, duration: 0.28, ease: 'power2.out' }, 'idle+=0.45').to('.biz-animation_nav-button.is-mic', { scale: 1, duration: 0.35, ease: 'elastic.out(1,.6)' }, 'idle+=0.73').addLabel('dictate', 'idle+=1.5');

      tl.to('.biz-animation_pill.is-hint', { opacity: 0, y: '-.375em', duration: 0.3, ease: 'power2.in' }, 'dictate')
        .to('.biz-animation_nav-buttons', { opacity: 0, scale: 0.7, duration: 0.32, ease: 'power2.in' }, 'dictate')
        .to('.biz-animation_recorder', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, 'dictate+=0.18')
        .to('.biz-animation_chat', { opacity: 1, y: 0, scale: 1, duration: 0.55 }, 'dictate+=0.1')
        .call(() => dotPulse.play(), null, 'dictate+=0.4')
        .addLabel('speak', 'dictate+=1.2');

      const typed = { p: 0 };
      tl.to('.biz-animation_recorder-dots', { opacity: 0, scale: 0.6, duration: 0.25 }, 'speak')
        .to('.biz-animation_recorder .biz-animation_wave', { opacity: 1, duration: 0.3 }, 'speak+=0.1')
        .to('.biz-animation_recorder', { minWidth: '8.25em', duration: 0.4 }, 'speak')
        .call(
          () => {
            dotPulse.pause();
            waveDictation.play();
          },
          null,
          'speak',
        )
        .fromTo(typed, { p: 0 }, {
          p: 1,
          duration: TYPE_DUR,
          ease: 'none',
          immediateRender: false,
          onStart: startDictation,
          onUpdate: () => revealTo(typed.p),
          onComplete: () => revealTo(1.0001)
        }, 'speak+=0.25')
        .addLabel('stop', 'speak+=4.9');

      tl.to('.biz-animation_recorder .biz-animation_wave-bar', { scaleY: 0.22, duration: 0.3, stagger: 0.015 }, 'stop')
        .call(() => waveDictation.pause(), null, 'stop+=0.3')
        .to('.biz-animation_recorder', { opacity: 0, scale: 0.8, duration: 0.35, ease: 'power2.in' }, 'stop+=0.35')
        .addLabel('slack', SLACK_IN_NAV ? 'stop+=0.55' : 'stop+=0.85');

      tl.to('.biz-animation_pill.is-slack', { opacity: 1, duration: 0.4 }, 'slack').from('.biz-animation_pill.is-slack', { scale: 0.8, y: SLACK_IN_NAV ? '.25em' : '.5em', duration: 0.5, ease: 'back.out(2)' }, 'slack').to('.biz-animation_nav-button.is-mic', { backgroundColor: 'rgba(16,19,23,.86)', color: '#ffffff', duration: 0.3 }, 'slack+=0.2').addLabel('invite', 'slack+=1.6');

      tl.to('.biz-animation_pill.is-slack', { opacity: 0, y: KEEP_CHAT_ON_SLACK ? '.3em' : '-.4em', scale: KEEP_CHAT_ON_SLACK ? 0.9 : 1, duration: 0.45, ease: 'sine.inOut' }, 'invite').to('.biz-animation_chat', { opacity: 0, y: '-.5em', scale: 0.98, duration: 0.55, ease: 'sine.inOut' }, 'invite').to('.biz-animation_nav-buttons', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, 'invite+=0.25').to('.biz-animation_meeting-card', { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, 'invite+=0.5').from('.biz-animation_meeting-cta', { opacity: 0, scale: 0.9, duration: 0.45, ease: 'back.out(2)' }, 'invite+=0.7').to('.biz-animation_meeting-cta', { scale: 0.96, duration: 0.12, ease: 'power2.out' }, 'invite+=1.8').to('.biz-animation_meeting-cta', { scale: 1, duration: 0.3, ease: 'elastic.out(1,.55)' }, 'invite+=1.92').addLabel('call', 'invite+=2.4');

      tl.to('.biz-animation_meeting-card', { opacity: 0, y: '.5em', duration: 0.35, ease: 'power2.in' }, 'call')
        .to('.biz-animation_nav-buttons', { opacity: 0, scale: 0.7, duration: 0.3, ease: 'power2.in' }, 'call')
        .to('.biz-animation_people-wrap', { opacity: 1, duration: 0.2 }, 'call+=0.15')
        .to('.biz-animation_people-item', { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.09, ease: 'back.out(1.5)' }, 'call+=0.2')
        .to('.biz-animation_panel', { opacity: 1, y: 0, scale: 1, duration: 0.6 }, 'call+=0.35')
        .to('.biz-animation_meeting-recorder', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, 'call+=0.5')
        .to('.biz-animation_meeting-recorder-wrap', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, 'call+=0.5')
        .call(
          () => {
            waveMeeting.play();
            stopPulse.play();
          },
          null,
          'call+=0.55',
        )
        .addLabel('summary', 'call+=4.6');

      transcriptLines.forEach((line, i) => {
        const at = `call+=${(0.9 + i * 1.1).toFixed(2)}`;
        const typer = lineTypers[i];
        tl.fromTo(line, { opacity: 0, y: '.5em' },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', immediateRender: false }, at);
        tl.call(() => { bounceSpeaker(line.dataset.bizSpeaker); drawSvgs(i); popName(i); }, null, at);
        if (typer) {
          const p = { v: 0 };
          tl.fromTo(p, { v: 0 }, {
            v: 1, duration: TR_TYPE_DUR, ease: 'none', immediateRender: false,
            onStart: () => typer.arm(),
            onUpdate: () => typer.reveal(p.v),
            onComplete: () => typer.fill()
          }, `call+=${(0.9 + i * 1.1 + 0.12).toFixed(2)}`);
        }
      });

      tl.to('.biz-animation_panel-layer.is-transcript', { opacity: 0, y: '-.375em', duration: 0.35, ease: 'power2.in' }, 'summary')
        .call(() => { setTab(TAB_SUMMARY); rainbow(true); darkLine(false); }, null, 'summary')
        .to(TR_LINE_EL, { scaleX: 0, opacity: 0, duration: 0.3, ease: 'power2.in' }, 'summary')
        .fromTo(SUM_LINE_EL, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.4, ease: 'power3.out' }, 'summary+=0.15')
        .to('.biz-animation_panel-layer.is-summary', { opacity: 1, duration: 0.4 }, 'summary+=0.35')
        .to(STO_MODE === 'text' ? '.biz-animation_sto-btn.is-resume' : '.biz-animation_sto-btn.is-stop',
          { opacity: 0, duration: 0.3, ease: 'power2.in' }, 'summary')
        .call(() => stoSummary(true), null, 'summary+=0.1')
        .to(footerEls.length ? footerEls : {}, { opacity: 0, duration: FOOTER_DUR, ease: 'power2.in' }, 'summary')
        .call(
          () => {
            waveMeeting.pause();
            stopPulse.pause();
          },
          null,
          'summary',
        )
        .addLabel('gen', 'summary+=0.35');

      tl.fromTo('.biz-animation_summary-gen-title', { opacity: 0, y: '.4em' }, { opacity: 1, y: 0, duration: 0.4 }, 'gen').fromTo('.biz-animation_summary-gen-list li', { opacity: 0, y: '.3em' }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12 }, 'gen+=0.15').addLabel('genOut', 'gen+=1.6');

      tl.to('.biz-animation_summary-gen', { opacity: 0, y: '-.3em', duration: 0.35, ease: 'power2.in' }, 'genOut').addLabel('reveal', 'genOut+=0.15');

      tl.fromTo('.biz-animation_summary-block > *', { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.25 }, 'reveal').addLabel('scroll', 'reveal+=2.2');

      tl.to('.biz-animation_summary-doc', { y: '-54%', duration: 0.9, ease: 'power2.inOut' }, 'scroll').addLabel('out', 'scroll+=1.5');

      tl.to('.biz-animation_meeting-recorder', { opacity: 0, scale: 0.85, duration: 0.4, ease: 'power2.in' }, 'out').to('.biz-animation_meeting-recorder-wrap', { opacity: 0, scale: 0.85, duration: 0.4, ease: 'power2.in' }, 'out').to('.biz-animation_panel', { opacity: 0, y: '.625em', scale: 0.98, duration: 0.5, ease: 'power2.in' }, 'out+=0.1').to('.biz-animation_people-item', { opacity: 0, y: '.7em', scale: 0.92, duration: 0.55, stagger: 0.08, ease: 'sine.inOut' }, 'out+=0.15').to('.biz-animation_people-wrap', { opacity: 0, duration: 0.4, ease: 'sine.inOut' }, 'out+=0.6').addLabel('reset', 'out+=1.2');

      tl.call(
        () => {
          resetChat();
          setTab(TAB_TRANSCRIPT);
          rainbow(false);
          darkLine(true);
          gsap.set(tabLines, { scaleX: 0, opacity: 0 });
          gsap.set(TR_LINE_EL, { scaleX: 1, opacity: 1 });
          gsap.set('.biz-animation_panel-layer.is-transcript', { opacity: 1, y: 0 });
          gsap.set('.biz-animation_transcript-line', { opacity: 0 });
          armTranscript();
          gsap.set('.biz-animation_tile-visual', { y: 0, scale: 1 });
          gsap.set('.biz-animation_people-item', { opacity: 0, y: '.875em', scale: 0.9 });
          gsap.set('.biz-animation_panel-layer.is-summary', { opacity: 0 });
          gsap.set('.biz-animation_summary-gen', { opacity: 1, y: 0 });
          gsap.set('.biz-animation_summary-gen-title', { opacity: 0, y: '.4em' });
          gsap.set('.biz-animation_summary-gen-list li', { opacity: 0, y: '.3em' });
          gsap.set('.biz-animation_summary-doc', { y: 0 });
          gsap.set('.biz-animation_summary-block > *', { opacity: 0 });
          gsap.set('.biz-animation_recorder-dots', { opacity: 1, scale: 1 });
          gsap.set('.biz-animation_recorder .biz-animation_wave', { opacity: 0 });
          gsap.set('.biz-animation_recorder', { minWidth: '6.5em' });
          gsap.set('.biz-animation_pill', { opacity: 0, y: 0 });
          gsap.set('.biz-animation_nav-buttons', { opacity: 0, scale: 0.7 });
          gsap.set('.biz-animation_sto-btn.is-stop', { opacity: 1 });
          gsap.set('.biz-animation_sto-btn.is-resume', { opacity: 0 });
          stoSummary(false);
          if (footerEls.length) gsap.set(footerEls, { opacity: 1 });
          gsap.set('.biz-animation_chat', { opacity: 0, y: '1em', scale: 0.97 });
          gsap.set('.biz-animation_meeting-card', { opacity: 0, y: '.625em' });
          gsap.set('.biz-animation_people-wrap', { opacity: 0 });
        },
        null,
        'reset',
      ).to({}, { duration: 0.8 });

      let lastW = window.innerWidth;
      let reflowT = null;
      window.addEventListener('resize', () => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        clearTimeout(reflowT);
        reflowT = setTimeout(measureBox, RESIZE_SETTLE);
      });
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(measureBox);
      }

      root._bizChat = { reveal: revealTo, reset: resetChat, measure: measureBox, words: () => wordEls };

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => (e.isIntersecting ? tl.play() : tl.pause()));
          },
          { threshold: 0 },
        ).observe(root);
      }
    }, root);

    return ctx;
  }

  function waitForGsapThenInit() {
    if (window.gsap) {
      initAllBizAnimations();
    } else {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (window.gsap) {
          clearInterval(check);
          initAllBizAnimations();
        } else if (attempts > 50) {
          clearInterval(check);
          console.warn('biz-animation: GSAP not found, skipping init.');
        }
      }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForGsapThenInit);
  } else {
    waitForGsapThenInit();
  }
})();
