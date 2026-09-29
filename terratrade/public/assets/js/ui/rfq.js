// Quote form → Netlify Forms (AJAX url-encoded POST to "/"), with per-field error messages
// (aria-describedby), an aria-live status, a success state that takes focus, and a no-JS fallback
// (native validation, then a normal POST that lands on /thanks/).
// Also: copy-email button + toast, and prefill from the spec sheet.
import { $, $$ } from '../core/env.js';
import { t } from '../core/i18n.js';
import { scrollToEl } from './nav.js';

export function toast(msg) {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200);
}

export function prefillQuote(productId) {
  const form = $('#rfq'); if (!form) return;
  if (form.hidden) { form.hidden = false; $('#rfqDone').hidden = true; } // re-open after a previous send
  const sel = form.elements.product; if (sel && productId) sel.value = productId;
  form.elements.source.value = 'spec:' + productId;
  scrollToEl($('#contact'));
  setTimeout(() => {
    const first = $$('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea', form).find(f => !f.value && !f.closest('.hp'));
    (first || sel).focus({ preventScroll: true });
  }, 900);
}

export function copyMail() {
  const b = $('#copyMail'); if (!b) return;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(t('toast.copied')); }
    catch (e) { toast(t('toast.copyFail')); }
  });
}

// validity → message key
function message(f) {
  const v = f.validity;
  if (f.type === 'checkbox') return 'form.errConsent';
  if (f.type === 'email' && !v.valueMissing && v.typeMismatch) return 'form.errEmailFormat';
  return { name: 'form.errName', email: 'form.errEmail', country: 'form.errCountry', product: 'form.errProduct' }[f.name] || 'form.errRequired';
}

export function rfq() {
  const form = $('#rfq'), done = $('#rfqDone'), status = $('#formStatus'); if (!form) return;
  form.noValidate = true; // JS takes over validation (native validation stays on when JS is off)
  const submit = $('.submit', form);
  const errEl = f => document.getElementById(f.getAttribute('aria-describedby') || '');
  const clear = f => { if (!f.hasAttribute?.('aria-invalid')) return; f.removeAttribute('aria-invalid'); const e = errEl(f); if (e) { e.hidden = true; e.textContent = ''; } };
  form.addEventListener('input', e => clear(e.target));
  form.addEventListener('change', e => clear(e.target));
  let inFlight = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (inFlight) return;
    status.textContent = ''; status.classList.remove('err');
    $$('[aria-invalid]', form).forEach(clear);
    const bad = $$('[required]', form).filter(f => !f.checkValidity());
    if (bad.length) {
      bad.forEach(f => { f.setAttribute('aria-invalid', 'true'); const el = errEl(f); if (el) { el.textContent = t(message(f)); el.hidden = false; } });
      status.textContent = t('form.invalid'); status.classList.add('err');
      bad[0].focus();
      return;
    }
    inFlight = true; submit.setAttribute('aria-disabled', 'true'); // keep focus on the button while sending
    const label = submit.querySelector('span'); const orig = label.textContent; label.textContent = t('form.sending');
    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.hidden = true; done.hidden = false; done.querySelector('h3').focus();
    } catch (err) {
      status.textContent = t('form.err'); status.classList.add('err');
    } finally { inFlight = false; submit.removeAttribute('aria-disabled'); label.textContent = orig; }
  });
  $('#rfqAgain')?.addEventListener('click', () => {
    form.reset(); form.elements.source.value = 'contact';
    done.hidden = true; form.hidden = false;
    $('#f-name', form).focus(); // never the honeypot
  });
}
