// The 10-item question set for the BC Estate Exposure Profile.
// Locked content — see TASTE.md for any redline history.
// Every scored option is the defensible expression of its tier (Ungameable Law).

export const QUESTIONS = [
  {
    id: 'q1_estate_value',
    type: 'calibration',
    prompt:
      "Roughly, what's your current net estate value? (real estate equity + investments + business value + insurance, minus debts)",
    options: [
      { value: 'under_250k', label: 'Under $250K' },
      { value: '250k_1m',    label: '$250K – $1M' },
      { value: '1m_3m',      label: '$1M – $3M' },
      { value: '3m_10m',     label: '$3M – $10M' },
      { value: '10m_plus',   label: '$10M+' },
    ],
  },
  {
    id: 'q2_will',
    type: 'scored',
    dimension: 'will',
    prompt: 'Which best describes your will?',
    options: [
      { value: 'A', label: 'Reviewed within the last year, reflects current life and assets' },
      { value: 'B', label: 'Drafted a couple of years ago, structure still fits' },
      { value: 'C', label: "A few years old, and some things have changed that I haven't reflected" },
      { value: 'F', label: 'I want to get the structure right before formalizing it' },
    ],
  },
  {
    id: 'q3_poa',
    type: 'scored',
    dimension: 'power_of_attorney',
    prompt:
      'If you were hospitalized tomorrow and unable to make decisions for two weeks, what actually happens?',
    options: [
      { value: 'A', label: 'My POA is documented and they know exactly what to do' },
      { value: 'B', label: "I have a POA in place, and they'd figure it out from my docs" },
      { value: 'C', label: 'My spouse/partner would handle the basics; the rest would be improvised' },
      { value: 'F', label: "My family would have to scramble. I want it figured out for them, but it's not yet." },
    ],
  },
  {
    id: 'q4_beneficiaries',
    type: 'scored',
    dimension: 'beneficiaries',
    prompt:
      'Pull up your RRSP, TFSA, and insurance accounts in your head. Beneficiary designations are:',
    options: [
      { value: 'A', label: 'Current, named, match my will, checked within the last year' },
      { value: 'B', label: "Named, but I'm not 100% certain they reflect my current intent" },
      { value: 'C', label: "Named years ago. Could be an ex or a deceased parent. I'd need to check." },
      { value: 'F', label: "I'd have to log in to find out" },
    ],
  },
  {
    id: 'q5_probate_exposure',
    type: 'scored',
    dimension: 'probate_exposure',
    prompt:
      'Of your current assets, roughly what portion would pass through BC probate vs. avoid it (joint tenancy, designated beneficiaries, trust)?',
    options: [
      { value: 'A', label: "I've intentionally structured most of it to avoid probate" },
      { value: 'B', label: "Significant chunks bypass probate, but I'm not sure about everything" },
      { value: 'C', label: "I think my house and accounts go through probate. Haven't mapped it." },
      { value: 'F', label: "I'm not sure what probate would actually cost my estate" },
    ],
  },
  {
    id: 'q6_documents',
    type: 'scored',
    dimension: 'document_accessibility',
    prompt:
      'If you became unreachable tonight, your spouse/executor would find your important documents:',
    options: [
      { value: 'A', label: "Within an hour. They're organized in a known location with a written index." },
      { value: 'B', label: 'Within a day. They know roughly where things live.' },
      { value: 'C', label: "Within a week. They'd dig through emails and filing cabinets." },
      { value: 'F', label: "It would take weeks and they'd probably miss things" },
    ],
  },
  {
    id: 'q7_dependents',
    type: 'scored_conditional',
    dimension: 'dependents',
    prompt:
      'If you have minor children or other dependents, your plan for who raises them and how they’re financially supported:',
    options: [
      { value: 'A',  label: 'Guardianship designated, trust structure funded, guardian briefed' },
      { value: 'B',  label: 'Guardianship designated in my will, financials covered by life insurance' },
      { value: 'C',  label: "I've thought about who, but haven't formalized it" },
      { value: 'F',  label: "I have dependents. Haven't worked through this yet." },
      { value: 'NA', label: 'No dependents' },
    ],
  },
  {
    id: 'q8_business',
    type: 'scored_conditional',
    dimension: 'business_succession',
    prompt:
      'If you own a business or significant private equity, what happens to it if you die or become incapacitated?',
    options: [
      { value: 'A',  label: 'Documented succession plan, buy/sell agreement funded, key people know' },
      { value: 'B',  label: 'Succession addressed in my will, partners/family know the intent' },
      { value: 'C',  label: 'Loose plan in my head. Partners would figure it out.' },
      { value: 'F',  label: "I have business assets. Succession isn't formalized yet." },
      { value: 'NA', label: 'No significant business interests' },
    ],
  },
  {
    id: 'q9_last_reviewed',
    type: 'gating',
    prompt:
      'When did you last sit down, even for 15 minutes, to review your estate plan, beneficiaries, and structure?',
    options: [
      { value: 'within_12m', label: 'Within the last 12 months' },
      { value: '1_2y',       label: '1 – 2 years ago' },
      { value: '3_5y',       label: '3 – 5 years ago' },
      { value: 'over_5y',    label: 'Longer than 5 years, or never' },
    ],
  },
  {
    id: 'q10_catalyst',
    type: 'segmentation',
    prompt: 'What brought you here today?',
    options: [
      { value: 'life_event', label: 'Recent life event (marriage, child, business sale, parent passing)' },
      { value: 'milestone',  label: 'Hit a milestone (turning 40/50/60, sold the company, retirement planning)' },
      { value: 'curiosity',  label: 'Curiosity, wanted to see where I stand' },
      { value: 'worry',      label: 'Something specific is worrying me' },
    ],
  },
];

// Dimensions that contribute to the scored pattern (in canonical order).
export const SCORED_DIMENSIONS = [
  'will',
  'power_of_attorney',
  'beneficiaries',
  'probate_exposure',
  'document_accessibility',
  'dependents',
  'business_succession',
];

// Human-readable dimension labels for the result page gap map.
export const DIMENSION_LABEL = {
  will:                   'Will currency',
  power_of_attorney:      'Power of attorney',
  beneficiaries:          'Beneficiary designations',
  probate_exposure:       'Probate exposure',
  document_accessibility: 'Document accessibility',
  dependents:             'Dependents protection',
  business_succession:    'Business succession',
};
