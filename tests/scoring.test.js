import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreResponse } from '../js/scoring.js';
import { bcProbateFee, estimateProbateRange } from '../js/probate.js';

// Minimum viable answer set — fill in scored dims, leave conditionals NA.
const baseAnswers = (overrides = {}) => ({
  q1_estate_value:     '1m_3m',
  q2_will:             'B',
  q3_poa:              'B',
  q4_beneficiaries:    'B',
  q5_probate_exposure: 'B',
  q6_documents:        'B',
  q7_dependents:       'NA',
  q8_business:         'NA',
  q9_last_reviewed:    '1_2y',
  q10_catalyst:        'milestone',
  ...overrides,
});

test('coherent Architect — all A, reviewed within 12 months', () => {
  const r = scoreResponse(baseAnswers({
    q2_will: 'A', q3_poa: 'A', q4_beneficiaries: 'A',
    q5_probate_exposure: 'A', q6_documents: 'A',
    q9_last_reviewed: 'within_12m',
  }));
  assert.equal(r.archetype, 'architect');
  assert.equal(r.grade, 'A');
  assert.equal(r.coherence_capped, false);
  assert.equal(r.gaming_capped, false);
  assert.deepEqual(r.top_gaps, []);
});

test('coherent Exposed — all F', () => {
  const r = scoreResponse(baseAnswers({
    q2_will: 'F', q3_poa: 'F', q4_beneficiaries: 'F',
    q5_probate_exposure: 'F', q6_documents: 'F',
    q9_last_reviewed: 'over_5y',
  }));
  assert.equal(r.archetype, 'exposed');
  assert.equal(r.grade, 'F');
  // 5+ years gap on an F is consistent — not gamed.
  assert.equal(r.gaming_capped, false);
  assert.equal(r.top_gaps.length, 3);
  assert.ok(r.top_gaps.every(g => g.severity === 'high'));
});

test('coherent Builder — all B', () => {
  const r = scoreResponse(baseAnswers());
  assert.equal(r.archetype, 'builder');
  assert.equal(r.grade, 'B');
  assert.equal(r.coherence_capped, false);
  assert.equal(r.top_gaps.length, 0);
});

test('gaming gate — claims all A but reviewed 5+ years ago caps to Optimist', () => {
  const r = scoreResponse(baseAnswers({
    q2_will: 'A', q3_poa: 'A', q4_beneficiaries: 'A',
    q5_probate_exposure: 'A', q6_documents: 'A',
    q9_last_reviewed: 'over_5y',
  }));
  assert.equal(r.gaming_capped, true);
  assert.equal(r.archetype, 'optimist');
  assert.equal(r.grade, 'C');
});

test('drift gate — A/B pattern with 5+ year review gap drops one tier', () => {
  // Solid Builder pattern but hasn't reviewed in 5+ years.
  const r = scoreResponse(baseAnswers({
    q2_will: 'B', q3_poa: 'B', q4_beneficiaries: 'B',
    q5_probate_exposure: 'B', q6_documents: 'B',
    q9_last_reviewed: 'over_5y',
  }));
  assert.equal(r.gaming_capped, true);
  assert.equal(r.archetype, 'optimist'); // dropped from builder
});

test('coherence cap — chaotic mix of A and F drops a tier', () => {
  const r = scoreResponse(baseAnswers({
    q2_will: 'A', q3_poa: 'F', q4_beneficiaries: 'A',
    q5_probate_exposure: 'F', q6_documents: 'A',
    q9_last_reviewed: 'within_12m',
  }));
  // Mean = (3+0+3+0+3)/5 = 1.8 → round to 2 (Builder), but stdev ~1.47 caps.
  assert.equal(r.coherence_capped, true);
  // Tier 2 → tier 1 (Optimist). But coherence-capped C reads as D.
  assert.equal(r.grade, 'D');
});

test('conditional NA — q7/q8 NA still scores correctly', () => {
  const r = scoreResponse(baseAnswers({
    q7_dependents: 'NA',
    q8_business:   'NA',
  }));
  // Scored on 5 dims only, all B → Builder.
  assert.equal(r.archetype, 'builder');
  assert.equal(r._debug.dimensionScores.dependents, undefined);
  assert.equal(r._debug.dimensionScores.business_succession, undefined);
});

test('conditional present — q7 dependents F surfaces as a top gap', () => {
  const r = scoreResponse(baseAnswers({
    q2_will: 'A', q3_poa: 'A', q4_beneficiaries: 'A',
    q5_probate_exposure: 'A', q6_documents: 'A',
    q7_dependents: 'F',
    q8_business: 'NA',
    q9_last_reviewed: 'within_12m',
  }));
  // Five As + one F → mean = 15/6 = 2.5 → round to 3 (Architect),
  // but stdev = sqrt((5*0.25 + 6.25)/6) ≈ 1.12 → coherence cap.
  // Coherence-capped builder grade = B (capped from A).
  assert.equal(r.coherence_capped, true);
  // Dependents is the lone F → must appear in top_gaps.
  assert.ok(r.top_gaps.some(g => g.dimension === 'dependents'));
  assert.equal(r.top_gaps[0].dimension, 'dependents');
  assert.equal(r.top_gaps[0].severity, 'high');
});

test('top gaps capped at three even when more exist', () => {
  const r = scoreResponse(baseAnswers({
    q2_will: 'F', q3_poa: 'F', q4_beneficiaries: 'F',
    q5_probate_exposure: 'C', q6_documents: 'C',
    q9_last_reviewed: 'over_5y',
  }));
  assert.equal(r.top_gaps.length, 3);
});

test('BC probate fee — small estate ($25K) is $0', () => {
  assert.equal(bcProbateFee(25_000), 0);
});

test('BC probate fee — $50K estate is $350 ($200 + $150)', () => {
  assert.equal(bcProbateFee(50_000), 350);
});

test('BC probate fee — $500K estate is $6,650', () => {
  // $200 + $150 + 14 * 450 = $6,650
  assert.equal(bcProbateFee(500_000), 6_650);
});

test('BC probate fee — $1M estate is $13,650', () => {
  assert.equal(bcProbateFee(1_000_000), 13_650);
});

test('estimateProbateRange — $1M-$3M bracket with high exposure (F)', () => {
  const range = estimateProbateRange('1m_3m', 'F');
  // Midpoint $2M, fraction range 0.80-1.00 → $1.6M-$2.0M passing probate.
  // $1.6M → $200 + $150 + 14 * 1550 = ~$22K
  // $2.0M → $200 + $150 + 14 * 1950 = ~$27.6K
  assert.ok(range.low >= 20_000 && range.low <= 24_000, `low was ${range.low}`);
  assert.ok(range.high >= 26_000 && range.high <= 29_000, `high was ${range.high}`);
});

test('estimateProbateRange — low-exposure (A) shrinks the fee', () => {
  const high = estimateProbateRange('1m_3m', 'F').high;
  const low  = estimateProbateRange('1m_3m', 'A').high;
  assert.ok(low < high, 'expected A-tier exposure to produce a smaller fee');
});
