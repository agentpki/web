  (function () {
    const $ = (id) => document.getElementById(id);
    const DEMO_ISSUER = 'https://demo.agentpki.dev';
    const VERIFIER = 'https://verify.agentpki.dev';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    // ───── Path-card accordion ─────
    // When the user opens any [data-path-teaser] details, close all the
    // others so only one path is expanded at a time. The `data-path-teaser`
    // attribute scopes this to the 4 path cards specifically — nested
    // details inside any path (data flow toggles, deny labs, etc.) are
    // unaffected because they don't carry the attribute.
    (function pathAccordion() {
      const teasers = document.querySelectorAll('details[data-path-teaser]');
      let suppress = false;  // guard against re-entry while we programmatically close peers
      teasers.forEach(t => {
        t.addEventListener('toggle', () => {
          if (suppress) return;
          if (!t.open) return;            // only react when this one OPENS
          suppress = true;
          teasers.forEach(other => {
            if (other !== t && other.open) other.open = false;
          });
          // Scroll the newly-opened path into view. Honor reduced-motion.
          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          t.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
          suppress = false;
        });
      });
    })();

    // ───── PATH 01 — subdomain → mint → verify ─────
    const p1Handle = $('p1-handle');
    const p1Preview = $('p1-preview');
    let p1Token = null;

    function p1Sanitize(v) {
      return String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
    }
    function p1UpdatePreview() {
      const v = p1Sanitize(p1Handle && p1Handle.value);
      p1Preview.textContent = (v ? v : '_____') + '.agents.agentpki.dev';
    }
    p1UpdatePreview();
    if (p1Handle) p1Handle.addEventListener('input', p1UpdatePreview);

    function markStepDone(n) {
      const el = $('p1-step-num-' + n);
      if (el) { el.classList.add('done'); el.textContent = '✓'; }
    }

    $('p1-claim') && $('p1-claim').addEventListener('click', () => {
      const handle = p1Sanitize(p1Handle.value);
      if (!handle) { p1Handle.focus(); return; }
      const btn = $('p1-claim');
      btn.disabled = true;
      btn.textContent = '✓ Claimed';
      markStepDone(1);
      $('p1-mint').disabled = false;
      $('p1-mint').focus();
    });

    $('p1-mint') && $('p1-mint').addEventListener('click', async () => {
      const handle = p1Sanitize(p1Handle.value) || 'hn-user';
      const btn = $('p1-mint');
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'minting…';
      try {
        const r = await fetch(DEMO_ISSUER + '/mint?sub=' + encodeURIComponent('agent:' + handle + '/v1')).then(r => r.json());
        p1Token = r.token;
        btn.textContent = '✓ Minted';
        markStepDone(2);

        // Reveal the token box with the token itself + length
        $('p1-token-display').textContent = p1Token;
        $('p1-token-length').textContent = p1Token.length.toLocaleString();
        $('p1-token-box').style.display = 'block';

        // Reveal both verify options
        $('p1-curl-box').style.display = 'block';
        $('p1-onpage-box').style.display = 'block';

        // Build the bash + PowerShell commands with the real freshly-minted token
        const bashCmd =
          "curl -X POST https://verify.agentpki.dev/v1/verify \\\n" +
          "    -H 'content-type: application/json' \\\n" +
          "    -d '{\"token\":\"" + p1Token + "\"}'";
        const psCmd =
          "$body = '{\"token\":\"" + p1Token + "\"}'\n" +
          "Invoke-RestMethod -Method POST -Uri 'https://verify.agentpki.dev/v1/verify' `\n" +
          "    -ContentType 'application/json' -Body $body";
        $('p1-curl-cmd-bash').textContent = bashCmd;
        $('p1-curl-cmd-ps').textContent = psCmd;

        // Verify button stays disabled until user pastes a token (option B)
        const verifyInput = $('p1-verify-input');
        if (verifyInput) verifyInput.value = '';
        $('p1-verify').disabled = true;
        $('p1-verdict').className = 'verdict-pill idle';
        $('p1-verdict').textContent = 'waiting for token';

        // Scroll the token into view so the user sees what just happened
        setTimeout(() => $('p1-token-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = old;
        alert('mint failed: ' + (e.message || e));
      }
    });

    // Copy the raw token to clipboard
    $('p1-token-copy') && $('p1-token-copy').addEventListener('click', async () => {
      if (!p1Token) return;
      try {
        await navigator.clipboard.writeText(p1Token);
        const btn = $('p1-token-copy'); const old = btn.textContent;
        btn.textContent = '✓ Token copied';
        setTimeout(() => btn.textContent = old, 1800);
      } catch {}
    });

    // Copy the curl/PowerShell command (with token baked in) to clipboard.
    // There are 2 copy buttons (one per shell tab) — each pulls from its sibling <pre>.
    document.querySelectorAll('.p1-curl-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const shell = btn.dataset.shell || 'bash';
        const cmd = (shell === 'ps' ? $('p1-curl-cmd-ps') : $('p1-curl-cmd-bash')).textContent;
        if (!cmd) return;
        try {
          await navigator.clipboard.writeText(cmd);
          const old = btn.textContent;
          btn.textContent = '✓ Copied — paste it in your terminal';
          setTimeout(() => btn.textContent = old, 2500);
        } catch {}
      });
    });

    // Shell-tab switching (bash / PowerShell)
    document.querySelectorAll('.shell-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.shell;
        document.querySelectorAll('.shell-tab').forEach(t => t.classList.toggle('active', t.dataset.shell === target));
        document.querySelectorAll('.shell-panel').forEach(p => p.classList.toggle('active', p.dataset.shellPanel === target));
      });
    });

    // Auto-select the right shell tab based on platform. Two separate tab
    // groups exist (Path 01 verify step uses `bash`/`ps`; Path 03 bootstrap
    // uses `p3-bash`/`p3-ps`), so handle each. This stops Windows users from
    // copy-pasting bash curl and hitting "term '$' is not recognized".
    (function autoSelectShell() {
      const ua = navigator.userAgent || '';
      const isWindows = /Windows/i.test(ua);
      if (!isWindows) return;  // bash tab is already the default; nothing to do on mac/linux

      const switchTo = (shell) => {
        document.querySelectorAll(`.shell-tab[data-shell="${shell}"]`).forEach(t => {
          // peers in the same .shell-tab-row
          const row = t.closest('.shell-tab-row');
          if (row) row.querySelectorAll('.shell-tab').forEach(s => s.classList.remove('active'));
          t.classList.add('active');
        });
        document.querySelectorAll(`.shell-panel[data-shell-panel="${shell}"]`).forEach(p => {
          // peers in the same .demo-step-body
          const body = p.parentElement;
          if (body) body.querySelectorAll('.shell-panel').forEach(s => s.classList.remove('active'));
          p.classList.add('active');
        });
      };

      switchTo('ps');      // Path 01 verify
      switchTo('p3-ps');   // Path 03 bootstrap

      // Show a small "detected: Windows" hint banner above each tab row so the
      // user understands WHY PowerShell is preselected.
      document.querySelectorAll('.shell-tab-row').forEach(row => {
        if (row.previousElementSibling && row.previousElementSibling.classList.contains('platform-hint')) return;
        const hint = document.createElement('div');
        hint.className = 'platform-hint';
        hint.style.cssText = 'font-family: ui-monospace, monospace; font-size: 0.66rem; letter-spacing: 0.08em; color: #6ee7b7; margin-bottom: 0.45rem;';
        hint.innerHTML = 'Detected: <strong>Windows</strong> &mdash; PowerShell tab pre-selected. Click <strong>bash</strong> if you&rsquo;re on WSL or piping over SSH.';
        row.parentElement.insertBefore(hint, row);
      });
    })();

    // Paste-and-verify: enable the Verify button only when something paste-able is in the textarea
    const verifyInputEl = $('p1-verify-input');
    if (verifyInputEl) {
      verifyInputEl.addEventListener('input', () => {
        const v = verifyInputEl.value.trim();
        const looksLikeToken = /^v4\.public\.[A-Za-z0-9._\-]+$/.test(v);
        const verdict = $('p1-verdict');
        if (looksLikeToken) {
          $('p1-verify').disabled = false;
          verdict.className = 'verdict-pill work';
          verdict.textContent = 'token ready';
        } else if (v.length === 0) {
          $('p1-verify').disabled = true;
          verdict.className = 'verdict-pill idle';
          verdict.textContent = 'waiting for token';
        } else {
          $('p1-verify').disabled = true;
          verdict.className = 'verdict-pill idle';
          verdict.textContent = 'not a v4.public token';
        }
      });
    }

    // Prefill button — paste in the token they just minted, for the lazy path
    $('p1-verify-prefill') && $('p1-verify-prefill').addEventListener('click', () => {
      if (!p1Token || !verifyInputEl) return;
      verifyInputEl.value = p1Token;
      verifyInputEl.dispatchEvent(new Event('input', { bubbles: true }));
      verifyInputEl.focus();
      const btn = $('p1-verify-prefill'); const old = btn.textContent;
      btn.textContent = '✓ Pasted — click Verify';
      setTimeout(() => btn.textContent = old, 1800);
    });

    $('p1-verify') && $('p1-verify').addEventListener('click', async () => {
      // Pull the token from whatever the user has pasted in the textarea.
      // This is the engaging part — they hand it over with their own hands.
      const pastedToken = ($('p1-verify-input') && $('p1-verify-input').value.trim()) || '';
      if (!pastedToken) return;
      const btn = $('p1-verify');
      const verdictPill = $('p1-verdict');
      btn.disabled = true;
      btn.textContent = 'verifying…';
      verdictPill.className = 'verdict-pill work';
      verdictPill.textContent = '… verifying';
      try {
        const r = await fetch(VERIFIER + '/v1/verify', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: pastedToken }),
        }).then(r => r.json());
        const v = r.verdict || 'unknown';
        const ms = r.elapsed_ms || '?';
        if (v === 'allow') {
          verdictPill.className = 'verdict-pill allow';
          verdictPill.textContent = '✓ allow · ' + ms + 'ms';

          // ── Populate the structured success panel ──
          const p = r.passport || {};
          $('p1-success-ms').textContent = ms;
          $('p1-success-issuer').textContent = p.issuer || '—';
          $('p1-success-agent').textContent = p.agent_id || '—';
          $('p1-success-scopes').textContent = Array.isArray(p.scopes) ? p.scopes.join(', ') : (p.scopes || '—');
          $('p1-success-tier').textContent = (typeof p.tier === 'number' ? p.tier : '—');
          $('p1-success-abuse').textContent = (typeof r.abuse_score === 'number' ? r.abuse_score.toFixed(2) : '0.00');
          $('p1-success-elapsed').textContent = ms + ' ms';
          $('p1-result-body').textContent = JSON.stringify(r, null, 2);

          // Tweet intent
          const tweet = encodeURIComponent('I just got my AI agent verified end-to-end on https://agentpki.dev — open-source cryptographic identity for AI agents. Open standard, in-browser flow, <50ms verify p99.');
          $('p1-success-tweet').href = 'https://twitter.com/intent/tweet?text=' + tweet;

          // Try to store a permalink (best-effort, non-blocking)
          const handle = (p1Handle.value || 'hn-user').toLowerCase().replace(/[^a-z0-9-]/g,'') || 'hn-user';
          fetch(VERIFIER + '/v1/verification/store', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ input: 'agent:' + handle + '/v1', result: r, ttl_seconds: 86400 }),
          }).then(r2 => r2.ok ? r2.json() : null).then(stored => {
            if (stored && stored.id) {
              $('p1-success-permalink').href = 'https://agentpki.dev/check/result/' + stored.id;
            } else {
              $('p1-success-permalink').href = 'https://agentpki.dev/check?q=' + encodeURIComponent(p1Token);
            }
          }).catch(() => {
            $('p1-success-permalink').href = 'https://agentpki.dev/check?q=' + encodeURIComponent(p1Token);
          });

          // Reveal the panel
          $('p1-success-panel').style.display = 'block';
          $('p1-success-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          verdictPill.className = 'verdict-pill';
          verdictPill.style.background = 'rgba(239,68,68,0.2)';
          verdictPill.style.color = '#fecaca';
          verdictPill.style.borderColor = '#f87171';
          verdictPill.textContent = '⛔ ' + v;
          alert('Got a deny verdict — that means the demo issuer rotated its key or something unusual happened. Reason: ' + (r.failure_reason || 'unknown'));
        }
        btn.textContent = '✓ Verified';
        markStepDone(3);
        $('p1-done').style.display = 'block';
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Verify it →';
        verdictPill.className = 'verdict-pill idle';
        verdictPill.textContent = 'failed';
        alert('verify failed: ' + (e.message || e));
      }
    });

    // Show / hide raw response toggle
    $('p1-success-raw-toggle') && $('p1-success-raw-toggle').addEventListener('click', () => {
      const pre = $('p1-result-body');
      const btn = $('p1-success-raw-toggle');
      if (pre.style.display === 'none' || pre.style.display === '') {
        pre.style.display = 'block';
        btn.textContent = 'Hide raw response';
      } else {
        pre.style.display = 'none';
        btn.textContent = 'Show raw verifier response';
      }
    });

    // ───── PATH 03 — bootstrap copy buttons (endpoints LIVE). ─────
    // Copies ONLY the command — the prompt marker (`$ ` / `PS> `) is stripped,
    // so users can never paste `PS> iwr ...` and hit "term not recognized".
    document.querySelectorAll('.p3-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const shell = btn.dataset.shell || 'p3-bash';
        const cmd = shell === 'p3-ps'
          ? 'iwr https://agentpki.dev/bootstrap.ps1 | iex'
          : 'curl -fsSL https://agentpki.dev/bootstrap | sh';
        try {
          await navigator.clipboard.writeText(cmd);
          const old = btn.textContent;
          btn.textContent = '✓ Copied — paste in your terminal';
          setTimeout(() => { btn.textContent = old; }, 2000);
        } catch {}
      });
    });

    // ───── PATH 01 Step 4 — interactive tamper + revoked-key demos ─────
    // Both buttons do REAL HTTP round-trips against the live infra:
    //   tamper:  GET /mint → flip last 4 chars of parts[2] → POST /v1/verify
    //   revoked: GET /mint?revoked=1 → POST /v1/verify
    // No fakery. The verdict, failure_reason, failure_detail, elapsed_ms
    // shown all come straight from the verifier's actual response body.

    const escapeHtml = (s) => String(s ?? '—').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const renderDenyCard = (result, title, description) => {
      const verdict = result.verdict || 'unknown';
      const reason = result.failure_reason || '—';
      const detail = result.failure_detail || '';
      const elapsed = (typeof result.elapsed_ms === 'number') ? result.elapsed_ms : '—';
      const detailRow = detail ? `
        <div class="deny-field" style="grid-column: 1 / -1;">
          <div class="deny-label">Failure detail (from verifier)</div>
          <div class="deny-value"><code>${escapeHtml(detail)}</code></div>
        </div>` : '';
      return `
        <div class="deny-card">
          <div class="deny-banner">
            <div class="deny-banner-main">verdict: ${escapeHtml(verdict)} &middot; ${escapeHtml(reason)}</div>
            <div class="deny-banner-sub">${escapeHtml(description)}</div>
          </div>
          <div class="deny-grid">
            <div class="deny-field">
              <div class="deny-label">failure_reason</div>
              <div class="deny-value"><code>${escapeHtml(reason)}</code></div>
            </div>
            <div class="deny-field">
              <div class="deny-label">verifier elapsed_ms</div>
              <div class="deny-value">${escapeHtml(elapsed)} ms</div>
            </div>
            ${detailRow}
          </div>
          <pre class="deny-raw">${escapeHtml(JSON.stringify(result, null, 2))}</pre>
        </div>`;
    };

    const runFailureDemo = async (btnId, resultId, scenarioName, fetchTokenFn) => {
      const btn = document.getElementById(btnId);
      const out = document.getElementById(resultId);
      if (!btn || !out) return;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Running real HTTP calls...';
      out.style.display = 'block';
      out.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.85rem;">Calling demo issuer + live verifier...</p>';
      try {
        const { token, description } = await fetchTokenFn();
        if (!token) throw new Error('issuer returned no token');
        const verifyRes = await fetch('https://verify.agentpki.dev/v1/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const result = await verifyRes.json();
        out.innerHTML = renderDenyCard(result, scenarioName, description);
        btn.textContent = 'Run again';
      } catch (e) {
        out.innerHTML = `<p style="color: #fca5a5; font-size: 0.85rem;">Error: ${escapeHtml(e.message || e)}</p>`;
        btn.textContent = original;
      } finally {
        btn.disabled = false;
      }
    };

    // ───── 3-stage Tamper Lab + Revoked-Key Lab ─────
    // The lab gives the user agency at each step:
    //   A: mint (they fetch a real token)
    //   B: choose (they pick what to corrupt / which kid)
    //   C: send (they hit verify; the deny is the consequence of their choice)
    // No simulation. Every panel value comes from a real HTTP call.

    // --- helpers shared by both labs --------------------------------------
    function labSetStage(labKey, stage, state) {
      // labKey: 't' or 'r'; stage: 'A' | 'B' | 'C'; state: 'locked' | 'active' | 'done'
      const el = document.getElementById(`lab-${labKey}-${stage}`);
      if (!el) return;
      el.classList.remove('locked', 'active', 'done');
      el.classList.add(state);
    }
    function labStatus(id, html) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    }
    // base64url decode → returns the raw byte string (Latin-1 / binary)
    function b64uDecode(s) {
      let t = s.replace(/-/g, '+').replace(/_/g, '/');
      while (t.length % 4) t += '=';
      try { return atob(t); } catch { return ''; }
    }
    // Decode the PASETO v4.public token's payload JSON.
    // parts[2] is base64url(payload_bytes || ed25519_sig_64_bytes).
    // Return parsed JSON object (or null if undecodable).
    function decodePayload(tokenStr) {
      try {
        const parts = tokenStr.split('.');
        const raw = b64uDecode(parts[2]);
        const payloadBin = raw.slice(0, -64);  // strip 64-byte signature
        const bytes = Uint8Array.from(payloadBin, c => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch { return null; }
    }
    // Render the 4-part token as color-coded HTML. Optionally highlight a
    // section [partIdx, startChar, endChar] as a diff: original chars
    // struck-through red, new chars (always 'AAAA') in yellow.
    function renderTokenView(targetId, tokenStr, diff) {
      const el = document.getElementById(targetId);
      if (!el) return;
      const parts = tokenStr.split('.');
      const cls = ['tok-v', 'tok-purpose', 'tok-payload', 'tok-footer'];
      el.style.display = 'block';
      el.innerHTML = parts.map((p, i) => {
        if (diff && diff.partIdx === i) {
          const head = escapeHtml(p.slice(0, diff.start));
          const orig = escapeHtml(diff.orig);
          const tail = escapeHtml(p.slice(diff.end));
          return `<span class="${cls[i]}">${head}</span><span class="tok-orig">${orig}</span><span class="tok-new">AAAA</span><span class="${cls[i]}">${tail}</span>`;
        }
        return `<span class="${cls[i]}">${escapeHtml(p)}</span>`;
      }).join('<span class="tok-dot">.</span>');
    }
    function renderDecoded(targetId, payloadObj, focusKey) {
      const el = document.getElementById(targetId);
      if (!el) return;
      el.style.display = 'block';
      if (!payloadObj) { el.textContent = '(could not decode payload)'; return; }
      const pretty = JSON.stringify(payloadObj, null, 2);
      const html = pretty.replace(/("([^"\\]|\\.)*")(\s*:)|("([^"\\]|\\.)*")|(-?\d+(\.\d+)?)/g, (m, key, _k1, _k2, str, _s1, num) => {
        if (key) return `<span class="key">${escapeHtml(m)}</span>`;
        if (str) return `<span class="str">${escapeHtml(m)}</span>`;
        if (num) return `<span class="num">${escapeHtml(m)}</span>`;
        return escapeHtml(m);
      });
      // Highlight a particular key's value
      let final = html;
      if (focusKey) {
        const re = new RegExp(`("${focusKey}"\\s*:\\s*)(<span class="(?:str|num)">)([^<]*)(</span>)`);
        final = final.replace(re, `$1$2<span class="focus">$3</span>$4`);
      }
      el.innerHTML = final;
    }

    // ════════════════════ TAMPER LAB ════════════════════
    (function tamperLab() {
      let cleanToken = null;
      let cleanPayload = null;
      let currentToken = null;
      let currentDiff = null;

      const mintBtn = $('lab-t-mint');
      if (!mintBtn) return;

      mintBtn.addEventListener('click', async () => {
        mintBtn.disabled = true;
        const oldText = mintBtn.textContent;
        mintBtn.textContent = 'Calling /mint...';
        labStatus('lab-t-mint-status', '<span>Fetching real token from demo.agentpki.dev...</span>');
        try {
          const res = await fetch('https://demo.agentpki.dev/mint');
          const data = await res.json();
          cleanToken = data.token;
          currentToken = cleanToken;
          cleanPayload = decodePayload(cleanToken);
          renderTokenView('lab-t-token-view', cleanToken, null);
          renderDecoded('lab-t-decoded', cleanPayload, 'kid');
          labStatus('lab-t-mint-status', `<span class="ok">[ok]</span> minted <strong>${cleanToken.length}</strong>-char token. Payload decoded above. Now pick what to corrupt &darr;`);
          mintBtn.textContent = 'Re-mint a fresh token';
          mintBtn.disabled = false;
          labSetStage('t', 'A', 'done');
          labSetStage('t', 'B', 'active');
        } catch (e) {
          labStatus('lab-t-mint-status', `<span class="err">[fail]</span> ${escapeHtml(e.message)}`);
          mintBtn.textContent = oldText;
          mintBtn.disabled = false;
        }
      });

      // Tamper choice buttons
      document.querySelectorAll('[data-tamper]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!cleanToken) return;
          const mode = btn.dataset.tamper;
          const parts = cleanToken.split('.');
          let diff = null;
          if (mode === 'reset') {
            currentToken = cleanToken;
            currentDiff = null;
            labStatus('lab-t-tamper-status', `<span class="ok">[ok]</span> sending unchanged token. Expect <strong>verdict: allow</strong>.`);
          } else if (mode === 'sig') {
            const orig = parts[2].slice(-4);
            currentDiff = { partIdx: 2, start: parts[2].length - 4, end: parts[2].length, orig };
            const tampered = parts[2].slice(0, -4) + 'AAAA';
            currentToken = `${parts[0]}.${parts[1]}.${tampered}.${parts[3]}`;
            labStatus('lab-t-tamper-status', `<span class="warn">[diff]</span> last 4 chars of signature: <strong>${escapeHtml(orig)} &rarr; AAAA</strong>. Payload unchanged. Expect <strong>verdict: deny</strong> &middot; <strong>bad_signature</strong>.`);
          } else if (mode === 'payload') {
            // Tamper deep in payload — position 30 should be well inside the JSON
            const pos = Math.min(30, parts[2].length - 90);
            const orig = parts[2].slice(pos, pos + 4);
            currentDiff = { partIdx: 2, start: pos, end: pos + 4, orig };
            const tampered = parts[2].slice(0, pos) + 'AAAA' + parts[2].slice(pos + 4);
            currentToken = `${parts[0]}.${parts[1]}.${tampered}.${parts[3]}`;
            labStatus('lab-t-tamper-status', `<span class="warn">[diff]</span> 4 chars at position ${pos} of payload: <strong>${escapeHtml(orig)} &rarr; AAAA</strong>. Expect <strong>verdict: deny</strong> &middot; reason is whichever check fires first.`);
          } else if (mode === 'footer') {
            const orig = parts[3].slice(0, 4);
            currentDiff = { partIdx: 3, start: 0, end: 4, orig };
            const tampered = 'AAAA' + parts[3].slice(4);
            currentToken = `${parts[0]}.${parts[1]}.${parts[2]}.${tampered}`;
            labStatus('lab-t-tamper-status', `<span class="warn">[diff]</span> first 4 chars of footer: <strong>${escapeHtml(orig)} &rarr; AAAA</strong>. Footer carries the kid; corrupting it should fail.`);
          }
          renderTokenView('lab-t-token-view', currentToken, currentDiff);
          labSetStage('t', 'B', 'done');
          labSetStage('t', 'C', 'active');
        });
      });

      $('lab-t-send').addEventListener('click', async () => {
        if (!currentToken) return;
        const btn = $('lab-t-send');
        btn.disabled = true;
        btn.textContent = 'POSTing to verifier...';
        const out = $('lab-t-result');
        out.style.display = 'block';
        out.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.85rem;">POST /v1/verify ...</p>';
        try {
          const res = await fetch('https://verify.agentpki.dev/v1/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: currentToken }),
          });
          const result = await res.json();
          if (result.verdict === 'allow') {
            out.innerHTML = `<div style="padding: 0.85rem; border-radius: 0.55rem; border: 1px solid rgba(52,211,153,0.4); background: rgba(52,211,153,0.06);"><div style="color: #6ee7b7; font-weight: 800; font-size: 0.9rem;">verdict: allow &middot; ${result.elapsed_ms}ms</div><div style="color: #d1fae5; font-size: 0.78rem; margin-top: 0.35rem;">Unchanged token, real signature, real key &mdash; verifier accepts. This is your control sample.</div></div>`;
          } else {
            out.innerHTML = renderDenyCard(result, 'Your tampered token', `You changed ${currentDiff ? `4 chars of the ${['v', 'purpose', 'payload+sig', 'footer'][currentDiff.partIdx]}` : 'nothing'}. The verifier rejected it because:`);
          }
          labSetStage('t', 'C', 'done');
          btn.textContent = 'Send another tamper &rarr;';
          btn.disabled = false;
        } catch (e) {
          out.innerHTML = `<p style="color: #fca5a5; font-size: 0.85rem;">Network error: ${escapeHtml(e.message)}</p>`;
          btn.textContent = 'Send to verifier &rarr;';
          btn.disabled = false;
        }
      });

      $('lab-t-reset').addEventListener('click', () => {
        cleanToken = null; currentToken = null; currentDiff = null; cleanPayload = null;
        document.getElementById('lab-t-token-view').style.display = 'none';
        document.getElementById('lab-t-decoded').style.display = 'none';
        document.getElementById('lab-t-result').style.display = 'none';
        labStatus('lab-t-mint-status', '');
        labStatus('lab-t-tamper-status', '');
        labSetStage('t', 'A', 'active');
        labSetStage('t', 'B', 'locked');
        labSetStage('t', 'C', 'locked');
        $('lab-t-mint').textContent = 'Mint a fresh token';
        $('lab-t-send').textContent = 'Send to verifier &rarr;';
      });
    })();

    // ════════════════════ REVOKED-KEY LAB ════════════════════
    (function revokedLab() {
      let mintedToken = null;
      let chosenKid = null;
      let directory = null;

      const kidButtons = document.querySelectorAll('[data-kid]');
      if (!kidButtons.length) return;

      kidButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
          const choice = btn.dataset.kid;  // 'active' | 'revoked'
          const url = choice === 'revoked'
            ? 'https://demo.agentpki.dev/mint?revoked=1'
            : 'https://demo.agentpki.dev/mint';
          kidButtons.forEach(b => b.disabled = true);
          labStatus('lab-r-mint-status', `<span>Asking the issuer to sign with the <strong>${choice}</strong> kid...</span>`);
          try {
            const res = await fetch(url);
            const data = await res.json();
            mintedToken = data.token;
            const payload = decodePayload(mintedToken);
            chosenKid = (payload && payload.kid) || (choice === 'revoked' ? 'demo-2026-q1-rotated' : 'demo-2026-q2');
            renderTokenView('lab-r-token-view', mintedToken, null);
            renderDecoded('lab-r-decoded', payload, 'kid');
            labStatus('lab-r-mint-status', `<span class="ok">[ok]</span> issuer signed with <strong>kid="${escapeHtml(chosenKid)}"</strong>. The <code>kid</code> field is highlighted in the decoded payload. ${choice === 'revoked' ? 'The verifier hasn&rsquo;t looked at the directory yet &mdash; fetch it next.' : 'This kid should be in good standing.'}`);
            kidButtons.forEach(b => b.disabled = false);
            labSetStage('r', 'A', 'done');
            labSetStage('r', 'B', 'active');
          } catch (e) {
            labStatus('lab-r-mint-status', `<span class="err">[fail]</span> ${escapeHtml(e.message)}`);
            kidButtons.forEach(b => b.disabled = false);
          }
        });
      });

      $('lab-r-fetch-dir').addEventListener('click', async () => {
        const btn = $('lab-r-fetch-dir');
        btn.disabled = true;
        btn.textContent = 'GET /.well-known/agentpki-issuer.json...';
        try {
          const res = await fetch('https://demo.agentpki.dev/.well-known/agentpki-issuer.json');
          directory = await res.json();
          const revokedKeys = Array.isArray(directory.revoked_keys) ? directory.revoked_keys : [];
          const activeKeys = Array.isArray(directory.current_keys) ? directory.current_keys.map(k => k.kid).filter(Boolean) : [];
          const crlHtml = revokedKeys.length
            ? revokedKeys.map(k => {
                const kid = typeof k === 'string' ? k : k.kid;
                const reason = typeof k === 'object' && k.reason ? k.reason : 'planned_rotation';
                const at = typeof k === 'object' && k.revoked_at ? new Date(k.revoked_at * 1000).toISOString().slice(0, 10) : '';
                const isMatch = kid === chosenKid;
                return `<div>${isMatch ? '<span class="crl-kid-match">' + escapeHtml(kid) + '</span>' : escapeHtml(kid)}${at ? ' &middot; revoked ' + at : ''} &middot; ${escapeHtml(reason)}</div>`;
              }).join('')
            : '<div>(none)</div>';
          const activeMatch = activeKeys.includes(chosenKid);
          $('lab-r-crl').style.display = 'block';
          $('lab-r-crl').innerHTML = `
            <div class="crl-head">Active keys (in <code>keys[]</code>)</div>
            <div>${activeKeys.map(k => k === chosenKid ? `<span class="crl-kid-match" style="color:#6ee7b7;background:rgba(52,211,153,0.28);">${escapeHtml(k)}</span>` : escapeHtml(k)).join(', ') || '(none)'}</div>
            <div class="crl-head" style="margin-top: 0.5rem;">Revoked keys (in <code>revoked_keys[]</code>)</div>
            ${crlHtml}
            <div style="margin-top: 0.55rem; padding-top: 0.5rem; border-top: 1px dashed rgba(248,113,113,0.25); color: ${activeMatch ? '#6ee7b7' : '#fca5a5'};">
              Your chosen kid <strong>${escapeHtml(chosenKid)}</strong> is in the <strong>${activeMatch ? 'active' : 'revoked'}</strong> list. The verifier will ${activeMatch ? 'accept' : 'reject'} this token.
            </div>`;
          btn.textContent = 'Re-fetch directory';
          btn.disabled = false;
          labSetStage('r', 'B', 'done');
          labSetStage('r', 'C', 'active');
        } catch (e) {
          $('lab-r-crl').style.display = 'block';
          $('lab-r-crl').innerHTML = `Error fetching directory: ${escapeHtml(e.message)}`;
          btn.disabled = false;
        }
      });

      $('lab-r-send').addEventListener('click', async () => {
        if (!mintedToken) return;
        const btn = $('lab-r-send');
        btn.disabled = true;
        btn.textContent = 'POSTing to verifier...';
        const out = $('lab-r-result');
        out.style.display = 'block';
        out.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.85rem;">POST /v1/verify ...</p>';
        try {
          const res = await fetch('https://verify.agentpki.dev/v1/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: mintedToken }),
          });
          const result = await res.json();
          if (result.verdict === 'allow') {
            out.innerHTML = `<div style="padding: 0.85rem; border-radius: 0.55rem; border: 1px solid rgba(52,211,153,0.4); background: rgba(52,211,153,0.06);"><div style="color: #6ee7b7; font-weight: 800; font-size: 0.9rem;">verdict: allow &middot; ${result.elapsed_ms}ms</div><div style="color: #d1fae5; font-size: 0.78rem; margin-top: 0.35rem;">You signed with the active kid (<strong>${escapeHtml(chosenKid)}</strong>). Real signature, key in good standing &mdash; verifier accepts.</div></div>`;
          } else {
            out.innerHTML = renderDenyCard(result, `Token signed with kid="${chosenKid}"`, `You chose to sign with a kid that the directory lists as revoked. The verifier consulted the CRL and rejected.`);
          }
          labSetStage('r', 'C', 'done');
          btn.textContent = 'Send again';
          btn.disabled = false;
        } catch (e) {
          out.innerHTML = `<p style="color: #fca5a5; font-size: 0.85rem;">Network error: ${escapeHtml(e.message)}</p>`;
          btn.textContent = 'Send to verifier &rarr;';
          btn.disabled = false;
        }
      });

      $('lab-r-reset').addEventListener('click', () => {
        mintedToken = null; chosenKid = null; directory = null;
        document.getElementById('lab-r-token-view').style.display = 'none';
        document.getElementById('lab-r-decoded').style.display = 'none';
        document.getElementById('lab-r-crl').style.display = 'none';
        document.getElementById('lab-r-result').style.display = 'none';
        labStatus('lab-r-mint-status', '');
        labSetStage('r', 'A', 'active');
        labSetStage('r', 'B', 'locked');
        labSetStage('r', 'C', 'locked');
        $('lab-r-fetch-dir').textContent = 'Fetch issuer directory';
        $('lab-r-send').textContent = 'Send to verifier &rarr;';
      });
    })();

    // ════════════════════ PATH 04 — TRUST-CONTRACT SUITE RUNNER ════════════════════
    // CI-style runner that executes the three assertions from the test snippet
    // above. Streams output line-by-line so the user sees each one fire.
    (function p4Suite() {
      const runBtn = $('p4-run-suite');
      const clearBtn = $('p4-reset-suite');
      const out = $('p4-suite-output');
      if (!runBtn || !out) return;

      const VERIFY = 'https://verify.agentpki.dev/v1/verify';
      const MINT   = 'https://demo.agentpki.dev/mint';

      const append = (html) => {
        out.style.display = 'block';
        out.innerHTML += html;
        out.scrollTop = out.scrollHeight;
      };
      const clear = () => { out.innerHTML = ''; };

      async function verify(token) {
        const t0 = performance.now();
        const r = await fetch(VERIFY, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = await r.json();
        return { body, ms: Math.round(performance.now() - t0) };
      }

      async function assertion({ name, expect, run }) {
        append(`<span style="color:#9ca3af;">  ▷</span> <span style="color:#e5e7eb;">${escapeHtml(name)}</span>\n`);
        try {
          const { body, ms } = await run();
          const ok = expect(body);
          if (ok) {
            append(`  <span style="color:#6ee7b7;">✓ pass</span>  <span style="color:#9ca3af;">(${ms}ms wall, verifier ${body.elapsed_ms ?? '?'}ms)</span>  <span style="color:#c4b5fd;">verdict=${escapeHtml(body.verdict || '?')}${body.failure_reason ? ' reason=' + escapeHtml(body.failure_reason) : ''}</span>\n\n`);
            return true;
          } else {
            append(`  <span style="color:#fca5a5;">✗ FAIL</span>  <span style="color:#9ca3af;">expected assertion did not hold</span>\n`);
            append(`  <span style="color:#fecaca;">${escapeHtml(JSON.stringify(body, null, 2)).replace(/\n/g, '\n  ')}</span>\n\n`);
            return false;
          }
        } catch (e) {
          append(`  <span style="color:#fca5a5;">✗ ERROR</span>  ${escapeHtml(e.message || String(e))}\n\n`);
          return false;
        }
      }

      runBtn.addEventListener('click', async () => {
        runBtn.disabled = true;
        const originalText = runBtn.textContent;
        runBtn.textContent = 'Running...';
        clear();
        append(`<span style="color:#c4b5fd;">$ npm test  </span><span style="color:#9ca3af;">(live, against verify.agentpki.dev)</span>\n\n`);
        append(`<span style="color:#e5e7eb;">describe('AgentPKI trust contract', () => {</span>\n\n`);

        const results = [];

        results.push(await assertion({
          name: "it('allow on a real signed token')",
          expect: (r) => r.verdict === 'allow',
          run: async () => {
            const { token } = await fetch(MINT).then(r => r.json());
            return verify(token);
          },
        }));

        results.push(await assertion({
          name: "it('deny + bad_signature on tampered token')",
          expect: (r) => r.verdict === 'deny' && r.failure_reason === 'bad_signature',
          run: async () => {
            const { token } = await fetch(MINT).then(r => r.json());
            const [v, p, p2, f] = token.split('.');
            const tampered = `${v}.${p}.${p2.slice(0, -4)}AAAA.${f}`;
            return verify(tampered);
          },
        }));

        results.push(await assertion({
          name: "it('deny + revoked_key when issuer rotated the kid')",
          expect: (r) => r.verdict === 'deny' && r.failure_reason === 'revoked_key'
                     && typeof r.failure_detail === 'string'
                     && r.failure_detail.includes('demo-2026-q1-rotated'),
          run: async () => {
            const { token } = await fetch(`${MINT}?revoked=1`).then(r => r.json());
            return verify(token);
          },
        }));

        append(`<span style="color:#e5e7eb;">});</span>\n\n`);

        const passed = results.filter(Boolean).length;
        const total = results.length;
        if (passed === total) {
          append(`<span style="color:#6ee7b7;font-weight:800;">Tests: ${passed} passed, ${total} total</span>\n`);
          append(`<span style="color:#9ca3af;">The trust contract holds. AgentPKI distinguishes &lsquo;forged&rsquo; from &lsquo;revoked&rsquo; and tells you, accurately, which one happened.</span>\n`);
        } else {
          append(`<span style="color:#fca5a5;font-weight:800;">Tests: ${passed} passed, ${total - passed} failed</span>\n`);
        }

        runBtn.textContent = '▶ Run again';
        runBtn.disabled = false;
        clearBtn.style.display = 'inline-flex';
      });

      clearBtn.addEventListener('click', () => {
        clear();
        out.style.display = 'none';
        clearBtn.style.display = 'none';
        runBtn.textContent = '▶ Run trust-contract suite';
      });
    })();

    // ───── PATH 04 — framework tabs ─────
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === target));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === target));
      });
    });
  })();
