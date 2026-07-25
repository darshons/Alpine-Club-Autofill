// CSV/TSV parser — handles quoted fields containing commas or newlines.

function parseCSV(text, delim) {
  const s = text.replace(/\r\n?/g, '\n');
  // Excel and Sheets copy as tab-separated; pasted CSV is comma-separated.
  if (!delim) delim = (s.split('\n')[0] || '').includes('\t') ? '\t' : ',';

  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delim) { row.push(field); field = ''; i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToRecords(text) {
  const grid = parseCSV(text).filter(r => r.some(c => c.trim() !== ''));
  if (grid.length < 2) return { headers: grid[0] || [], records: [] };

  const headers = grid[0].map(h => h.trim());
  const records = grid.slice(1).map(cells => {
    const rec = {};
    headers.forEach((h, idx) => { rec[h] = (cells[idx] ?? '').trim(); });
    return rec;
  });
  return { headers, records };
}
