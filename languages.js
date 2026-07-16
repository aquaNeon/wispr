(function () {

  // ==========================================================================
  // languages.js — the "languages" scroll-roll animation cards.
  //
  // The OUTER scroll-roll (moving/curved text) will come from a GSAP resource and
  // is NOT built here. This drives the ANIMATION CARDS that sit in ONE fixed place
  // and are swapped/scrubbed by which item is active (same model as the flow tabs).
  //
  // DOM contract (author in Webflow):
  //   [data-lang="section"]                 the section (temp scroll driver spans it)
  //   [data-lang-anim="0"]                  card 0 — the language switcher (fixed card)
  //       [data-lang-name]                  the pill's language NAME (we scramble it)
  //       [data-lang-flag]                  the flag element (we set its text = emoji)
  //   [data-lang-anim="1|2|3"]              cards 1–3 (added later)
  //
  // NOTE: the curved phrase is the scroll-roll's own moving text (it just scrubs, driven by the
  // GSAP roll) — this script does NOT touch it. Card 0 only animates the pill name + flag.
  //
  // For now a temp ScrollTrigger maps the section's scroll → progress 0..1 and card 0
  // scrubs through LANGS. When the real roll exists, delete the temp trigger and call
  //   window.Languages.setProgress(p)   // p 0..1 across all languages
  // ==========================================================================

  // ---- card 0 content (edit freely; ~6–8 languages reads well). only name + flag animate here;
  // the phrase is the scroll-roll's own moving text and just scrubs (driven by the GSAP roll).
  // flag: `code` = ISO country code → used for an <img> flag (renders everywhere, incl. Windows).
  //       `flag` = emoji fallback if [data-lang-flag] is a text element (note: no flags on Windows). ----
  var FLAG_URL = 'https://flagcdn.com/w80/{code}.png';   // {code} → country code; swap for your own asset host
  var LANGS = [
    { name: 'English',  code: 'us', flag: '🇺🇸' },
    { name: 'Deutsch',  code: 'de', flag: '🇩🇪' },
    { name: 'Español',  code: 'es', flag: '🇪🇸' },
    { name: 'Italiano', code: 'it', flag: '🇮🇹' },
    { name: 'हिन्दी',    code: 'in', flag: '🇮🇳' },
    { name: '日本語',    code: 'jp', flag: '🇯🇵' },
    { name: 'Français', code: 'fr', flag: '🇫🇷' },
    { name: '한국어',    code: 'kr', flag: '🇰🇷' }
  ];

  // ---- config ----
  var HOLD        = 0.5;    // fraction of each language's slice spent PARKED (settled) before it
                            // scrambles to the next. 0 = always scrambling, →1 = snappier switches.
  var FLAG_AT     = 0.5;    // point within the scramble (0..1) where the flag swaps to the next one
  var SCRUB_LERP  = 0.18;   // eases the driven progress so the scramble glides (like the flow scrubs)

  var ATTR = 'data-lang';

  // ---- scramble: resolve left→right to the target; unresolved chars use the TARGET's own
  // characters as the random pool, so non-latin scripts scramble in-script. ----
  function scramble(target, t) {
    if (t >= 1) { return target; }
    if (t <= 0) { return target; }
    var chars = target.split(''), n = chars.length, reveal = Math.floor(t * n), out = '';
    var pool = target.replace(/\s/g, '');
    if (!pool) { pool = 'abcdefghijklmnopqrstuvwxyz'; }
    for (var i = 0; i < n; i++) {
      var ch = chars[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
      out += (i < reveal) ? ch : pool.charAt((Math.random() * pool.length) | 0);
    }
    return out;
  }

  function init() {
    if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') {
      console.warn('[languages] GSAP + ScrollTrigger required before this script.');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    var section = document.querySelector('[' + ATTR + '="section"]');
    if (!section) { console.warn('[languages] no [data-lang="section"] found'); return; }

    // ---- card 0: language switcher (name scrambles, flag swaps) ----
    var card0  = section.querySelector('[' + ATTR + '-anim="0"]');
    var nameEl = card0 && card0.querySelector('[' + ATTR + '-name]');
    var flagEl = card0 && card0.querySelector('[' + ATTR + '-flag]');

    var flagIsImg = flagEl && flagEl.tagName && flagEl.tagName.toLowerCase() === 'img';
    function setFlag(lang) {                            // <img> → swap src by country code; else emoji text
      if (!flagEl) { return; }
      if (flagIsImg) {
        var src = FLAG_URL.replace('{code}', lang.code || '');
        if (flagEl.getAttribute('src') !== src) { flagEl.setAttribute('src', src); }
      } else if (flagEl.textContent !== lang.flag) {
        flagEl.textContent = lang.flag || '';
      }
    }

    var lastName = null, lastFlagI = -1;               // avoid redundant DOM writes
    function renderCard0(progress) {
      if (!card0 || LANGS.length === 0) { return; }
      var N = LANGS.length;
      var pos = Math.max(0, Math.min(1, progress)) * (N - 1);
      var i = Math.min(N - 1, Math.floor(pos));
      var f = pos - i;                                  // 0..1 within this language's slice
      var next = Math.min(N - 1, i + 1);

      var nm, flagIdx;
      if (f <= HOLD || i === next) {                    // PARKED — show this language settled
        nm = LANGS[i].name; flagIdx = i;
      } else {                                          // SCRAMBLING toward the next language
        var st = (f - HOLD) / (1 - HOLD);               // local scramble progress 0..1
        nm = scramble(LANGS[next].name, st);
        flagIdx = (st >= FLAG_AT) ? next : i;
      }
      if (nameEl && nm !== lastName) { nameEl.textContent = nm; lastName = nm; }
      if (flagIdx !== lastFlagI) { setFlag(LANGS[flagIdx]); lastFlagI = flagIdx; }
    }

    // ---- driver: TEMP ScrollTrigger (replace with the GSAP roll's progress later) ----
    var target = 0, current = 0, painted = -1;
    function paint(p) { renderCard0(p); }

    var st = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function (self) { target = self.progress; }
    });

    // ease the progress so the scramble glides + settles when scroll stops (like the flow scrubs)
    var tick = function () {
      if (SCRUB_LERP >= 1) { current = target; }
      else {
        var k = 1 - Math.pow(1 - SCRUB_LERP, gsap.ticker.deltaRatio());
        current += (target - current) * k;
        if (Math.abs(target - current) < 0.0002) { current = target; }
      }
      if (current !== painted) { paint(current); painted = current; }
    };
    gsap.ticker.add(tick);

    // public hook — the real roll calls this instead of the temp trigger
    window.Languages = {
      setProgress: function (p) { target = p; },
      render: renderCard0
    };

    renderCard0(0);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

}());
