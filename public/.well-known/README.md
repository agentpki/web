# .well-known fallback directory

Cloudflare Workers Routes attached to this zone intercept the canonical paths:

- `agentpki.dev/.well-known/agentpki-issuer.json` → `agentpki-self-issuer` Worker
- `agentpki.dev/.well-known/agentpki-crl.json` → `agentpki-self-issuer` Worker

This directory holds **fallback static copies** that Pages would serve if the
Worker routes were detached (e.g., emergency rollback if the Worker is broken).

## Files

- `agentpki-issuer.static.json` — last-good snapshot of the live directory.
  Regenerate by running:
  ```bash
  curl -s https://agentpki.dev/.well-known/agentpki-issuer.json \
    > web/public/.well-known/agentpki-issuer.static.json
  ```
  Commit after every key rotation.

## Promoting the fallback (incident-only)

If the Worker is broken and you need verifiers to keep working:

1. In Cloudflare → Workers Routes for `agentpki.dev` → delete the
   `/.well-known/agentpki-*` patterns (keep `/mint` and `/admin/*` routes so
   those return 404 rather than silently breaking).
2. Rename `agentpki-issuer.static.json` → `agentpki-issuer.json` in
   `web/public/.well-known/`.
3. Redeploy Pages.
4. Verifiers will now fetch the static JSON from Pages. Minting will be
   offline until the Worker is restored.

CRL has no static fallback by design — if minting is down, you can't issue
NEW revocations either, so the CRL is irrelevant during an outage.
