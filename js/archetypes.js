// Archetype + grade band definitions. One archetype per tier.
// `band` is the final grade we expose. `tier` is the internal score range.

export const ARCHETYPES = {
  architect: {
    id: 'architect',
    name: 'The Architect',
    band: 'A',
    headline: 'Your estate is built like an architect drew it.',
    blurb:
      "Current will, named POA, beneficiaries that match your intent, a deliberate probate strategy, and documents your family could find within the hour. You're in the top single-digit percent of BC adults.",
    callToActionTier: 'soft',
  },
  builder: {
    id: 'builder',
    name: 'The Builder',
    band: 'B',
    headline: "You built the assets. The structure hasn't caught up.",
    blurb:
      "Will exists, basics are in place, but the documents haven't kept pace with what you've built. The classic 'I'll get to it next quarter' position. Most successful BC business owners and professionals sit here.",
    callToActionTier: 'soft',
  },
  optimist: {
    id: 'optimist',
    name: 'The Optimist',
    band: 'C',
    headline: 'Basic protections, real gaps.',
    blurb:
      "Something is in place. Maybe a will from 2015, maybe life insurance, maybe both. The rest is assumption. Probate exposure is significant and your family would be improvising under stress.",
    callToActionTier: 'medium',
  },
  exposed: {
    id: 'exposed',
    name: 'The Exposed',
    band: 'F',
    headline: 'Your family would be starting from scratch.',
    blurb:
      "No will, or one that hasn't been touched in a decade. No documented POA. Business or family assets unallocated. This is the default state for most adults, and it's the most expensive place to be when something happens.",
    callToActionTier: 'direct',
  },
};

// Map a numeric tier score (0-3) to the archetype id.
// 0 = F (exposed), 1 = C (optimist), 2 = B (builder), 3 = A (architect).
export const TIER_TO_ARCHETYPE = ['exposed', 'optimist', 'builder', 'architect'];

// Letter grade lookup applied after coherence / gaming caps.
// Index = effective tier (after caps). C-grade differentiates from D
// when coherence-capped (i.e. mixed pattern caps a Builder to C/D).
export const GRADES = ['F', 'C', 'B', 'A'];
