/*! AgentPKI verification badge widget. MIT. https://github.com/agentpki/web
 *
 * Drop on any third-party page:
 *   <div data-agentpki-verify="<passport-token-or-id>"></div>
 *   <script src="https://agentpki.dev/widget.js" async></script>
 *
 * Per-element attributes:
 *   data-agentpki-size   small | medium | large   (default: medium)
 *   data-agentpki-theme  light | dark | auto      (default: auto)
 *
 * The widget is self-contained: shadow DOM, no global CSS leaks, no
 * framework dependencies. Each badge makes one POST to verify.agentpki.dev/v1/verify
 * and renders the verdict. Clicking the badge opens a permalink at
 * agentpki.dev/check/result/<id> in a new tab when a snapshot was stored.
 */
(function () {
  if (window.__AGENTPKI_WIDGET_LOADED__) return;
  window.__AGENTPKI_WIDGET_LOADED__ = true;

  var BASE = 'https://verify.agentpki.dev';
  var CHECK_PAGE = 'https://agentpki.dev/check';

  function classify(r) {
    if (!r) return 'unverified';
    if (r.verdict === 'allow') return 'verified';
    if (r.verdict === 'deny') {
      var s = (r.failure_reason || '');
      if (/revok|expired|malformed|signature_invalid|sig_invalid|no_issuer_key/i.test(s)) return 'revoked';
      return 'unverified';
    }
    return 'unverified';
  }

  function detectTheme(attr) {
    if (attr === 'light' || attr === 'dark') return attr;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  var CSS = [
    ':host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:inline-block;}',
    'a{all:unset;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid;cursor:pointer;transition:opacity .15s,transform .15s;text-decoration:none;font-size:12px;font-weight:600;line-height:1;font-family:inherit;}',
    'a:hover{opacity:.85;transform:translateY(-1px);}',
    '.dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;}',
    '.lbl{}',
    '.detail{font-weight:400;opacity:.7;margin-left:6px;font-size:11px;}',
    // Sizes
    '.size-small a{padding:3px;}',
    '.size-small .lbl,.size-small .detail{display:none;}',
    '.size-medium a{padding:4px 10px;}',
    '.size-medium .detail{display:none;}',
    '.size-large a{padding:8px 14px;font-size:13px;flex-direction:column;align-items:flex-start;border-radius:8px;min-width:200px;}',
    '.size-large .lbl{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;}',
    '.size-large .detail{display:block;margin-left:0;margin-top:4px;font-size:11px;}',
    // Light theme
    '.theme-light a.state-verified{background:#f0fdf4;border-color:#86efac;color:#15803d;}',
    '.theme-light a.state-verified .dot{background:#22c55e;}',
    '.theme-light a.state-revoked{background:#fef2f2;border-color:#fca5a5;color:#b91c1c;}',
    '.theme-light a.state-revoked .dot{background:#ef4444;}',
    '.theme-light a.state-unverified{background:#fffbeb;border-color:#fcd34d;color:#a16207;}',
    '.theme-light a.state-unverified .dot{background:#f59e0b;}',
    '.theme-light a.state-loading{background:#f3f4f6;border-color:#d1d5db;color:#6b7280;}',
    '.theme-light a.state-loading .dot{background:#9ca3af;}',
    '.theme-light a.state-error{background:#fef2f2;border-color:#fca5a5;color:#b91c1c;}',
    '.theme-light a.state-error .dot{background:#ef4444;}',
    // Dark theme
    '.theme-dark a.state-verified{background:rgba(34,197,94,.12);border-color:rgba(74,222,128,.5);color:#86efac;}',
    '.theme-dark a.state-verified .dot{background:#22c55e;}',
    '.theme-dark a.state-revoked{background:rgba(239,68,68,.12);border-color:rgba(248,113,113,.5);color:#fca5a5;}',
    '.theme-dark a.state-revoked .dot{background:#ef4444;}',
    '.theme-dark a.state-unverified{background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.5);color:#fcd34d;}',
    '.theme-dark a.state-unverified .dot{background:#f59e0b;}',
    '.theme-dark a.state-loading{background:rgba(107,107,120,.12);border-color:rgba(107,107,120,.4);color:#a1a1aa;}',
    '.theme-dark a.state-loading .dot{background:#71717a;}',
    '.theme-dark a.state-error{background:rgba(239,68,68,.12);border-color:rgba(248,113,113,.5);color:#fca5a5;}',
    '.theme-dark a.state-error .dot{background:#ef4444;}',
    // Loading dot pulse
    'a.state-loading .dot{animation:agpulse 1.2s ease-in-out infinite;}',
    '@keyframes agpulse{0%,100%{opacity:.4;}50%{opacity:1;}}',
  ].join('');

  function labelFor(state) {
    if (state === 'verified') return ['✓', 'Verified', 'AgentPKI passport valid'];
    if (state === 'revoked') return ['⛔', 'Revoked', 'Do not trust this agent'];
    if (state === 'unverified') return ['!', 'Unverified', 'No AgentPKI passport found'];
    if (state === 'loading') return ['·', 'Verifying…', 'Checking AgentPKI'];
    return ['×', 'Error', 'Verification check failed'];
  }

  function render(host, state, href) {
    var size = host.getAttribute('data-agentpki-size') || 'medium';
    var theme = detectTheme(host.getAttribute('data-agentpki-theme') || 'auto');
    var lab = labelFor(state);
    if (!host.shadowRoot) host.attachShadow({ mode: 'open' });
    host.shadowRoot.innerHTML =
      '<style>' + CSS + '</style>' +
      '<div class="size-' + size + ' theme-' + theme + '">' +
        '<a class="state-' + state + '"' + (href ? ' href="' + href + '" target="_blank" rel="noopener noreferrer"' : '') + ' role="img" aria-label="AgentPKI ' + state + '">' +
          '<span class="dot" aria-hidden="true"></span>' +
          '<span class="lbl">' + lab[1] + '</span>' +
          '<span class="detail">' + lab[2] + '</span>' +
        '</a>' +
      '</div>';
  }

  function verifyOne(host) {
    var token = host.getAttribute('data-agentpki-verify');
    if (!token) return;
    render(host, 'loading');

    var looksLikeToken = /^v4\.public\.[A-Za-z0-9._-]+$/.test(token);
    if (!looksLikeToken) {
      // Identifier, not a token — render unverified with a link to the public check page
      render(host, 'unverified', CHECK_PAGE + '?q=' + encodeURIComponent(token));
      return;
    }

    fetch(BASE + '/v1/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: token }),
    })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        var state = classify(body);
        // Best-effort: store snapshot for sharing; ignore failures.
        fetch(BASE + '/v1/verification/store', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: token, result: body, ttl_seconds: 86400 }),
        }).then(function (sr) {
          if (!sr.ok) { render(host, state, CHECK_PAGE + '?q=' + encodeURIComponent(token)); return; }
          return sr.json().then(function (sb) {
            render(host, state, 'https://agentpki.dev/check/result/' + sb.id);
          });
        }).catch(function () {
          render(host, state, CHECK_PAGE + '?q=' + encodeURIComponent(token));
        });
      })
      .catch(function () { render(host, 'error', CHECK_PAGE + '?q=' + encodeURIComponent(token)); });
  }

  function scan() {
    var nodes = document.querySelectorAll('[data-agentpki-verify]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].__agentpki_done) continue;
      nodes[i].__agentpki_done = true;
      verifyOne(nodes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Re-scan when SPA frameworks add new badges
  if (window.MutationObserver) {
    var obs = new MutationObserver(function () { scan(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Web Component API — <agentpki-verify token="..." size="..." theme="...">
  //
  // Reuses the same render/verify pipeline as the data-attribute version
  // above. The component exposes a clean DOM API:
  //   <agentpki-verify token="v4.public.AAA.BBB" size="large" theme="dark">
  //   document.querySelector('agentpki-verify').setAttribute('token', '...')
  //
  // Why both APIs? data-attribute is the no-build path (any HTML page).
  // The custom element is the framework path (React/Vue/Svelte love it).
  // ─────────────────────────────────────────────────────────────────────────
  if (typeof window.customElements !== 'undefined' && !window.customElements.get('agentpki-verify')) {
    function AgentpkiVerify() {
      return Reflect.construct(HTMLElement, [], AgentpkiVerify);
    }
    AgentpkiVerify.prototype = Object.create(HTMLElement.prototype);
    AgentpkiVerify.prototype.constructor = AgentpkiVerify;

    AgentpkiVerify.observedAttributes = ['token', 'size', 'theme'];
    Object.defineProperty(AgentpkiVerify, 'observedAttributes', {
      get: function () { return ['token', 'size', 'theme']; }
    });

    // Bridge custom-element attrs → the existing data-* render path, so we
    // get one rendering codepath. We mirror token→data-agentpki-verify, etc.
    AgentpkiVerify.prototype._sync = function () {
      var token = this.getAttribute('token') || '';
      var size = this.getAttribute('size') || 'medium';
      var theme = this.getAttribute('theme') || 'auto';
      this.setAttribute('data-agentpki-verify', token);
      this.setAttribute('data-agentpki-size', size);
      this.setAttribute('data-agentpki-theme', theme);
      this.__agentpki_done = false;
      if (token) verifyOne(this);
    };

    AgentpkiVerify.prototype.connectedCallback = function () { this._sync(); };
    AgentpkiVerify.prototype.attributeChangedCallback = function (name, oldV, newV) {
      if (oldV === newV) return;
      this._sync();
    };

    // Modern class-syntax friendly:
    try {
      var AgentpkiVerifyClass = class extends HTMLElement {
        static get observedAttributes() { return ['token', 'size', 'theme']; }
        connectedCallback() { this._sync(); }
        attributeChangedCallback(_n, o, n) { if (o !== n) this._sync(); }
        _sync() {
          var token = this.getAttribute('token') || '';
          var size = this.getAttribute('size') || 'medium';
          var theme = this.getAttribute('theme') || 'auto';
          this.setAttribute('data-agentpki-verify', token);
          this.setAttribute('data-agentpki-size', size);
          this.setAttribute('data-agentpki-theme', theme);
          this.__agentpki_done = false;
          if (token) verifyOne(this);
        }
      };
      window.customElements.define('agentpki-verify', AgentpkiVerifyClass);
    } catch (_e) {
      // Legacy fallback (pre-class CE)
      try { window.customElements.define('agentpki-verify', AgentpkiVerify); } catch (_ee) {}
    }
  }
})();
