// Supabase + Kit integration. Anon-insert-only — RLS guards the tables.
// Publishable keys are safe to ship to the browser.

const SUPABASE_URL = 'https://rbedklytopejtogpsefg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8VdVe5T9zW241p4yp7aodg_fxwXzlIJ';

// Kit integration — fill these in once Steve's nurture forms exist in Kit.
// Create one form per tier under Kit → Grow → Landing Pages & Forms.
// The form ID is the integer in the public form URL.
export const KIT_FORM_IDS = {
  soft:   null, // quarterly BC estate brief (A/B tier)
  medium: null, // readiness audit call (C/D tier)
  direct: null, // book-a-consult heat list (F tier)
};

// Steve's booking URL — verify against his "BOOK A CONSULT" CTA target.
export const STEVE_BOOKING_URL = 'https://www.parrbusinesslaw.com/contact';

const supaHeaders = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=minimal',
};

export async function submitResponse({ answers, scored, probateRange, sessionId }) {
  const id = crypto.randomUUID();
  const payload = {
    id,
    session_id: sessionId,
    q1_estate_value:     answers.q1_estate_value,
    q2_will:             answers.q2_will,
    q3_poa:              answers.q3_poa,
    q4_beneficiaries:    answers.q4_beneficiaries,
    q5_probate_exposure: answers.q5_probate_exposure,
    q6_documents:        answers.q6_documents,
    q7_dependents:       answers.q7_dependents,
    q8_business:         answers.q8_business,
    q9_last_reviewed:    answers.q9_last_reviewed,
    q10_catalyst:        answers.q10_catalyst,
    archetype:           scored.archetype,
    grade:               scored.grade,
    coherence_capped:    scored.coherence_capped,
    gaming_capped:       scored.gaming_capped,
    exposure_estimate_low:  probateRange.low,
    exposure_estimate_high: probateRange.high,
    top_gaps:            scored.top_gaps,
    user_agent:          navigator.userAgent,
    referrer:            document.referrer || null,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/parr_responses`, {
      method: 'POST',
      headers: supaHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error('parr_responses insert failed', res.status, await res.text());
  } catch (err) {
    console.error('parr_responses insert error', err);
  }
  return id;
}

export async function logEvent({ sessionId, event, meta = {} }) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/parr_events`, {
      method: 'POST',
      headers: supaHeaders,
      body: JSON.stringify({ session_id: sessionId, event, meta }),
    });
  } catch { /* fire-and-forget */ }
}

export async function captureContact({
  responseId, email, firstName, lastName, phone, message,
  supportFor, supportType, referralSource,
  ctaTier, consent,
}) {
  // 1) Write to Supabase — Warren owns this list regardless of Kit state.
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/parr_contacts`, {
      method: 'POST',
      headers: supaHeaders,
      body: JSON.stringify({
        response_id: responseId,
        email,
        first_name:      firstName      || null,
        last_name:       lastName       || null,
        phone:           phone          || null,
        message:         message        || null,
        support_for:     supportFor     || null,
        support_type:    supportType    || null,
        referral_source: referralSource || null,
        cta_tier: ctaTier,
        consent_outreach: !!consent,
      }),
    });
  } catch (err) {
    console.error('parr_contacts insert error', err);
  }

  // 2) Kit handoff — only if a form ID is configured for this tier.
  const formId = KIT_FORM_IDS[ctaTier];
  if (formId) {
    const body = new URLSearchParams({
      email_address: email,
      first_name: firstName || '',
    });
    try {
      // Kit's public form endpoint accepts cross-origin form submissions.
      await fetch(`https://app.kit.com/forms/${formId}/subscriptions`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body,
        mode: 'no-cors', // public endpoint; we don't need to read the response
      });
    } catch (err) {
      console.error('kit subscribe error', err);
    }
  }
}
