// notetaker page - hero transcript + task deck. ported from the approved prototype
// (wispr-notetaker.netlify.app). contract: [data-transcript=wrap|track|name|sentence|card|
// card-name|card-sentence] + data-transcript-task on rows that spawn a task.
(function () {

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

    var CARD_RADIUS = '16px'; // action card corner radius ('' = leave Webflow's value)

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
    var CONTENT = [
      { name: 'Tom', text: 'okay launch is Thursday let\'s lock everything down', task: '', pill: 'fathom' },
      { name: 'Lelia', text: 'I\'ll drop the final images in this afternoon', task: 'Drop in final images', pill: 'glow' },
      { name: 'Tom', text: 'legal still hasn\'t cleared the new terms', task: '', pill: 'fathom' },
      { name: 'Sarah', text: 'I\'ll chase legal right after this call', task: 'Chase legal sign off', pill: 'dawn' },
      { name: 'Jay', text: 'the changelog still needs a proofread', task: '', pill: 'pulse' },
      { name: 'Lelia', text: 'send it over I\'ll proof it today', task: 'Proof the changelog', pill: 'glow' },
      { name: 'Tom', text: 'support docs are only halfway there', task: '', pill: 'fathom' },
      { name: 'Jay', text: 'I\'ll finish the FAQ tomorrow morning', task: 'Finish the FAQ', pill: 'pulse' },
      { name: 'Lelia', text: 'the launch email needs a subject line', task: '', pill: 'glow' },
      { name: 'Tom', text: 'I\'ll write three options tonight', task: 'Write subject line options', pill: 'fathom' },
      { name: 'Sarah', text: 'the demo video ending drags a bit', task: '', pill: 'dawn' },
      { name: 'Lelia', text: 'I\'ll trim the ending tomorrow', task: 'Trim the demo video', pill: 'glow' },
      { name: 'Jay', text: 'I still need the beta invite list', task: '', pill: 'pulse' },
      { name: 'Sarah', text: 'I\'ll export it for you after this', task: 'Send Jay the beta list', pill: 'dawn' },
      { name: 'Tom', text: 'we never set up the status page', task: '', pill: 'fathom' },
      { name: 'Jay', text: 'I\'ll set it up on Wednesday', task: 'Set up the status page', pill: 'pulse' },
      { name: 'Sarah', text: 'press wise it\'s just the newsletter folks', task: '', pill: 'dawn' },
      { name: 'Lelia', text: 'I\'ll send the press kit Monday', task: 'Send out the press kit', pill: 'glow' },
      { name: 'Tom', text: 'pricing table needs the annual toggle', task: '', pill: 'fathom' },
      { name: 'Sarah', text: 'I\'ll switch the toggle on today', task: 'Add the annual toggle', pill: 'dawn' },
      { name: 'Jay', text: 'the signup flow still skips the survey', task: '', pill: 'pulse' },
      { name: 'Tom', text: 'I\'ll wire the survey back in', task: 'Fix the signup survey', pill: 'fathom' },
      { name: 'Lelia', text: 'socials are empty for launch week', task: '', pill: 'glow' },
      { name: 'Sarah', text: 'I\'ll schedule the launch posts', task: 'Schedule launch posts', pill: 'dawn' },
      { name: 'Tom', text: 'who\'s watching metrics on the day', task: '', pill: 'fathom' },
      { name: 'Jay', text: 'I\'ll build the launch dashboard', task: 'Build launch dashboard', pill: 'pulse' },
      { name: 'Sarah', text: 'the blog post intro still reads flat', task: '', pill: 'dawn' },
      { name: 'Tom', text: 'I\'ll rewrite the intro tonight', task: 'Rewrite blog intro', pill: 'fathom' },
      { name: 'Jay', text: 'partners haven\'t heard a launch date yet', task: '', pill: 'pulse' },
      { name: 'Lelia', text: 'I\'ll email the partner list today', task: 'Email the partners', pill: 'glow' },
      { name: 'Sarah', text: 'onboarding tooltips are still placeholder', task: '', pill: 'dawn' },
      { name: 'Jay', text: 'I\'ll write the real copy tomorrow', task: 'Write tooltip copy', pill: 'pulse' },
      { name: 'Tom', text: 'we should stress test the servers', task: '', pill: 'fathom' },
      { name: 'Jay', text: 'I\'ll run the load test Wednesday', task: 'Run the load test', pill: 'pulse' },
      { name: 'Tom', text: 'and let\'s not skip the retro this time', task: '', pill: 'fathom' },
      { name: 'Sarah', text: 'I\'ll book the retro for Friday', task: 'Book the launch retro', pill: 'dawn' }
    ];
    // what the card shows before the first task fires (last task in the loop,
    // so the rotation reads as continuous)
    var CARD_DEFAULT = { name: 'Sarah', task: 'Book the launch retro', pill: 'dawn' };
    var tplByName = {};
    var tplByVariant = {};

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
      node.style.transformOrigin = '50% 100%';
      if (CARD_RADIUS) {
        node.style.setProperty('border-radius', CARD_RADIUS, 'important');
      }
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

    // rebuild the text as per-letter inline-block spans so each can be animated
    function setTextLetters(el, txt) {
      el.textContent = '';
      var spans = [],
        i,
        ch,
        s;
      for (i = 0; i < txt.length; i++) {
        ch = txt.charAt(i);
        s = document.createElement('span');
        s.textContent = ch === ' ' ? '\u00A0' : ch; // keep spaces in inline-block flow
        s.style.display = 'inline-block';
        s.style.willChange = 'transform';
        el.appendChild(s);
        spans.push(s);
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

      var key = sentence.name + ' ' + taskText;
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
        nameWrap.style.backgroundColor = sentence.nameBg;
        nameWrap.style.color = sentence.nameColor;
      }
      if (nameText) {
        nameText.style.color = sentence.nameColor;
        nameText.textContent = sentence.name;
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
            { transform: 'translateX(' + CARD_FROM_X + 'px) scale(' + CARD_FROM_SCALE + ') rotate(0deg)', opacity: 0, offset: 0 },
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
        })(nameText, sentence.name);
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
                { transform: 'translateX(' + THROW_BUMP_X + 'px)', offset: 0.35 },
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

    // AI-summary sparkle in place of the checkbox — the notetaker distilled this
    function initSparkle(root, animateIn) {
      var slot = (root || document).querySelector('[data-anim-check]');
      if (!slot) {
        return;
      }
      slot.style.border = 'none';
      slot.style.position = 'relative';

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', '#1a1a1a');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;';

      var big = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      big.setAttribute('d', 'M9 2 C9.7 7 13 10.3 18 11 C13 11.7 9.7 15 9 20 C8.3 15 5 11.7 0 11 C5 10.3 8.3 7 9 2 Z');
      var small = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      small.setAttribute('d', 'M18.5 12.5 C18.9 15 20.2 16.3 22.7 16.7 C20.2 17.1 18.9 18.4 18.5 20.9 C18.1 18.4 16.8 17.1 14.3 16.7 C16.8 16.3 18.1 15 18.5 12.5 Z');
      svg.appendChild(big);
      svg.appendChild(small);
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
        return;
      }

      SENTENCES = readSentencesFromDOM();
      if (!SENTENCES.length) {
        console.warn('[transcript] no data-transcript="track" rows found inside wrap');
        return;
      }

      // index styling templates by pill variant (fathom/pulse/dawn/glow) and by
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
      if (CONTENT.length) {
        var rebuilt = [];
        for (bi = 0; bi < CONTENT.length; bi++) {
          c = CONTENT[bi];
          tpl = (c.pill && tplByVariant[c.pill]) || tplByName[c.name] || SENTENCES[0];
          rebuilt.push({
            template: tpl.template,
            text: c.text,
            task: c.task || '',
            name: c.name,
            nameColor: tpl.nameColor,
            nameBg: tpl.nameBg,
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
        cardInnerH = origInner.offsetHeight;
        if (cardInnerH > 0) {
          cardEl.style.height = cardInnerH + 'px';
        }
        styleCardNode(origInner);
        origInner.style.zIndex = '50';
        origInner._tilt = (Math.random() * 2 - 1) * CARD_TILT_MAX;
        origInner.style.transform = 'rotate(' + origInner._tilt + 'deg)';

        // overwrite the Designer's placeholder with CARD_DEFAULT
        var dTpl = (CARD_DEFAULT.pill && tplByVariant[CARD_DEFAULT.pill]) || tplByName[CARD_DEFAULT.name];
        var dSent = origInner.querySelector('[' + ATTR + '="' + A_CARD_SENT + '"]');
        var dNw = origInner.querySelector('[' + ATTR + '="' + A_CARD_NAME + '"]');
        if (dSent) {
          dSent.textContent = CARD_DEFAULT.task;
        }
        if (dNw) {
          var dNt = dNw.querySelector('*') || dNw;
          dNt.textContent = CARD_DEFAULT.name;
          if (dTpl) {
            dNw.style.backgroundColor = dTpl.nameBg;
            dNw.style.color = dTpl.nameColor;
            dNt.style.color = dTpl.nameColor;
          }
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
        '[data-transcript="card"] .hero_select_inner{border:1px solid var(--base-color--vast, #1a1a1a)}';
      document.head.appendChild(waveCss);

      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.justifyContent = 'flex-end';
      container.style.overflow = 'hidden';
      // clip box extends right past the throw-bump so the nudge isn't cut off
      container.style.boxSizing = 'border-box';
      container.style.width = 'calc(100% + ' + THROW_BUMP_X * 2 + 'px)';
      container.style.paddingRight = THROW_BUMP_X * 2 + 'px';

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

        var lockH = rowHeightPx * MAX_LINES;
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
      startSentence();
    }

    window.addEventListener('resize', function () {
      if (scroller && container) {
        scroller.style.alignItems = window.getComputedStyle(container).alignItems || 'stretch';
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
