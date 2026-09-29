// Operations map story: the Nigeria outline draws itself, the Kano sourcing zone and hubs pop in, goods
// travel along the inland routes to the southern ports, then out to sea "to export markets".
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
  const truckA = mk('circle', { r: 9, class: 'ng-cargo' }), truckB = mk('circle', { r: 9, class: 'ng-cargo' });
  const ship = mk('circle', { r: 7, class: 'ng-ship' }), ship2 = mk('circle', { r: 7, class: 'ng-ship' });
  const steps = $$('.ops-step');
  const setStep = i => steps.forEach((s, k) => s.classList.toggle('on', k === i));
  const hub = n => $(`.hub-${n}`, map);

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  tl.from('.ng-outline', { drawSVG: '0%', duration: 1.4 })
    .from('.ng-land', { opacity: 0, duration: .8 }, '<.4')
    .from('.ng-zone', { scale: 0, transformOrigin: '50% 50%', opacity: 0, duration: .6, ease: 'back.out(1.6)' })
    .from([hub('kano'), '.zone-note'], { scale: 0, opacity: 0, duration: .5, ease: 'back.out(2)', onStart: () => setStep(0), onReverseComplete: () => setStep(-1) }, '<.1')
    .from([hub('lagos'), hub('ph')], { scale: 0, opacity: 0, duration: .5, stagger: .15, ease: 'back.out(2)', onStart: () => setStep(1), onReverseComplete: () => setStep(0) }, '+=.3')
    .from(['#ngRouteLagos', '#ngRoutePH'], { drawSVG: '0%', duration: 1.2 })
    .fromTo(truckA, { opacity: 0 }, { opacity: 1, duration: .1 }, '<')
    .fromTo(truckB, { opacity: 0 }, { opacity: 1, duration: .1 }, '<')
    .to(truckA, { motionPath: { path: '#ngRouteLagos', align: '#ngRouteLagos', alignOrigin: [.5, .5] }, duration: 1.2 }, '<')
    .to(truckB, { motionPath: { path: '#ngRoutePH', align: '#ngRoutePH', alignOrigin: [.5, .5] }, duration: 1.2 }, '<')
    .from(['#ngSeaLagos', '#ngSeaPH'], { drawSVG: '0%', duration: .9, onStart: () => setStep(2), onReverseComplete: () => setStep(1) })
    .fromTo([ship, ship2], { opacity: 0 }, { opacity: 1, duration: .1 }, '<')
    .to(ship, { motionPath: { path: '#ngSeaLagos', align: '#ngSeaLagos', alignOrigin: [.5, .5] }, duration: .9 }, '<')
    .to(ship2, { motionPath: { path: '#ngSeaPH', align: '#ngSeaPH', alignOrigin: [.5, .5] }, duration: .9 }, '<')
    .from('.sea-note', { y: 12, opacity: 0, duration: .4 }, '-=.3');

  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    stage.classList.add('pinning');
    const st = ScrollTrigger.create({ trigger: stage, start: 'center center', end: '+=160%', pin: true, scrub: .6, animation: tl, anticipatePin: 1 });
    return () => { stage.classList.remove('pinning'); st.kill(); };
  });
  mm.add('(max-width: 900px)', () => {
    const st = ScrollTrigger.create({ trigger: '.ops-steps', start: 'top 75%', end: 'bottom 55%', scrub: .6, animation: tl });
    return () => st.kill();
  });
  ScrollTrigger.refresh();
}
