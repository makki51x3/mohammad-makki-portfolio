// Product spec data for the spec-sheet dialog. Values are INDICATIVE (typical export ranges), clearly labelled
// as such on the page — final specifications are agreed per contract. TO CONFIRM WITH TERRATRADE before launch.
// Language-neutral: numbers stay as-is (rendered inside <bdi dir=ltr>); words are i18n keys ({k: 'key'}).
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const PRODUCTS = {
  sesame: {
    months: [10, 11, 12, 1],
    specs: [['spec.purity', '≥ 98%'], ['spec.moisture', '≤ 6%'], ['spec.oil', '48 – 52%'], ['spec.ffa', '≤ 2%'], ['spec.admixture', '≤ 2%']],
    pack: 'pack.bags',
  },
  cashew: {
    months: [2, 3, 4, 5],
    specs: [['spec.kor', '46 – 50 lbs / 80 kg'], ['spec.nutcount', '180 – 210 / kg'], ['spec.moisture', '≤ 10%'], ['spec.defective', '≤ 10%'], ['spec.foreign', '≤ 1%']],
    pack: 'pack.jute',
  },
  hibiscus: {
    months: [11, 12, 1],
    specs: [['spec.form', { k: 'spec.v.calyces' }], ['spec.colour', { k: 'spec.v.deepRed' }], ['spec.moisture', '≤ 12%'], ['spec.admixture', '≤ 1%']],
    pack: 'pack.bags',
  },
  ginger: {
    months: [11, 12, 1, 2, 3],
    specs: [['spec.form', { k: 'spec.v.split' }], ['spec.moisture', '≤ 12%'], ['spec.admixture', '≤ 1%']],
    pack: 'pack.bags',
  },
  soybean: {
    months: [10, 11, 12],
    specs: [['spec.protein', '36 – 40%'], ['spec.oil', '18 – 20%'], ['spec.moisture', '≤ 13%'], ['spec.foreign', '≤ 2%']],
    pack: 'pack.bags',
  },
  'soybean-meal': {
    months: ALL, yearRound: true,
    specs: [['spec.cprotein', '44 – 48%'], ['spec.moisture', '≤ 12.5%'], ['spec.cfibre', '≤ 7%']],
    pack: 'pack.meal',
  },
  'wheat-bran': {
    months: ALL, yearRound: true,
    specs: [['spec.form', { k: 'spec.v.branPellets' }], ['spec.cprotein', '14 – 17%'], ['spec.cfibre', '≤ 12%'], ['spec.moisture', '≤ 13%']],
    pack: 'pack.meal',
  },
  'cotton-seed': {
    months: [11, 12, 1, 2, 3],
    specs: [['spec.form', { k: 'spec.v.wholeSeed' }], ['spec.oil', '17 – 20%'], ['spec.protein', '20 – 24%'], ['spec.moisture', '≤ 10%']],
    pack: 'pack.bags',
  },
};
