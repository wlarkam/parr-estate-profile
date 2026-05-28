import { QUESTIONS } from './questions.js';
import { scoreResponse, describeResult } from './scoring.js';
import { estimateProbateRange } from './probate.js';
import {
  submitResponse,
  captureContact,
  logEvent,
  STEVE_BOOKING_URL,
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

const CTA_COPY = {
  soft: {
    variant: 'newsletter',
    eyebrow: 'Stay sharp',
    heading: 'One short email per quarter on BC estate planning',
    body: "What changed in BC estate law, what most business owners are missing, and what to revisit in your own plan. No pitch, no spam — Steve writes it himself.",
    submitLabel: 'Send it to me',
    consent: "I'd like Steve Parr to email me his quarterly BC estate brief and the occasional follow-up. I can unsubscribe at any time.",
  },
  medium: {
    variant: 'consult',
    eyebrow: 'Want a second set of eyes?',
    heading: 'Book a free 15-minute readiness review',
    body: "We'll walk through your top exposures together and you'll leave with one or two concrete next steps. It's not a sales call — it's a sanity check.",
    submitLabel: 'Send message',
    consent: "I'd like Steve Parr's office to contact me about a free readiness review. I understand this isn't legal advice and I can opt out any time.",
  },
  direct: {
    variant: 'consult',
    eyebrow: "Let's actually fix this",
    heading: 'Book a consult with Steve Parr',
    body: "The state you're in is the most expensive place to be when something happens. A consult is the fastest way out — Steve will cover what to lock down first, what's BC-specific, and how to keep your family from absorbing avoidable costs.",
    submitLabel: 'Send message',
    consent: "I'd like Steve Parr's office to contact me about booking a consult. I understand this isn't legal advice and I can opt out any time.",
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
      "since your last review. We've lowered the grade — plans drift, life " +
      "changes, and the law changes. Worth a fresh look.";
    capEl.hidden = false;
  } else if (state.scored.coherence_capped) {
    capEl.textContent =
      "Heads up: your answers spanned a wide range — strong in some areas, " +
      "exposed in others. We've lowered the grade because a partially-handled " +
      "estate is more like an exposed one than a structured one.";
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

  // CTA card — newsletter form (email only) or full consult form by tier.
  const ctaEl = $('[data-cta-card]');
  const archetype = describeResult(state.scored);
  const prefillMessage =
    `I just took the BC Estate Exposure Profile and came back as ` +
    `"${archetype.name}" (grade ${state.scored.grade}). I'd like to talk about next steps.`;

  const formMarkup = cta.variant === 'consult'
    ? `
      <form data-cta-form class="consult-form">
        <div class="form-row">
          <label class="field">
            <span class="field-label">First name</span>
            <input type="text" name="firstName" autocomplete="given-name" required>
          </label>
          <label class="field">
            <span class="field-label">Last name</span>
            <input type="text" name="lastName" autocomplete="family-name" required>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Email</span>
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label class="field">
            <span class="field-label">Phone</span>
            <input type="tel" name="phone" autocomplete="tel">
          </label>
        </div>
        <label class="field">
          <span class="field-label">Message</span>
          <textarea name="message" rows="4" required>${escapeHtml(prefillMessage)}</textarea>
        </label>
        <label class="consent">
          <input type="checkbox" name="consent" required>
          <span>${escapeHtml(cta.consent)}</span>
        </label>
        <button type="submit" class="cta primary">${escapeHtml(cta.submitLabel)}</button>
      </form>
    `
    : `
      <form data-cta-form>
        <div class="form-row">
          <input type="text"  name="firstName" placeholder="First name" autocomplete="given-name" required>
          <input type="email" name="email"     placeholder="you@example.com" autocomplete="email" required>
        </div>
        <label class="consent">
          <input type="checkbox" name="consent" required>
          <span>${escapeHtml(cta.consent)}</span>
        </label>
        <button type="submit" class="cta primary">${escapeHtml(cta.submitLabel)}</button>
      </form>
    `;

  ctaEl.innerHTML = `
    <p class="eyebrow">${escapeHtml(cta.eyebrow)}</p>
    <h3>${escapeHtml(cta.heading)}</h3>
    <p>${escapeHtml(cta.body)}</p>
    ${formMarkup}
  `;

  $('[data-cta-form]', ctaEl).addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const btn = $('button[type="submit"]', e.target);
    btn.disabled = true;
    btn.textContent = 'Sending…';

    await captureContact({
      responseId: state.responseId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName || null,
      phone: data.phone || null,
      message: data.message || null,
      ctaTier: tier,
      consent: !!data.consent,
    });
    logEvent({ sessionId: state.sessionId, event: 'opted_in', meta: { tier } });

    const thanksBody = cta.variant === 'consult'
      ? `<p class="cta-thanks">Got it, ${escapeHtml(data.firstName)}. Steve's office will reach out within one business day to set up a time.</p>`
      : `<p class="cta-thanks">Subscribed. Your first issue will land soon.</p>`;
    ctaEl.innerHTML = `
      <p class="eyebrow">${escapeHtml(cta.eyebrow)}</p>
      <h3>Thanks, ${escapeHtml(data.firstName)}.</h3>
      ${thanksBody}
    `;
  });
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
      ? 'Beneficiary designations are unknown or out of date — these override your will.'
      : 'Beneficiaries are named but may not match your current intent.',
    probate_exposure: high
      ? 'Most of your assets would pass through BC probate at ~1.4% — likely avoidable.'
      : 'Some probate exposure exists. A few structural changes can shrink it significantly.',
    document_accessibility: high
      ? 'Your family would spend weeks finding the right paperwork. Costs delays and decisions.'
      : 'Documents exist but aren’t centrally organized.',
    dependents: high
      ? 'Guardianship and financial support for dependents aren’t formalized.'
      : 'Guardianship designated but the structure could be tighter.',
    business_succession: high
      ? 'Business assets have no documented succession plan — partners and family at risk.'
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
