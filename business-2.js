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
    const TAB_TRANSCRIPT = 0,
      TAB_SUMMARY = 1;

    const MESSAGE = "Can you let the team know the launch is slipping to Monday? We're still waiting on legal to sign off on the new terms page. We'll have a firm timeline by end of day Thursday.";

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
      gsap.set(tabLines[TAB_TRANSCRIPT], { scaleX: 1, opacity: 1, transformOrigin: 'left center' });
      gsap.set(tabLines[TAB_SUMMARY], { scaleX: 0, opacity: 0, transformOrigin: 'left center' });
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
        .addLabel('slack', 'stop+=0.85');

      tl.to('.biz-animation_pill.is-slack', { opacity: 1, duration: 0.4 }, 'slack').from('.biz-animation_pill.is-slack', { scale: 0.8, y: '.5em', duration: 0.5, ease: 'back.out(2)' }, 'slack').to('.biz-animation_nav-button.is-mic', { backgroundColor: 'rgba(16,19,23,.86)', color: '#ffffff', duration: 0.3 }, 'slack+=0.2').addLabel('invite', 'slack+=1.6');

      tl.to('.biz-animation_pill.is-slack', { opacity: 0, y: '-.4em', duration: 0.55, ease: 'sine.inOut' }, 'invite').to('.biz-animation_chat', { opacity: 0, y: '-.5em', scale: 0.98, duration: 0.55, ease: 'sine.inOut' }, 'invite').to('.biz-animation_nav-buttons', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, 'invite+=0.25').to('.biz-animation_meeting-card', { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, 'invite+=0.5').from('.biz-animation_meeting-cta', { opacity: 0, scale: 0.9, duration: 0.45, ease: 'back.out(2)' }, 'invite+=0.7').to('.biz-animation_meeting-cta', { scale: 0.96, duration: 0.12, ease: 'power2.out' }, 'invite+=1.8').to('.biz-animation_meeting-cta', { scale: 1, duration: 0.3, ease: 'elastic.out(1,.55)' }, 'invite+=1.92').addLabel('call', 'invite+=2.4');

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
        .fromTo('.biz-animation_transcript-line', { opacity: 0, y: '.5em' }, { opacity: 1, y: 0, duration: 0.5, stagger: 1.1 }, 'call+=0.9')
        .addLabel('summary', 'call+=4.6');

      transcriptLines.forEach((line, i) => {
        tl.call(() => bounceSpeaker(line.dataset.bizSpeaker), null, `call+=${(0.9 + i * 1.1).toFixed(2)}`);
      });

      tl.to('.biz-animation_panel-layer.is-transcript', { opacity: 0, y: '-.375em', duration: 0.35, ease: 'power2.in' }, 'summary')
        .call(() => setTab(TAB_SUMMARY), null, 'summary')
        .to(tabLines[TAB_TRANSCRIPT], { scaleX: 0, opacity: 0, duration: 0.3, ease: 'power2.in' }, 'summary')
        .fromTo(tabLines[TAB_SUMMARY], { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.4, ease: 'power3.out' }, 'summary+=0.15')
        .to('.biz-animation_panel-layer.is-summary', { opacity: 1, duration: 0.4 }, 'summary+=0.35')
        .to('.biz-animation_sto-btn.is-stop', { opacity: 0, duration: 0.3, ease: 'power2.in' }, 'summary')
        .to('.biz-animation_sto-btn.is-resume', { opacity: 1, duration: 0.3, ease: 'power2.out' }, 'summary+=0.1')
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
          gsap.set(tabLines[TAB_TRANSCRIPT], { scaleX: 1, opacity: 1 });
          gsap.set(tabLines[TAB_SUMMARY], { scaleX: 0, opacity: 0 });
          gsap.set('.biz-animation_panel-layer.is-transcript', { opacity: 1, y: 0 });
          gsap.set('.biz-animation_transcript-line', { opacity: 0 });
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
