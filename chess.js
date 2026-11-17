// Schach-Regelwerk: Feld 0 = a8, 63 = h1. Figuren als 'wK', 'bP' usw.
const FILES = 'abcdefgh';
const N8 = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const K8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const RD = [[-1,0],[1,0],[0,-1],[0,1]];
const BD = [[-1,-1],[-1,1],[1,-1],[1,1]];
const DE = { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' };
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const opp = c => (c === 'w' ? 'b' : 'w');
const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));

function posKey(s) {
  return s.b.map(x => x || '--').join('') + s.turn +
    (s.castle.wK ? 'K' : '') + (s.castle.wQ ? 'Q' : '') +
    (s.castle.bK ? 'k' : '') + (s.castle.bQ ? 'q' : '') + s.ep;
}

function initial() {
  const b = Array(64).fill(null);
  const back = ['R','N','B','Q','K','B','N','R'];
  for (let i = 0; i < 8; i++) {
    b[i] = 'b' + back[i]; b[8 + i] = 'bP';
    b[48 + i] = 'wP'; b[56 + i] = 'w' + back[i];
  }
  const s = { b, turn: 'w', castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1, half: 0, last: null };
  s.keys = [posKey(s)];
  return s;
}

function attacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7, pd = by === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) { const rr = r + pd, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === by + 'P') return true; }
  for (const [dr, dc] of N8) { const rr = r + dr, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === by + 'N') return true; }
  for (const [dr, dc] of K8) { const rr = r + dr, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === by + 'K') return true; }
  for (const [dirs, ps] of [[RD, 'RQ'], [BD, 'BQ']]) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (on(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) { if (p[0] === by && ps.includes(p[1])) return true; break; }
        rr += dr; cc += dc;
      }
    }
  }
  return false;
}

const kingSq = (b, col) => b.indexOf(col + 'K');
const inCheck = (s, col) => attacked(s.b, kingSq(s.b, col), opp(col));

function pseudo(s) {
  const b = s.b, me = s.turn, ms = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p || p[0] !== me) continue;
    const r = sq >> 3, c = sq & 7, t = p[1];
    if (t === 'P') {
      const d = me === 'w' ? -1 : 1, start = me === 'w' ? 6 : 1, last = me === 'w' ? 0 : 7;
      const add = (to, extra) => {
        if ((to >> 3) === last) for (const pr of 'QRBN') ms.push({ from: sq, to, promo: pr, ...extra });
        else ms.push({ from: sq, to, ...extra });
      };
      if (on(r + d, c) && !b[(r + d) * 8 + c]) {
        add((r + d) * 8 + c, {});
        const f2 = (r + 2 * d) * 8 + c;
        if (r === start && !b[f2]) ms.push({ from: sq, to: f2, dbl: true });
      }
      for (const dc of [-1, 1]) {
        const rr = r + d, cc = c + dc;
        if (!on(rr, cc)) continue;
        const to = rr * 8 + cc;
        if (b[to] && b[to][0] !== me) add(to, {});
        else if (to === s.ep) ms.push({ from: sq, to, ep: true });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of (t === 'N' ? N8 : K8)) {
        const rr = r + dr, cc = c + dc;
        if (!on(rr, cc)) continue;
        const to = rr * 8 + cc;
        if (!b[to] || b[to][0] !== me) ms.push({ from: sq, to });
      }
      const home = me === 'w' ? 60 : 4;
      if (t === 'K' && sq === home && !inCheck(s, me)) {
        const o = opp(me);
        if (s.castle[me + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === me + 'R' &&
            !attacked(b, home + 1, o) && !attacked(b, home + 2, o))
          ms.push({ from: sq, to: home + 2, castle: 'K' });
        if (s.castle[me + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === me + 'R' &&
            !attacked(b, home - 1, o) && !attacked(b, home - 2, o))
          ms.push({ from: sq, to: home - 2, castle: 'Q' });
      }
    } else {
      const dirs = t === 'R' ? RD : t === 'B' ? BD : RD.concat(BD);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (on(rr, cc)) {
          const to = rr * 8 + cc;
          if (b[to]) { if (b[to][0] !== me) ms.push({ from: sq, to }); break; }
          ms.push({ from: sq, to });
          rr += dr; cc += dc;
        }
      }
    }
  }
  return ms;
}

function apply(s, m, withKeys = true) {
  const b = s.b.slice(), p = b[m.from], me = s.turn;
  const cap = b[m.to] || m.ep;
  b[m.to] = m.promo ? me + m.promo : p;
  b[m.from] = null;
  if (m.ep) b[(m.from & ~7) | (m.to & 7)] = null;
  if (m.castle) {
    const home = me === 'w' ? 60 : 4;
    if (m.castle === 'K') { b[home + 1] = b[home + 3]; b[home + 3] = null; }
    else { b[home - 1] = b[home - 4]; b[home - 4] = null; }
  }
  const castle = { ...s.castle };
  if (p[1] === 'K') castle[me + 'K'] = castle[me + 'Q'] = false;
  for (const [sq, k] of [[63, 'wK'], [56, 'wQ'], [7, 'bK'], [0, 'bQ']])
    if (m.from === sq || m.to === sq) castle[k] = false;
  const ns = {
    b, turn: opp(me), castle,
    ep: m.dbl ? (m.from + m.to) / 2 : -1,
    half: (p[1] === 'P' || cap) ? 0 : s.half + 1,
    last: m
  };
  ns.keys = withKeys ? s.keys.concat(posKey(ns)) : s.keys;
  return ns;
}

function legal(s) {
  const me = s.turn;
  return pseudo(s).filter(m => {
    const n = apply(s, m, false);
    return !attacked(n.b, kingSq(n.b, me), opp(me));
  });
}

function insufficient(b) {
  const rest = b.filter(p => p && p[1] !== 'K');
  return rest.length === 0 || (rest.length === 1 && 'BN'.includes(rest[0][1]));
}

function san(s, m, ls) {
  const p = s.b[m.from], t = p[1];
  let str;
  if (m.castle) str = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const cap = s.b[m.to] || m.ep, to = sqName(m.to);
    if (t === 'P') str = (cap ? FILES[m.from & 7] + 'x' : '') + to + (m.promo ? '=' + DE[m.promo] : '');
    else {
      const others = ls.filter(o => o.to === m.to && o.from !== m.from && s.b[o.from] === p);
      let dis = '';
      if (others.length) {
        const sameFile = others.some(o => (o.from & 7) === (m.from & 7));
        const sameRank = others.some(o => (o.from >> 3) === (m.from >> 3));
        dis = !sameFile ? FILES[m.from & 7] : !sameRank ? String(8 - (m.from >> 3)) : sqName(m.from);
      }
      str = DE[t] + dis + (cap ? 'x' : '') + to;
    }
  }
  const n = apply(s, m, false);
  if (inCheck(n, n.turn)) str += legal(n).length ? '+' : '#';
  return str;
}

// Spielt eine Zugliste vom Server ab (nur from/to/promo) und prüft dabei jeden Zug.
function buildGame(moves) {
  let s = initial();
  const list = [];
  for (const mv of moves) {
    const ls = legal(s);
    const m = ls.find(x => x.from === mv.from && x.to === mv.to && (x.promo || null) === (mv.promo || null));
    if (!m) break;
    list.push(san(s, m, ls));
    s = apply(s, m);
  }
  return { s, list };
}

if (typeof module !== 'undefined') module.exports = { initial, legal, apply, inCheck, buildGame, insufficient, san };
