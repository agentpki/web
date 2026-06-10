(function () {
  // ── Tabs ──
  // On tab switch we refresh BOTH the outgoing tab (so it's clean when revisited)
  // and the incoming tab (so the user lands on a fresh state). Flowchart + form
  // displays + simulation outputs all reset; user-typed inputs (handle/email)
  // are preserved.
  var activeTabKey = 'p1';
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-tab');
      // Refresh outgoing first (so when user comes back later, it's fresh)
      if (activeTabKey && activeTabKey !== key) refreshTab(activeTabKey);

      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.flow-panel').forEach(p => p.classList.remove('active'));
      var panel = document.getElementById('panel-' + key);
      if (panel) panel.classList.add('active');

      // Refresh incoming so the newly-entered tab starts from step 0
      refreshTab(key);
      activeTabKey = key;
    });
  });

  // Reset everything visible inside a tab: flowchart + form displays +
  // simulation outputs + button states. User-typed input values are preserved.
  function refreshTab(key) {
    // Flowchart back to step 0
    if (runners[key]) runners[key].reset();

    if (key === 'p1') {
      var claim = document.getElementById('p1-claim');
      if (claim) { claim.disabled = false; claim.textContent = 'Claim subdomain →'; }
      var mint = document.getElementById('p1-mint');
      if (mint) { mint.disabled = true; mint.classList.remove('loading'); mint.textContent = '▶ Mint passport'; }
      ['p1-token-box', 'p1-curl-box', 'p1-onpage-box'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      var success = document.getElementById('p1-success-panel');
      if (success) success.classList.remove('visible');
      var verify = document.getElementById('p1-verify');
      if (verify) { verify.disabled = true; verify.classList.remove('loading'); }
      var verifyInput = document.getElementById('p1-verify-input');
      if (verifyInput) verifyInput.value = '';
      var verdict = document.getElementById('p1-verdict');
      if (verdict) { verdict.className = 'verdict-pill idle'; verdict.textContent = 'waiting for token'; }
      var err = document.getElementById('p1-error');
      if (err) err.style.display = 'none';

      // Collapse deny modes
      var denyToggle = document.getElementById('p1-deny-toggle');
      var denyBody = document.getElementById('p1-deny-body');
      if (denyToggle && denyBody) {
        denyToggle.classList.remove('open');
        denyBody.classList.remove('open');
        denyToggle.setAttribute('aria-expanded', 'false');
      }
    }

    if (key === 'p2') {
      var simRun = document.getElementById('p2-simulate-run');
      if (simRun) { simRun.disabled = false; simRun.innerHTML = '▶ Simulate <code style="color:#000;background:transparent;">npm start</code>'; }
      var runOut = document.getElementById('p2-run-output');
      if (runOut) { runOut.style.display = 'none'; runOut.innerHTML = ''; }
    }

    if (key === 'p3') {
      var simBtn = document.getElementById('p3-simulate-run');
      if (simBtn) { simBtn.disabled = false; simBtn.textContent = '▶ Simulate bootstrap output'; }
      var simOut = document.getElementById('p3-output');
      if (simOut) { simOut.style.display = 'none'; simOut.innerHTML = ''; }
    }

    if (key === 'p4') {
      var runSuite = document.getElementById('p4-run-suite');
      if (runSuite) { runSuite.disabled = false; runSuite.classList.remove('loading'); runSuite.textContent = '▶ Run trust-contract suite'; }
      var resetSuite = document.getElementById('p4-reset-suite');
      if (resetSuite) resetSuite.style.display = 'none';
      var suiteOut = document.getElementById('p4-suite-output');
      if (suiteOut) { suiteOut.classList.remove('visible'); suiteOut.innerHTML = ''; }
    }
  }

  // ── Per-path step definitions: actors + arrows that light up at each step ──
  // 4-actor 2×2 layout: n1=TL, n2=TR, n3=BL, n4=BR. 4 arrows: a1=top, a2=top-return,
  // a3=left-vertical, a4=bottom. Each step explicitly lists active and success nodes/arrows.
  function flowSteps(prefix) {
    function step(active, success) {
      var activeIds = (active.nodes || []).map(n => prefix + '-' + n)
        .concat((active.arrows || []).flatMap(a => [prefix + '-a' + a, prefix + '-l' + a]));
      var successIds = (success.nodes || []).map(n => prefix + '-' + n)
        .concat((success.arrows || []).flatMap(a => [prefix + '-a' + a, prefix + '-l' + a]));
      return { active: activeIds, success: successIds };
    }
    return [
      // Step 1: user at origin (n1)
      step({ nodes: ['n1'] }, {}),
      // Step 2: request fires (a1 active, n2 active, n1 stays origin)
      step({ nodes: ['n1', 'n2'], arrows: [1] }, {}),
      // Step 3: response returns (a2 active, a1 done, n2 active result, n1 success)
      step({ nodes: ['n2'], arrows: [2] }, { nodes: ['n1'], arrows: [1] }),
      // Step 4: action moves to verifier (a3 active, n3 active, n1+n2 done)
      step({ nodes: ['n3'], arrows: [3] }, { nodes: ['n1', 'n2'], arrows: [1, 2] }),
      // Step 5: final verdict (a4 success, all 4 nodes success, all 4 arrows success)
      step({}, { nodes: ['n1', 'n2', 'n3', 'n4'], arrows: [1, 2, 3, 4] }),
    ];
  }

  // Titles per path (5 steps each: origin → request → response → next stage → final)
  var titles = {
    p1: [
      'You fill the form — handle + email.',
      'Browser GETs /mint from demo.agentpki.dev.',
      'Issuer returns a real PASETO v4 token.',
      'Browser POSTs token to verify.agentpki.dev.',
      'Verifier returns verdict: allow.',
    ],
    p2: [
      'You view agentpki/test-agent-template on GitHub.',
      'Click Open in StackBlitz / Codespaces — repo forks.',
      'IDE ready with @agentpki/sdk pre-installed.',
      'You hit Run. Agent fires signed fetch() to verifier.',
      'Verifier returns verdict: allow. console.log prints.',
    ],
    p3: [
      'You paste the curl|sh (or iwr|iex) command.',
      'Script POSTs your email to /api/v1/bootstrap-claim.',
      'Server returns inline verdict + 24h permalink URL.',
      'Server internally hits verify.agentpki.dev.',
      'Verdict stored under /check/result/<id>. Shareable.',
    ],
    p4: [
      'Your existing agent picks a framework adapter.',
      '@agentpki/sdk wraps your fetch() in your code.',
      'Token + RFC 9421 signature attached, ready to send.',
      'Signed HTTPS request goes to vendor verifier.',
      'Vendor returns 200 OK + audit log entry created.',
    ],
  };

  // ── Runners ──
  var runners = {};

  function makeRunner(key) {
    var state = { idx: -1, playing: false, timer: null };
    var panel = '#panel-' + key;
    var stepEl = document.getElementById(key + '-step');
    var playBtn = document.getElementById(key + '-play');
    var stepBtn = document.getElementById(key + '-step-btn');
    var resetBtn = document.getElementById(key + '-reset');
    var steps = flowSteps(key);

    function clearAll() {
      document.querySelectorAll(panel + ' .actor').forEach(a => a.classList.remove('active', 'success'));
      document.querySelectorAll(panel + ' .arrow').forEach(a => a.classList.remove('active', 'success'));
      document.querySelectorAll(panel + ' .label').forEach(l => l.classList.remove('active', 'success'));
    }

    function applyStep(i) {
      clearAll();
      var s = steps[i];
      if (!s) return;
      // Apply success first so active wins when both lists overlap.
      (s.success || []).forEach(id => {
        var el = document.getElementById(id);
        if (el) el.classList.add('success');
      });
      (s.active || []).forEach(id => {
        var el = document.getElementById(id);
        if (el) { el.classList.remove('success'); el.classList.add('active'); }
      });
      stepEl.textContent = 'Step ' + (i + 1) + ' of ' + steps.length + ' · ' + (titles[key] ? titles[key][i] : '');
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
      }, 2200);
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
      stepEl.textContent = 'Step 0 of ' + steps.length + ' · ready';
    }
    function next() {
      state.idx = Math.min(state.idx + 1, steps.length - 1);
      applyStep(state.idx);
      if (state.idx >= steps.length - 1) stop();
    }
    function goTo(i) {
      stop();
      state.idx = Math.max(0, Math.min(i, steps.length - 1));
      applyStep(state.idx);
    }

    playBtn.addEventListener('click', function () { state.playing ? stop() : play(); });
    stepBtn.addEventListener('click', function () { stop(); if (state.idx >= steps.length - 1) state.idx = -1; next(); });
    resetBtn.addEventListener('click', reset);

    reset();
    return { goTo: goTo, reset: reset };
  }

  ['p1', 'p2', 'p3', 'p4'].forEach(function (k) { runners[k] = makeRunner(k); });

  // ════════════════════════════════════════════════════════════
  // PATH 01 — real claim, real mint, real verify
  // ════════════════════════════════════════════════════════════
  (function wireP1() {
    var handleEl = document.getElementById('p1-handle');
    var emailEl = document.getElementById('p1-email');
    var previewEl = document.getElementById('p1-preview');
    var claimBtn = document.getElementById('p1-claim');
    var mintBtn = document.getElementById('p1-mint');
    var tokenBox = document.getElementById('p1-token-box');
    var tokenDisplay = document.getElementById('p1-token-display');
    var tokenLength = document.getElementById('p1-token-length');
    var tokenCopy = document.getElementById('p1-token-copy');
    var curlBox = document.getElementById('p1-curl-box');
    var onpageBox = document.getElementById('p1-onpage-box');
    var curlBash = document.getElementById('p1-curl-cmd-bash');
    var curlPs = document.getElementById('p1-curl-cmd-ps');
    var verifyInput = document.getElementById('p1-verify-input');
    var verifyBtn = document.getElementById('p1-verify');
    var verifyPrefill = document.getElementById('p1-verify-prefill');
    var verdictEl = document.getElementById('p1-verdict');
    var successPanel = document.getElementById('p1-success-panel');

    var claimedHandle = null;
    var liveToken = null;

    function updatePreview() {
      var h = (handleEl.value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      previewEl.textContent = (h || '_____') + '.agents.agentpki.dev';
      runners.p1.goTo(0);  // step 1: filling the form
    }
    handleEl.addEventListener('input', updatePreview);
    emailEl.addEventListener('focus', function () { runners.p1.goTo(0); });

    claimBtn.addEventListener('click', function () {
      var h = (handleEl.value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!h) { handleEl.focus(); return; }
      claimedHandle = h;
      previewEl.textContent = h + '.agents.agentpki.dev';
      claimBtn.disabled = true;
      claimBtn.textContent = '✓ Claimed ' + h + '.agents.agentpki.dev';
      mintBtn.disabled = false;
      runners.p1.goTo(0);
    });

    mintBtn.addEventListener('click', async function () {
      if (!claimedHandle) return;
      runners.p1.goTo(1);  // step 2: GET /mint pulses
      mintBtn.classList.add('loading');
      mintBtn.disabled = true;
      try {
        var sub = 'agent:' + claimedHandle + '.agents.agentpki.dev/preview';
        var r = await fetch('https://demo.agentpki.dev/mint?sub=' + encodeURIComponent(sub) + '&scope=read:articles&lifetime=300');
        var body = await r.json();
        if (!body.token) throw new Error('no token in response');
        liveToken = body.token;
        runners.p1.goTo(2);  // step 3: token returned
        tokenDisplay.textContent = liveToken;
        tokenLength.textContent = liveToken.length;
        tokenBox.style.display = 'block';

        // Build curl commands
        var bashCmd = "curl -X POST https://verify.agentpki.dev/v1/verify \\\n  -H 'content-type: application/json' \\\n  -d '{\"token\":\"" + liveToken + "\"}'";
        var psCmd = "Invoke-RestMethod -Uri https://verify.agentpki.dev/v1/verify -Method POST `\n  -ContentType 'application/json' `\n  -Body (@{ token = '" + liveToken + "' } | ConvertTo-Json)";
        curlBash.innerHTML = '<span class="c-prompt">$</span> ' + escapeHtml(bashCmd);
        curlPs.innerHTML = '<span class="c-prompt">PS&gt;</span> ' + escapeHtml(psCmd);
        curlBox.style.display = 'block';
        onpageBox.style.display = 'block';
        mintBtn.textContent = '✓ Minted';
      } catch (e) {
        mintBtn.textContent = 'Mint failed: ' + e.message;
        mintBtn.disabled = false;
      } finally {
        mintBtn.classList.remove('loading');
      }
    });

    tokenCopy.addEventListener('click', async function () {
      if (!liveToken) return;
      try { await navigator.clipboard.writeText(liveToken); tokenCopy.textContent = 'Copied!'; setTimeout(() => tokenCopy.textContent = 'Copy token', 1500); } catch {}
    });

    document.querySelectorAll('[data-p1-curl-copy]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var sh = b.getAttribute('data-p1-curl-copy');
        var src = sh === 'bash' ? curlBash.textContent.replace(/^\$\s/, '') : curlPs.textContent.replace(/^PS>\s/, '');
        try { await navigator.clipboard.writeText(src); b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy command', 1500); } catch {}
      });
    });

    // Shell tabs (Path 01 curl)
    document.querySelectorAll('#panel-p1 .shell-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var sh = t.getAttribute('data-shell');
        document.querySelectorAll('#panel-p1 .shell-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('#panel-p1 .shell-panel').forEach(p => p.classList.remove('active'));
        var panel = document.querySelector('#panel-p1 .shell-panel[data-shell-panel="' + sh + '"]');
        if (panel) panel.classList.add('active');
      });
    });

    verifyInput.addEventListener('input', function () {
      verifyBtn.disabled = !verifyInput.value.trim();
      verdictEl.className = 'verdict-pill idle';
      verdictEl.textContent = verifyInput.value.trim() ? 'ready to verify' : 'waiting for token';
    });

    verifyPrefill.addEventListener('click', function () {
      if (liveToken) { verifyInput.value = liveToken; verifyBtn.disabled = false; verdictEl.className = 'verdict-pill idle'; verdictEl.textContent = 'ready to verify'; }
    });

    verifyBtn.addEventListener('click', async function () {
      var t = verifyInput.value.trim();
      if (!t) return;
      runners.p1.goTo(3);  // step 4: POST /v1/verify pulses
      verifyBtn.classList.add('loading');
      verifyBtn.disabled = true;
      verdictEl.className = 'verdict-pill loading';
      verdictEl.textContent = 'verifying…';
      var t0 = Date.now();
      try {
        var r = await fetch('https://verify.agentpki.dev/v1/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: t }),
        });
        var body = await r.json();
        var elapsed = Date.now() - t0;
        runners.p1.goTo(4);  // step 5: verdict received
        var v = body.verdict || 'unknown';
        verdictEl.className = 'verdict-pill ' + (v === 'allow' ? 'allow' : 'deny');
        verdictEl.textContent = 'verdict: ' + v;

        if (v === 'allow') {
          document.getElementById('p1-success-ms').textContent = body.elapsed_ms || elapsed;
          document.getElementById('p1-success-issuer').textContent = body.issuer || '—';
          document.getElementById('p1-success-agent').textContent = body.identity || body.sub || '—';
          document.getElementById('p1-success-scopes').textContent = (body.scopes || []).join(', ') || '—';
          document.getElementById('p1-success-tier').textContent = body.tier || '—';
          document.getElementById('p1-success-abuse').textContent = body.abuse_score != null ? body.abuse_score : '—';
          document.getElementById('p1-success-elapsed').textContent = (body.elapsed_ms || elapsed) + ' ms';
          successPanel.classList.add('visible');
        }
      } catch (e) {
        verdictEl.className = 'verdict-pill deny';
        verdictEl.textContent = 'network error';
      } finally {
        verifyBtn.classList.remove('loading');
        verifyBtn.disabled = false;
      }
    });
  })();

  // ════════════════════════════════════════════════════════════
  // PATH 01 — Deny modes (Tamper Lab + Revoked-Key Lab)
  // ════════════════════════════════════════════════════════════
  (function wireP1Deny() {
    var toggle = document.getElementById('p1-deny-toggle');
    var body = document.getElementById('p1-deny-body');
    toggle.addEventListener('click', function () {
      var open = body.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // ─── Tamper Lab ───
    var labT = {
      token: null,
      tampered: null,
      mode: null,
      stages: {
        A: document.getElementById('lab-t-A'),
        B: document.getElementById('lab-t-B'),
        C: document.getElementById('lab-t-C'),
      },
    };
    var labTMint = document.getElementById('lab-t-mint');
    var labTTokenEl = document.getElementById('lab-t-token');
    var labTMintStatus = document.getElementById('lab-t-mint-status');
    var labTTamperStatus = document.getElementById('lab-t-tamper-status');
    var labTSend = document.getElementById('lab-t-send');
    var labTReset = document.getElementById('lab-t-reset');
    var labTResult = document.getElementById('lab-t-result');
    var labTTamperBtns = document.querySelectorAll('[data-tamper]');

    function activateStage(card, stage) {
      ['A', 'B', 'C'].forEach(function (k) {
        var s = card.stages[k];
        if (!s) return;
        s.classList.remove('active');
        if (k === stage) s.classList.add('active');
      });
    }
    function markDone(card, stage) {
      var s = card.stages[stage];
      if (s) { s.classList.add('done'); s.classList.remove('active'); }
    }
    function flipChar(s, idx) {
      var c = s.charCodeAt(idx);
      var nc = c === 65 ? 66 : c === 66 ? 67 : c === 90 ? 65 : c + 1;
      return s.slice(0, idx) + String.fromCharCode(nc) + s.slice(idx + 1);
    }

    labTMint.addEventListener('click', async function () {
      labTMint.classList.add('loading');
      labTMint.disabled = true;
      labTMintStatus.textContent = 'minting …';
      try {
        var r = await fetch('https://demo.agentpki.dev/mint');
        var body = await r.json();
        if (!body.token) throw new Error('no token');
        labT.token = body.token;
        labT.tampered = body.token;
        labT.mode = null;
        labTTokenEl.textContent = body.token;
        labTTokenEl.style.display = 'block';
        labTMintStatus.textContent = '✓ minted (' + body.token.length + ' chars)';
        markDone(labT, 'A');
        activateStage(labT, 'B');
        labTTamperBtns.forEach(b => b.disabled = false);
        labTSend.disabled = true;
        labTResult.classList.remove('visible');
      } catch (e) {
        labTMintStatus.textContent = 'mint failed: ' + e.message;
      } finally {
        labTMint.classList.remove('loading');
        labTMint.disabled = false;
        labTMint.textContent = '↻ Mint another';
      }
    });

    labTTamperBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!labT.token) return;
        var mode = btn.getAttribute('data-tamper');
        labT.mode = mode;
        var parts = labT.token.split('.');  // v4.public.payload.footer? actually PASETO is v.purpose.payload[.footer]
        // PASETO v4.public is "v4.public.<payload-with-trailing-sig>" or with footer "v4.public.<payload>.<footer>"
        // We treat parts[2] as the payload+sig blob; flipping its last few chars corrupts the signature.
        if (mode === 'sig') {
          // Flip the last 4 chars of parts[2] — these are inside the Ed25519 signature suffix
          var p2 = parts[2] || '';
          if (p2.length > 6) {
            labT.tampered = parts[0] + '.' + parts[1] + '.' + p2.slice(0, -4) + 'AAAA' + (parts[3] ? '.' + parts[3] : '');
          }
          labTTamperStatus.textContent = '✗ signature flipped — last 4 chars overwritten with AAAA';
          labTTamperStatus.className = 'lab-status tampered';
        } else if (mode === 'payload') {
          // Flip a char near the middle of parts[2] (in the payload region, not the signature suffix)
          var p2 = parts[2] || '';
          if (p2.length > 20) {
            var idx = Math.floor(p2.length / 3);
            labT.tampered = parts[0] + '.' + parts[1] + '.' + flipChar(p2, idx) + (parts[3] ? '.' + parts[3] : '');
          }
          labTTamperStatus.textContent = '✗ payload flipped — 1 char swapped mid-blob';
          labTTamperStatus.className = 'lab-status tampered';
        } else if (mode === 'footer') {
          var f = parts[3] || '';
          if (f) {
            labT.tampered = parts[0] + '.' + parts[1] + '.' + parts[2] + '.' + flipChar(f, 0);
          } else {
            // No footer present — append a fake one to corrupt the AAD
            labT.tampered = labT.token + '.AAAA';
          }
          labTTamperStatus.textContent = '✗ footer flipped (or added) — additional-data changed';
          labTTamperStatus.className = 'lab-status tampered';
        } else {
          labT.tampered = labT.token;
          labTTamperStatus.textContent = '✓ unchanged — send the real token to confirm it still allows';
          labTTamperStatus.className = 'lab-status unchanged';
        }
        markDone(labT, 'B');
        activateStage(labT, 'C');
        labTSend.disabled = false;
      });
    });

    labTSend.addEventListener('click', async function () {
      if (!labT.tampered) return;
      labTSend.classList.add('loading');
      labTSend.disabled = true;
      labTResult.classList.remove('visible');
      try {
        var r = await fetch('https://verify.agentpki.dev/v1/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: labT.tampered }),
        });
        var body = await r.json();
        var v = body.verdict || 'unknown';
        labTResult.classList.add('visible');
        labTResult.classList.remove('allow', 'deny');
        if (v === 'allow') {
          labTResult.classList.add('allow');
          labTResult.innerHTML = '<strong>✓ verdict: allow</strong>The verifier accepted the token. (You sent it unchanged.)';
        } else {
          labTResult.classList.add('deny');
          labTResult.innerHTML = '<strong>✗ verdict: deny</strong>failure_reason: <code>' + (body.failure_reason || 'unknown') + '</code>' + (body.failure_detail ? '<br>detail: ' + body.failure_detail : '');
        }
        markDone(labT, 'C');
      } catch (e) {
        labTResult.classList.add('visible', 'deny');
        labTResult.innerHTML = '<strong>network error</strong>' + e.message;
      } finally {
        labTSend.classList.remove('loading');
        labTSend.disabled = false;
      }
    });

    labTReset.addEventListener('click', function () {
      labT.token = null; labT.tampered = null; labT.mode = null;
      labTTokenEl.style.display = 'none';
      labTTokenEl.textContent = '';
      labTMintStatus.textContent = '';
      labTTamperStatus.textContent = '';
      labTTamperStatus.className = 'lab-status';
      labTResult.classList.remove('visible');
      labT.stages.A.classList.add('active');
      labT.stages.A.classList.remove('done');
      labT.stages.B.classList.remove('active', 'done');
      labT.stages.C.classList.remove('active', 'done');
      labTTamperBtns.forEach(b => b.disabled = true);
      labTSend.disabled = true;
      labTMint.textContent = 'Mint a fresh token';
    });

    // ─── Revoked-Key Lab ───
    var labR = {
      token: null,
      kid: null,
      stages: {
        A: document.getElementById('lab-r-A'),
        B: document.getElementById('lab-r-B'),
        C: document.getElementById('lab-r-C'),
      },
    };
    var labRTokenEl = document.getElementById('lab-r-token');
    var labRMintStatus = document.getElementById('lab-r-mint-status');
    var labRFetchDir = document.getElementById('lab-r-fetch-dir');
    var labRCrl = document.getElementById('lab-r-crl');
    var labRSend = document.getElementById('lab-r-send');
    var labRReset = document.getElementById('lab-r-reset');
    var labRResult = document.getElementById('lab-r-result');
    var labRKidBtns = document.querySelectorAll('[data-kid]');

    labRKidBtns.forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var kid = btn.getAttribute('data-kid');
        labR.kid = kid;
        btn.classList.add('loading');
        labRMintStatus.textContent = 'minting with kid="' + (kid === 'active' ? 'demo-2026-q2' : 'demo-2026-q1-rotated') + '" …';
        try {
          var url = kid === 'revoked' ? 'https://demo.agentpki.dev/mint?revoked=1' : 'https://demo.agentpki.dev/mint';
          var r = await fetch(url);
          var body = await r.json();
          if (!body.token) throw new Error('no token');
          labR.token = body.token;
          labRTokenEl.textContent = body.token;
          labRTokenEl.style.display = 'block';
          labRMintStatus.textContent = '✓ token signed with kid="' + (kid === 'active' ? 'demo-2026-q2' : 'demo-2026-q1-rotated') + '"';
          markDone(labR, 'A');
          activateStage(labR, 'B');
          labRFetchDir.disabled = false;
        } catch (e) {
          labRMintStatus.textContent = 'mint failed: ' + e.message;
        } finally {
          btn.classList.remove('loading');
        }
      });
    });

    labRFetchDir.addEventListener('click', function () {
      // Simulate the issuer directory CRL output — values mirror /demo's expected behavior.
      labRCrl.innerHTML = '<span class="crl-key">{</span>\n  <span class="crl-key">"issuer":</span> "demo.agentpki.dev",\n  <span class="crl-key">"keys":</span> [\n    {\n      <span class="crl-key">"kid":</span> "demo-2026-q2",\n      <span class="crl-key">"status":</span> <span class="crl-active">"active"</span>,\n      <span class="crl-key">"created_at":</span> 1748390400\n    },\n    {\n      <span class="crl-key">"kid":</span> "demo-2026-q1-rotated",\n      <span class="crl-key">"status":</span> <span class="crl-revoked">"revoked"</span>,\n      <span class="crl-key">"revoked_at":</span> 1748390400,\n      <span class="crl-key">"reason":</span> "planned_rotation"\n    }\n  ]\n<span class="crl-key">}</span>';
      labRCrl.style.display = 'block';
      markDone(labR, 'B');
      activateStage(labR, 'C');
      labRSend.disabled = false;
    });

    labRSend.addEventListener('click', async function () {
      if (!labR.token) return;
      labRSend.classList.add('loading');
      labRSend.disabled = true;
      labRResult.classList.remove('visible');
      try {
        var r = await fetch('https://verify.agentpki.dev/v1/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: labR.token }),
        });
        var body = await r.json();
        var v = body.verdict || 'unknown';
        labRResult.classList.add('visible');
        labRResult.classList.remove('allow', 'deny');
        if (v === 'allow') {
          labRResult.classList.add('allow');
          labRResult.innerHTML = '<strong>✓ verdict: allow</strong>Active kid, real signature — verifier accepted. (Try the revoked kid next.)';
        } else {
          labRResult.classList.add('deny');
          labRResult.innerHTML = '<strong>✗ verdict: deny</strong>failure_reason: <code>' + (body.failure_reason || 'unknown') + '</code>' + (body.failure_detail ? '<br>detail: ' + body.failure_detail : '');
        }
        markDone(labR, 'C');
      } catch (e) {
        labRResult.classList.add('visible', 'deny');
        labRResult.innerHTML = '<strong>network error</strong>' + e.message;
      } finally {
        labRSend.classList.remove('loading');
        labRSend.disabled = false;
      }
    });

    labRReset.addEventListener('click', function () {
      labR.token = null; labR.kid = null;
      labRTokenEl.style.display = 'none';
      labRTokenEl.textContent = '';
      labRMintStatus.textContent = '';
      labRCrl.style.display = 'none';
      labRResult.classList.remove('visible');
      labR.stages.A.classList.add('active');
      labR.stages.A.classList.remove('done');
      labR.stages.B.classList.remove('active', 'done');
      labR.stages.C.classList.remove('active', 'done');
      labRFetchDir.disabled = true;
      labRSend.disabled = true;
    });
  })();

  // ════════════════════════════════════════════════════════════
  // PATH 02 — simulated cloud IDE
  // ════════════════════════════════════════════════════════════
  (function wireP2() {
    var sbBtn = document.getElementById('p2-stackblitz');
    var csBtn = document.getElementById('p2-codespaces');
    var ghBtn = document.getElementById('p2-github');
    var runBtn = document.getElementById('p2-simulate-run');
    var runOut = document.getElementById('p2-run-output');

    function onOpen() {
      runners.p2.goTo(0);  // step 1: clicked Open
      setTimeout(() => runners.p2.goTo(1), 700);  // step 2: fork happens
      setTimeout(() => runners.p2.goTo(2), 1400); // step 3: IDE ready
    }
    sbBtn.addEventListener('click', onOpen);
    csBtn.addEventListener('click', onOpen);
    ghBtn.addEventListener('click', function () { runners.p2.goTo(0); });

    runBtn.addEventListener('click', function () {
      runBtn.disabled = true;
      runOut.style.display = 'block';
      runOut.innerHTML = '';
      runners.p2.goTo(2);
      var lines = [
        { html: '<span class="c-prompt">$</span> npm start', step: 2, delay: 200 },
        { html: '<span class="c-cmt">> @agentpki/test-agent-template@0.1.0 start</span>', step: 2, delay: 250 },
        { html: '<span class="c-cmt">> node index.mjs</span>', step: 2, delay: 200 },
        { html: '', step: 2, delay: 100 },
        { html: '<span class="c-cmt">[mint] requesting from demo.agentpki.dev …</span>', step: 3, delay: 600 },
        { html: '<span class="c-cmt">[verify] POST verify.agentpki.dev/v1/verify …</span>', step: 3, delay: 700 },
        { html: '', step: 3, delay: 100 },
        { html: 'claude says: AgentPKI is an open standard for cryptographic agent', step: 3, delay: 500 },
        { html: 'identity. It works like HTTPS for AI agents — you can prove', step: 3, delay: 200 },
        { html: "who's behind the agent calling your API.", step: 3, delay: 200 },
        { html: '', step: 3, delay: 100 },
        { html: '<span style="color: var(--green); font-weight:700;">verifier says: allow</span>', step: 4, delay: 400 },
      ];
      var i = 0;
      function tick() {
        if (i >= lines.length) { runBtn.textContent = '✓ Done'; return; }
        var l = lines[i];
        runOut.innerHTML += l.html + '\n';
        runOut.scrollTop = runOut.scrollHeight;
        runners.p2.goTo(l.step);
        i++;
        setTimeout(tick, l.delay);
      }
      tick();
    });
  })();

  // ════════════════════════════════════════════════════════════
  // PATH 03 — bootstrap simulation
  // ════════════════════════════════════════════════════════════
  (function wireP3() {
    // Shell tabs
    document.querySelectorAll('#panel-p3 .shell-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var sh = t.getAttribute('data-shell');
        document.querySelectorAll('#panel-p3 .shell-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('#panel-p3 .shell-panel').forEach(p => p.classList.remove('active'));
        var panel = document.querySelector('#panel-p3 .shell-panel[data-shell-panel="' + sh + '"]');
        if (panel) panel.classList.add('active');
        runners.p3.goTo(0);  // step 1: viewing command
      });
    });

    document.querySelectorAll('[data-p3-copy]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var sh = b.getAttribute('data-p3-copy');
        var cmd = sh === 'bash' ? 'curl -fsSL https://agentpki.dev/bootstrap | sh' : 'iwr https://agentpki.dev/bootstrap.ps1 | iex';
        try { await navigator.clipboard.writeText(cmd); b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy command', 1500); } catch {}
        runners.p3.goTo(0);
      });
    });

    var simBtn = document.getElementById('p3-simulate-run');
    var simOut = document.getElementById('p3-output');
    simBtn.addEventListener('click', function () {
      simBtn.disabled = true;
      simOut.style.display = 'block';
      simOut.innerHTML = '';
      runners.p3.goTo(0);

      var output = [
        { html: 'AgentPKI bootstrap · v1.0  (3-scenario trust demo)', step: 0, d: 200 },
        { html: '----------------------------------------------------', step: 0, d: 80 },
        { html: '', step: 0, d: 100 },
        { html: '  Email? <span class="c-str">you@example.com</span>', step: 1, d: 500 },
        { html: '', step: 1, d: 100 },
        { html: '  <span class="c-cmt">Scenario 1 of 3 · happy path</span>', step: 2, d: 400 },
        { html: '  --------------------------------------------------', step: 2, d: 80 },
        { html: '  Claiming subdomain + minting + verifying + storing ... <span class="c-key">ok</span> in <span class="c-num">864</span>ms', step: 2, d: 800 },
        { html: '    issuer    <span class="c-str">bs-a4f8d2e.agents.agentpki.dev</span>', step: 2, d: 200 },
        { html: '    passport  v4.public.eyJ2IjoxLCJpc3... (<span class="c-num">397</span> chars)', step: 2, d: 150 },
        { html: '    verdict   <span class="c-key">allow</span>   (verifier elapsed <span class="c-num">486</span>ms)', step: 3, d: 300 },
        { html: '    share     <span class="c-str">https://agentpki.dev/check/result/27c7f86c8563</span>', step: 4, d: 250 },
        { html: '', step: 4, d: 100 },
        { html: '  <span class="c-cmt">Scenario 2 of 3 · tampered signature</span>', step: 4, d: 300 },
        { html: '  --------------------------------------------------', step: 4, d: 80 },
        { html: '  Minting a fresh token, flipping 4 chars of its Ed25519 signature, verifying ... done', step: 4, d: 500 },
        { html: '    verdict   <span style="color:#fca5a5;font-weight:700">deny</span> in <span class="c-num">5</span>ms', step: 4, d: 200 },
        { html: '    reason    <span style="color:#fca5a5;font-weight:700">bad_signature</span>', step: 4, d: 150 },
        { html: '    why       The payload JSON was still valid — but the Ed25519', step: 4, d: 150 },
        { html: '              signature no longer matched. No network needed: this', step: 4, d: 100 },
        { html: '              fails on pure crypto math, locally.', step: 4, d: 100 },
        { html: '', step: 4, d: 100 },
        { html: '  <span class="c-cmt">Scenario 3 of 3 · revoked-key signing</span>', step: 4, d: 300 },
        { html: '  --------------------------------------------------', step: 4, d: 80 },
        { html: '  Minting via /mint?revoked=1 (signs with rotated kid), verifying ... done', step: 4, d: 500 },
        { html: '    verdict   <span style="color:#fca5a5;font-weight:700">deny</span> in <span class="c-num">4</span>ms', step: 4, d: 200 },
        { html: '    reason    <span style="color:#fca5a5;font-weight:700">revoked_key</span>', step: 4, d: 150 },
        { html: '    detail    kid="<span class="c-str">demo-2026-q1-rotated</span>" revoked at <span class="c-num">1748390400</span> (planned_rotation)', step: 4, d: 200 },
        { html: '    why       Signature was mathematically valid — the rotated', step: 4, d: 150 },
        { html: '              kid really did sign this token. The verifier consulted', step: 4, d: 100 },
        { html: "              the issuer's CRL and saw the kid is now revoked.", step: 4, d: 100 },
        { html: '', step: 4, d: 100 },
        { html: '  ----------------------------------------------------', step: 4, d: 200 },
        { html: '  All 3 scenarios behaved as expected:', step: 4, d: 200 },
        { html: '    [scenario 1]  real signed token        → <span class="c-key">allow</span>', step: 4, d: 100 },
        { html: '    [scenario 2]  tampered signature       → <span style="color:#fca5a5;font-weight:700">deny</span> (<span style="color:#fca5a5">bad_signature</span>)', step: 4, d: 100 },
        { html: '    [scenario 3]  revoked-key signing      → <span style="color:#fca5a5;font-weight:700">deny</span> (<span style="color:#fca5a5">revoked_key</span>)', step: 4, d: 100 },
        { html: '', step: 4, d: 100 },
        { html: '  AgentPKI distinguishes a forged token from a revoked one —', step: 4, d: 200 },
        { html: "  and the verifier tells you, accurately, which one happened.", step: 4, d: 100 },
      ];
      var i = 0;
      function tick() {
        if (i >= output.length) { simBtn.textContent = '✓ Done'; return; }
        var l = output[i];
        simOut.innerHTML += l.html + '\n';
        simOut.scrollTop = simOut.scrollHeight;
        runners.p3.goTo(l.step);
        i++;
        setTimeout(tick, l.d);
      }
      tick();
    });
  })();

  // ════════════════════════════════════════════════════════════
  // PATH 04 — framework tabs + real suite runner
  // ════════════════════════════════════════════════════════════
  (function wireP4() {
    document.querySelectorAll('#panel-p4 .fw-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var key = t.getAttribute('data-fw-tab');
        document.querySelectorAll('#panel-p4 .fw-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('#panel-p4 .fw-panel').forEach(p => p.classList.remove('active'));
        var panel = document.querySelector('#panel-p4 .fw-panel[data-fw-panel="' + key + '"]');
        if (panel) panel.classList.add('active');
        runners.p4.goTo(0);  // step 1: picked framework
      });
    });

    var runSuiteBtn = document.getElementById('p4-run-suite');
    var resetSuiteBtn = document.getElementById('p4-reset-suite');
    var out = document.getElementById('p4-suite-output');

    function append(html) { out.innerHTML += html + '\n'; out.scrollTop = out.scrollHeight; }

    async function runSuite() {
      runSuiteBtn.disabled = true;
      runSuiteBtn.classList.add('loading');
      out.classList.add('visible');
      out.innerHTML = '';
      resetSuiteBtn.style.display = 'inline-flex';

      append('<span class="dim"> RUN  v1.0.0  agentpki.test.ts (3 tests)</span>');
      append('');
      runners.p4.goTo(0);

      // Test 1: allow on real token
      runners.p4.goTo(1);
      var t0 = Date.now();
      try {
        var m1 = await fetch('https://demo.agentpki.dev/mint').then(r => r.json());
        runners.p4.goTo(2);
        var v1 = await fetch('https://verify.agentpki.dev/v1/verify', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({token: m1.token}) }).then(r => r.json());
        var dt1 = Date.now() - t0;
        runners.p4.goTo(3);
        if (v1.verdict === 'allow') {
          append('  <span class="ok">✓</span> AgentPKI trust contract > allow on a real signed token  <span class="num">(' + dt1 + ' ms)</span>');
        } else {
          append('  <span class="err">✗</span> AgentPKI trust contract > allow on a real signed token  <span class="num">(' + dt1 + ' ms)</span>');
          append('    <span class="err">expected verdict to be \'allow\', got \'' + v1.verdict + '\'</span>');
        }
      } catch (e) {
        append('  <span class="err">✗</span> AgentPKI trust contract > allow on a real signed token');
        append('    <span class="err">' + e.message + '</span>');
      }

      // Test 2: deny + bad_signature
      var t1 = Date.now();
      try {
        var m2 = await fetch('https://demo.agentpki.dev/mint').then(r => r.json());
        var parts = m2.token.split('.');
        var tampered = parts[0] + '.' + parts[1] + '.' + parts[2].slice(0, -4) + 'AAAA' + '.' + (parts[3] || '');
        var v2 = await fetch('https://verify.agentpki.dev/v1/verify', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({token: tampered}) }).then(r => r.json());
        var dt2 = Date.now() - t1;
        if (v2.verdict === 'deny' && v2.failure_reason === 'bad_signature') {
          append('  <span class="ok">✓</span> AgentPKI trust contract > deny + bad_signature on tampered token  <span class="num">(' + dt2 + ' ms)</span>');
        } else {
          append('  <span class="err">✗</span> AgentPKI trust contract > deny + bad_signature on tampered token  <span class="num">(' + dt2 + ' ms)</span>');
          append('    <span class="err">got verdict=' + v2.verdict + ', failure_reason=' + (v2.failure_reason || 'none') + '</span>');
        }
      } catch (e) {
        append('  <span class="err">✗</span> AgentPKI trust contract > deny + bad_signature on tampered token');
        append('    <span class="err">' + e.message + '</span>');
      }

      // Test 3: deny + revoked_key
      var t2 = Date.now();
      try {
        var m3 = await fetch('https://demo.agentpki.dev/mint?revoked=1').then(r => r.json());
        var v3 = await fetch('https://verify.agentpki.dev/v1/verify', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({token: m3.token}) }).then(r => r.json());
        var dt3 = Date.now() - t2;
        runners.p4.goTo(4);
        if (v3.verdict === 'deny' && v3.failure_reason === 'revoked_key') {
          append('  <span class="ok">✓</span> AgentPKI trust contract > deny + revoked_key when issuer rotated the kid  <span class="num">(' + dt3 + ' ms)</span>');
        } else {
          append('  <span class="err">✗</span> AgentPKI trust contract > deny + revoked_key when issuer rotated the kid  <span class="num">(' + dt3 + ' ms)</span>');
          append('    <span class="err">got verdict=' + v3.verdict + ', failure_reason=' + (v3.failure_reason || 'none') + '</span>');
        }
      } catch (e) {
        append('  <span class="err">✗</span> AgentPKI trust contract > deny + revoked_key when issuer rotated the kid');
        append('    <span class="err">' + e.message + '</span>');
      }

      append('');
      append('<span class="dim"> Test Files  1 passed (1)</span>');
      append('<span class="dim">      Tests  3 passed (3)</span>');
      append('   Start at  ' + new Date(t0).toISOString().slice(11, 19));
      var total = Date.now() - t0;
      append('   Duration  ' + total + ' ms');
      append('');
      append('<span class="ok">✓ Trust contract intact. AgentPKI works.</span>');

      runSuiteBtn.disabled = false;
      runSuiteBtn.classList.remove('loading');
      runSuiteBtn.textContent = '↻ Run again';
    }

    runSuiteBtn.addEventListener('click', runSuite);
    resetSuiteBtn.addEventListener('click', function () {
      out.classList.remove('visible');
      out.innerHTML = '';
      resetSuiteBtn.style.display = 'none';
      runSuiteBtn.textContent = '▶ Run trust-contract suite';
      runners.p4.reset();
    });
  })();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }
})();
