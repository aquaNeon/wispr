// notetaker page - hero transcript + task deck. ported from the approved prototype
// (wispr-notetaker.netlify.app). contract: [data-transcript=wrap|track|name|sentence|card|
// card-name|card-sentence] + data-transcript-task on rows that spawn a task.
(function () {

    // pre-paint guard: without this the Designer-state card and transcript rows
    // paint first and visibly re-style when init() runs. visibility (not display)
    // so init can still measure row/card heights.
    var READY_ATTR = 'data-notetaker-ready';
    function reveal() {
      document.documentElement.setAttribute(READY_ATTR, '');
    }
    (function preboot() {
      if (document.documentElement.classList.contains('wf-design-mode')) {
        return; // Designer canvas: leave the authored state visible for editing
      }
      var s = document.createElement('style');
      s.id = 'notetaker-preboot';
      s.textContent =
        '[data-transcript="wrap"],[data-transcript="card"]{visibility:hidden}' +
        'html[' + READY_ATTR + '] [data-transcript="wrap"],html[' + READY_ATTR + '] [data-transcript="card"]{visibility:visible}';
      (document.head || document.documentElement).appendChild(s);
      // failsafe: a script error must never leave the section blank
      setTimeout(reveal, 4000);
    })();

    var MAX_LINES = 5;
    var LINE_MS = 1100; // minimum time between lines
    // live-transcription typing: letters flow up into place as the line enters —
    // same motion language as the card's name wave (one direction, no bounce)
    var LETTER_STAGGER = 28; // ms per letter — the typing cadence
    var LETTER_IN_MS = 260; // per-letter rise/fade duration
    var LETTER_RISE = 8; // px each letter rises from
    var LINE_GAP_MS = 400; // breath after a line finishes typing
    var TASK_HOLD_MS = 1100; // extra hold on a commitment line while its task flies to the deck
    var FADE_STOP = '42%';
    var FADE_ALPHA = 0.25;
    // newest line (bottom) is the live/highlighted one; history fades as it rises
    var OPACITIES = [1.0, 0.5, 0.32, 0.18, 0.08];
    var WIDTH_PAD = 120;

    var ATTR = 'data-transcript';
    var A_WRAP = 'wrap';
    var A_TRACK = 'track';
    var A_NAME = 'name';
    var A_SENTENCE = 'sentence';
    var A_CARD = 'card'; // card wrapper synced to focus line
    var A_CARD_NAME = 'card-name'; // name badge wrap inside card (gets bg color)
    var A_CARD_SENT = 'card-sentence'; // task text inside card
    var A_TASK_ATTR = 'data-transcript-task'; // distilled task text on rows that spawn a task

    var CARD_FADE_MS = 200; // opacity fade each half of the swap
    var CARD_SWAP_MS = CARD_FADE_MS + 10; // swap text only once fully faded out

    var EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

    // playful action-card entrance (fires each time a new task lands in the card)
    var CARD_POP = true; // master switch for the entrance
    var BACK_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // overshoot (back.out feel)
    var CARD_IN_MS = 420; // whole card pop-in duration
    var PILL_IN_MS = 380; // green name-pill enter duration
    var PILL_DELAY = 90; // pill lags the card slightly
    // pill entrance: starts as a circle, scales on X out to full width
    var PILL_ORIGIN = '50% 50%'; // circle grows from centre; 'left center' unrolls from the left
    // name text waves in per-letter AFTER the pill finishes expanding (fast)
    var NAME_WAVE_RISE = 6; // px each name letter drops in from
    var NAME_WAVE_STAGGER = 18; // ms per letter — fast wave
    var NAME_WAVE_MS = 220; // per-letter in duration
    var NAME_WAVE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'; // soft easeOut, no bounce

    // task text: per-letter wave — wisprflow's button-hover motion language, but a
    // SINGLE hump (up -> settle) so one ripple rolls across quickly, not up-down-settle.
    var TEXT_RIPPLE = true;
    var RIPPLE_Y_PCT = 20; // yPercent lift at the crest (relative to letter height)
    var RIPPLE_ROT = 5; // deg rotation at the crest
    var RIPPLE_STAGGER = 45; // ms delay per letter (wave speed)
    var RIPPLE_LETTER_MS = 500; // per-letter up-and-back duration
    var RIPPLE_EASE = 'linear'; // matches their ease: 'none'

    // the deck is sized to the LONGEST task it will ever show, not to whichever one happens to
    // be on screen: the cards are absolutely positioned at left:0/right:0, so they all share the
    // wrap's width, and a wrap sized by the grid breaks the long tasks onto a second line. every
    // task is measured through the same per-letter rendering the real card uses, and the widest
    // wins — so the deck never reflows between cards and no task ever wraps.
    var CARD_FIT_TEXT = true;
    var CARD_FIT_PAD = 0; // px of slack on top of the widest measured task
    var CARD_MAX_W = 0; // px hard cap. 0 = only the viewport gutter below applies
    var CARD_FIT_GUTTER = 24; // px kept clear each side, so a long task can't cause page scroll

    var CARD_RADIUS = ''; // action card corner radius ('' = leave Webflow's value)
    var CARD_BORDER = '2px solid var(--border-color--border-secondary)'; // '' = leave Webflow's border

    // task deck: newest card slots in at the bottom, aligned with the live
    // transcript line; older tasks stack up behind it
    var STACK_OFFSET = 14; // px each older card peeks above the newer one
    var STACK_SCALE = 0.045; // how much each older card shrinks
    var STACK_FADE = 0; // older cards keep full opacity — the deck shows 3 solid cards
    var STACK_MAX = 3; // cards kept in the deck (incl. newest)
    var CARD_FROM_X = -140; // entrance start: negative = from the transcript side
    var CARD_TILT_MAX = 3; // deg — each landed card rests at a slight random angle
    var CARD_IN_TRAVEL_MS = 780; // whole left-to-right journey duration
    var CARD_FROM_SCALE = 0.72; // cards start small and grow as they travel
    var THROW_BUMP_X = 14; // px the committing line nudges right as it throws

    // stacked layout (tablet and down): the throw rotates — card drops in from above, line nudges down
    // notetaker only — deliberately wider than Webflow's own 991 tablet breakpoint, so the deck
    // stacks under the transcript before the layout itself goes to tablet.
    var STACK_BP     = 1150;  // px at or below which the layout is stacked
    var CARD_FROM_Y  = -120;  // entrance start when stacked: negative = from above the deck
    var THROW_BUMP_Y = 14;    // px the committing line nudges DOWN as it throws
    var STACK_GAP    = 14;    // px between transcript and deck when stacked
    var THROW_BUMP_MS = 480; // out-and-back duration of that nudge

    // stack scroll: the whole column glides up one row each line — smooth, no per-line jump
    var SWOOSH = 'cubic-bezier(0.16, 1, 0.3, 1)'; // easeOutExpo — drag then snap into place
    var ENTER_MS = 0.6; // seconds for the glide (bump to 0.8 for more drag)

    var SENTENCES = [];
    var container = null;
    var scroller = null; // inner column we translate to scroll the whole stack
    var rowHeightPx = 0;
    var lines = [];
    var sentenceIdx = 0;
    var wordIdx = 0;
    var words = [];

    var liveWave = null; // waveform bars on the pill of the line being spoken

    var cardEl = null; // the deck wrap
    var innerTemplate = null; // pristine clone of the Webflow card
    var cardStack = []; // card nodes, newest first
    var cardInnerH = 0; // front card height, for centering on the live line
    var FOCUS_FB = 0; // "from bottom" index of the opacity-1.0 line
    var hasTasks = false; // any row carries data-transcript-task
    var lastCardKey = ''; // dedupe: skip re-swapping to identical task+name


    // ---- transcript content: edit HERE, not in the Designer ----
    // The Webflow rows are only used as styling templates (one per speaker);
    // the lines below are what actually plays. task '' = no card.
    // owner = who the task is assigned to on the card. omit when it's the speaker.
    var CONTENT = [
      { name: 'Mark', text: 'Can everyone see the CES proposal?', task: '' },
      { name: 'Alix', text: 'Yep. Keep in mind the floor plan isn’t final.', task: '' },
      { name: 'Hailey', text: 'The agency is sending this afternoon.', task: '' },
      { name: 'DeShawn', text: 'Is the interactive wall still in?', task: '' },
      { name: 'Jay', text: 'For now.', task: '' },
      { name: 'Mark', text: 'Do we really need it?', task: '' },
      { name: 'Hailey', text: 'I’d rather use that space for another demo.', task: '' },
      { name: 'DeShawn', text: 'Agreed. I’ll flag it.', task: 'Replace interactive wall with demo space' },
      { name: 'Mark', text: 'Demos should be top priority for us.', task: '' },
      { name: 'Alix', text: 'What are we planning to show?', task: '' },
      { name: 'Hailey', text: 'The AI assistant and Tableau dashboard.', task: '' },
      { name: 'DeShawn', text: 'Let’s keep each spiel under five minutes.', task: '' },
      { name: 'Mark', text: 'Jay, can you confirm the flow?', task: '' },
      { name: 'Jay', text: 'Yep, I’ll review it with Product and Eoin.', task: 'Review demo flow with Product team and Eoin' },
      { name: 'Alix', text: 'Is the booth schedule finalized?', task: '' },
      { name: 'Hailey', text: 'Almost. Sales and Product will rotate.', task: '' },
      { name: 'Alix', text: 'Engineering should be there for live demos.', task: '' },
      { name: 'DeShawn', text: 'Agreed, but not all day.', task: '' },
      { name: 'Mark', text: 'Let’s say 11am–2pm tentatively.', task: '' },
      { name: 'Hailey', text: 'I’ll let them know.', task: 'Notify Engineering of tentative 11am–2pm CES coverage' },
      { name: 'DeShawn', text: 'What’s our meeting target again?', task: '' },
      { name: 'Jay', text: '25 over the course of three days.', task: '' },
      { name: 'Mark', text: 'We need Sales targeting priority accounts ASAP.', task: '' },
      { name: 'Alix', text: 'Who’s handling the list?', task: '' },
      { name: 'DeShawn', text: 'I’ll send it to Yasmin tomorrow morning.', task: 'Send priority account list to Yasmin tomorrow morning' },
      { name: 'Jay', text: 'Thanks. I’ll check their progress Friday.', task: 'Check Sales outreach progress Friday' },
      { name: 'Hailey', text: 'Has everyone booked their travel?', task: '' },
      { name: 'Alix', text: 'Not everyone on my team.', task: '' },
      { name: 'Mark', text: 'We need to wrap that up by the 10th.', task: '' },
      { name: 'Hailey', text: 'The 8th, actually.', task: '' },
      { name: 'Alix', text: 'Reminding them now.', task: 'Remind team to book CES travel by the 8th' },
      { name: 'Alix', text: 'Expense reports go through Ramp, right?', task: '' },
      { name: 'DeShawn', text: 'Yes. We switched over last month.', task: '' },
      { name: 'Hailey', text: 'I’ll note that in the event channel too.', task: 'Post Ramp expense reminder in the event channel' },
      { name: 'Mark', text: 'Any other concerns?', task: '' },
      { name: 'Hailey', text: 'Nope. I’m excited!', task: '' }
    ];
    // >>> PLACEHOLDER — change this one hex when the real colour lands. <<<
    // Mark is the fifth speaker and Webflow only authors four pill variants, so he has no row of
    // his own. This is his colour outright, not a borrowed one: MARK_BG is written straight onto
    // the pill and the name's text colour is derived from its luminance (see textOn), so a light
    // or a dark hex both work with no other edit.
    var MARK_BG = '#7232A6';

    // pill variant per speaker — picks which Webflow row gets CLONED. structure only: every colour
    // on the clone is overwritten from COLOR_BY_NAME below. Mark clones 'pulse' purely because a
    // row has to be cloned from somewhere and a fixed choice keeps the markup predictable.
    var PILL_BY_NAME = { Jay: 'pulse', Mark: 'pulse', Alix: 'signal', Hailey: 'dawn', DeShawn: 'fathom' };

    // hard override, wins over the cloned Webflow colours — the variant lookup
    // can't be trusted here. bg only; `text` is derived from bg luminance
    // unless stated. leave a name out to keep using its Webflow row.
    var COLOR_BY_NAME = {
      Jay: { bg: '#7F1C34' }, // pulse
      Alix: { bg: '#FFBCF2' }, // signal
      Hailey: { bg: '#FFA946' }, // dawn
      DeShawn: { bg: '#034F46' }, // fathom
      Mark: { bg: MARK_BG }, // placeholder — see MARK_BG above
    };
    var TEXT_ON_DARK = '#FFFDF9';
    var TEXT_ON_LIGHT = '#1A1A1A';

    // read live: the breakpoint can be crossed without a reload
    function isStacked() {
      return !!(window.matchMedia && window.matchMedia('(max-width: ' + STACK_BP + 'px)').matches);
    }

    // readable name colour for a pill background (sRGB relative luminance)
    function autoText(hex) {
      var h = String(hex).replace('#', '');
      if (h.length === 3) {
        h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      }
      if (h.length !== 6) {
        return TEXT_ON_LIGHT;
      }
      var c = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
      var i, v, lin = [];
      for (i = 0; i < 3; i++) {
        v = c[i] / 255;
        lin.push(v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      }
      var L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
      return L > 0.42 ? TEXT_ON_LIGHT : TEXT_ON_DARK;
    }

    // resolved {bg, text} for a speaker, or null when no override is set
    function overrideFor(name) {
      var o = COLOR_BY_NAME[name];
      if (!o || !o.bg) {
        return null;
      }
      return { bg: o.bg, text: o.text || autoText(o.bg) };
    }
    // what the card shows before the first task fires (last task in the loop,
    // so the rotation reads as continuous)
    var CARD_DEFAULT = { name: 'Jay', task: 'Watch the SLA' };
    var tplByName = {};
    var tplByVariant = {};

    // styling template for a speaker: explicit pill wins, then PILL_BY_NAME,
    // then a same-named Webflow row, then the first row as a last resort
    function pillTemplate(name, pill) {
      var v = pill || PILL_BY_NAME[name];
      return (v && tplByVariant[v]) || tplByName[name] || SENTENCES[0];
    }

    function readSentencesFromDOM() {
      var tracks = container.querySelectorAll('[' + ATTR + '="' + A_TRACK + '"]');
      var result = [];
      var i, track, badge, sentEl, computed, clone, cloneBadge;
      for (i = 0; i < tracks.length; i++) {
        track = tracks[i];
        badge = track.querySelector('[' + ATTR + '="' + A_NAME + '"]');
        sentEl = track.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
        if (!badge || !sentEl) {
          continue;
        }

        // bg sits on the badge div, but the text color is set on the inner text
        // element (.hero_record_name) — read each from where it actually lives
        var nameTextEl = badge.querySelector('.hero_record_name') || badge.querySelector('[' + ATTR + '="name-text"]') || badge.querySelector('*') || badge;
        computed = window.getComputedStyle(badge);
        var textColor = window.getComputedStyle(nameTextEl).color;
        clone = track.cloneNode(true);
        cloneBadge = clone.querySelector('[' + ATTR + '="' + A_NAME + '"]');
        if (cloneBadge) {
          cloneBadge.style.backgroundColor = computed.backgroundColor;
        }

        // attr may sit on the track itself or any descendant (Webflow nesting)
        var taskHolder = track.hasAttribute(A_TASK_ATTR) ? track : track.querySelector('[' + A_TASK_ATTR + ']');
        var task = taskHolder ? taskHolder.getAttribute(A_TASK_ATTR) : '';
        task = task ? task.trim() : '';

        result.push({
          template: clone,
          text: sentEl.textContent.trim(),
          task: task,
          name: badge.textContent.trim(),
          nameColor: textColor,
          nameBg: computed.backgroundColor,
          variant: track.getAttribute('data-wf--drop-hero-stranscript--variant') || '',
        });
      }
      return result;
    }

    function lockWidth() {
      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;left:-9999px;display:flex;flex-direction:column;';
      document.body.appendChild(probe);

      var maxW = 0,
        maxRowH = 0;
      var i, row, sentEl;
      for (i = 0; i < SENTENCES.length; i++) {
        row = SENTENCES[i].template.cloneNode(true);
        sentEl = row.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
        if (sentEl) {
          sentEl.textContent = SENTENCES[i].text;
        }
        row.style.whiteSpace = 'nowrap';
        probe.appendChild(row);
        if (row.offsetWidth > maxW) {
          maxW = row.offsetWidth;
        }
        if (row.offsetHeight > maxRowH) {
          maxRowH = row.offsetHeight;
        }
      }

      document.body.removeChild(probe);
      // no width forced from JS — the Webflow grid owns the column width.
      // allow the wrap to shrink inside its grid track (grid items default to min-width:auto)
      container.style.minWidth = '0';

      rowHeightPx = maxRowH;
    }

    // opacity for a screen slot counted from the bottom (0 = bottom row)
    function opForSlot(slot) {
      if (slot < 0 || slot > MAX_LINES - 1) {
        return 0;
      }
      return OPACITIES[slot] !== undefined ? OPACITIES[slot] : 0.4;
    }

    function refreshStyles() {
      var total = lines.length;
      var i, fromBottom, op;
      for (i = 0; i < total; i++) {
        if (lines[i].placeholder) {
          continue;
        }
        fromBottom = total - 1 - i;
        op = OPACITIES[fromBottom] !== undefined ? OPACITIES[fromBottom] : 0.4;
        lines[i].el.style.opacity = op;
      }
    }

    // a card node in the deck: absolutely positioned, bottom-anchored
    function styleCardNode(node) {
      node.style.position = 'absolute';
      node.style.left = '0';
      node.style.right = '0';
      node.style.bottom = '0';
      // width is forced, not inferred. left:0 + right:0 only stretches a box whose width is auto,
      // and any width Webflow puts on the card wins over that - so each card sized to its OWN task
      // text and the deck changed shape every time a new one landed. min/max cleared for the same
      // reason: either one would let the card disagree with the deck it sits in.
      node.style.width = '100%';
      node.style.minWidth = '0';
      node.style.maxWidth = 'none';
      node.style.boxSizing = 'border-box';
      node.style.transformOrigin = '50% 100%';
      if (CARD_RADIUS) {
        node.style.setProperty('border-radius', CARD_RADIUS, 'important');
      }
    }

    // widen the deck to the longest task in the script.
    // measured inside cardEl rather than in a detached probe: the card's font-size, weight and
    // letter-spacing are all inherited, and a clone parked on document.body would be measured
    // against the body's typography instead of the card's.
    function fitCardWidth() {
      if (!CARD_FIT_TEXT || !cardEl || !innerTemplate) {
        return;
      }
      var probe = innerTemplate.cloneNode(true);
      // max-content, NOT auto. an absolutely positioned box with width:auto is shrink-to-fit,
      // and shrink-to-fit is capped by its containing block - which is cardEl, which this
      // function then pins. so with a pin in place no task could ever measure wider than the
      // pin already was, long tasks under-measured, and the text wrapped. max-content is the
      // intrinsic width and ignores the containing block entirely.
      probe.style.cssText += ';position:absolute;left:-9999px;top:0;right:auto;' +
        'width:max-content;width:-webkit-max-content;max-width:none;' +
        'visibility:hidden;pointer-events:none;white-space:nowrap;';
      cardEl.appendChild(probe);

      var sentEl = probe.querySelector('[' + ATTR + '="' + A_CARD_SENT + '"]');
      var nameWrap = probe.querySelector('[' + ATTR + '="' + A_CARD_NAME + '"]');
      var nameText = nameWrap ? nameWrap.querySelector('*') || nameWrap : null;
      if (sentEl) {
        sentEl.style.whiteSpace = 'nowrap';
      }
      if (nameWrap) {
        nameWrap.style.whiteSpace = 'nowrap';
        nameWrap.style.flexShrink = '0';
      }

      // every task that can reach the card, plus the one it shows before the first task fires
      // MIRRORS syncCard: a line puts its task on the card, or - when no row carries the task
      // attribute at all - its whole sentence. measuring only the task strings meant the legacy
      // path was sized for text that never appears, and the sentences that do appear wrapped.
      var jobs = [];
      var i, text;
      for (i = 0; i < CONTENT.length; i++) {
        text = CONTENT[i].task ? CONTENT[i].task : (hasTasks ? '' : CONTENT[i].text);
        if (text) {
          jobs.push({ name: CONTENT[i].owner || CONTENT[i].name, task: text });
        }
      }
      for (i = 0; i < SENTENCES.length; i++) {   // DOM rows can carry their own task text
        text = SENTENCES[i].task ? SENTENCES[i].task : (hasTasks ? '' : SENTENCES[i].text);
        if (text) {
          jobs.push({ name: SENTENCES[i].name, task: text });
        }
      }
      jobs.push({ name: CARD_DEFAULT.name, task: CARD_DEFAULT.task });

      var max = 0,
        widest = '';
      for (i = 0; i < jobs.length; i++) {
        if (nameText) {
          nameText.textContent = jobs[i].name;
        }
        // the same per-letter build the live card uses: inline-block letters measure a little
        // wider than a plain text node, and measuring the plain string would undershoot
        if (sentEl) {
          setTextLetters(sentEl, jobs[i].task);
        }
        if (probe.offsetWidth > max) {
          max = probe.offsetWidth;
          widest = jobs[i].name + ' / ' + jobs[i].task;
        }
      }
      cardEl.removeChild(probe);
      if (!max) {
        return;
      }

      var target = max + CARD_FIT_PAD;
      // min-width, not width: the deck is a grid item, and a set width would be overridden by
      // the track while a min-width makes the track itself grow
      //
      // PINNED, not floored. min-width alone was the bug: it stops the deck getting narrower than
      // the longest task, but says nothing about it getting WIDER. the deck is a grid item beside
      // the transcript, whose rows are white-space:nowrap and hug their own text - so a long line
      // widens the transcript's track, the grid re-solves, and the deck takes whatever is left.
      // above the floor the deck simply followed the transcript, which is why a long line made the
      // cards grow. all three properties are set so no track sizing can move it in either
      // direction, and flex is neutralised in case the parent is a flex row rather than a grid.
      // target is what the CARD needs. the deck is border-box, and the cards inside it are
      // width:100% - which resolves against the deck's CONTENT box - so any padding or border on
      // the deck comes straight off the card. pinning the deck to the card's own width therefore
      // hands the card that much less than it was measured to need, and the text wraps by exactly
      // the padding. add it back.
      var dcs = window.getComputedStyle(cardEl);
      var deckPad = (parseFloat(dcs.paddingLeft) || 0) + (parseFloat(dcs.paddingRight) || 0) +
                    (parseFloat(dcs.borderLeftWidth) || 0) + (parseFloat(dcs.borderRightWidth) || 0);
      var pinned = target + deckPad;

      // caps apply to the pinned box, not the inner target — the deck is what occupies the page,
      // so clamping the target left the deck deckPad wider than whatever limit was asked for
      if (CARD_MAX_W) {
        pinned = Math.min(pinned, CARD_MAX_W);
      }
      var room = (document.documentElement.clientWidth || 0) - CARD_FIT_GUTTER * 2;
      if (room > 0 && pinned > room) {
        pinned = room;   // narrow screen: wrapping beats pushing the page sideways
      }

      cardEl.style.boxSizing = 'border-box';
      cardEl.style.width = pinned + 'px';
      cardEl.style.minWidth = pinned + 'px';
      cardEl.style.maxWidth = pinned + 'px';
      cardEl.style.flex = '0 0 auto';
    }

    // push older cards up-and-back; drop the ones past the deck limit
    function restack() {
      var i, node, t;
      for (i = 1; i < cardStack.length; i++) {
        node = cardStack[i];
        if (i >= STACK_MAX) {
          (function (n) {
            if (typeof n.animate === 'function') {
              var a = n.animate([{ opacity: 0 }], { duration: 250, fill: 'both' });
              a.onfinish = function () {
                if (n.parentNode) n.parentNode.removeChild(n);
              };
            } else if (n.parentNode) {
              n.parentNode.removeChild(n);
            }
          })(node);
          continue;
        }
        node.style.zIndex = String(50 - i);
        t = 'translateY(' + -STACK_OFFSET * i + 'px) scale(' + (1 - STACK_SCALE * i) + ') rotate(' + (node._tilt || 0) + 'deg)';
        if (typeof node.animate === 'function') {
          node.animate([{ transform: t, opacity: Math.max(0, 1 - STACK_FADE * i) }], { duration: 350, easing: EASE, fill: 'both' });
        } else {
          node.style.transform = t;
        }
      }
      cardStack.length = Math.min(cardStack.length, STACK_MAX);
    }

    // letters drop in + fade, staggered — used for the name wave-in after the pill expands
    function waveInLetters(el, txt) {
      if (typeof el.animate !== 'function') {
        el.textContent = txt;
        el.style.opacity = '1';
        return;
      }
      var spans = setTextLetters(el, txt);
      el.style.opacity = '1';
      for (var i = 0; i < spans.length; i++) {
        (function (sp, idx) {
          sp.style.opacity = '0';
          sp.animate(
            [
              { opacity: 0, transform: 'translateY(' + NAME_WAVE_RISE + 'px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: NAME_WAVE_MS, delay: idx * NAME_WAVE_STAGGER, easing: NAME_WAVE_EASE, fill: 'both' },
          );
        })(spans[i], i);
      }
    }

    // rebuild the text as per-letter inline-block spans so each can be animated.
    // letters are grouped into per-word wrappers: an inline-block is a break
    // opportunity, so ungrouped letters let the browser split mid-word
    // ("Amplitud|e"). the wrapper keeps each word whole; breaks land on spaces.
    function setTextLetters(el, txt) {
      el.textContent = '';
      var spans = [];
      var words = txt.split(' ');
      var w, word, wrap, i, ch, s;
      for (w = 0; w < words.length; w++) {
        word = words[w] + (w < words.length - 1 ? ' ' : '');
        wrap = document.createElement('span');
        wrap.style.display = 'inline-block';
        wrap.style.whiteSpace = 'pre'; // no break inside the word
        for (i = 0; i < word.length; i++) {
          ch = word.charAt(i);
          s = document.createElement('span');
          s.textContent = ch === ' ' ? '\u00A0' : ch; // keep spaces in inline-block flow
          s.style.display = 'inline-block';
          s.style.willChange = 'transform';
          wrap.appendChild(s);
          spans.push(s);
        }
        el.appendChild(wrap);
      }
      return spans;
    }

    // one ripple: each letter rolls up to a single crest then settles back,
    // staggered left-to-right. yPercent via translateY('%') = relative to letter height.
    function rippleLetters(spans) {
      var up = -RIPPLE_Y_PCT,
        ru = -RIPPLE_ROT;
      for (var i = 0; i < spans.length; i++) {
        (function (sp, idx) {
          sp.animate(
            [
              { transform: 'translateY(0%) rotate(0deg)', offset: 0 },
              { transform: 'translateY(' + up + '%) rotate(' + ru + 'deg)', offset: 0.5 },
              { transform: 'translateY(0%) rotate(0deg)', offset: 1 },
            ],
            { duration: RIPPLE_LETTER_MS, delay: idx * RIPPLE_STAGGER, easing: RIPPLE_EASE },
          );
        })(spans[i], i);
      }
    }

    function updateCard(sentence, taskText) {
      if (!cardEl || !sentence) {
        return;
      }

      // the badge names the assignee — often not the speaker who said the line
      var ownerName = sentence.owner || sentence.name;
      var ownerBg = sentence.ownerBg || sentence.nameBg;
      var ownerColor = sentence.ownerColor || sentence.nameColor;

      var key = ownerName + ' ' + taskText;
      if (key === lastCardKey) {
        return;
      } // already showing this — no flash
      lastCardKey = key;

      var node = innerTemplate.cloneNode(true);
      styleCardNode(node);
      node.style.zIndex = '50';
      node._tilt = (Math.random() * 2 - 1) * CARD_TILT_MAX; // settles like a tossed card

      var nameWrap = node.querySelector('[' + ATTR + '="' + A_CARD_NAME + '"]');
      var nameText = nameWrap ? nameWrap.querySelector('*') || nameWrap : null;
      var sentEl = node.querySelector('[' + ATTR + '="' + A_CARD_SENT + '"]');

      if (nameWrap) {
        nameWrap.style.backgroundColor = ownerBg;
        nameWrap.style.color = ownerColor;
        nameWrap.style.whiteSpace = 'nowrap'; // the badge never breaks mid-name
        nameWrap.style.flexShrink = '0'; // ...and the task text yields to it, not the reverse
      }
      if (nameText) {
        nameText.style.color = ownerColor;
        nameText.textContent = ownerName;
        nameText.style.opacity = '0'; // waves in once the pill has expanded
      }

      cardEl.appendChild(node);
      cardStack.unshift(node);
      initSparkle(node, true);
      restack();

      // fly in from the transcript side: fade up fast at the start so the card
      // is visible for most of its left-to-right journey, overshoot into place
      if (CARD_POP && typeof node.animate === 'function') {
        node.animate(
          [
            { transform: (isStacked()
                ? 'translateY(' + CARD_FROM_Y + 'px)'
                : 'translateX(' + CARD_FROM_X + 'px)') +
                ' scale(' + CARD_FROM_SCALE + ') rotate(0deg)', opacity: 0, offset: 0 },
            { opacity: 1, offset: 0.22 },
            { transform: 'translateX(0) scale(1) rotate(' + node._tilt + 'deg)', opacity: 1, offset: 1 },
          ],
          { duration: CARD_IN_TRAVEL_MS, easing: BACK_EASE, fill: 'both' },
        );
      }

      // pill: circle -> full width, then the name waves in
      if (nameWrap && typeof nameWrap.animate === 'function') {
        nameWrap.style.transformOrigin = PILL_ORIGIN;
        var r = nameWrap.getBoundingClientRect();
        var startX = r.width > 0 ? Math.max(0.05, r.height / r.width) : 0.25; // circle: w == h
        nameWrap.animate([{ transform: 'scaleX(' + startX + ')' }, { transform: 'scaleX(1)' }], { duration: PILL_IN_MS, delay: PILL_DELAY, easing: BACK_EASE, fill: 'both' });
      }
      if (nameText) {
        (function (el, txt) {
          setTimeout(function () {
            waveInLetters(el, txt);
          }, PILL_DELAY + PILL_IN_MS);
        })(nameText, ownerName);
      }

      // task text ripples as the card lands
      if (sentEl) {
        if (TEXT_RIPPLE && typeof sentEl.animate === 'function') {
          var spans = setTextLetters(sentEl, taskText);
          rippleLetters(spans);
        } else {
          sentEl.textContent = taskText;
        }
      }
      // task text keeps its own color — only the NAME recolors
    }

    // keep whatever the card ships with from Webflow (never blank it), and record
    // that as the dedupe baseline so the matching line won't re-swap to the same text
    function primeCard() {
      if (!cardStack.length) {
        return;
      }
      var first = cardStack[0];
      var st = first.querySelector('[' + ATTR + '="' + A_CARD_SENT + '"]');
      var nw = first.querySelector('[' + ATTR + '="' + A_CARD_NAME + '"]');
      lastCardKey = (nw ? nw.textContent.trim() : '') + ' ' + (st ? st.textContent.trim() : '');
    }

    // mirror the line currently sitting in the opacity-1.0 (focus) slot.
    // task mode: only rows carrying data-transcript-task update the card.
    // legacy: if no row has that attr, every focus line uses its sentence text.
    function syncCard() {
      if (!cardEl) {
        return;
      }
      var idx = lines.length - 1 - FOCUS_FB;
      if (idx < 0) {
        return;
      }
      var ln = lines[idx];
      if (!ln || ln.placeholder || !ln.sentence) {
        return;
      }

      var s = ln.sentence;
      var taskText = s.task ? s.task : hasTasks ? '' : s.text;
      if (!taskText) {
        return;
      } // this line spawns no task — hold the card

      // focus is the newest line: the instant its last character lands, the
      // line throws its task out to the deck — nudging right as it lets go
      if (FOCUS_FB === 0) {
        setTimeout(function () {
          if (ln.el && typeof ln.el.animate === 'function') {
            ln.el.animate(
              [
                { transform: 'translateX(0)', offset: 0 },
                { transform: isStacked()
                    ? 'translateY(' + THROW_BUMP_Y + 'px)'
                    : 'translateX(' + THROW_BUMP_X + 'px)', offset: 0.35 },
                { transform: 'translateX(0)', offset: 1 },
              ],
              { duration: THROW_BUMP_MS, easing: 'ease-in-out' },
            );
          }
          updateCard(s, taskText);
        }, typeDuration(s.text));
      } else {
        updateCard(s, taskText);
      }
    }

    function addPlaceholder() {
      var track = SENTENCES[0].template.cloneNode(true);
      var sentEl = track.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
      track.style.opacity = '0';
      if (rowHeightPx > 0) {
        track.style.minHeight = rowHeightPx + 'px';
      }
      track.setAttribute('aria-hidden', 'true');
      scroller.appendChild(track);
      lines.push({ el: track, sentenceEl: sentEl, placeholder: true });
    }

    function evictOldest() {
      var old = lines.shift();
      if (old.el.parentNode) {
        old.el.parentNode.removeChild(old.el);
      }
    }

    function addLine(sentence) {
      var lineEl = sentence.template.cloneNode(true);
      var sentEl = lineEl.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
      var badge = lineEl.querySelector('[' + ATTR + '="' + A_NAME + '"]');
      var nameWrap = badge ? badge.parentNode : null;
      var nmEl = badge ? badge.querySelector('.hero_record_name') : null;
      if (nmEl) {
        nmEl.textContent = sentence.name;
      }
      // re-apply the resolved colours: the clone carries its template row's
      // baked-in background, which a COLOR_BY_NAME override must beat
      if (badge) {
        if (sentence.nameBg) {
          badge.style.backgroundColor = sentence.nameBg;
        }
        badge.style.whiteSpace = 'nowrap';
      }
      if (nmEl && sentence.nameColor) {
        nmEl.style.color = sentence.nameColor;
      }

      if (sentEl) {
        typeLetters(sentEl, sentence.text);
      } // words type in like live transcription

      var pillEl = lineEl.querySelector('[' + ATTR + '="' + A_NAME + '"]');
      if (pillEl) {
        var wave = makeWave(sentence.nameColor);
        pillEl.insertBefore(wave.el, pillEl.firstChild);
        if (liveWave) {
          liveWave.stop();
        }
        liveWave = wave;
        wave.start();
      }
      if (rowHeightPx > 0) {
        lineEl.style.minHeight = rowHeightPx + 'px';
      }
      lineEl.style.willChange = 'opacity';
      if (nameWrap) {
        nameWrap.style.opacity = '1';
      } // name rides the row — no separate slide/fade

      scroller.appendChild(lineEl);
      lines.push({ el: lineEl, sentenceEl: sentEl, nameWrap: nameWrap, sentence: sentence, placeholder: false });

      var n = lines.length;
      var i, l, fromBottom;

      // warm-up: stack still filling from the bottom — just fade the new row in place
      if (n <= MAX_LINES) {
        for (i = 0; i < n; i++) {
          if (lines[i].placeholder) {
            continue;
          }
          lines[i].el.style.transition = 'opacity ' + ENTER_MS + 's ' + SWOOSH;
          lines[i].el.style.opacity = opForSlot(n - 1 - i);
        }
        lineEl.style.opacity = '0';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            lineEl.style.opacity = opForSlot(0);
            syncCard();
          });
        });
        return;
      }

      // steady state: physically scroll the whole column up one row, then drop the top row.
      // pre-offset the scroller DOWN one row and set each row to the slot it sits in NOW,
      // so the frame looks unchanged before the glide starts.
      scroller.style.transition = 'none';
      scroller.style.transform = 'translateY(' + rowHeightPx + 'px)';
      for (i = 0; i < n; i++) {
        l = lines[i];
        if (l.placeholder) {
          continue;
        }
        fromBottom = n - 1 - i;
        l.el.style.transition = 'none';
        l.el.style.opacity = opForSlot(fromBottom - 1);
      }

      void scroller.offsetHeight; // flush the pre-offset before animating

      requestAnimationFrame(function () {
        scroller.style.transition = 'transform ' + ENTER_MS + 's ' + SWOOSH;
        scroller.style.transform = 'translateY(0)'; // glide the stack up one row
        for (i = 0; i < n; i++) {
          l = lines[i];
          if (l.placeholder) {
            continue;
          }
          fromBottom = n - 1 - i;
          l.el.style.transition = 'opacity ' + ENTER_MS + 's ' + SWOOSH;
          l.el.style.opacity = opForSlot(fromBottom); // crossfade toward its new slot
        }
        syncCard();
      });

      setTimeout(
        function () {
          evictOldest(); // remove the row that scrolled off the top
          scroller.style.transition = 'none';
          scroller.style.transform = 'translateY(0)';
          refreshStyles();
        },
        Math.round(ENTER_MS * 1000) + 30,
      );
    }

    // three tiny waveform bars (like the Flow mark) inside a pill, left of the
    // name — animated while that person is talking, frozen once they stop
    function makeWave(color) {
      var el = document.createElement('span');
      el.className = 'tw-wave';
      el.style.color = color;
      var bars = [];
      for (var i = 0; i < 3; i++) {
        var b = document.createElement('i');
        el.appendChild(b);
        bars.push(b);
      }
      var KF = [
        [0.5, 1.6, 0.7, 1.2, 0.5],
        [1.4, 0.6, 1.5, 0.8, 1.4],
        [0.8, 1.3, 0.6, 1.5, 0.8],
      ];
      return {
        el: el,
        start: function () {
          if (typeof el.animate !== 'function') return;
          for (var i = 0; i < bars.length; i++) {
            bars[i].animate(
              KF[i].map(function (s) {
                return { transform: 'scaleY(' + s + ')' };
              }),
              { duration: 700 + i * 90, iterations: Infinity, easing: 'ease-in-out' },
            );
          }
        },
        stop: function () {
          for (var i = 0; i < bars.length; i++) {
            var anims = bars[i].getAnimations ? bars[i].getAnimations() : [];
            for (var j = 0; j < anims.length; j++) anims[j].cancel();
          }
        },
      };
    }

    // per-letter spans laid out up-front (invisible but occupying space, so the
    // row never reflows), each letter rising from below into its final spot
    function typeLetters(el, txt) {
      var spans = setTextLetters(el, txt);
      var i;
      for (i = 0; i < spans.length; i++) {
        (function (sp, idx) {
          sp.style.opacity = '0';
          if (typeof sp.animate === 'function') {
            sp.animate(
              [
                { opacity: 0, transform: 'translateY(' + LETTER_RISE + 'px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              { duration: LETTER_IN_MS, delay: idx * LETTER_STAGGER, easing: NAME_WAVE_EASE, fill: 'both' },
            );
          } else {
            setTimeout(function () {
              sp.style.opacity = '1';
            }, idx * LETTER_STAGGER);
          }
        })(spans[i], i);
      }
    }

    // how long a sentence takes to finish typing
    function typeDuration(txt) {
      return txt.length * LETTER_STAGGER;
    }

    function startSentence() {
      var s = SENTENCES[sentenceIdx];
      addLine(s);
      sentenceIdx = (sentenceIdx + 1) % SENTENCES.length;
      // next line waits for this one to finish typing, with a floor so short
      // lines ("good idea") don't rush past
      var wait = Math.max(LINE_MS, typeDuration(s.text) + LINE_GAP_MS);
      if (s.task) {
        // hold the conversation a beat: the line lands, its task flies out to
        // the deck, and only then does the next line come in
        wait += TASK_HOLD_MS;
      }
      setTimeout(startSentence, wait);
    }

    // AI-summary sparkle in place of the checkbox — the notetaker distilled this.
    // the artwork is config: the exported file ships the same path twice with different fills
    // (a black under-layer, then the real colour on top), which is just how the export came
    // out - one path with the final fill renders identically.
    var SPARKLE_VIEWBOX = '0 0 25 25';
    var SPARKLE_FILL    = '#1A1A1A';
    var SPARKLE_PATH    = 'M12.9756 5.65729L13.9775 8.30342C14.3963 9.41004 15.2452 10.2999 16.3309 ' +
      '10.7704L18.9269 11.8958C19.4068 12.1041 19.3906 12.7903 18.9014 12.9753L16.2553 13.9772C15.1487 ' +
      '14.396 14.2588 15.2449 13.7883 16.3306L12.6629 18.9266C12.4546 19.4065 11.7684 19.3903 11.5834 ' +
      '18.9011L10.5815 16.255C10.1627 15.1484 9.31378 14.2585 8.22812 13.788L5.63212 12.6626C5.15222 ' +
      '12.4543 5.16839 11.7681 5.65757 11.5831L8.3037 10.5812C9.41032 10.1624 10.3002 9.3135 10.7707 ' +
      '8.22784L11.8961 5.63184C12.104 5.15193 12.7902 5.1681 12.9756 5.65729Z';

    function initSparkle(root, animateIn) {
      var slot = (root || document).querySelector('[data-anim-check]');
      if (!slot) {
        return;
      }
      slot.style.border = 'none';
      slot.style.position = 'relative';

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', SPARKLE_VIEWBOX);
      svg.setAttribute('fill', SPARKLE_FILL);
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;';

      var star = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      star.setAttribute('d', SPARKLE_PATH);
      star.setAttribute('fill', SPARKLE_FILL);
      svg.appendChild(star);
      slot.appendChild(svg);

      if (animateIn && typeof svg.animate === 'function') {
        svg.style.transformOrigin = '50% 50%';
        svg.animate(
          [
            { transform: 'scale(0) rotate(-40deg)', opacity: 0 },
            { transform: 'scale(1) rotate(0deg)', opacity: 1 },
          ],
          { duration: 450, delay: 180, easing: BACK_EASE, fill: 'both' },
        );
      }
    }

    function init() {
      container = document.querySelector('[' + ATTR + '="' + A_WRAP + '"]');
      if (!container) {
        console.warn('[transcript] no element with data-transcript="wrap" found');
        reveal();
        return;
      }

      SENTENCES = readSentencesFromDOM();
      if (!SENTENCES.length) {
        console.warn('[transcript] no data-transcript="track" rows found inside wrap');
        reveal();
        return;
      }

      // index styling templates by pill variant (fathom/pulse/dawn/signal) and by
      // speaker name as a fallback — the production rows use colors
      // inconsistently, so CONTENT declares its pill explicitly
      var bi, c, tpl;
      for (bi = 0; bi < SENTENCES.length; bi++) {
        if (SENTENCES[bi].variant && !tplByVariant[SENTENCES[bi].variant]) {
          tplByVariant[SENTENCES[bi].variant] = SENTENCES[bi];
        }
        if (!tplByName[SENTENCES[bi].name]) {
          tplByName[SENTENCES[bi].name] = SENTENCES[bi];
        }
      }
      // what the DOM actually offers — variant names must match PILL_BY_NAME exactly
      console.log('[notetaker] variants found:', Object.keys(tplByVariant), '| row names:', Object.keys(tplByName));
      for (var pk in PILL_BY_NAME) {
        if (!tplByVariant[PILL_BY_NAME[pk]]) {
          console.warn('[notetaker] no row with variant "' + PILL_BY_NAME[pk] + '" (for ' + pk + ') — falling back');
        }
      }

      if (CONTENT.length) {
        var rebuilt = [];
        for (bi = 0; bi < CONTENT.length; bi++) {
          c = CONTENT[bi];
          tpl = pillTemplate(c.name, c.pill);
          // the card badge names the ASSIGNEE, who may not be the speaker
          var own = c.owner || c.name;
          var oTpl = own === c.name ? tpl : pillTemplate(own, '');
          var ovr = overrideFor(c.name) || {};
          var oOvr = overrideFor(own) || {};
          rebuilt.push({
            template: tpl.template,
            text: c.text,
            task: c.task || '',
            name: c.name,
            nameColor: ovr.text || tpl.nameColor,
            nameBg: ovr.bg || tpl.nameBg,
            owner: own,
            ownerColor: oOvr.text || oTpl.nameColor,
            ownerBg: oOvr.bg || oTpl.nameBg,
          });
        }
        SENTENCES = rebuilt;
      }

      // focus = index (counted from bottom) of the brightest line
      var maxOp = Math.max.apply(null, OPACITIES);
      FOCUS_FB = OPACITIES.indexOf(maxOp);
      if (FOCUS_FB < 0) {
        FOCUS_FB = 0;
      }

      hasTasks = SENTENCES.some(function (s) {
        return !!s.task;
      });

      cardEl = document.querySelector('[' + ATTR + '="' + A_CARD + '"]');
      if (cardEl) {
        var origInner = cardEl.querySelector('.hero_select_inner') || cardEl.firstElementChild;
        innerTemplate = origInner.cloneNode(true);

        // the wrap becomes the deck: bottom-anchored, cards absolutely stacked
        cardEl.style.position = 'relative';
        // width before height: the height depends on how many lines the task takes, and that
        // depends on the width. measured the other way round the deck reserves room for a
        // wrapped line that the widened card no longer needs.
        fitCardWidth();
        styleCardNode(origInner);
        origInner.style.zIndex = '50';
        origInner._tilt = (Math.random() * 2 - 1) * CARD_TILT_MAX;
        origInner.style.transform = 'rotate(' + origInner._tilt + 'deg)';

        // overwrite the Designer's placeholder with CARD_DEFAULT
        var dTpl = pillTemplate(CARD_DEFAULT.name, CARD_DEFAULT.pill);
        var dSent = origInner.querySelector('[' + ATTR + '="' + A_CARD_SENT + '"]');
        var dNw = origInner.querySelector('[' + ATTR + '="' + A_CARD_NAME + '"]');
        if (dSent) {
          dSent.textContent = CARD_DEFAULT.task;
        }
        if (dNw) {
          var dNt = dNw.querySelector('*') || dNw;
          dNt.textContent = CARD_DEFAULT.name;
          var dOvr = overrideFor(CARD_DEFAULT.name) || {};
          var dBg = dOvr.bg || (dTpl && dTpl.nameBg);
          var dCol = dOvr.text || (dTpl && dTpl.nameColor);
          if (dBg) {
            dNw.style.backgroundColor = dBg;
          }
          if (dCol) {
            dNw.style.color = dCol;
            dNt.style.color = dCol;
          }
          dNw.style.whiteSpace = 'nowrap';
        }

        // height last: it is only true once the card carries its real text at its real width.
        // this used to be read before CARD_DEFAULT was written, so the deck was sized to
        // whatever placeholder the Designer happened to hold.
        cardInnerH = origInner.offsetHeight;
        if (cardInnerH > 0) {
          cardEl.style.height = cardInnerH + 'px';
        }

        cardStack.push(origInner);
        initSparkle(origInner, false);
        primeCard();
      }

      var waveCss = document.createElement('style');
      waveCss.textContent =
        '[data-transcript="wrap"] [data-transcript="name"]{display:flex;align-items:center;gap:3px}' +
        '.tw-wave{display:inline-flex;align-items:center;gap:2px}' +
        '.tw-wave i{display:block;width:2px;border-radius:1px;background:currentColor}' +
        '.tw-wave i:nth-child(1){height:4px}' +
        '.tw-wave i:nth-child(2){height:7px}' +
        '.tw-wave i:nth-child(3){height:5px}' +
        '.hero_bottom{align-items:end}' +
        '.hero_animation_wrap{overflow:visible}' +
        '[data-transcript="card"]{align-self:end;overflow:visible}' +
        (CARD_BORDER ? '[data-transcript="card"] .hero_select_inner{border:' + CARD_BORDER + '}' : '');
      document.head.appendChild(waveCss);

      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.justifyContent = 'flex-end';
      container.style.overflow = 'hidden';
      // clip box extends right past the throw-bump so the nudge isn't cut off
      container.style.boxSizing = 'border-box';
      // extend the clip box along whichever axis the bump travels, padded back so the content area
      // is unchanged — otherwise overflow:hidden crops the nudge
      if (isStacked()) {
        container.style.width = '';
        container.style.paddingRight = '';
        container.style.paddingBottom = THROW_BUMP_Y * 2 + 'px';
        container.style.marginBottom = (STACK_GAP - THROW_BUMP_Y * 2) + 'px';   // pad added height back off
      } else {
        container.style.paddingBottom = '';
        container.style.marginBottom = '';
        container.style.width = 'calc(100% + ' + THROW_BUMP_X * 2 + 'px)';
        container.style.paddingRight = THROW_BUMP_X * 2 + 'px';
      }

      var edge = 'rgba(0,0,0,' + FADE_ALPHA + ')';
      // history fades out toward the top only — the live line at the bottom
      // stays full strength (no gradient creeping onto its pill)
      var mask = 'linear-gradient(to bottom, ' + edge + ' 0%, black ' + FADE_STOP + ', black 100%)';
      container.style.webkitMaskImage = mask;
      container.style.maskImage = mask;

      container.textContent = '';

      // inner column that we translate to scroll the whole stack as one group.
      // inherit the wrap's horizontal alignment so rows keep their original position.
      scroller = document.createElement('div');
      scroller.style.cssText = 'display:flex;flex-direction:column;justify-content:flex-end;width:100%;will-change:transform;';
      scroller.style.alignItems = window.getComputedStyle(container).alignItems || 'stretch';
      container.appendChild(scroller);

      lockWidth();

      var p;
      for (p = 0; p < MAX_LINES - 1; p++) {
        addPlaceholder();
      }

      for (p = 0; p < lines.length; p++) {
        if (lines[p].el.offsetHeight > rowHeightPx) {
          rowHeightPx = lines[p].el.offsetHeight;
        }
      }
      if (rowHeightPx > 0) {
        for (p = 0; p < lines.length; p++) {
          lines[p].el.style.minHeight = rowHeightPx + 'px';
        }

        // border-box: the pad must be added to the lock or it eats content instead of extending the box
        var lockH = rowHeightPx * MAX_LINES + (isStacked() ? THROW_BUMP_Y * 2 : 0);
        container.style.height = lockH + 'px';
        container.style.minHeight = lockH + 'px';
        container.style.maxHeight = lockH + 'px';
        container.style.flexShrink = '0';
        container.style.flexGrow = '0';

        // the card is taller than a transcript row — shift the deck down so the
        // front card's midline sits on the live line's midline (a straight
        // sideways throw, not a bottom-edge alignment)
        if (cardEl && cardInnerH > 0) {
          cardEl.style.transform = 'translateY(' + (cardInnerH - rowHeightPx) / 2 + 'px)';
        }
      }
      
      container.style.transition = 'opacity 0.3s ease';
      container.style.opacity = '1';

      // everything is positioned and re-texted — safe to show, one frame later
      // so the browser paints the finished state rather than an intermediate one
      requestAnimationFrame(function () {
        requestAnimationFrame(reveal);
      });

      startSentence();
    }

    function refitCard() {
      if (!cardEl) {
        return;
      }
      cardEl.style.minWidth = ''; // drop the old fit before measuring, or it floors the new one
      fitCardWidth();
      var front = cardStack[0];
      if (!front) {
        return;
      }
      cardInnerH = front.offsetHeight;
      if (cardInnerH > 0) {
        cardEl.style.height = cardInnerH + 'px';
        if (rowHeightPx > 0) {
          cardEl.style.transform = 'translateY(' + (cardInnerH - rowHeightPx) / 2 + 'px)';
        }
      }
    }

    // the card is sized by measuring text, so it is only correct for the font that was actually
    // loaded when it was measured. webfonts land after this script runs, and letter-spacing is
    // applied on top of whatever advance widths the font has - so a deck fitted against the
    // fallback face is the wrong width for the real one, and the longest task wraps after all.
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        refitCard();
      });
    }

    var lastFitW = 0;
    var fitT = null;
    window.addEventListener('resize', function () {
      if (scroller && container) {
        scroller.style.alignItems = window.getComputedStyle(container).alignItems || 'stretch';
      }
      // WIDTH only: a phone fires resize continuously as the URL bar collapses, and that is a
      // height change. re-fitting on it would re-measure the whole script every scroll frame.
      var w = document.documentElement.clientWidth;
      if (w === lastFitW) {
        return;
      }
      lastFitW = w;
      clearTimeout(fitT);
      fitT = setTimeout(refitCard, 200);
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
