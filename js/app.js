import { QUESTIONS } from './questions.js';
import { scoreResponse, describeResult } from './scoring.js';
import { estimateProbateRange } from './probate.js';
import {
  submitResponse,
  logEvent,
} from './storage.js';

const state = {
  answers: {},
  current: 0,
  sessionId: crypto.randomUUID(),
  responseId: null,
  scored: null,
  probateRange: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const screens = {
  intro:  $('#intro'),
  quiz:   $('#quiz'),
  result: $('#result'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Quiz rendering -----------------------------------------------------

function renderQuestion() {
  const q = QUESTIONS[state.current];
  const total = QUESTIONS.length;
  const host = $('#question-host');

  $('[data-current]').textContent = String(state.current + 1);
  $('[data-total]').textContent = String(total);
  $('[data-progress-fill]').style.width = `${((state.current) / total) * 100}%`;

  host.innerHTML = `
    <p class="question-prompt">${escapeHtml(q.prompt)}</p>
    <div class="options" role="radiogroup" aria-label="${escapeHtml(q.prompt)}">
      ${q.options.map(opt => `
        <label class="option ${state.answers[q.id] === opt.value ? 'selected' : ''}">
          <input type="radio" name="${q.id}" value="${opt.value}"
                 ${state.answers[q.id] === opt.value ? 'checked' : ''}>
          ${escapeHtml(opt.label)}
        </label>
      `).join('')}
    </div>
  `;

  // Listen on the radio's change — single fire per selection. Clicking
  // the label re-emits a click via for/label association, which bubbles
  // up and would double-fire a click handler attached to the label.
  $$('.option input', host).forEach(input => {
    input.addEventListener('change', () => {
      const value = input.value;
      const label = input.closest('.option');
      state.answers[q.id] = value;
      $$('.option', host).forEach(o => o.classList.remove('selected'));
      label.classList.add('selected');
      $('[data-action="next"]').disabled = false;
      logEvent({ sessionId: state.sessionId, event: 'question_answered',
                 meta: { qid: q.id, value, index: state.current } });
    });
  });

  // Back disabled on first Q. Next disabled until an answer exists.
  $('[data-action="back"]').disabled = state.current === 0;
  $('[data-action="next"]').disabled = !state.answers[q.id];
  $('[data-action="next"]').textContent =
    state.current === total - 1 ? 'See my profile →' : 'Next →';
}

// --- Result rendering ---------------------------------------------------

// Every archetype routes to the same contact form (mirrors Steve's
// Lawmatics intake). Copy still varies per tier in the eyebrow/heading/body
// so the framing matches where the user landed.
const CTA_CONSENT =
  "I'd like Steve Parr's office to follow up on this assessment. I understand this isn't legal advice and I can opt out any time.";

const CTA_COPY = {
  soft: {
    eyebrow: 'Want a second opinion?',
    heading: 'Get in touch with the team',
    body: "You're in great shape. If you'd like another set of eyes on what you've built, or have a question about a change coming up, tell us what's on your mind and we'll get back to you within one business day.",
    submitLabel: 'Send message',
    consent: CTA_CONSENT,
  },
  medium: {
    eyebrow: 'Want a second set of eyes?',
    heading: 'Get in touch with the team',
    body: "You've got the basics in place. Tell us where the gaps are and we'll get back to you within one business day to figure out next steps.",
    submitLabel: 'Send message',
    consent: CTA_CONSENT,
  },
  direct: {
    eyebrow: "Let's get this sorted",
    heading: 'Get in touch with the team',
    body: "You're in the most exposed position. Tell us what's going on and we'll get back to you within one business day to map out next steps.",
    submitLabel: 'Send message',
    consent: CTA_CONSENT,
  },
};

function formatMoney(n) {
  if (!Number.isFinite(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('en-CA');
}

function renderResult() {
  const arch = describeResult(state.scored);
  const tier = arch.callToActionTier;
  const cta = CTA_COPY[tier];

  $('[data-result-tier]').textContent = `${arch.band}-tier archetype`;
  $('[data-result-archetype-name]').textContent = arch.name;
  const gradeEl = $('[data-result-grade]');
  gradeEl.textContent = state.scored.grade;
  gradeEl.setAttribute('data-band', state.scored.grade);
  $('[data-result-blurb]').innerHTML = `<strong>${escapeHtml(arch.headline)}</strong> ${escapeHtml(arch.blurb)}`;

  // Cap note — only show if scoring was capped.
  const capEl = $('[data-result-cap-note]');
  if (state.scored.gaming_capped) {
    capEl.textContent =
      "Heads up: you marked things as well-handled, but it's been 5+ years " +
      "since your last review. We've lowered the grade because plans drift, " +
      "life changes, and the law changes. Worth a fresh look.";
    capEl.hidden = false;
  } else if (state.scored.coherence_capped) {
    capEl.textContent =
      "Heads up: your answers spanned a wide range. Strong in some areas, " +
      "exposed in others. We've lowered the grade because a partially-handled " +
      "estate behaves more like an exposed one than a structured one.";
    capEl.hidden = false;
  } else {
    capEl.hidden = true;
  }

  // Probate range
  $('[data-probate-low]').textContent = formatMoney(state.probateRange.low);
  $('[data-probate-high]').textContent = formatMoney(state.probateRange.high);

  // Gaps
  const gapsCard = $('[data-gaps-card]');
  const gapList = $('[data-gap-list]');
  if (state.scored.top_gaps.length === 0) {
    gapsCard.hidden = true;
  } else {
    gapsCard.hidden = false;
    gapList.innerHTML = state.scored.top_gaps.map(g => `
      <li class="${g.severity === 'high' ? 'high' : ''}">
        <span class="gap-label">${escapeHtml(g.label)}</span>
        <span class="gap-note">${gapCopy(g.dimension, g.severity)}</span>
      </li>
    `).join('');
  }

  // CTA card — per-tier framing copy only. The actual lead-capture form is
  // Steve's existing Lawmatics widget, embedded below this card. Submissions
  // flow into his real CRM intake, not into our Supabase.
  const ctaEl = $('[data-cta-card]');
  ctaEl.innerHTML = `
    <p class="eyebrow">${escapeHtml(cta.eyebrow)}</p>
    <h3>${escapeHtml(cta.heading)}</h3>
    <p>${escapeHtml(cta.body)}</p>
  `;
}

function gapCopy(dimension, severity) {
  const high = severity === 'high';
  const map = {
    will: high
      ? 'No current will, or one that hasn’t been touched in years. Highest-leverage thing to fix.'
      : 'Your will is dated or doesn’t reflect recent changes. Worth a refresh.',
    power_of_attorney: high
      ? 'No documented POA. If you’re incapacitated tomorrow, your family is improvising.'
      : 'POA exists but the people involved aren’t fully briefed.',
    beneficiaries: high
      ? 'Beneficiary designations are unknown or out of date. These override your will.'
      : 'Beneficiaries are named but may not match your current intent.',
    probate_exposure: high
      ? 'Most of your assets would pass through BC probate at ~1.4%. Likely avoidable.'
      : 'Some probate exposure exists. A few structural changes can shrink it significantly.',
    document_accessibility: high
      ? 'Your family would spend weeks finding the right paperwork. Costs delays and decisions.'
      : 'Documents exist but aren’t centrally organized.',
    dependents: high
      ? 'Guardianship and financial support for dependents aren’t formalized.'
      : 'Guardianship designated but the structure could be tighter.',
    business_succession: high
      ? 'Business assets have no documented succession plan. Partners and family are at risk.'
      : 'A succession outline exists but isn’t funded or formally signed.',
  };
  return map[dimension] || '';
}

// --- Event wiring -------------------------------------------------------

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'start') {
    showScreen('quiz');
    logEvent({ sessionId: state.sessionId, event: 'started' });
    renderQuestion();
  }

  if (action === 'back') {
    if (state.current > 0) {
      state.current -= 1;
      renderQuestion();
    }
  }

  if (action === 'next') {
    if (state.current < QUESTIONS.length - 1) {
      state.current += 1;
      renderQuestion();
    } else {
      await completeQuiz();
    }
  }

  if (action === 'restart') {
    state.answers = {};
    state.current = 0;
    state.sessionId = crypto.randomUUID();
    state.responseId = null;
    state.scored = null;
    state.probateRange = null;
    showScreen('intro');
  }
});

async function completeQuiz() {
  state.scored = scoreResponse(state.answers);
  state.probateRange = estimateProbateRange(
    state.answers.q1_estate_value,
    state.answers.q5_probate_exposure
  );
  logEvent({ sessionId: state.sessionId, event: 'completed',
             meta: { archetype: state.scored.archetype, grade: state.scored.grade } });

  // Fire-and-forget the response insert; result page doesn't wait on it.
  submitResponse({
    answers: state.answers,
    scored: state.scored,
    probateRange: state.probateRange,
    sessionId: state.sessionId,
  }).then(id => { state.responseId = id; });

  renderResult();
  showScreen('result');
  logEvent({ sessionId: state.sessionId, event: 'viewed_result',
             meta: { archetype: state.scored.archetype, grade: state.scored.grade } });
}

// --- Utils --------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
