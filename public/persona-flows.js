(function () {
  // Each entry: prefix → { panel-id, steps[] }. Same script loads on all 6
  // /for-* pages; each runner guards itself so it skips silently when its
  // panel isn't in the DOM.
  var FLOWS = {
    'fa': {  // /for-agents — Bot operators
      panel: 'panel-for-agents',
      steps: [
        { title: 'Your bot, with a passport in hand',
          body: 'Your bot was issued a PASETO passport by your issuer (e.g. <code>acme.bot/v1</code>). The passport is signed with your Ed25519 key, cached in agent memory, includes an <code>intent</code> claim (purchase / monitor / scrape-bulk / …).',
          actors: ['fa-n1'], arrows: [] },
        { title: 'Bot makes an outbound HTTPS call',
          body: 'The SDK wraps your <code>fetch()</code> and attaches the passport in an <code>AgentPKI-Token</code> header plus an RFC 9421 signature on the request. Your existing code paths don\'t change.',
          actors: ['fa-n1', 'fa-n2'],
          arrows: [{ id: 'fa-a1', kind: 'active' }, { id: 'fa-l1', kind: 'active' }] },
        { title: 'Target site forwards the token to the verifier',
          body: 'The site\'s edge middleware (Cloudflare Worker, nginx module, Express middleware) extracts the token and POSTs it to <code>verify.agentpki.dev/v1/verify</code>. Signature + CRL + issuer reputation + abuse score, ~50ms.',
          actors: ['fa-n2', 'fa-n3'],
          arrows: [{ id: 'fa-a1', kind: 'success' }, { id: 'fa-l1', kind: 'success' },
                   { id: 'fa-a2', kind: 'active' }, { id: 'fa-l2', kind: 'active' }] },
        { title: 'Verifier returns allow + tier + intent_match',
          body: 'Verdict <code>allow</code>, with metadata: which issuer, what tier (typically <code>2</code> for established issuers), whether your declared intent matches site policy. Site uses this to route your traffic.',
          actors: ['fa-n3'],
          arrows: [{ id: 'fa-a1', kind: 'success' }, { id: 'fa-l1', kind: 'success' },
                   { id: 'fa-a2', kind: 'success' }, { id: 'fa-l2', kind: 'success' },
                   { id: 'fa-a3', kind: 'active' }, { id: 'fa-l3', kind: 'active' }] },
        { title: 'Site serves your bot. Audit entry written.',
          verdict: 'allow',
          body: 'Your bot gets <code>200 OK</code>. The verifier wrote an audit-log entry (hash-chained per v0.3-intent §6). You can later prove your bot accessed the site at this time, with this intent. No CAPTCHA, no IP-block, no negotiation.',
          actors: ['fa-n1', 'fa-n2', 'fa-n3', 'fa-n4'],
          arrows: [{ id: 'fa-a1', kind: 'success' }, { id: 'fa-l1', kind: 'success' },
                   { id: 'fa-a2', kind: 'success' }, { id: 'fa-l2', kind: 'success' },
                   { id: 'fa-a3', kind: 'success' }, { id: 'fa-l3', kind: 'success' }] },
      ],
    },

    'fs': {  // /for-sites — Sites & platforms
      panel: 'panel-for-sites',
      steps: [
        { title: 'Agent traffic hits your edge',
          body: 'An incoming request carries an <code>AgentPKI-Token</code> header (PASETO v4 token) + an RFC 9421 signature. Your CDN or framework middleware sees it before your application code does.',
          actors: ['fs-n1'], arrows: [] },
        { title: 'Edge middleware extracts the token',
          body: '5 lines of code: extract header, POST to the verifier. Works in Cloudflare Workers, nginx Lua, Express, Fastify, Caddy, anything. We ship reference middleware for the common stacks.',
          actors: ['fs-n1', 'fs-n2'],
          arrows: [{ id: 'fs-a1', kind: 'active' }, { id: 'fs-l1', kind: 'active' }] },
        { title: 'Verifier validates and enriches',
          body: 'Signature check → CRL check → issuer reputation tier → intent_match against your declared policy. Returns <code>{verdict, issuer, scopes, tier, intent_match, abuse_score, elapsed_ms}</code> in ~50ms p50.',
          actors: ['fs-n2', 'fs-n3'],
          arrows: [{ id: 'fs-a1', kind: 'success' }, { id: 'fs-l1', kind: 'success' },
                   { id: 'fs-a2', kind: 'active' }, { id: 'fs-l2', kind: 'active' }] },
        { title: 'Your policy maps verdict to action',
          body: 'Your <code>/.well-known/agentpki-intent-policy.json</code> declares what you accept (<code>monitor</code>: ok, <code>purchase</code>: require tier-2+, <code>scrape-bulk</code>: deny). The middleware enforces in-line.',
          actors: ['fs-n3', 'fs-n4'],
          arrows: [{ id: 'fs-a1', kind: 'success' }, { id: 'fs-l1', kind: 'success' },
                   { id: 'fs-a2', kind: 'success' }, { id: 'fs-l2', kind: 'success' },
                   { id: 'fs-a3', kind: 'active' }, { id: 'fs-l3', kind: 'active' }] },
        { title: 'Decision routed in milliseconds.',
          verdict: 'allow',
          body: 'Allow → upstream. Deny → 403. Throttle → token bucket. Captcha → challenge page. You decide. We just give you the signal — verifiable, scoped, attributable to a known issuer.',
          actors: ['fs-n1', 'fs-n2', 'fs-n3', 'fs-n4'],
          arrows: [{ id: 'fs-a1', kind: 'success' }, { id: 'fs-l1', kind: 'success' },
                   { id: 'fs-a2', kind: 'success' }, { id: 'fs-l2', kind: 'success' },
                   { id: 'fs-a3', kind: 'success' }, { id: 'fs-l3', kind: 'success' }] },
      ],
    },

    'fb': {  // /for-bot-defense — Bot-defense vendors
      panel: 'panel-for-bot-defense',
      steps: [
        { title: 'Customer site forwards request for scoring',
          body: 'Reuters or Stack Overflow or whichever customer site is using your bot-defense product. You already have signals: IP reputation, header heuristics, behavioral fingerprints, JS challenge results.',
          actors: ['fb-n1'], arrows: [] },
        { title: 'Your engine extracts AgentPKI-Token (if present)',
          body: 'New parser stage in your existing pipeline. Looks for <code>AgentPKI-Token</code> header. Absent → falls through to your existing heuristics (no behavior change). Present → enrich the request fingerprint.',
          actors: ['fb-n1', 'fb-n2'],
          arrows: [{ id: 'fb-a1', kind: 'active' }, { id: 'fb-l1', kind: 'active' }] },
        { title: 'Verifier returns a positive signal',
          body: 'Cached call to <code>verify.agentpki.dev/v1/verify</code> (5-min TTL, sub-1ms after warmup). Returns: issuer, tier, intent_match, abuse_score. <strong>This is the first positive signal you\'ve ever had for an unknown bot.</strong>',
          actors: ['fb-n2', 'fb-n3'],
          arrows: [{ id: 'fb-a1', kind: 'success' }, { id: 'fb-l1', kind: 'success' },
                   { id: 'fb-a2', kind: 'active' }, { id: 'fb-l2', kind: 'active' }] },
        { title: 'AgentPKI verdict feeds into your score',
          body: 'You stay in control: pick the weight (we suggest <code>0.40</code> for tier 2, <code>0.50</code> for tier 3). Pick the threshold. Your behavioral models, IP reputation, customer rules — all still fire.',
          actors: ['fb-n3', 'fb-n4'],
          arrows: [{ id: 'fb-a1', kind: 'success' }, { id: 'fb-l1', kind: 'success' },
                   { id: 'fb-a2', kind: 'success' }, { id: 'fb-l2', kind: 'success' },
                   { id: 'fb-a3', kind: 'active' }, { id: 'fb-l3', kind: 'active' }] },
        { title: 'Combined score → action.',
          verdict: 'allow',
          body: 'Final score includes AgentPKI as one additive signal. Customer site gets a better verdict for honest bots, same blocking for adversarial traffic. You report a new metric: "% of unknown-bot traffic now positively-attributed."',
          actors: ['fb-n1', 'fb-n2', 'fb-n3', 'fb-n4'],
          arrows: [{ id: 'fb-a1', kind: 'success' }, { id: 'fb-l1', kind: 'success' },
                   { id: 'fb-a2', kind: 'success' }, { id: 'fb-l2', kind: 'success' },
                   { id: 'fb-a3', kind: 'success' }, { id: 'fb-l3', kind: 'success' }] },
      ],
    },

    'fp': {  // /for-publishers — Content publishers
      panel: 'panel-for-publishers',
      steps: [
        { title: 'Your CMS publishes an article',
          body: 'Whatever your stack — WordPress, Ghost, Sanity, Substack, a custom CMS. The article is rendered and ready to go live. One extra step in your publish hook.',
          actors: ['fp-n1'], arrows: [] },
        { title: 'CMS calls signing.agentpki.dev',
          body: 'POST the content bytes + your issuer subdomain. We hold your Ed25519 key (encrypted at rest), sign a C2PA-compatible manifest. ~80ms. No key handling on your side.',
          actors: ['fp-n1', 'fp-n2'],
          arrows: [{ id: 'fp-a1', kind: 'active' }, { id: 'fp-l1', kind: 'active' }] },
        { title: 'Signed manifest returned',
          body: 'Two delivery formats: <code>Content-Provenance</code> HTTP header on the article URL, AND a sidecar at <code>article-url + .provenance.json</code>. Both reference the same signed manifest.',
          actors: ['fp-n2', 'fp-n3'],
          arrows: [{ id: 'fp-a1', kind: 'success' }, { id: 'fp-l1', kind: 'success' },
                   { id: 'fp-a2', kind: 'active' }, { id: 'fp-l2', kind: 'active' }] },
        { title: 'Article published with provenance',
          body: 'Google, Bing, Perplexity, OpenAI search, every aggregator that\'s integrated AgentPKI Provenance reads the manifest. They verify in milliseconds. Your byline becomes cryptographic, not just textual.',
          actors: ['fp-n3', 'fp-n4'],
          arrows: [{ id: 'fp-a1', kind: 'success' }, { id: 'fp-l1', kind: 'success' },
                   { id: 'fp-a2', kind: 'success' }, { id: 'fp-l2', kind: 'success' },
                   { id: 'fp-a3', kind: 'active' }, { id: 'fp-l3', kind: 'active' }] },
        { title: 'Verified attribution. Ranking lift. Provable ownership.',
          verdict: 'allow',
          body: 'When an AI farm clones your content, their version fails provenance verification (no valid signature from your issuer). Aggregators show your original as canonical. Disputes resolve in seconds, not weeks of DMCA back-and-forth.',
          actors: ['fp-n1', 'fp-n2', 'fp-n3', 'fp-n4'],
          arrows: [{ id: 'fp-a1', kind: 'success' }, { id: 'fp-l1', kind: 'success' },
                   { id: 'fp-a2', kind: 'success' }, { id: 'fp-l2', kind: 'success' },
                   { id: 'fp-a3', kind: 'success' }, { id: 'fp-l3', kind: 'success' }] },
      ],
    },

    'fc': {  // /for-compliance — AI compliance
      panel: 'panel-for-compliance',
      steps: [
        { title: 'Your AI generates or accesses something',
          body: 'A customer-facing LLM generates a response, an internal agent scrapes a competitor\'s pricing, an autonomous workflow places a purchase. Every one of these is a regulator-relevant event under EU AI Act / China AIGC / US state laws.',
          actors: ['fc-n1'], arrows: [] },
        { title: 'Provenance signing fires automatically',
          body: 'For generated content: <code>signing.agentpki.dev</code> embeds a Content-Provenance manifest. For accessed content / actions: the passport already carries an <code>intent</code> claim. Either way, the event is now cryptographic.',
          actors: ['fc-n1', 'fc-n2'],
          arrows: [{ id: 'fc-a1', kind: 'active' }, { id: 'fc-l1', kind: 'active' }] },
        { title: 'Hash-chained audit entry written',
          body: 'The intent audit log (v0.3-intent §6) is append-only, RFC 6962-inspired, public. Every entry is hash-linked to the previous one. You can\'t go back and rewrite history; auditors can verify integrity.',
          actors: ['fc-n2', 'fc-n3'],
          arrows: [{ id: 'fc-a1', kind: 'success' }, { id: 'fc-l1', kind: 'success' },
                   { id: 'fc-a2', kind: 'active' }, { id: 'fc-l2', kind: 'active' }] },
        { title: 'Compliance dashboard ingests in real time',
          body: 'Atom feed + JSON webhook delivery. Dashboard indexes by issuer, intent type, target site, timestamp. Filter, query, slice for whichever disclosure framework you need.',
          actors: ['fc-n3', 'fc-n4'],
          arrows: [{ id: 'fc-a1', kind: 'success' }, { id: 'fc-l1', kind: 'success' },
                   { id: 'fc-a2', kind: 'success' }, { id: 'fc-l2', kind: 'success' },
                   { id: 'fc-a3', kind: 'active' }, { id: 'fc-l3', kind: 'active' }] },
        { title: 'Disclosure obligation met.',
          verdict: 'allow',
          body: 'Per EU AI Act Article 50: machine-readable content attribution. Per China AIGC rules: signed labeling. Per US state laws: provable disclosure. AgentPKI Provenance produces all three formats from the same cryptographic record.',
          actors: ['fc-n1', 'fc-n2', 'fc-n3', 'fc-n4'],
          arrows: [{ id: 'fc-a1', kind: 'success' }, { id: 'fc-l1', kind: 'success' },
                   { id: 'fc-a2', kind: 'success' }, { id: 'fc-l2', kind: 'success' },
                   { id: 'fc-a3', kind: 'success' }, { id: 'fc-l3', kind: 'success' }] },
      ],
    },

    'fe': {  // /for-everyone — Everyone else
      panel: 'panel-for-everyone',
      steps: [
        { title: 'Something arrives in your inbox or feed',
          body: 'An email claiming to be from your bank. A news article. A DM from "support". An agent calling on your behalf. Some are real; some are AI farms. You can\'t tell from the surface.',
          actors: ['fe-n1'], arrows: [] },
        { title: 'You paste it into agentpki.dev/check',
          body: 'Web verifier, no signup. Paste a token, paste an article URL, drop a screenshot. Heuristic checks + cryptographic verification of any embedded AgentPKI passport.',
          actors: ['fe-n1', 'fe-n2'],
          arrows: [{ id: 'fe-a1', kind: 'active' }, { id: 'fe-l1', kind: 'active' }] },
        { title: 'Verifier walks the chain',
          body: 'Signature checks against the claimed issuer\'s public key. Issuer\'s reputation history. Abuse reports. Tier. Whether the agent\'s declared intent matches what the message actually does.',
          actors: ['fe-n2', 'fe-n3'],
          arrows: [{ id: 'fe-a1', kind: 'success' }, { id: 'fe-l1', kind: 'success' },
                   { id: 'fe-a2', kind: 'active' }, { id: 'fe-l2', kind: 'active' }] },
        { title: 'Result: ✓ Verified or ⚠ Unverified',
          body: 'Green: signature checks out, issuer is in good standing. Red: revoked, fraud-flagged, or signature missing. Yellow: no passport, treat with caution. The result is shareable — paste the link to warn others.',
          actors: ['fe-n3', 'fe-n4'],
          arrows: [{ id: 'fe-a1', kind: 'success' }, { id: 'fe-l1', kind: 'success' },
                   { id: 'fe-a2', kind: 'success' }, { id: 'fe-l2', kind: 'success' },
                   { id: 'fe-a3', kind: 'active' }, { id: 'fe-l3', kind: 'active' }] },
        { title: 'You make an informed trust decision.',
          verdict: 'allow',
          body: 'Click the link or report the scam. Trust the article or look for the original. Hand over money or close the tab. AgentPKI doesn\'t make the decision for you — it gives you the evidence that today is invisible.',
          actors: ['fe-n1', 'fe-n2', 'fe-n3', 'fe-n4'],
          arrows: [{ id: 'fe-a1', kind: 'success' }, { id: 'fe-l1', kind: 'success' },
                   { id: 'fe-a2', kind: 'success' }, { id: 'fe-l2', kind: 'success' },
                   { id: 'fe-a3', kind: 'success' }, { id: 'fe-l3', kind: 'success' }] },
      ],
    },
  };

  function makeRunner(prefix, flow) {
    var state = { idx: -1, playing: false, timer: null };
    var panel = '#' + flow.panel;
    var titleEl = document.getElementById(prefix + '-title');
    var stepEl = document.getElementById(prefix + '-step');
    var bodyEl = document.getElementById(prefix + '-body');
    var progressEl = document.getElementById(prefix + '-progress');
    var playBtn = document.getElementById(prefix + '-play');
    var stepBtn = document.getElementById(prefix + '-step-btn');
    var resetBtn = document.getElementById(prefix + '-reset');
    var steps = flow.steps;

    // Safety guard: skip silently when this runner's panel isn't on the page.
    // Lets the same persona-flows.js load on /for-agents (only fa runner),
    // /for-sites (only fs runner), etc. without throwing.
    if (!playBtn || !stepBtn || !resetBtn || !titleEl) return;

    function clearAll() {
      document.querySelectorAll(panel + ' .actor').forEach(a => a.classList.remove('active', 'success'));
      document.querySelectorAll(panel + ' .arrow').forEach(a => a.classList.remove('active', 'success'));
      document.querySelectorAll(panel + ' .label').forEach(l => l.classList.remove('active', 'success'));
    }
    function applyStep(i) {
      clearAll();
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
      bodyEl.innerHTML = 'Click <strong>Play</strong> for the passive walkthrough, or <strong>Step</strong> through manually.';
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

  Object.keys(FLOWS).forEach(function (k) { makeRunner(k, FLOWS[k]); });
})();
