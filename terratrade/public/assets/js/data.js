// Product spec data for the spec-sheet dialog. Values are INDICATIVE (typical export ranges), clearly labelled
// as such on the page - final specifications are agreed per contract. TO CONFIRM WITH TERRATRADE before launch.
// Language-neutral: numbers stay as-is (rendered inside <bdi dir=ltr>); words are i18n keys ({k: 'key'});
// numbers with units are {n, u} so the unit gets translated.
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const PRODUCTS = {
  sesame: {
    months: [10, 11, 12, 1],
    specs: [['spec.purity', '≥ 98%'], ['spec.moisture', '≤ 6%'], ['spec.oil', '48 – 52%'], ['spec.ffa', '≤ 2%'], ['spec.admixture', '≤ 2%']],
    pack: 'pack.bags',
  },
  cashew: {
    months: [2, 3, 4, 5],
    specs: [['spec.kor', { n: '46 – 50', u: 'spec.u.lbs80' }], ['spec.nutcount', { n: '180 – 210', u: 'spec.u.perKg' }], ['spec.moisture', '≤ 10%'], ['spec.defective', '≤ 10%'], ['spec.foreign', '≤ 1%']],
    pack: 'pack.jute',
  },
  hibiscus: {
    months: [11, 12, 1],
    specs: [['spec.form', { k: 'spec.v.calyces' }], ['spec.colour', { k: 'spec.v.deepRed' }], ['spec.moisture', '≤ 12%'], ['spec.admixture', '≤ 1%']],
    pack: 'pack.bags',
  },
  soybean: {
    months: [10, 11, 12],
    specs: [['spec.protein', '36 – 40%'], ['spec.oil', '18 – 20%'], ['spec.moisture', '≤ 13%'], ['spec.foreign', '≤ 2%']],
    pack: 'pack.bags',
  },
  'wheat-bran': {
    months: ALL, yearRound: true,
    specs: [['spec.form', { k: 'spec.v.branPellets' }], ['spec.cprotein', '14 – 17%'], ['spec.cfibre', '≤ 12%'], ['spec.moisture', '≤ 13%']],
    pack: 'pack.meal',
  },
  // wood-based products: hardwood lump charcoal (produced year-round; typical export-grade ranges)
  charcoal: {
    months: ALL, yearRound: true, yearRoundKey: 'spec.yearRoundMade',
    specs: [['spec.form', { k: 'spec.v.hardwoodLump' }], ['spec.fixedCarbon', '≥ 75%'], ['spec.moisture', '≤ 8%'], ['spec.ash', '≤ 4%'],
      ['spec.volatile', '≤ 20%'], ['spec.size', { n: '3 – 15', u: 'spec.u.cm' }], ['spec.calorific', { n: '≥ 7,000', u: 'spec.u.kcalKg' }]],
    pack: 'pack.charcoal',
  },
};
