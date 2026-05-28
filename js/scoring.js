// Pure scoring engine for the BC Estate Exposure Profile.
// No DOM, no fetch, no side effects — designed for unit tests.
//
// Pattern over answers: the grade emerges from coherence across dimensions,
// not from any single question. See ARCHITECTURE.md (or PLAYBOOK.md in the
// free-tool-builder skill) for the design rationale.

import { SCORED_DIMENSIONS, DIMENSION_LABEL } from './questions.js';
import { ARCHETYPES, TIER_TO_ARCHETYPE, GRADES } from './archetypes.js';

const LETTER_TO_TIER = { A: 3, B: 2, C: 1, F: 0 };

const DIMENSION_TO_QUESTION = {
  will:                   'q2_will',
  power_of_attorney:      'q3_poa',
  beneficiaries:          'q4_beneficiaries',
  probate_exposure:       'q5_probate_exposure',
  document_accessibility: 'q6_documents',
  dependents:             'q7_dependents',
  business_succession:    'q8_business',
};

export function scoreResponse(answers) {
  // 1. Collect per-dimension tier scores, skipping NA conditionals.
  const dimensionScores = {};
  for (const dim of SCORED_DIMENSIONS) {
    const qid = DIMENSION_TO_QUESTION[dim];
    const letter = answers[qid];
    if (letter && letter !== 'NA') {
      dimensionScores[dim] = LETTER_TO_TIER[letter];
    }
  }

  const scored = Object.values(dimensionScores);
  if (scored.length === 0) {
    throw new Error('scoreResponse: no scored dimensions in answers');
  }

  // 2. Mean and standard deviation across applicable dimensions.
  const mean = scored.reduce((a, b) => a + b, 0) / scored.length;
  const variance = scored.reduce((a, b) => a + (b - mean) ** 2, 0) / scored.length;
  const stdev = Math.sqrt(variance);

  // 3. Provisional tier from rounded mean.
  let tier = Math.round(mean);
  let coherenceCapped = false;
  let gamingCapped = false;

  // 4. Coherence cap — a chaotic pattern (A's mixed with F's) cannot
  //    confidently land in any single archetype. Cap one tier.
  if (stdev > 1.1) {
    coherenceCapped = true;
    tier = Math.max(0, tier - 1);
  }

  // 5. Drift / gaming gate against Q9 (last_reviewed).
  //    If the user claims A across every dimension but hasn't reviewed
  //    in 5+ years, that's implausible — floor at C (Optimist).
  const allArchitect = scored.every(v => v === 3);
  if (allArchitect && answers.q9_last_reviewed === 'over_5y') {
    gamingCapped = true;
    tier = 1;
  }

  //    More general drift: any A/B-implied tier paired with a 5+-year
  //    review gap drops one tier. Long-untouched plans are not A/B.
  if (!gamingCapped && answers.q9_last_reviewed === 'over_5y' && tier >= 2) {
    gamingCapped = true;
    tier = Math.max(1, tier - 1);
  }

  // 6. Map tier → archetype + grade. Coherence-capped C reads as D to
  //    distinguish "mixed-bag respondent" from "clean Optimist."
  const archetype = TIER_TO_ARCHETYPE[tier];
  let grade = GRADES[tier];
  if (coherenceCapped && grade === 'C') grade = 'D';

  // 7. Top gaps — lowest-scoring scored dimensions first, only the real ones.
  const topGaps = Object.entries(dimensionScores)
    .sort(([, a], [, b]) => a - b)
    .filter(([, score]) => score <= 1)
    .slice(0, 3)
    .map(([dimension, score]) => ({
      dimension,
      label: DIMENSION_LABEL[dimension],
      severity: score === 0 ? 'high' : 'medium',
    }));

  return {
    archetype,
    grade,
    coherence_capped: coherenceCapped,
    gaming_capped: gamingCapped,
    top_gaps: topGaps,
    _debug: { mean, stdev, tier, dimensionScores },
  };
}

// Convenience: full archetype object + headline + CTA tier for the result page.
export function describeResult(scored) {
  return ARCHETYPES[scored.archetype];
}
