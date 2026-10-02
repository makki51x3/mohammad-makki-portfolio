// CodePen effect slots. Each adapted pen lives in its own module (fx/<slot>-<pen>.js), credited in its header,
// in /credits.txt and in README.md; CSS-only adaptations live in assets/css/fx.css under [data-fx="…"].
// Modules load on demand, only where they apply.
import { FINE } from '../core/env.js';

const SLOTS = [
  // S3 hero liquid-glass bubbles - Fernando Cohen, "[SVG] [CSS] Marquee Glass Bubble"
  ['bubbles', () => document.querySelector('[data-fx="bubbles"]') && import('./bubbles-QwdoddG.js')],
  // S1 cursor lens - Andrew Fisher, "Pure CSS cursor tracking" (fine pointers only)
  ['cursor', () => FINE && import('./cursor-GgraMzd.js')],
  // Contact glass card - Abdughafur Khujzoda, liquid-glass profile card (the photo it sits on shows ≥ 961px)
  ['glass', () => document.querySelector('[data-fx="glass"]') && matchMedia('(min-width: 961px)').matches && import('./glass-jEyVvqK.js')],
  // S12 chunky squircle buttons + floating WhatsApp - Andrew Fisher, "Chunky 3D Buttons"
  ['chunky', () => document.querySelector('[data-chunky]') && import('./chunky-raMZQNe.js')],
];

export default function fx() {
  for (const [name, load] of SLOTS) {
    Promise.resolve(load()).then(m => m?.default?.()).catch(e => console.error('[fx]', name, e));
  }
}
