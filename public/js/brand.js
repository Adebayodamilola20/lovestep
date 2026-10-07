// Stephlia wordmark: two hearts leaning into each other, "Steph" in the accent,
// "lia" in ink with a hand-drawn underline.
export const BRAND = 'Stephlia';

const HEART = 'M16 28.5C6.4 21.6 2 15.9 2 10.6 2 6.9 4.9 4 8.6 4c3 0 5.4 1.7 7.4 4.4C18 5.7 20.4 4 23.4 4 27.1 4 30 6.9 30 10.6c0 5.3-4.4 11-14 17.9z';

export const LOGO = `<span class="ls-logo" aria-label="${BRAND}">
  <svg class="ls-icon" viewBox="0 0 32 32" aria-hidden="true">
    <g transform="translate(13 7) rotate(14 9 9) scale(0.6)"><path d="${HEART}" fill="oklch(92% 0.12 100)"/></g>
    <g transform="translate(1 5) rotate(-10 9 9) scale(0.66)">
      <path d="${HEART}" fill="var(--color-accent)" stroke="var(--color-paper)" stroke-width="2.4"/>
      <path d="M7 10c.5-2.4 2.4-3.8 4.6-3.6" fill="none" stroke="oklch(100% 0 0 / 0.6)" stroke-width="2.8" stroke-linecap="round"/>
    </g>
  </svg>
  <span class="ls-word" aria-hidden="true"><span class="ls-love">Steph</span><span class="ls-step">lia<svg viewBox="0 0 60 8" preserveAspectRatio="none"><path d="M2 5.5c6-4 10 2 16-1.5s10-3 16 0 10 2.5 14-.5 8-2 10 0"/></svg></span></span>
</span>`;
