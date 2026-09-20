export const MODELS = {
  'core-fast':   { label: 'Core Fast',   inRate: 0.6, outRate: 1.8 }, 
  'core-large':  { label: 'Core Large',  inRate: 2.4, outRate: 7.2 },
  'core-vision': { label: 'Core Vision', inRate: 1.5, outRate: 4.5 },
};

export function creditsForEvent(modelKey, tokensIn, tokensOut) {
  const model = MODELS[modelKey] ?? MODELS['core-fast'];
  const cost = (tokensIn / 1000) * model.inRate + (tokensOut / 1000) * model.outRate;
  return Math.round(cost * 10000) / 10000; // 4 decimal places
}

// 1 credit = $0.01. A real system would price this per-account (volume
// discounts, negotiated rates); 
export function creditsToUSD(credits) {
  return Math.round(credits * 0.01 * 100) / 100;
}
