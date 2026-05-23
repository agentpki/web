// POST /api/contact — handles "Talk to Founder" form submissions.
//
// Flow:
//   1. Validate the JSON body (name, email required; phone optional; description min 5 chars).
//   2. Store the lead in the CONTACT_LEADS KV namespace, keyed by timestamp-UUID.
//   3. Forward to hello@agentpki.dev via the Resend API (reply-to is set to the
//      submitter so hitting Reply goes back to them).
//   4. Return { ok: true } on success. Email-forward failure is non-fatal — the lead
//      is already persisted in KV and we can resend manually.
//
// Setup requirements in Cloudflare Pages → Settings → Functions:
//   - Bind KV namespace "CONTACT_LEADS"
//   - Set secret RESEND_API_KEY (same value used by the issuer-dashboard Resend integration)

interface Env {
  CONTACT_LEADS?: KVNamespace;
  RESEND_API_KEY?: string;
}

interface ContactBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  description?: unknown;
  source?: unknown; // optional: which button/page triggered this
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: ContactBody;
  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  // ── Validate
  const name = stringFromBody(body.name, 1, 120);
  const email = stringFromBody(body.email, 5, 200);
  const description = stringFromBody(body.description, 5, 5000);
  const phone = body.phone != null ? stringFromBody(body.phone, 0, 60) ?? '' : '';
  const source = body.source != null ? stringFromBody(body.source, 0, 60) ?? '' : '';

  if (!name) return json({ error: 'missing_name', detail: 'Name is required.' }, 400);
  if (!email) return json({ error: 'missing_email', detail: 'Email is required.' }, 400);
  if (!isValidEmail(email)) return json({ error: 'invalid_email', detail: 'That email address doesn\'t look valid.' }, 400);
  if (!description) return json({ error: 'missing_description', detail: 'Please add a short message — even one sentence is fine.' }, 400);

  // ── Store in KV (best-effort: if KV isn't bound, log and continue so we don't lose the lead to email-only)
  const id = `${Date.now()}-${crypto.randomUUID()}`;
  const lead = {
    id,
    name,
    email,
    phone: phone || null,
    description,
    source: source || null,
    submittedAt: new Date().toISOString(),
    userAgent: request.headers.get('user-agent') || null,
    cfRay: request.headers.get('cf-ray') || null,
    cfCountry: request.headers.get('cf-ipcountry') || null,
  };

  if (env.CONTACT_LEADS) {
    try {
      await env.CONTACT_LEADS.put(id, JSON.stringify(lead));
    } catch (e) {
      console.error('KV write failed:', e);
    }
  } else {
    console.warn('CONTACT_LEADS KV not bound — lead exists only in email.');
  }

  // ── Forward to hello@agentpki.dev via Resend
  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AgentPKI Forms <hello@agentpki.dev>',
          to: ['hello@agentpki.dev'],
          reply_to: email,
          subject: `[Lead] ${name}${source ? ` — ${source}` : ''}`,
          html: buildLeadHtml(lead),
          text: buildLeadText(lead),
        }),
      });
    } catch (e) {
      console.error('Resend forward failed:', e);
      // Don't return error — lead is already in KV
    }
  }

  return json({
    ok: true,
    message: "Got it. We'll reply within 48 hours from hello@agentpki.dev.",
  });
};

// ─── Helpers ─────────────────────────────────────────────────────────

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function stringFromBody(v: unknown, min: number, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < min || s.length > max) return null;
  return s;
}

function isValidEmail(s: string): boolean {
  // Pragmatic, not RFC-perfect — catches typos, rejects obviously broken
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLeadHtml(lead: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  description: string;
  source: string | null;
  submittedAt: string;
  cfRay: string | null;
  cfCountry: string | null;
}): string {
  const desc = escapeHtml(lead.description).replace(/\n/g, '<br>');
  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:24px auto;color:#1c1c20;line-height:1.5;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#08080b;">New lead from agentpki.dev</h2>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b6b78;width:90px;">Name</td><td style="padding:6px 0;"><strong>${escapeHtml(lead.name)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b78;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b6b78;">Phone</td><td style="padding:6px 0;">${lead.phone ? escapeHtml(lead.phone) : '<span style="color:#9c9cab;">(not provided)</span>'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b6b78;">Source</td><td style="padding:6px 0;">${lead.source ? escapeHtml(lead.source) : '<span style="color:#9c9cab;">(not provided)</span>'}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e7e7ea;margin:20px 0;">
      <h3 style="margin:0 0 8px;font-size:13px;color:#6b6b78;text-transform:uppercase;letter-spacing:1px;">Message</h3>
      <div style="font-size:14px;color:#1c1c20;background:#f6f6f8;padding:14px 18px;border-radius:8px;">${desc}</div>
      <p style="font-size:11px;color:#9c9cab;margin-top:24px;">
        ID: ${lead.id}<br>
        Submitted: ${lead.submittedAt}<br>
        ${lead.cfCountry ? `Country: ${escapeHtml(lead.cfCountry)} · ` : ''}CF-Ray: ${lead.cfRay || 'n/a'}<br>
        Reply directly to this email — your reply goes to the lead, not to AgentPKI's inbox.
      </p>
    </div>
  `;
}

function buildLeadText(lead: {
  name: string;
  email: string;
  phone: string | null;
  description: string;
  source: string | null;
  id: string;
  submittedAt: string;
}): string {
  return [
    'New lead from agentpki.dev',
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone || '(not provided)'}`,
    `Source: ${lead.source || '(not provided)'}`,
    '',
    '── Message ──',
    lead.description,
    '',
    '──',
    `ID: ${lead.id}`,
    `Submitted: ${lead.submittedAt}`,
    'Reply directly to this email — your reply goes to the lead.',
  ].join('\n');
}
