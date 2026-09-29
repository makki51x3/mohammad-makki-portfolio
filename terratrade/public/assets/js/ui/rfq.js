// Quote form → Netlify Forms (AJAX url-encoded POST to "/"), with inline validation, an aria-live status,
// a success state that takes focus, and a no-JS fallback (the form posts normally and lands on /thanks/).
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
  const sel = form.elements.product; if (sel && productId) sel.value = productId;
  form.elements.source.value = 'spec:' + productId;
  const section = $('#contact');
  scrollToEl(section);
  setTimeout(() => { const first = [...form.querySelectorAll('input:not([type=hidden]):not([type=radio]), select, textarea')].find(f => !f.value && !f.closest('.hp')); (first || sel).focus({ preventScroll: true }); }, 900);
}

export function copyMail() {
  const b = $('#copyMail'); if (!b) return;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(t('toast.copied')); }
    catch (e) { toast(t('toast.copyFail')); }
  });
}

export function rfq() {
  const form = $('#rfq'), done = $('#rfqDone'), status = $('#formStatus'); if (!form) return;
  const submit = $('.submit', form);
  const clearInvalid = el => { el.removeAttribute('aria-invalid'); };
  form.addEventListener('input', e => clearInvalid(e.target));
  form.addEventListener('change', e => clearInvalid(e.target));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.textContent = ''; status.classList.remove('err');
    const bad = $$('[required]', form).filter(f => !f.checkValidity());
    $$('[aria-invalid]', form).forEach(clearInvalid);
    if (bad.length) { bad.forEach(f => f.setAttribute('aria-invalid', 'true')); status.textContent = t('form.invalid'); status.classList.add('err'); bad[0].focus(); return; }
    submit.disabled = true; const label = submit.querySelector('span'); const orig = label.textContent; label.textContent = t('form.sending');
    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.hidden = true; done.hidden = false; done.focus();
    } catch (err) {
      status.textContent = t('form.err'); status.classList.add('err');
    } finally { submit.disabled = false; label.textContent = orig; }
  });
  $('#rfqAgain')?.addEventListener('click', () => { form.reset(); form.elements.source.value = 'contact'; done.hidden = true; form.hidden = false; form.querySelector('input:not([type=hidden])').focus(); });
}
