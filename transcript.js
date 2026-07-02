(function () {

  var MAX_LINES  = 5;
  var WORD_MS    = 140;
  var PAUSE_MS   = 900;
  var FADE_STOP  = '42%';
  var FADE_ALPHA = 0.25;
  var OPACITIES  = [0.8, 0.92, 1.0, 0.5, 0.2];
  var WIDTH_PAD  = 120;

  var ATTR       = 'data-transcript';
  var A_WRAP     = 'wrap';
  var A_TRACK    = 'track';
  var A_NAME     = 'name';
  var A_SENTENCE = 'sentence';

  var EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

  var SENTENCES   = [];
  var container   = null;
  var rowHeightPx = 0;
  var lines       = [];
  var sentenceIdx = 0;
  var wordIdx     = 0;
  var words       = [];

  function readSentencesFromDOM() {
    var tracks = container.querySelectorAll('[' + ATTR + '="' + A_TRACK + '"]');
    var result = [];
    var i, track, badge, sentEl, computed, clone, cloneBadge;
    for (i = 0; i < tracks.length; i++) {
      track  = tracks[i];
      badge  = track.querySelector('[' + ATTR + '="' + A_NAME + '"]');
      sentEl = track.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
      if (!badge || !sentEl) { continue; }

      computed   = window.getComputedStyle(badge);
      clone      = track.cloneNode(true);
      cloneBadge = clone.querySelector('[' + ATTR + '="' + A_NAME + '"]');
      if (cloneBadge) {
        cloneBadge.style.color           = computed.color;
        cloneBadge.style.backgroundColor = computed.backgroundColor;
      }

      result.push({
        template : clone,
        text     : sentEl.textContent.trim()
      });
    }
    return result;
  }

  function lockWidth() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;left:-9999px;display:flex;flex-direction:column;';
    document.body.appendChild(probe);

    var maxW = 0, maxRowH = 0;
    var i, row, sentEl;
    for (i = 0; i < SENTENCES.length; i++) {
      row    = SENTENCES[i].template.cloneNode(true);
      sentEl = row.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
      if (sentEl) { sentEl.textContent = SENTENCES[i].text; }
      row.style.whiteSpace = 'nowrap';
      probe.appendChild(row);
      if (row.offsetWidth  > maxW)    { maxW    = row.offsetWidth; }
      if (row.offsetHeight > maxRowH) { maxRowH = row.offsetHeight; }
    }

    document.body.removeChild(probe);
    if (maxW > 0) {
      container.style.minWidth = (maxW + WIDTH_PAD) + 'px';
      container.style.width    = (maxW + WIDTH_PAD) + 'px';
    }

    rowHeightPx = maxRowH;
  }

  function refreshStyles() {
    var total = lines.length;
    var i, fromBottom, op;
    for (i = 0; i < total; i++) {
      if (lines[i].placeholder) { continue; }
      fromBottom = total - 1 - i;
      op = OPACITIES[fromBottom] !== undefined ? OPACITIES[fromBottom] : 0.4;
      lines[i].el.style.opacity = op;
    }
  }

  function addPlaceholder() {
    var track  = SENTENCES[0].template.cloneNode(true);
    var sentEl = track.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
    track.style.opacity = '0';
    if (rowHeightPx > 0) { track.style.minHeight = rowHeightPx + 'px'; }
    track.setAttribute('aria-hidden', 'true');
    container.appendChild(track);
    lines.push({ el: track, sentenceEl: sentEl, placeholder: true });
  }

  function evictOldest() {
    var old = lines.shift();
    if (old.el.parentNode) { old.el.parentNode.removeChild(old.el); }
  }

  function addLine(sentence) {
    if (lines.length >= MAX_LINES) { evictOldest(); }

    var track    = sentence.template.cloneNode(true);
    var sentEl   = track.querySelector('[' + ATTR + '="' + A_SENTENCE + '"]');
    var badge    = track.querySelector('[' + ATTR + '="' + A_NAME + '"]');
    var nameWrap = badge ? badge.parentNode : null;

    if (sentEl) {
      sentEl.textContent = '';
    }

    if (rowHeightPx > 0) { track.style.minHeight = rowHeightPx + 'px'; }
    track.style.opacity    = '0';
    track.style.transform  = 'translateY(10px)';
    track.style.transition = 'opacity 0.3s ' + EASE + ', transform 0.3s ' + EASE;
    track.style.willChange = 'opacity, transform';

    if (nameWrap) {
      nameWrap.style.opacity    = '0';
      nameWrap.style.transform  = 'translateX(-6px)';
      nameWrap.style.transition = 'opacity 0.3s ' + EASE + ' 0.08s, transform 0.3s ' + EASE + ' 0.08s';
    }

    container.appendChild(track);
    lines.push({ el: track, sentenceEl: sentEl, nameWrap: nameWrap, placeholder: false });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        refreshStyles();
        track.style.transform = 'translateY(0)';
        setTimeout(function () {
          if (nameWrap) {
            nameWrap.style.opacity   = '1';
            nameWrap.style.transform = 'translateX(0)';
          }
        }, 60);
      });
    });
  }

  function typeNext() {
    var current = lines[lines.length - 1];
    if (!current || current.placeholder || !current.sentenceEl) { return; }
    if (wordIdx < words.length) {
      current.sentenceEl.textContent = words.slice(0, wordIdx + 1).join(' ');
      wordIdx = wordIdx + 1;
      setTimeout(typeNext, WORD_MS + Math.floor(Math.random() * 80) - 40);
    } else {
      sentenceIdx = (sentenceIdx + 1) % SENTENCES.length;
      setTimeout(startSentence, PAUSE_MS);
    }
  }

  function startSentence() {
    var s   = SENTENCES[sentenceIdx];
    words   = s.text.split(' ');
    wordIdx = 0;
    addLine(s);
    setTimeout(typeNext, 420);
  }

  function initCheckbox() {
    var checkEl = document.querySelector('[data-anim-check]');
    if (!checkEl) { return; }

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 12 10');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#000');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;';

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M1.5 5L4.5 8L10.5 1.5');
    path.setAttribute('pathLength', '1');
    path.style.cssText = 'stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 0.35s ' + EASE + ';';

    svg.appendChild(path);
    checkEl.style.position = 'relative';
    checkEl.appendChild(svg);

    checkEl.addEventListener('click', function (e) {
      e.preventDefault();
      var on = checkEl.getAttribute('data-checked') === 'true';
      checkEl.setAttribute('data-checked', on ? 'false' : 'true');
      path.style.strokeDashoffset = on ? '1' : '0';
    });
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

    container.style.display        = 'flex';
    container.style.flexDirection  = 'column';
    container.style.justifyContent = 'flex-end';
    container.style.overflow       = 'hidden';

    var edge = 'rgba(0,0,0,' + FADE_ALPHA + ')';
    var mask = 'linear-gradient(to bottom, ' + edge + ' 0%, black ' + FADE_STOP + ', black ' + (100 - parseInt(FADE_STOP)) + '%, ' + edge + ' 100%)';
    container.style.webkitMaskImage = mask;
    container.style.maskImage       = mask;

    container.textContent = '';

    lockWidth();

    var p;
    for (p = 0; p < MAX_LINES - 1; p++) { addPlaceholder(); }

    for (p = 0; p < lines.length; p++) {
      if (lines[p].el.offsetHeight > rowHeightPx) { rowHeightPx = lines[p].el.offsetHeight; }
    }
    if (rowHeightPx > 0) {
      for (p = 0; p < lines.length; p++) { lines[p].el.style.minHeight = rowHeightPx + 'px'; }

      var lockH = rowHeightPx * MAX_LINES;
      container.style.height     = lockH + 'px';
      container.style.minHeight  = lockH + 'px';
      container.style.maxHeight  = lockH + 'px';
      container.style.flexShrink = '0';
      container.style.flexGrow   = '0';
    }

    startSentence();

    initCheckbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
