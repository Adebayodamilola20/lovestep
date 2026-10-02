import { assertTurn } from './util.js';

export const meta = { id: 'chess', name: 'Chess', blurb: 'The full game: castling, en passant, mate.', tag: 'Strategy' };
const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const colorOf = (p) => (p === 0 ? 'w' : 'b');
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK = KG.slice(0, 4), BISHOP = KG.slice(4);

export function init() {
  const rows = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'.split('/');
  const board = [];
  for (const row of rows) for (const ch of row) {
    if (/\d/.test(ch)) board.push(...Array(+ch).fill(null));
    else board.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase());
  }
  return {
    board, turn: 0, winner: null, last: null, check: false, msg: null, half: 0,
    castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: null,
  };
}

export function attacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7;
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (inb(pr, c + dc) && b[pr * 8 + c + dc] === by + 'P') return true;
  for (const [dr, dc] of KN) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'N') return true;
  for (const [dr, dc] of KG) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'K') return true;
  for (const [dirs, kinds] of [[ROOK, 'RQ'], [BISHOP, 'BQ']]) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inb(rr, cc)) {
        const pc = b[rr * 8 + cc];
        if (pc) { if (pc[0] === by && kinds.includes(pc[1])) return true; break; }
        rr += dr; cc += dc;
      }
    }
  }
  return false;
}

function pseudo(s, from) {
  const b = s.board, pc = b[from], col = pc[0], opp = col === 'w' ? 'b' : 'w';
  const r = from >> 3, c = from & 7, out = [];
  const add = (to, extra = {}) => out.push({ from, to, ...extra });
  const enemyOrEmpty = (i) => !b[i] || b[i][0] === opp;
  switch (pc[1]) {
    case 'P': {
      const dir = col === 'w' ? -1 : 1, start = col === 'w' ? 6 : 1;
      const one = (r + dir) * 8 + c;
      if (inb(r + dir, c) && !b[one]) {
        add(one);
        const two = (r + 2 * dir) * 8 + c;
        if (r === start && !b[two]) add(two, { double: true });
      }
      for (const dc of [-1, 1]) {
        if (!inb(r + dir, c + dc)) continue;
        const t = (r + dir) * 8 + c + dc;
        if (b[t] && b[t][0] === opp) add(t);
        else if (t === s.ep) add(t, { ep: true });
      }
      break;
    }
    case 'N':
      for (const [dr, dc] of KN) if (inb(r + dr, c + dc) && enemyOrEmpty((r + dr) * 8 + c + dc)) add((r + dr) * 8 + c + dc);
      break;
    case 'K': {
      for (const [dr, dc] of KG) if (inb(r + dr, c + dc) && enemyOrEmpty((r + dr) * 8 + c + dc)) add((r + dr) * 8 + c + dc);
      const home = col === 'w' ? 60 : 4;
      if (from === home && !attacked(b, home, opp)) {
        if (s.castle[col + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === col + 'R' &&
            !attacked(b, home + 1, opp) && !attacked(b, home + 2, opp)) add(home + 2, { castle: 'K' });
        if (s.castle[col + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === col + 'R' &&
            !attacked(b, home - 1, opp) && !attacked(b, home - 2, opp)) add(home - 2, { castle: 'Q' });
      }
      break;
    }
    default: {
      const dirs = pc[1] === 'R' ? ROOK : pc[1] === 'B' ? BISHOP : KG;
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inb(rr, cc)) {
          const t = rr * 8 + cc;
          if (b[t]) { if (b[t][0] === opp) add(t); break; }
          add(t);
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}

function applyBoard(b, mv, promo = 'Q') {
  b = b.slice();
  const pc = b[mv.from];
  b[mv.to] = pc;
  b[mv.from] = null;
  if (mv.ep) b[(mv.from & ~7) + (mv.to & 7)] = null;
  if (mv.castle === 'K') { b[mv.from + 1] = b[mv.from + 3]; b[mv.from + 3] = null; }
  if (mv.castle === 'Q') { b[mv.from - 1] = b[mv.from - 4]; b[mv.from - 4] = null; }
  if (pc[1] === 'P' && (mv.to >> 3 === 0 || mv.to >> 3 === 7)) b[mv.to] = pc[0] + promo;
  return b;
}

export function legalMoves(s, p = s.turn) {
  const col = colorOf(p), opp = colorOf(1 - p), out = [];
  s.board.forEach((pc, i) => {
    if (pc?.[0] !== col) return;
    for (const mv of pseudo(s, i)) {
      const nb = applyBoard(s.board, mv);
      if (!attacked(nb, nb.indexOf(col + 'K'), opp)) out.push(mv);
    }
  });
  return out;
}

export function move(s, p, m) {
  assertTurn(s, p);
  const mv = legalMoves(s, p).find((x) => x.from === m.from && x.to === m.to);
  if (!mv) throw new Error('Illegal move');
  const promo = ['Q', 'R', 'B', 'N'].includes(m.promo) ? m.promo : 'Q';
  const col = colorOf(p), opp = colorOf(1 - p);
  const moving = s.board[mv.from];
  const captured = s.board[mv.to] || mv.ep;
  s.board = applyBoard(s.board, mv, promo);
  s.half = moving[1] === 'P' || captured ? 0 : s.half + 1;
  s.ep = mv.double ? (mv.from + mv.to) / 2 : null;
  if (moving[1] === 'K') s.castle[col + 'K'] = s.castle[col + 'Q'] = false;
  for (const [sq, key] of [[63, 'wK'], [56, 'wQ'], [7, 'bK'], [0, 'bQ']]) {
    if (mv.from === sq || mv.to === sq) s.castle[key] = false;
  }
  s.last = { from: mv.from, to: mv.to };
  s.turn = 1 - p;
  s.check = attacked(s.board, s.board.indexOf(opp + 'K'), col);
  s.msg = null;
  if (!legalMoves(s, 1 - p).length) {
    s.winner = s.check ? p : 'draw';
    s.msg = s.check ? 'Checkmate!' : 'Stalemate.';
  } else if (s.board.every((pc) => !pc || pc[1] === 'K')) {
    s.winner = 'draw'; s.msg = 'Only kings left. Draw.';
  } else if (s.half >= 100) {
    s.winner = 'draw'; s.msg = 'Fifty moves without a capture. Draw.';
  } else if (s.check) s.msg = 'Check!';
  return s;
}
