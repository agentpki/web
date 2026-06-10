(function () {
  // ── Tabs ──
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      var which = btn.getAttribute('data-tab');
      document.querySelectorAll('.flow-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + which).classList.add('active');
    });
  });

  // ── Flow steps for each panel ──
  var flows = {
    f1: {
      panel: 'allow',
      steps: [
        { title: 'Agent presents passport', body: 'The agent (acme.bot/v1) holds a passport minted by its issuer. The passport is a PASETO v4.public token signed with the issuer\'s Ed25519 private key.', actors: ['f1-agent'], arrows: [] },
        { title: 'Agent calls the verifier', body: 'The agent attaches the passport to its request to verify.agentpki.dev/v1/verify. Just a POST with <code>{token}</code>.', actors: ['f1-agent', 'f1-verifier'], arrows: [{ id: 'f1-arr-1', kind: 'active' }], labels: ['f1-lbl-1'] },
        { title: 'Verifier checks the signature', body: 'The verifier extracts the kid from the passport footer, fetches the issuer directory at <code>acme.com/.well-known/agentpki-issuer.json</code>, finds the matching public key, and checks the Ed25519 signature.', actors: ['f1-verifier', 'f1-issuer', 'f1-dir'], arrows: [{ id: 'f1-arr-2', kind: 'active' }, { id: 'f1-arr-3', kind: 'active' }], labels: ['f1-lbl-2', 'f1-lbl-3'] },
        { title: '✓ Verdict: allow', body: 'Signature is valid, exp window is fresh, kid is in <code>current_keys</code>. The verifier returns <code>verdict: allow</code> in roughly 50ms.', actors: ['f1-agent', 'f1-verifier'], arrows: [{ id: 'f1-arr-4', kind: 'success' }], labels: ['f1-lbl-4'], verdict: 'allow' },
      ]
    },
    f2: {
      panel: 'tamper',
      steps: [
        { title: 'Adversary intercepts the passport', body: 'A man-in-the-middle (or a compromised proxy) captures a passport in flight to a target.', actors: ['f2-agent', 'f2-adversary'], arrows: [{ id: 'f2-arr-1', kind: 'danger' }], labels: ['f2-lbl-1'] },
        { title: 'They flip two bytes in the signature', body: 'The Ed25519 signature is the last 64 bytes of the passport body. The attacker mutates a few bytes hoping to bypass verification or impersonate the agent.', actors: ['f2-adversary'], arrows: [] },
        { title: 'Tampered passport reaches verifier', body: 'The adversary forwards the tampered passport. From the wire, it looks identical to a valid PASETO token.', actors: ['f2-adversary', 'f2-verifier'], arrows: [{ id: 'f2-arr-2', kind: 'danger' }], labels: ['f2-lbl-2'] },
        { title: '✗ Signature mismatch → deny', body: 'The verifier runs ed25519.verify() against the issuer\'s public key. Bytes don\'t match. Verdict: deny / bad_signature. The adversary gets nothing.', actors: ['f2-verifier'], arrows: [{ id: 'f2-arr-4', kind: 'danger' }], labels: ['f2-lbl-4'], showVerdict: 'f2-verdict' },
      ]
    },
    f3: {
      panel: 'revoked',
      steps: [
        { title: 'Issuer rotates a key', body: 'The issuer (acme.com) is rotating an old signing key — maybe scheduled, maybe a compromise. The kid gets added to the issuer\'s CRL.', actors: ['f3-issuer'], arrows: [] },
        { title: 'CRL entry written', body: 'The CRL at <code>/.well-known/agentpki-crl.json</code> now lists the kid with <code>revoked_at</code> + reason. Verifiers consult this on every verify call (cached 5 minutes).', actors: ['f3-issuer', 'f3-crl'], arrows: [{ id: 'f3-arr-1', kind: 'active' }], labels: ['f3-lbl-1'] },
        { title: 'Agent presents the now-old passport', body: 'A passport signed before rotation still has a mathematically valid signature. The agent doesn\'t know the kid was rotated. They send it to the verifier as usual.', actors: ['f3-agent', 'f3-verifier'], arrows: [{ id: 'f3-arr-2', kind: 'active' }], labels: ['f3-lbl-2'] },
        { title: 'Verifier fetches CRL → finds the kid → deny', body: 'Verifier signature-check passes, but the kid is in the CRL. Verdict: deny / revoked_key. The old passport is universally rejected within ~5 minutes of CRL update.', actors: ['f3-verifier', 'f3-crl'], arrows: [{ id: 'f3-arr-3', kind: 'danger' }, { id: 'f3-arr-4', kind: 'danger' }], labels: ['f3-lbl-3'], showVerdict: 'f3-verdict' },
      ]
    },
    f4: {
      panel: 'replay',
      steps: [
        { title: 'Mode B request #1 arrives', body: 'The agent sends a Mode B request: passport + RFC 9421 signature over (method, URL, body hash). Signature binds the token to this specific HTTP call.', actors: ['f4-agent', 'f4-verifier'], arrows: [{ id: 'f4-arr-1', kind: 'active' }], labels: ['f4-lbl-1'] },
        { title: 'Verifier records (jti, sig) in Durable Object', body: 'The Replay Cache DO is a single global state machine. Verifier writes the (jti, signature_bytes) tuple with a TTL matching the passport expiry.', actors: ['f4-verifier', 'f4-do'], arrows: [{ id: 'f4-arr-2', kind: 'active' }], labels: ['f4-lbl-2'], showVerdict: 'f4-verdict1' },
        { title: 'Adversary captures + replays the request', body: 'The signed request is bit-perfect copy. An attacker who can see the wire can resend the same bytes hoping the server accepts it twice. Common attack pattern.', actors: ['f4-adv', 'f4-verifier'], arrows: [{ id: 'f4-arr-3', kind: 'danger' }], labels: ['f4-lbl-3'] },
        { title: 'Verifier looks up (jti, sig)', body: 'On the second arrival, the verifier signature-checks the request (still valid math) but then queries the DO with the same (jti, sig). The DO returns: already seen.', actors: ['f4-verifier', 'f4-do'], arrows: [{ id: 'f4-arr-4', kind: 'danger' }], labels: ['f4-lbl-4'] },
        { title: '✗ Verdict: replay_detected', body: 'Verifier returns deny / replay_detected for the second call. The DO\'s globally consistent state makes this work across any Cloudflare edge node — multi-region replay attacks are caught.', actors: ['f4-verifier'], arrows: [{ id: 'f4-arr-5', kind: 'danger' }], labels: [], showVerdict: 'f4-verdict2' },
      ]
    },
    f5: {
      panel: 'subscribe',
      steps: [
        { title: 'Customer subscribes on /pricing', body: 'They pick the <code>Team</code> plan, enter their email, click Subscribe. The site calls /v1/checkout/session and redirects to Stripe.', actors: ['f5-customer', 'f5-checkout'], arrows: [{ id: 'f5-arr-1', kind: 'active' }], labels: ['f5-lbl-1'] },
        { title: 'Stripe collects payment', body: 'Stripe Checkout is hosted, PCI-compliant. The customer pays. Stripe creates a Customer + Subscription record with our metadata (product=verifier, plan=team).', actors: ['f5-checkout', 'f5-webhook'], arrows: [{ id: 'f5-arr-2', kind: 'active' }], labels: ['f5-lbl-2'] },
        { title: 'Stripe fires webhook to verifier', body: 'POST to /v1/webhooks/stripe with event <code>customer.subscription.created</code>. Signature on the body verified with the webhook secret.', actors: ['f5-webhook', 'f5-verifier'], arrows: [{ id: 'f5-arr-3', kind: 'active' }], labels: ['f5-lbl-3'] },
        { title: 'Verifier provisions an api_key', body: 'Generates apk_… and stores it in KV under <code>apikey:apk_…</code> with plan + customer_id. Writes the email→key index for /v1/auth/me.', actors: ['f5-verifier', 'f5-kv'], arrows: [{ id: 'f5-arr-4', kind: 'active' }], labels: ['f5-lbl-4'] },
        { title: 'Resend emails the api_key', body: 'The api_key gets emailed to the customer immediately with usage instructions. They have it in their inbox before they\'re even back from Stripe.', actors: ['f5-verifier', 'f5-email'], arrows: [{ id: 'f5-arr-5', kind: 'active' }], labels: ['f5-lbl-5'] },
        { title: '✓ Customer sees the key in /account', body: 'After Stripe redirects, /account fetches /v1/auth/me. The dashboard shows: plan = Team, usage = 0, key fingerprint, billing portal link.', actors: ['f5-customer', 'f5-account'], arrows: [{ id: 'f5-arr-6', kind: 'success' }], labels: ['f5-lbl-6'], verdict: 'allow' },
      ]
    },
    f6: {
      panel: 'signin',
      steps: [
        { title: 'Customer enters email on /account', body: 'No password. They type their email, click "Email me a sign-in link". The page calls POST /v1/auth/request-link.', actors: ['f6-account', 'f6-verifier'], arrows: [{ id: 'f6-arr-1', kind: 'active' }], labels: ['f6-lbl-1'] },
        { title: 'Verifier generates link, sends email', body: 'Verifier creates a short-lived token (15 min TTL), stores it in KV under <code>auth-link:lnk_…</code>, and sends a one-time URL to the customer\'s email via Resend.', actors: ['f6-verifier', 'f6-email'], arrows: [{ id: 'f6-arr-2', kind: 'active' }], labels: ['f6-lbl-2'] },
        { title: 'Customer clicks the link', body: 'Email link is <code>agentpki.dev/account?token=lnk_…</code>. Browser follows it.', actors: ['f6-email', 'f6-customer'], arrows: [{ id: 'f6-arr-3', kind: 'active' }], labels: ['f6-lbl-3'] },
        { title: 'Browser hits /v1/auth/verify', body: 'The /account page sees ?token=… and forwards to the verifier. The verifier consumes the token (one-use), checks expiry, and mints a session cookie (HttpOnly, Secure, 7-day TTL).', actors: ['f6-customer', 'f6-verify'], arrows: [{ id: 'f6-arr-4', kind: 'active' }], labels: ['f6-lbl-4'] },
        { title: 'Cookie set, redirect back to /account', body: 'Verifier returns 302 with <code>Set-Cookie: agentpki_session=…</code>. The customer is now signed in. No password ever entered.', actors: ['f6-verify', 'f6-me'], arrows: [{ id: 'f6-arr-5', kind: 'active' }], labels: ['f6-lbl-5'] },
        { title: '✓ Dashboard renders', body: '/account calls /v1/auth/me with the cookie, gets back email + plan + usage + masked key, and renders the dashboard. The "Manage billing" button opens the Stripe Customer Portal.', actors: ['f6-me', 'f6-dash'], arrows: [{ id: 'f6-arr-6', kind: 'success' }], labels: ['f6-lbl-6'], verdict: 'allow' },
      ]
    }
  };

  function makeRunner(key, flow) {
    var state = { idx: 0, playing: false, timer: null };
    var prefix = key;
    var panel = '#panel-' + flow.panel;
    var titleEl = document.getElementById(prefix + '-title');
    var stepEl = document.getElementById(prefix + '-step');
    var bodyEl = document.getElementById(prefix + '-body');
    var progressEl = document.getElementById(prefix + '-progress');
    var playBtn = document.getElementById(prefix + '-play');
    var stepBtn = document.getElementById(prefix + '-step-btn');
    var resetBtn = document.getElementById(prefix + '-reset');
    var steps = flow.steps;

    // Each flow runner only wires up if its panel is present on the page.
    // This lets the same spec-flows.js file load on /how-verification-works
    // (3 panels), /replay (1 panel), /pricing (1 panel), /account (1 panel),
    // and any subset of flows on /spec — each page only animates what it shows.
    if (!playBtn || !stepBtn || !resetBtn || !titleEl) return;

    function clearAll() {
      document.querySelectorAll(panel + ' .actor').forEach(a => a.classList.remove('active','success','danger'));
      document.querySelectorAll(panel + ' .arrow').forEach(a => a.classList.remove('active','success','danger'));
      document.querySelectorAll(panel + ' .label').forEach(l => l.classList.remove('active','success','danger'));
      document.querySelectorAll(panel + ' .verdict-pill').forEach(v => v.classList.remove('shown'));
    }

    function applyStep(i) {
      clearAll();
      var s = steps[i];
      if (!s) return;
      (s.actors || []).forEach(id => {
        var el = document.getElementById(id);
        if (el) el.classList.add(s.verdict === 'allow' ? 'success' : (s.showVerdict && s.showVerdict.includes('verdict2') ? 'danger' : 'active'));
      });
      (s.arrows || []).forEach(arr => {
        var el = document.getElementById(arr.id);
        if (el) el.classList.add(arr.kind);
      });
      (s.labels || []).forEach(lid => {
        var el = document.getElementById(lid);
        if (el) el.classList.add(s.verdict === 'allow' ? 'success' : 'active');
      });
      if (s.showVerdict) {
        var v = document.getElementById(s.showVerdict);
        if (v) v.classList.add('shown');
      }
      stepEl.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
      titleEl.textContent = s.title;
      bodyEl.innerHTML = s.body;
      progressEl.style.width = (((i + 1) / steps.length) * 100) + '%';
    }

    function play() {
      if (state.playing) return;
      state.playing = true;
      playBtn.textContent = '⏸ Pause';
      if (state.idx >= steps.length - 1) state.idx = -1;
      state.timer = setInterval(function () {
        state.idx++;
        if (state.idx >= steps.length) { stop(); return; }
        applyStep(state.idx);
      }, 2500);
    }
    function stop() {
      state.playing = false;
      playBtn.textContent = '▶ Play';
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
    }
    function reset() {
      stop();
      state.idx = -1;
      clearAll();
      stepEl.textContent = 'Step 0 of ' + steps.length;
      titleEl.textContent = 'Ready to start.';
      bodyEl.innerHTML = 'Click <strong>Play</strong> to walk this flow.';
      progressEl.style.width = '0%';
    }
    function next() {
      state.idx = Math.min(state.idx + 1, steps.length - 1);
      applyStep(state.idx);
      if (state.idx >= steps.length - 1) stop();
    }

    playBtn.addEventListener('click', function () { state.playing ? stop() : play(); });
    stepBtn.addEventListener('click', function () { stop(); if (state.idx >= steps.length - 1) state.idx = -1; next(); });
    resetBtn.addEventListener('click', reset);

    reset();
  }

  Object.keys(flows).forEach(function (k) { makeRunner(k, flows[k]); });
})();
