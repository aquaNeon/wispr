(function () {

  var SENTENCES = [
    { speaker: "Gabrielle", color: "#e8a838", text: "The deck is looking really good" },
    { speaker: "Lina",      color: "#8b6fc9", text: "Someone needs to send the deck over today" },
    { speaker: "Zada",      color: "#5b9cf6", text: "Sure yeah I'll do that this afternoon" },
    { speaker: "Nakamoro",  color: "#e05b5b", text: "Also did we ever actually loop in dev" },
    { speaker: "Gabrielle", color: "#e8a838", text: "No but I can ping them after this" },
    { speaker: "Lina",      color: "#8b6fc9", text: "Let me check my calendar real quick" },
    { speaker: "Zada",      color: "#5b9cf6", text: "How about this text that is medium length" },
    { speaker: "Nakamoro",  color: "#e05b5b", text: "And here again we have a shorter text" }
  ];

  var MAX_LINES = 5;
  var WORD_MS   = 200;
  var PAUSE_MS  = 1100;

  var container   = null;
  var lines       = [];
  var sentenceIdx = 0;
  var wordIdx     = 0;
  var words       = [];

  function styleFor(i) {
    var k, activeIdx = -1;
    for (k = lines.length - 1; k >= 0; k--) {
      if (lines[k].completed) { activeIdx = k; break; }
    }
    if (!lines[i].completed) { return { op: 0.5,  bold: false }; }
    if (activeIdx === -1)     { return { op: 0.5,  bold: false }; }
    var dist = activeIdx - i;
    if (dist === 0) { return { op: 1.0,  bold: true  }; }
    if (dist === 1) { return { op: 0.6,  bold: false }; }
    if (dist === 2) { return { op: 0.35, bold: false }; }
    return            { op: 0.15, bold: false };
  }

  function refreshStyles() {
    var i, s;
    for (i = 0; i < lines.length; i++) {
      s = styleFor(i);
      lines[i].el.style.opacity = s.op;
      lines[i].sentenceEl.style.fontWeight = s.bold ? '600' : '400';
    }
  }

  function removeAfterFade(el) {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(function () {
      if (el.parentNode) { el.parentNode.removeChild(el); }
    }, 400);
  }

  function addLine(sentence) {
    if (lines.length >= MAX_LINES) {
      removeAfterFade(lines.shift().el);
    }

    var track = document.createElement('div');
    track.className        = 'hero_record_track';
    track.style.opacity    = '0';
    track.style.transform  = 'translateY(10px)';
    track.style.transition = 'opacity 0.35s ease, transform 0.35s ease';

    var nameWrap = document.createElement('div');
    nameWrap.className        = 'hero_record_name_wrap';
    nameWrap.style.opacity    = '0';
    nameWrap.style.transform  = 'translateX(-8px)';
    nameWrap.style.transition = 'opacity 0.28s ease, transform 0.28s ease';

    var badge = document.createElement('div');
    badge.className             = 'hero_record_name';
    badge.textContent           = sentence.speaker;
    badge.style.backgroundColor = sentence.color;
    nameWrap.appendChild(badge);

    var sentEl = document.createElement('div');
    sentEl.className        = 'hero_record_scentence';
    sentEl.style.transition = 'font-weight 0.3s ease';

    track.appendChild(nameWrap);
    track.appendChild(sentEl);
    container.appendChild(track);

    lines.push({ el: track, sentenceEl: sentEl, nameWrap: nameWrap, completed: false });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        refreshStyles();
        track.style.transform = 'translateY(0)';
        setTimeout(function () {
          nameWrap.style.opacity   = '1';
          nameWrap.style.transform = 'translateX(0)';
        }, 80);
      });
    });
  }

  function typeNext() {
    var current = lines[lines.length - 1];
    if (!current) { return; }
    if (wordIdx < words.length) {
      current.sentenceEl.textContent = words.slice(0, wordIdx + 1).join(' ');
      wordIdx = wordIdx + 1;
      setTimeout(typeNext, WORD_MS);
    } else {
      current.completed = true;
      refreshStyles();
      sentenceIdx = (sentenceIdx + 1) % SENTENCES.length;
      setTimeout(startSentence, PAUSE_MS);
    }
  }

  function startSentence() {
    var s   = SENTENCES[sentenceIdx];
    words   = s.text.split(' ');
    wordIdx = 0;
    addLine(s);
    setTimeout(typeNext, 400);
  }

  function init() {
    container = document.querySelector('.hero_record_wrap');
    if (!container) {
      console.warn('[transcript] .hero_record_wrap not found');
      return;
    }
    container.textContent = '';
    startSentence();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
