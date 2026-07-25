// Fills the membership form from one spreadsheet row.

(function () {
  'use strict';

  function setText(name, value) {
    if (value == null || value === '') return false;
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // The country <select> uses GUID values and text like "Korea, Republic of
  // (South Korea)", so short codes need mapping onto the option text.
  const COUNTRY_ALIAS = {
    'kr': 'korea, republic of',
    'south korea': 'korea, republic of'
  };

  function setSelect(name, value, isCountry) {
    if (value == null || value === '') return false;
    const el = document.querySelector(`select[name="${name}"]`);
    if (!el) return false;
    let want = String(value).trim().toLowerCase();
    if (isCountry && COUNTRY_ALIAS[want]) want = COUNTRY_ALIAS[want];

    for (const opt of el.options) {
      if (opt.value.trim().toLowerCase() === want ||
          opt.text.trim().toLowerCase() === want) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    for (const opt of el.options) {
      if (opt.value && opt.text.trim().toLowerCase().includes(want)) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Radio values are GUIDs, so match on the label text instead.
  function setRadioByLabel(groupName, mustMatch, mustNotMatch) {
    const radios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
    for (const el of radios) {
      let lbl = '';
      if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) lbl = l.textContent; }
      if (!lbl && el.closest('label')) lbl = el.closest('label').textContent;
      lbl = lbl.replace(/\s+/g, ' ').trim().toLowerCase();
      if (mustMatch.every(re => re.test(lbl)) &&
          (!mustNotMatch || mustNotMatch.every(re => !re.test(lbl)))) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('click',  { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function pick(rec, ...keys) {
    if (!rec) return '';
    const lower = {};
    for (const k of Object.keys(rec)) lower[k.toLowerCase()] = rec[k];
    for (const k of keys) {
      const v = lower[k.toLowerCase()];
      if (v != null && v !== '') return v;
    }
    return '';
  }

  function F(label, ok) {
    if (!ok) console.log(`[autofill] "${label}" not filled`);
    return ok;
  }

  function eng(raw) {
    const conv = convertKoreanAddress(raw);
    return conv ? conv.korean_order : raw;
  }

  // Accepts 1988.11.15 and 15.11.1988 (and / or - separators); outputs DD.MM.YYYY.
  function normalizeDob(raw) {
    if (!raw) return raw;
    const s = String(raw).trim();
    let d, mo, y;

    let m = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
    if (m) { [, y, mo, d] = m; }
    else {
      m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) { [, d, mo, y] = m; }
      else return raw;
    }

    d  = d.padStart(2, '0');
    mo = mo.padStart(2, '0');
    if (y.length === 2) y = (parseInt(y, 10) > 30 ? '19' : '20') + y;
    return `${d}.${mo}.${y}`;
  }

  function normalizePhone(raw) {
    if (!raw) return raw;
    const s = String(raw).trim();
    if (s.startsWith('+')) return s;
    if (s.startsWith('0082')) return '+' + s.slice(2);
    if (s.startsWith('82')) return '+' + s;
    if (s.startsWith('0')) return '+82 ' + s.slice(1);   // domestic 010... -> +82 10...
    return '+82 ' + s;
  }

  function fill(rec) {
    if (!rec || Object.keys(rec).length === 0) {
      console.log('[autofill] no record');
      return;
    }

    const addrRaw = pick(rec, 'home address', 'address');

    let country = pick(rec, 'country');
    if (!country && /[가-힣]/.test(addrRaw)) country = 'KR';
    F('country', setSelect('nation_id', country, true));

    const postcode = pick(rec, 'postcode', 'zip');
    F('postcode', setText('plz_ausland', postcode) | setText('plz', postcode));

    let line1  = eng(addrRaw);
    let town   = eng(pick(rec, 'town', 'city'));
    let county = eng(pick(rec, 'county', 'province'));

    // A single Korean address cell gets split across the three fields; separate
    // town/county columns just get their tokens reversed into Western order.
    let usedSplit = false;
    if ((!town || !county) && /[가-힣]/.test(addrRaw)) {
      const parts = splitKoreanAddress(addrRaw);
      line1  = parts.line1 || line1;
      town   = town   || parts.city;
      county = county || parts.province;
      usedSplit = true;
    }
    const flip = s => (usedSplit || !s) ? s : s.trim().split(/\s+/).reverse().join(' ');

    F('address1', setText('strasse', flip(line1)));
    F('address2', setText('adressfeld2', eng(pick(rec, 'address line 2'))));
    F('town', setText('ort_ausland', flip(town)) | setSelect('ort', flip(town)));
    F('county', setText('adressfeld3', flip(county)));

    const gender = pick(rec, 'gender');
    let title = pick(rec, 'title');
    if (!title) {
      const g = gender.trim().toLowerCase();
      if (g === 'male' || g === 'm') title = 'Mr';
      else if (g === 'female' || g === 'f') title = 'Mrs';
    }
    F('title',  setSelect('anrede1', title));
    F('gender', setSelect('gender_text1', gender));

    let first = pick(rec, 'first name');
    let last  = pick(rec, 'family name', 'last name');
    if (!first && !last) {
      const bits = pick(rec, 'english name', 'name').trim().split(/\s+/);
      first = bits.shift() || '';
      last  = bits.join(' ');
    }
    F('firstName', setText('vorname1', first));
    F('lastName',  setText('nachname1', last));

    // The form has no Korean-name field, so it goes in "preferred name".
    F('preferred', setText('kurzname1', pick(rec, 'korean name')));
    F('dob',   setText('geb_urt_datum1', normalizeDob(pick(rec, 'date of birth', 'dob'))));
    F('phone', setText('telefon1', normalizePhone(pick(rec, 'phone no', 'phone number', 'phone'))));
    F('email', setText('MWemail1', pick(rec, 'email')));

    F('newsletter-opt-out',
      setRadioByLabel('pnpNLpreferences1', [/do not|don't|dont|not wish|not want/]));
    F('send-by-email',
      setRadioByLabel('commpreferences1', [/e-?mail/], [/post/]));
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'fill') {
      try {
        fill(msg.record || {});
        sendResponse({ ok: true });
      } catch (e) {
        console.error('[autofill] fill failed:', e);
        sendResponse({ ok: false, error: String(e) });
      }
    }
  });
})();
