// LoveStep wordmark: a heart that has climbed a short staircase, "Love" in the accent,
// "Step" in ink with a hand-drawn underline.
export const BRAND = 'LoveStep';

const HEART = 'M16 28.5C6.4 21.6 2 15.9 2 10.6 2 6.9 4.9 4 8.6 4c3 0 5.4 1.7 7.4 4.4C18 5.7 20.4 4 23.4 4 27.1 4 30 6.9 30 10.6c0 5.3-4.4 11-14 17.9z';

export const LOGO = `<span class="ls-logo" aria-label="${BRAND}">
  <svg class="ls-icon" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M2.5 30.5v-5.5h7v-5h7v-5h7.5v15.5z" fill="oklch(92% 0.12 100)" stroke="oklch(92% 0.12 100)" stroke-width="1.5" stroke-linejoin="round"/>
    <g transform="translate(12.4 0.6) scale(0.52)">
      <path d="${HEART}" fill="var(--color-accent)"/>
      <path d="M7 10c.5-2.4 2.4-3.8 4.6-3.6" fill="none" stroke="oklch(100% 0 0 / 0.6)" stroke-width="2.8" stroke-linecap="round"/>
    </g>
  </svg>
  <span class="ls-word" aria-hidden="true"><span class="ls-love">Love</span><span class="ls-step">Step<svg viewBox="0 0 60 8" preserveAspectRatio="none"><path d="M2 5.5c6-4 10 2 16-1.5s10-3 16 0 10 2.5 14-.5 8-2 10 0"/></svg></span></span>
</span>`;
