const $ = (id) => document.getElementById(id);
let records = [];

const SAMPLE = `Korean Name,First Name,Family Name,Gender,Date of Birth,Phone No,Email,Home Address
김민수,Minsu,Kim,male,15/03/1990,+82 10 1234 5678,minsu.kim@example.com,서울특별시 강남구 역삼동 123-45
이지영,Jiyoung,Lee,female,22/07/1988,+82 10 2345 6789,jiyoung.lee@example.com,경기도 성남시 분당구 정자동 178-1
박준호,Junho,Park,male,08/11/1995,+82 10 3456 7890,junho.park@example.com,부산광역시 해운대구 우동 1500`;

function status(msg, isError) {
  const el = $('status');
  el.textContent = msg;
  el.style.color = isError ? '#c0392b' : '#555';
}

function rowLabel(rec, idx) {
  const lower = {};
  for (const k of Object.keys(rec)) lower[k.toLowerCase()] = rec[k];
  const get = (...keys) => { for (const k of keys) if (lower[k]) return lower[k]; return ''; };

  const first  = get('first name');
  const family = get('family name', 'last name');
  const name = [first, family].filter(Boolean).join(' ')
    || get('english name', 'name')
    || get('korean name');

  return `${idx + 1}. ${name || '(row ' + (idx + 1) + ')'}`;
}

function loadFromText(text) {
  records = csvToRecords(text).records;

  const sel = $('rows');
  sel.innerHTML = '';
  records.forEach((rec, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = rowLabel(rec, idx);
    sel.appendChild(opt);
  });
  sel.style.display = records.length ? 'block' : 'none';
  if (records.length) sel.selectedIndex = 0;
  $('fillBtn').disabled = !records.length;

  status(records.length
    ? `Loaded ${records.length} row${records.length === 1 ? '' : 's'}.`
    : 'No rows found — need a header line plus at least one data row.',
    !records.length);
}

$('loadBtn').addEventListener('click', () => {
  const text = $('paste').value.trim();
  if (!text) { status('Paste some rows first (or click "Use sample").', true); return; }
  try { loadFromText(text); }
  catch (e) { status(`Could not parse: ${e.message}`, true); }
});

$('sampleBtn').addEventListener('click', () => {
  $('paste').value = SAMPLE;
  loadFromText(SAMPLE);
});

$('fillBtn').addEventListener('click', () => {
  const idx = parseInt($('rows').value, 10);
  const rec = records[idx];
  if (!rec) { status('Select a row first.', true); return; }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) { status('No active tab.', true); return; }
    if (!/alpenverein\.at\/mybritannia\/becomeamember\//.test(tab.url || '')) {
      status('Open the become-a-member form page in this tab first.', true);
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'fill', record: rec }, (resp) => {
      if (chrome.runtime.lastError) {
        status('Content script not loaded — reload the extension and refresh the form page.', true);
      } else if (resp && resp.ok) {
        status(`Filled form with row ${idx + 1}.`);
      } else {
        status(`Fill error: ${resp && resp.error ? resp.error : 'unknown'}`, true);
      }
    });
  });
});

$('krBtn').addEventListener('click', () => {
  const r = convertKoreanAddress($('krInput').value);
  $('krOut').textContent = r
    ? `Western: ${r.western_order}\nKorean order: ${r.korean_order}`
    : 'No Korean text detected.';
});
