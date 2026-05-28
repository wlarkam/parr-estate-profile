// BC Probate Fee Act math — used to compute the exposure dollar range
// shown on the result page. Pure functions, no I/O.

// Midpoint estate value for each Q1 bracket (in dollars).
// We use midpoints because the user picks a range, not an exact figure.
const ESTATE_MIDPOINT = {
  under_250k: 150_000,
  '250k_1m':  625_000,
  '1m_3m':    2_000_000,
  '3m_10m':   6_500_000,
  '10m_plus': 15_000_000,
};

// BC probate fee schedule (Probate Fee Act, BC):
//   ≤ $25K:                    $0
//   $25K < estate ≤ $50K:      $200 filing fee + $6 per $1,000 over $25K
//   > $50K:                    $200 + $150 + $14 per $1,000 over $50K
//
// "Estate value" here is the value of assets passing *through* probate,
// not gross net worth.
export function bcProbateFee(estateValue) {
  if (estateValue <= 25_000) return 0;
  if (estateValue <= 50_000) {
    return 200 + Math.round((6 * (estateValue - 25_000)) / 1_000);
  }
  return (
    200 +
    150 +
    Math.round((14 * (estateValue - 50_000)) / 1_000)
  );
}

// What fraction of the gross estate is likely to pass *through* probate,
// keyed on the user's Q5 (probate_exposure) answer.
// A: actively structured to avoid probate.
// F: hasn't mapped it — assume nearly everything is exposed.
const PROBATE_EXPOSURE_FRACTION = {
  A: 0.25,
  B: 0.55,
  C: 0.80,
  F: 0.95,
};

// Returns the [low, high] range of probate fees a user's family would pay
// given their estate-value bracket and their reported probate exposure.
// The range comes from ±15% around the midpoint exposure fraction,
// so the result page shows a band rather than false precision.
export function estimateProbateRange(q1EstateValue, q5ProbateExposure) {
  const estate = ESTATE_MIDPOINT[q1EstateValue];
  const baseFraction = PROBATE_EXPOSURE_FRACTION[q5ProbateExposure];
  if (estate == null || baseFraction == null) {
    return { low: 0, high: 0 };
  }
  const lowFraction = Math.max(0, baseFraction - 0.15);
  const highFraction = Math.min(1, baseFraction + 0.15);
  return {
    low:  bcProbateFee(Math.round(estate * lowFraction)),
    high: bcProbateFee(Math.round(estate * highFraction)),
  };
}
