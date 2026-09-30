// Light (default) / dark "night harvest" theme with the portfolio's circular view-transition reveal.
// Persisted in localStorage('tt-theme'); the inline head script applies it before first paint.
// Also wires the "Pause animations" switch (WCAG 2.2.2).
import { html, REDUCED, $ } from './env.js';
import { t } from './i18n.js';

const meta = () => document.querySelector('meta[name="theme-color"]');
export const isDark = () => html.classList.contains('dark');

function sync() {
  // action-style label ("Switch to dark theme"), so no aria-pressed on top of it
  $('#themeToggle')?.setAttribute('aria-label', t(isDark() ? 'nav.themeLight' : 'nav.themeDark'));
  meta()?.setAttribute('content', isDark() ? '#04150E' : '#013D27');
}

export function theme() {
  const btn = $('#themeToggle'); if (!btn) return;
  sync();
  btn.addEventListener('click', () => {
    const r = btn.getBoundingClientRect();
    html.style.setProperty('--vx', ((r.left + r.width / 2) / innerWidth * 100) + '%');
    html.style.setProperty('--vy', ((r.top + r.height / 2) / innerHeight * 100) + '%');
    const go = () => {
      const dark = html.classList.toggle('dark');
      try { localStorage.setItem('tt-theme', dark ? 'dark' : 'light'); } catch (e) { /* private mode */ }
      sync();
      window.dispatchEvent(new CustomEvent('tt:theme', { detail: { dark } }));
    };
    if (document.startViewTransition && !REDUCED) {
      const vt = document.startViewTransition(go);
      vt.ready?.catch(() => {}); vt.finished?.catch(() => {});
    } else go();
  });
}
