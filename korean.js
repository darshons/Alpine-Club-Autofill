// Korean address romanization (Revised Romanization).

const CHO  = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const JUNG = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const JONG = ['','k','k','k','n','n','n','t','l','l','l','l','l','l','l','l','m','p','p','t','t','ng','t','t','k','t','p','t'];

function romanizeSyllable(ch) {
  const c = ch.charCodeAt(0) - 0xAC00;
  if (c < 0 || c > 11171) return ch;
  // Hangul syllables are packed as cho*588 + jung*28 + jong.
  return CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
}

const romanize = s => [...s].map(romanizeSyllable).join('');
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// Longest suffix first, so 특별시 wins over 시.
const DIV = [
  ['특별자치시', '-si'], ['특별자치도', '-do'], ['특별시', '-si'], ['광역시', '-si'],
  ['특례시', '-si'], ['자치구', '-gu'], ['자치군', '-gun'],
  ['시', '-si'], ['도', '-do'], ['군', '-gun'], ['구', '-gu'], ['읍', '-eup'],
  ['면', '-myeon'], ['동', '-dong'], ['리', '-ri'], ['가', '-ga'], ['로', '-ro'], ['길', '-gil']
];

// Place names whose accepted spelling isn't what RR produces.
const OVERRIDE = {
  '서울':'Seoul','부산':'Busan','대구':'Daegu','인천':'Incheon','광주':'Gwangju',
  '대전':'Daejeon','울산':'Ulsan','세종':'Sejong','경기':'Gyeonggi','강원':'Gangwon',
  '충북':'Chungbuk','충남':'Chungnam','전북':'Jeonbuk','전남':'Jeonnam',
  '경북':'Gyeongbuk','경남':'Gyeongnam','제주':'Jeju','종로':'Jongno'
};

function convertToken(tok) {
  for (const [suf, en] of DIV) {
    if (tok.endsWith(suf) && tok.length > suf.length) {
      const stem = tok.slice(0, -suf.length);
      return (OVERRIDE[stem] || cap(romanize(stem))) + en;
    }
  }
  return OVERRIDE[tok] || cap(romanize(tok));
}

function convertKoreanAddress(addr) {
  if (!addr || !/[가-힣]/.test(addr)) return null;
  const converted = addr.trim().split(/\s+/).map(t => {
    if (/^[\d\-번지호층]+$/.test(t)) {
      return t.replace(/번지/g, '').replace(/호/g, '').replace(/층/g, '');
    }
    return convertToken(t);
  });
  return {
    korean_order:  converted.join(' '),
    western_order: converted.slice().reverse().join(', ')
  };
}

// Splits one Korean address cell into { province, city, line1 } for the form's
// three address fields, in Western order.
function splitKoreanAddress(addr) {
  if (!addr || !/[가-힣]/.test(addr)) {
    return { province: '', city: '', line1: addr || '' };
  }
  const tokens = addr.trim().split(/\s+/);
  const isProvince = t => /(특별자치시|특별자치도|특별시|광역시|도)$/.test(t);
  const isCity     = t => /(시|군|구)$/.test(t);

  let i = 0;
  let province = '';
  if (i < tokens.length && isProvince(tokens[i])) province = convertToken(tokens[i++]);

  const cityToks = [];
  while (i < tokens.length && isCity(tokens[i])) cityToks.push(convertToken(tokens[i++]));
  const city = cityToks.slice().reverse().join(', ');

  // 210동/310호 are building units; 역삼동 is a neighborhood, so require a leading number.
  const isBuilding = t => /^\d+(호|동|층)$/.test(t);
  const building = [], street = [];
  for (const t of tokens.slice(i)) {
    let romanized;
    if (isBuilding(t)) {
      romanized = t.replace(/호$/, '').replace(/층$/, '').replace(/동$/, '-dong');
    } else {
      romanized = /^[\d\-번지]+$/.test(t) ? t.replace(/번지/g, '') : convertToken(t);
    }
    (isBuilding(t) ? building : street).push(romanized);
  }
  const line1 = [...building.reverse(), street.join(' ')].filter(Boolean).join(', ');

  if (!province && !city) {
    return { province: '', city: '', line1: convertKoreanAddress(addr).korean_order };
  }
  return { province, city, line1 };
}

window.convertKoreanAddress = convertKoreanAddress;
window.splitKoreanAddress = splitKoreanAddress;
