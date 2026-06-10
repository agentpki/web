(function () {
  // ── Tab switcher ──
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      var which = btn.getAttribute('data-tab');
      document.querySelectorAll('.flow-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + which).classList.add('active');
    });
  });

  // ── INTENT flow steps ──
  // Each step describes which actors light up, which arrows highlight,
  // and what the narration says.
  var intentSteps = [
    {
      title: 'Bot mints a passport',
      body: 'Claude (the bot) is issued a passport by Anthropic. The passport is a cryptographic credential — Ed25519-signed PASETO token — that any verifier can check against the public Anthropic issuer directory.',
      actors: ['i-bot'],
      arrows: [],
    },
    {
      title: 'Bot declares intent: purchase',
      body: 'When Claude mints the passport for this session, it includes an <code>intent: ["purchase"]</code> claim. This binds the agent\'s purpose into the cryptographic credential.',
      actors: ['i-bot'],
      arrows: [],
    },
    {
      title: 'Bot calls the marketplace',
      body: 'Claude makes its request to <code>marketplace.example/checkout</code>, attaching the passport in an <code>Agentpki-Token</code> header. The site sees the passport before it processes the request.',
      actors: ['i-bot', 'i-site'],
      arrows: [{ id: 'i-arr-1', kind: 'active' }],
      labels: ['i-lbl-1'],
    },
    {
      title: 'Site asks the verifier',
      body: 'The marketplace forwards the passport to <code>verify.agentpki.dev/v1/verify</code> with <code>intent_check.site=marketplace.example</code>. This is one POST, ~50ms on the edge.',
      actors: ['i-site', 'i-verifier'],
      arrows: [{ id: 'i-arr-2', kind: 'active' }],
      labels: ['i-lbl-2'],
    },
    {
      title: 'Verifier fetches the site policy',
      body: 'The verifier reads the site\'s published policy at <code>marketplace.example/.well-known/agentpki-intent-policy.json</code>. The policy says: accept <code>purchase</code> at 10rpm, deny <code>scrape-bulk</code>, deny <code>automate-account</code>.',
      actors: ['i-verifier', 'i-policy'],
      arrows: [{ id: 'i-arr-3', kind: 'active' }],
      labels: ['i-lbl-3'],
    },
    {
      title: 'Match → allow. Records to audit log.',
      body: 'Declared <code>purchase</code> matches an accepted intent. Verdict is <code>allow</code>. The verifier appends a hash-chained entry to the public audit log so the declaration is recoverable forever — useful when sites need to prove who tried what.',
      actors: ['i-verifier', 'i-audit'],
      arrows: [{ id: 'i-arr-4', kind: 'success' }],
      labels: ['i-lbl-4'],
      verdict: 'allow',
    },
    {
      title: 'Site lets the bot through',
      body: 'Verifier returns <code>verdict: allow</code> to the site, and the site responds 200 OK to Claude. The fan gets the ticket — and the scalper bots who declared <code>scrape-bulk</code> or refused to identify never got past step 4.',
      actors: ['i-bot', 'i-site', 'i-verifier'],
      arrows: [
        { id: 'i-arr-5', kind: 'success' },
        { id: 'i-arr-6', kind: 'success' },
      ],
      labels: ['i-lbl-5', 'i-lbl-6'],
      verdict: 'allow',
    },
  ];

  // ── PROVENANCE flow steps ──
  var provenanceSteps = [
    {
      title: 'Sarah writes her article',
      body: 'Sarah finishes a 4,000-word investigation. Her Substack CMS has the AgentPKI signing service wired in.',
      actors: ['p-author'],
      arrows: [],
    },
    {
      title: 'Substack signs + attaches manifest',
      body: 'On publish, the article bytes get hashed (SHA-256), the hash is bound to Sarah\'s passport (issuer: substack.com), and the signed manifest is attached as a sidecar and as a <code>Content-Provenance</code> HTTP header.',
      actors: ['p-author', 'p-article'],
      arrows: [{ id: 'p-arr-1', kind: 'active' }],
      labels: ['p-lbl-1'],
    },
    {
      title: 'Article is live',
      body: 'The article goes out into the world. Search engines crawl it, readers find it, AI-overview tools summarize it. Each consumer sees both the bytes and the attached manifest.',
      actors: ['p-article', 'p-reader'],
      arrows: [{ id: 'p-arr-2', kind: 'active' }],
      labels: ['p-lbl-2'],
    },
    {
      title: 'Reader\'s browser verifies the manifest',
      body: 'A reader\'s browser (with the AgentPKI extension, or any C2PA-aware client) detects the manifest. It calls <code>provenance.agentpki.dev/v1/verify</code> with the manifest and the page bytes.',
      actors: ['p-reader', 'p-verifier'],
      arrows: [{ id: 'p-arr-3', kind: 'active' }],
      labels: ['p-lbl-3'],
    },
    {
      title: 'Verifier walks chain to issuer directory',
      body: 'The verifier extracts the passport from the manifest, resolves Sarah\'s issuer (<code>substack.com</code>), and fetches the issuer directory at the well-known URL. The pubkey listed there validates the manifest signature.',
      actors: ['p-verifier', 'p-dir'],
      arrows: [
        { id: 'p-arr-4', kind: 'active' },
        { id: 'p-arr-5', kind: 'active' },
      ],
      labels: ['p-lbl-4', 'p-lbl-5'],
    },
    {
      title: '✓ Verified: Sarah Lin, published 10:14 AM',
      body: 'Verifier confirms: signature is valid, content bytes match the manifest hash exactly, passport is unexpired, issuer is tier 2. The reader\'s browser surfaces a verified-author badge. AI clones of the article — which can\'t produce a matching signature — show "no provenance" instead.',
      actors: ['p-author', 'p-article', 'p-reader', 'p-verifier', 'p-dir'],
      arrows: [{ id: 'p-arr-6', kind: 'success' }],
      labels: ['p-lbl-6'],
      verdict: 'allow',
    },
  ];

  // ── Generic flow runner ──
  function makeRunner(prefix, steps) {
    var state = { idx: 0, playing: false, timer: null };
    var titleEl = document.getElementById(prefix + '-title');
    var stepEl = document.getElementById(prefix + '-step');
    var bodyEl = document.getElementById(prefix + '-body');
    var progressEl = document.getElementById(prefix + '-progress');
    var playBtn = document.getElementById(prefix + '-play');
    var stepBtn = document.getElementById(prefix + '-step-btn');
    var resetBtn = document.getElementById(prefix + '-reset');

    // Skip silently when this runner's controls aren't on the current page.
    // Lets the same trust-flow.js load on /policy-builder (Intent panel only)
    // AND /provenance (Provenance panel only) without throwing on missing
    // elements.
    if (!playBtn || !stepBtn || !resetBtn || !titleEl) return;

    function clearAll() {
      document.querySelectorAll('#panel-' + (prefix === 'i' ? 'intent' : 'provenance') + ' .actor').forEach(a => {
        a.classList.remove('active', 'success', 'danger');
      });
      document.querySelectorAll('#panel-' + (prefix === 'i' ? 'intent' : 'provenance') + ' .arrow').forEach(a => {
        a.classList.remove('active', 'success', 'danger');
      });
      document.querySelectorAll('#panel-' + (prefix === 'i' ? 'intent' : 'provenance') + ' .label').forEach(l => {
        l.classList.remove('active', 'success');
      });
    }

    function applyStep(i) {
      clearAll();
      // Activate cumulative — keep prior actors visible at lower emphasis? Actually no,
      // for clarity only highlight the current step's actors + arrows.
      var s = steps[i];
      if (!s) return;
      (s.actors || []).forEach(id => {
        var el = document.getElementById(id);
        if (el) el.classList.add(s.verdict === 'allow' ? 'success' : 'active');
      });
      (s.arrows || []).forEach(arr => {
        var el = document.getElementById(arr.id);
        if (el) el.classList.add(arr.kind);
      });
      (s.labels || []).forEach(lid => {
        var el = document.getElementById(lid);
        if (el) el.classList.add(s.verdict === 'allow' ? 'success' : 'active');
      });
      stepEl.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
      titleEl.textContent = s.title;
      bodyEl.innerHTML = s.body;
      progressEl.style.width = (((i + 1) / steps.length) * 100) + '%';
    }

    function next() {
      state.idx = Math.min(state.idx + 1, steps.length - 1);
      applyStep(state.idx);
      if (state.idx >= steps.length - 1) stop();
    }

    function play() {
      if (state.playing) return;
      state.playing = true;
      playBtn.textContent = '⏸ Pause';
      // If at the end, reset first
      if (state.idx >= steps.length - 1) {
        state.idx = -1;
      }
      state.timer = setInterval(function () {
        state.idx++;
        if (state.idx >= steps.length) {
          stop();
          return;
        }
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
      bodyEl.innerHTML = 'Click <strong>Play</strong> to watch the trust flow run end to end, or <strong>Step</strong> to advance manually.';
      progressEl.style.width = '0%';
    }

    playBtn.addEventListener('click', function () {
      if (state.playing) stop(); else play();
    });
    stepBtn.addEventListener('click', function () {
      stop();
      // If at end, restart from beginning
      if (state.idx >= steps.length - 1) { state.idx = -1; }
      next();
    });
    resetBtn.addEventListener('click', reset);

    // Initialize
    reset();
  }

  makeRunner('i', intentSteps);
  makeRunner('p', provenanceSteps);
})();
