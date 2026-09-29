// Spec-sheet dialog — the portfolio's case-file viewer rebuilt on native <dialog> (focus trap, Escape and
// focus return for free), with its giant outlined ghost text. Product name/blurb/image are read from the card.
import { $, $$, html } from '../core/env.js';
import { t } from '../core/i18n.js';
import { PRODUCTS } from '../data.js';
import { prefillQuote } from './rfq.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const val = v => typeof v === 'object' ? t(v.k) : v;

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
    const big = img.getAttribute('srcset')?.split(',').pop().trim().split(' ')[0] || img.src;
    const si = $('#specImg', dlg); si.src = big; si.alt = img.alt;
    $('#specCap', dlg).textContent = t('spec.cap');
    $('#specTable', dlg).innerHTML = '<tbody>' + data.specs.map(([k, v]) => `<tr><th scope="row">${esc(t(k))}</th><td><bdi>${esc(val(v))}</bdi></td></tr>`).join('') + '</tbody>';
    $('#specPack', dlg).innerHTML = `<b>${esc(t('spec.packLabel'))}:</b> ${esc(t(data.pack))}`;
    const months = t('months');
    $('#specSeason', dlg).innerHTML = `<span class="season-cap">${esc(t(data.yearRound ? 'spec.yearRound' : 'spec.season'))}</span>` +
      months.map((m, i) => `<span class="${data.months.includes(i + 1) ? 'on' : ''}" aria-hidden="true">${esc(m)}</span>`).join('');
    $('#specQuote', dlg).textContent = t('spec.quote');
    const wa = $('#specWa', dlg); wa.textContent = t('spec.wa'); wa.href = 'https://wa.me/2348034445888?text=' + encodeURIComponent(t('spec.waText', { p: name }));
    $('#specPrint', dlg).textContent = t('spec.print');
    $('#specNote', dlg).textContent = t('spec.note');
    $('#specClose', dlg).setAttribute('aria-label', t('spec.close'));
    html.classList.add('dlgopen');
    dlg.showModal();
    $('#specClose', dlg).focus();
  };
  const close = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => { html.classList.remove('dlgopen'); opener?.focus?.(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); }); // backdrop click
  $('#specClose', dlg).addEventListener('click', close);
  $('#specQuote', dlg).addEventListener('click', () => { const id = current; opener = null; close(); prefillQuote(id); });
  $('#specPrint', dlg).addEventListener('click', () => { document.body.classList.add('printing'); print(); setTimeout(() => document.body.classList.remove('printing'), 500); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-spec]'); if (b) open(b.dataset.spec, b); });
  // the whole card opens the sheet too (the button stays the keyboard target)
  $$('.pcard').forEach(c => c.addEventListener('click', e => { if (!e.target.closest('button, a')) open(c.dataset.id, $('[data-spec]', c)); }));
}
