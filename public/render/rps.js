import { CHOICES, WIN } from '/shared/games/rps.js';
import { haptic, reduced, tilt } from '/js/fx.js';

const ICON = { rock: 'ph-hand-fist', paper: 'ph-hand-palm', scissors: 'ph-scissors' };
const LABEL = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

export function mount(el, { send, preview }) {
  el.innerHTML = `
    <div class="rps">
      <div class="rps-arena">
        <div class="rps-side them"><div class="rps-pips"></div><div class="rps-card" data-who="them"></div><span class="rps-tag"></span></div>
        <div class="rps-mid"><b class="rps-round num"></b><span class="rps-say" aria-live="polite"></span></div>
        <div class="rps-side me"><span class="rps-tag"></span><div class="rps-card" data-who="me"></div><div class="rps-pips"></div></div>
      </div>
      <div class="rps-hand" role="group" aria-label="Your pick">
        ${CHOICES.map((c, i) => `<button class="rps-pick" type="button" data-pick="${i}" aria-label="${LABEL[c]}"><i class="ph-fill ${ICON[c]}"></i><span>${LABEL[c]}</span></button>`).join('')}
      </div>
    </div>`;
  const $ = (q) => el.querySelector(q);
  const cardMe = $('.rps-card[data-who="me"]'), cardThem = $('.rps-card[data-who="them"]');
  const offs = [...el.querySelectorAll('.rps-pick')].map((b) => tilt(b, { max: 10 }));
  let state = null, meta = null, seen = null, busy = false;

  const face = (pick, extra = '') => `<span class="rps-face ${extra}"><i class="ph-fill ${ICON[CHOICES[pick]]}"></i><b>${LABEL[CHOICES[pick]]}</b></span>`;
  const back = (text, icon = 'ph-question') => `<span class="rps-back"><i class="ph ${icon}"></i><small>${esc(text)}</small></span>`;
  const pips = (n) => Array.from({ length: WIN }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('');

  function paint() {
    const me = meta.you, them = 1 - me, s = state;
    const opp = meta.players[them]?.name ?? 'Them';
    el.querySelector('.them .rps-pips').innerHTML = pips(s.score[them]);
    el.querySelector('.me .rps-pips').innerHTML = pips(s.score[me]);
    el.querySelector('.them .rps-tag').textContent = opp;
    el.querySelector('.me .rps-tag').textContent = 'You';
    $('.rps-round').textContent = s.winner != null ? 'Final' : `Round ${s.round}`;

    const mine = s.picks[me], theirs = s.picks[them];
    const showLast = s.last && mine == null && theirs == null;
    if (showLast || s.winner != null) {
      const L = s.last;
      cardMe.innerHTML = face(L.picks[me], L.won === me ? 'won' : L.won === them ? 'lost' : '');
      cardThem.innerHTML = face(L.picks[them], L.won === them ? 'won' : L.won === me ? 'lost' : '');
      $('.rps-say').textContent = L.won == null ? 'Draw. Go again' : L.won === me ? 'You take the round' : `${opp} takes the round`;
    } else {
      cardMe.innerHTML = mine != null ? face(mine) : back('Your pick', 'ph-hand-pointing');
      cardThem.innerHTML = theirs != null ? back('Locked in', 'ph-lock-simple') : back('Thinking…');
      cardThem.classList.toggle('locked', theirs != null);
      $('.rps-say').textContent = mine != null ? `Waiting for ${opp}` : theirs != null ? `${opp} has picked. Your move` : 'Rock, paper, scissors…';
    }
    const can = !preview && s.winner == null && mine == null && !busy;
    el.querySelectorAll('.rps-pick').forEach((b) => { b.disabled = !can; b.classList.toggle('chosen', +b.dataset.pick === mine); });
  }

  // The classic count: both fists bounce three times, then the cards turn over.
  async function reveal() {
    busy = true;
    paint();
    const L = state.last, me = meta.you;
    if (!reduced) {
      cardMe.innerHTML = face(0); cardThem.innerHTML = face(0);
      const say = $('.rps-say');
      for (const word of ['Rock', 'Paper', 'Scissors']) {
        say.textContent = word;
        haptic(6);
        await Promise.all([cardMe, cardThem].map((c) => c.animate([
          { transform: 'translateY(0) rotateX(0deg)' }, { transform: 'translateY(-22px) rotateX(-14deg)' }, { transform: 'translateY(0) rotateX(0deg)' },
        ], { duration: 300, easing: 'ease-in-out' }).finished));
      }
      say.textContent = 'Shoot!';
    }
    busy = false;
    paint();
    if (!reduced) [cardMe, cardThem].forEach((c) => c.animate([{ transform: 'rotateY(90deg) scale(0.9)' }, { transform: 'none' }], { duration: 360, easing: EASE }));
    haptic(L.won == null ? 10 : L.won === me ? [20, 30, 40] : [40, 20, 10]);
  }

  el.querySelectorAll('.rps-pick').forEach((b) => b.addEventListener('click', async () => {
    if (b.disabled) return;
    const pick = +b.dataset.pick;
    haptic(10);
    b.classList.add('chosen');
    el.querySelectorAll('.rps-pick').forEach((x) => { x.disabled = true; });
    cardMe.innerHTML = face(pick);
    if (!reduced) cardMe.animate([{ transform: 'translateY(60px) rotateX(40deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: EASE });
    const r = await send({ type: 'lock', pick });
    if (r?.error) paint();
  }));

  return {
    update(s, m) {
      const fresh = s.last && seen != null && s.last.round !== seen;
      seen = s.last?.round ?? 0;
      state = s;
      meta = m;
      if (fresh && !preview) reveal();
      else paint();
    },
    destroy() { offs.forEach((f) => f?.()); },
  };
}
