// Spec-sheet dialog — the portfolio's case-file viewer rebuilt on native <dialog> (focus trap, Escape and
// focus return for free), with its giant outlined ghost text. Product name/blurb/image are read from the card.
import { $, $$, html } from '../core/env.js';
import { t } from '../core/i18n.js';
import { PRODUCTS } from '../data.js';
import { prefillQuote } from './rfq.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// value = "≤ 6%" | { k: 'spec.v.…' } (a word) | { n: '46 – 50', u: 'spec.u.…' } (number + translated unit)
const val = v => typeof v === 'string' ? `<bdi>${esc(v)}</bdi>`
  : v.k ? esc(t(v.k))
  : `<bdi>${esc(v.n)}</bdi> ${esc(t(v.u))}`;

export function spec() {
  const dlg = $('#spec'); if (!dlg || typeof dlg.showModal !== 'function') return;
  let opener = null, current = null;
  const open = (id, from) => {
    const data = PRODUCTS[id], card = $(`.pcard[data-id="${id}"]`); if (!data || !card) return;
    current = id; opener = from || document.activeElement;
    const name = $('h3', card).textContent.trim(), img = $('img', card);
    $('#specName', dlg).textContent = name;
    $('#specGhost', dlg).textContent = `${name} · ${name} · ${name} · ${name} · `;
    $('#specDiv', dlg).textContent = $('.tag', card).textContent.trim();
    $('#specBlurb', dlg).textContent = $('.blurb', card).textContent.trim();
    // show the card's already-decoded image instantly (never the previous product's photo)
    const si = $('#specImg', dlg); si.removeAttribute('src'); si.src = img.currentSrc || img.src; si.alt = img.alt;
    $('#specCap', dlg).textContent = t('spec.cap');
    $('#specTable', dlg).innerHTML = '<tbody>' + data.specs.map(([k, v]) => `<tr><th scope="row">${esc(t(k))}</th><td>${val(v)}</td></tr>`).join('') + '</tbody>';
    $('#specPack', dlg).innerHTML = `<b>${esc(t('spec.packLabel'))}:</b> ${esc(t(data.pack))}`;
    const months = t('months'), names = t('monthNames');
    const inSeason = data.yearRound ? t('spec.yearRound') : data.months.map(m => names[m - 1]).join(html.lang === 'ar' ? '، ' : ', ');
    $('#specSeason', dlg).innerHTML = `<span class="season-cap">${esc(t(data.yearRound ? 'spec.yearRound' : 'spec.season'))}</span>` +
      months.map((m, i) => `<span class="${data.months.includes(i + 1) ? 'on' : ''}" aria-hidden="true">${esc(m)}</span>`).join('') +
      `<span class="sr-only">${esc(inSeason)}</span>`;
    $('#specQuote', dlg).textContent = t('spec.quote');
    const wa = $('#specWa', dlg); wa.textContent = t('spec.wa'); wa.href = 'https://wa.me/2348034445888?text=' + encodeURIComponent(t('spec.waText', { p: name }));
    $('#specPrint', dlg).textContent = t('spec.print');
    $('#specNote', dlg).textContent = t('spec.note');
    $('#specClose', dlg).setAttribute('aria-label', t('spec.close'));
    html.classList.add('dlgopen');
    dlg.showModal();
    $('.spec-wrap', dlg).scrollTop = 0;
    $('#specClose', dlg).focus();
  };
  const close = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => { html.classList.remove('dlgopen'); opener?.focus?.(); });
  // backdrop click closes — but not when a text-selection drag merely ends on the backdrop
  let downOnBackdrop = false;
  dlg.addEventListener('pointerdown', e => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener('click', e => { if (downOnBackdrop && e.target === dlg) close(); downOnBackdrop = false; });
  $('#specClose', dlg).addEventListener('click', close);
  $('#specQuote', dlg).addEventListener('click', () => { const id = current; opener = null; close(); prefillQuote(id); });
  // print only the sheet (also when the user prints with Ctrl/Cmd+P while it is open)
  addEventListener('beforeprint', () => { if (dlg.open) document.body.classList.add('printing'); });
  addEventListener('afterprint', () => document.body.classList.remove('printing'));
  $('#specPrint', dlg).addEventListener('click', () => print());
  document.addEventListener('click', e => { const b = e.target.closest('[data-spec]'); if (b) open(b.dataset.spec, b); });
  // the whole card opens the sheet too (the button stays the keyboard target)
  $$('.pcard').forEach(c => c.addEventListener('click', e => { if (!e.target.closest('button, a')) open(c.dataset.id, $('[data-spec]', c)); }));
  // a card's "Request a quote" prefills the form with that product (without JS it is a plain #contact link)
  $$('[data-quote]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); prefillQuote(a.dataset.quote, 'card'); }));
}
