// Operations map story: the Nigeria outline draws itself, the Kano sourcing zone and hubs pop in, goods
// travel along the inland route to the port of Lagos, then out to sea "to export markets".
// Desktop: the stage is pinned and scrubbed. Phones: the map is sticky (CSS) and the step cards scrub it.
// Reduced motion / no JS: the finished map is shown as-is. Never mirrored in Arabic (geography is fixed).
import { $, $$, REDUCED, hasGSAP } from '../core/env.js';

const load = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

export default async function nigeriaMap() {
  const stage = $('#opsStage'), map = $('#ngmap'); if (!stage || !map || REDUCED || !hasGSAP()) { $$('.ops-step').forEach(s => s.classList.add('on')); return; }
  await Promise.all([load('/assets/js/vendor/DrawSVGPlugin.min.js'), load('/assets/js/vendor/MotionPathPlugin.min.js')]);
  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);
  const svg = $('svg', map), NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); svg.appendChild(el); return el; };
  const truck = mk('circle', { r: 9, class: 'ng-cargo' }), ship = mk('circle', { r: 7, class: 'ng-ship' });
  const steps = $$('.ops-step');
  const setStep = i => steps.forEach((s, k) => s.classList.toggle('on', k === i));
  const hub = n => $(`.hub-${n}`, map);

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  tl.from('.ng-outline', { drawSVG: '0%', duration: 1.4 })
    .fromTo('.ng-land', { opacity: .14 }, { opacity: 1, duration: .8 }, '<.4')
    .from('.ng-zone', { scale: 0, transformOrigin: '50% 50%', opacity: 0, duration: .6, ease: 'back.out(1.6)' })
    .from([hub('kano'), '.zone-note'], { scale: 0, opacity: 0, duration: .5, ease: 'back.out(2)', onStart: () => setStep(0), onReverseComplete: () => setStep(-1) }, '<.1')
    .from(hub('lagos'), { scale: 0, opacity: 0, duration: .5, ease: 'back.out(2)', onStart: () => setStep(1), onReverseComplete: () => setStep(0) }, '+=.3')
    .from('#ngRouteLagos', { drawSVG: '0%', duration: 1.2 })
    .fromTo(truck, { opacity: 0 }, { opacity: 1, duration: .1 }, '<')
    .to(truck, { motionPath: { path: '#ngRouteLagos', align: '#ngRouteLagos', alignOrigin: [.5, .5] }, duration: 1.2 }, '<')
    .fromTo('.ng-sea-route', { opacity: 0 }, { opacity: 1, duration: .9, onStart: () => setStep(2), onReverseComplete: () => setStep(1) })
    .fromTo(ship, { opacity: 0 }, { opacity: 1, duration: .1 }, '<')
    .to(ship, { motionPath: { path: '#ngSeaLagos', align: '#ngSeaLagos', alignOrigin: [.5, .5] }, duration: .9 }, '<')
    .from('.sea-note', { y: 12, opacity: 0, duration: .4 }, '-=.3');

  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    stage.classList.add('pinning');
    const st = ScrollTrigger.create({ trigger: stage, start: 'center center', end: '+=160%', pin: true, scrub: .6, animation: tl, anticipatePin: 1 });
    return () => { stage.classList.remove('pinning'); st.kill(); };
  });
  mm.add('(max-width: 900px)', () => {
    // the map is sticky on phones: start drawing as soon as it enters, finish as the last step passes
    const st = ScrollTrigger.create({ trigger: map, start: 'top 90%', endTrigger: '.ops-steps', end: 'bottom 60%', scrub: .6, animation: tl });
    return () => st.kill();
  });
  ScrollTrigger.refresh();
}
