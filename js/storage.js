// Supabase + Lawmatics integration. Both writes fire in parallel from the
// browser. Supabase is the source of truth (RLS-guarded anon insert);
// Lawmatics is Steve's existing CRM intake so leads flow into the workflow
// his assistant already uses.

const SUPABASE_URL = 'https://rbedklytopejtogpsefg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8VdVe5T9zW241p4yp7aodg_fxwXzlIJ';

// Steve's Lawmatics "EXT | PBL | Website Form" — public intake endpoint.
// CORS is open (access-control-allow-origin: *), no auth header required.
const LAWMATICS_FORM_ID = '181a8cbb-d10b-402d-b68e-a4693712b38a';
const LAWMATICS_SUBMIT_URL = `https://api.lawmatics.com/v1/forms/${LAWMATICS_FORM_ID}/submit`;

// Option IDs are Lawmatics-side numeric IDs that map our internal values
// onto Steve's dropdown options. From Form API Details panel in his Lawmatics.
const LAWMATICS_SUPPORT_FOR = {       // custom_field_583330
  myself:     521206,
  my_company: 521207,
  another:    521208,
};
const LAWMATICS_SUPPORT_TYPE = {      // custom_field_536359
  business:     465679,
  estate_wills: 465680,
  probate:      585239,
  other:        465681,
};
const LAWMATICS_REFERRAL_SOURCE = {   // custom_field_635773
  professional_advisor:    585855,
  current_client_referral: 585856,
  google:                  585859,
  facebook:                585858,
  instagram:               585863,
  linkedin:                585860,
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

export async function captureContact(contact) {
  // Fire both writes in parallel. Lawmatics failure must not block the
  // Supabase write, and vice versa — we always want at least one record.
  await Promise.allSettled([
    writeContactToSupabase(contact),
    submitToLawmatics(contact),
  ]);
}

async function writeContactToSupabase({
  responseId, email, firstName, lastName, phone, message,
  supportFor, supportType, referralSource,
  ctaTier, consent,
}) {
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
}

// POST a submission to Steve's existing Lawmatics intake form so the lead
// lands in the same intake queue his assistant uses for parrbusinesslaw.com.
async function submitToLawmatics({
  email, firstName, lastName, phone, message,
  supportFor, supportType, referralSource,
  consent,
}) {
  const payload = {
    first_name: firstName,
    last_name:  lastName,
    email,
    phone:      phone || '',
    custom_field_583330: LAWMATICS_SUPPORT_FOR[supportFor],
    custom_field_536359: LAWMATICS_SUPPORT_TYPE[supportType],
    custom_field_635407: message,
    custom_field_635773: LAWMATICS_REFERRAL_SOURCE[referralSource],
    general_field_49fe:  !!consent,
  };

  // Conditional fields. Lawmatics requires these keys in EVERY payload,
  // even when the trigger value isn't selected — empty string is the
  // expected "no value" sentinel. (Confirmed via 422 response on a test
  // submission without them.)
  payload.custom_field_546946 = referralSource === 'current_client_referral'
    ? '(Lead captured via BC Estate Exposure Profile)'
    : '';
  payload.custom_field_750529 = supportType === 'other'
    ? 'See message field for details'
    : '';

  try {
    const res = await fetch(LAWMATICS_SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('lawmatics submit failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('lawmatics submit error', err);
  }
}
