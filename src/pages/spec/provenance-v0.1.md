---
layout: ../../layouts/Doc.astro
title: AgentPKI Provenance v0.1
description: Agent-signed content provenance — extend C2PA to attest who (which AI agent) created or transformed a piece of content. Text, code, images, audio, video, any byte stream. Inline manifests, sidecar files, and HTTP Content-Provenance header delivery.
---

# AgentPKI Provenance v0.1

**Status:** Draft (active)
**Date:** 2026-06-09
**Editors:** AgentPKI Project
**License:** Apache License 2.0
**Companion to:** [AgentPKI core v0.1](/spec/v0.1), [v0.2 operational](/spec/v0.2), [v0.3-intent](/spec/v0.3-intent)
**Builds on:** [C2PA Content Credentials v1.4](https://c2pa.org/specifications/specifications/1.4/specs/C2PA_Specification.html)
**Repository:** github.com/agentpki/spec

---

## Abstract

This document specifies **AgentPKI Provenance v0.1**, a layer that lets AI agents cryptographically attest to content they created or transformed, using the Coalition for Content Provenance and Authenticity (C2PA) manifest format as its substrate. It defines:

1. An `agentpki.declaration` C2PA assertion that binds a passport-signed agent identity to a piece of content (§3)
2. A signing flow that uses the agent's Ed25519 private key (the same one used in core v0.1 passports) to sign C2PA manifests (§4)
3. A verification flow that walks back from content → C2PA manifest → AgentPKI passport → issuer directory (§5)
4. Content binding for media types C2PA does NOT natively cover: plain text, code, JSON, JSONL, structured data (§6)
5. An HTTP delivery mechanism — the `Content-Provenance` response header — for streaming or dynamic responses where embedding a manifest is impractical (§7)

The motivating problem: AI agents are increasingly the actual authors of public content (articles, posts, code, images, audio), but viewers have no cryptographic way to know **which agent** produced **which piece**. Today, "Claude wrote this" or "GPT-4 generated this" is a marketing claim, not a provable fact. AgentPKI Provenance makes it a provable fact for any content the agent's operator chose to sign.

This spec is **deliberately scoped** to agent-as-signer. The complementary direction — humans signing content with AgentPKI-issued identities — is out of scope here and follows IETF Identity-on-the-Web work.

C2PA implementations remain unchanged. v0.1 of this spec adds one new assertion type; the rest of the C2PA stack (manifest format, signing algorithms, verification rules, trust list) is used as-is.

---

## Status of this Document

This is a v0.1 working draft of AgentPKI Provenance. Phase 1 (this document) specifies the wire format. Phases 2–5 ship SDK helpers, CLI commands, a public Provenance Explorer at `/provenance`, and bridge adapters for popular content surfaces (Markdown editors, image generators, Vercel AI SDK).

AgentPKI Provenance is a **separate product line** from the core protocol. Reference deployment runs at:

```
https://provenance.agentpki.dev/v1/sign
https://provenance.agentpki.dev/v1/verify
```

(Live in Phase 2.)

The latest version, errata, and conformance test vectors are maintained at:

```
https://agentpki.dev/spec/provenance-v0.1
```

---

## 1. Conventions and Terminology

This document inherits RFC 2119 keywords (MUST, SHOULD, MAY) from [AgentPKI core v0.1 §1](/spec/v0.1) and C2PA terminology from the [C2PA specification §1](https://c2pa.org/specifications/specifications/1.4/specs/C2PA_Specification.html). New terms introduced in Provenance v0.1:

- **Content** — Any byte stream a producer wishes to attest to (text, image, audio, video, code, structured data).
- **Producer** — The party that created or transformed the content. In v0.1, the producer MUST be an AI agent identified by an AgentPKI passport.
- **Manifest** — A signed C2PA manifest containing one or more assertions about the content, including the agent identity assertion this spec adds.
- **`agentpki.declaration`** — The new C2PA assertion type defined in §3 of this document. Binds a passport-identified agent to a specific content hash.
- **Sidecar manifest** — A `.c2pa.json` file delivered alongside content that lacks a native C2PA container.
- **Content-Provenance header** — An HTTP response header (§7) carrying a base64url-encoded signed manifest for streaming responses.
- **Provenance chain** — The ordered sequence of producers/transformers attested by the manifest, where each entry references the previous via the C2PA `parent_ingredient` mechanism.

---

## 2. Summary of What's New

| Area | Pre-v0.1 behavior | v0.1 addition |
|---|---|---|
| Agent-as-signer in C2PA | Not standardized | New assertion `agentpki.declaration` binding passport → content hash |
| Signing algorithm | RFC 8410 Ed25519 in CBOR-COSE per C2PA | Unchanged. Use existing AgentPKI Ed25519 keys; passport carries the public key |
| Trust list | C2PA trust list (Adobe/Truepic/etc.) | Adds AgentPKI issuer directory as a parallel trust source |
| Text / code / JSON | No native C2PA binding | Sidecar `.c2pa.json` (§6.1), inline `<!--c2pa: ...-->` comments (§6.2), JSONL header-row pattern (§6.3) |
| Streaming/dynamic content | C2PA manifest embedded in container | HTTP `Content-Provenance` response header (§7) |
| Verifier | C2PA validator (Adobe / Truepic / open-source `c2patool`) | Adds `https://provenance.agentpki.dev/v1/verify` as a hosted option |

**No breaking changes to C2PA.** Standard C2PA tools see an unknown assertion and SHOULD ignore it per C2PA §11.1. AgentPKI-aware tools recognize the assertion and walk back to the issuer directory.

---

## 3. The `agentpki.declaration` Assertion

### 3.1 Wire Format

The assertion is a standard C2PA assertion (CBOR-encoded inside the manifest). Its label and payload schema:

```cbor
{
  "label": "agentpki.declaration",
  "data": {
    "version": 1,
    "passport": "v4.public.eyJpc3M...",     ; AgentPKI passport token (PASETO)
    "content_hash": "sha256-9f86d081...",   ; SHA-256 of the content as base64url
    "content_type": "text/markdown",        ; media type
    "produced_at": 1780967660,              ; Unix seconds, MUST be in passport.iat..exp range
    "transformation": "generated",          ; §3.3 vocabulary
    "parent_hash": null,                    ; optional, for derivative content
    "parent_producer": null,                ; optional, agent_id of upstream agent
    "extra": {}                             ; optional issuer-specific metadata
  }
}
```

JSON encoding is shown for readability; the on-wire form is CBOR per C2PA conventions.

### 3.2 Constraints

- `version` MUST be `1`.
- `passport` MUST be a valid AgentPKI v0.1+ passport token (per [core spec §3](/spec/v0.1)). The passport's `exp` MUST be ≥ `produced_at`.
- `content_hash` MUST be the SHA-256 of the canonical byte representation of the content (see §6 for per-type canonicalization).
- `content_type` SHOULD be an IANA-registered media type.
- `produced_at` MUST be in `[passport.iat, passport.exp]`.
- `transformation` MUST be from the §3.3 vocabulary.
- The assertion MUST be signed using the same Ed25519 private key whose public key appears in `passport`'s `cnf.jwk.x` (Mode B style), OR signed indirectly by virtue of being embedded in a C2PA manifest signed with that key.

### 3.3 Transformation Vocabulary

| Value | Meaning |
|---|---|
| `generated` | Content created from no antecedent (e.g., a new article, a brand-new image). |
| `edited` | Content modified from a `parent_hash`. The agent is responsible for material changes. |
| `translated` | Content is a translation of `parent_hash`. |
| `summarized` | Content is a summary of `parent_hash`. |
| `transcribed` | Content is a transcription (audio → text, image → OCR). |
| `composed` | Content is assembled from multiple `parent_hash` items (use `parent_ingredients` per C2PA). |
| `reviewed` | Agent did not produce content but attested to its accuracy. |

Vendor-specific transformations use the `x-<vendor>-<verb>` prefix and are not portable.

### 3.4 Multiple Assertions

A single manifest MAY contain multiple `agentpki.declaration` assertions to model multi-agent workflows. Example:

1. Agent A (Anthropic-issued Claude) generates a draft → `transformation: "generated"`
2. Agent B (Grammarly-issued bot) edits → `transformation: "edited"`, `parent_hash: <hash of A's output>`
3. Human reviewer-bot certifies → `transformation: "reviewed"`

The viewer walks the chain in order and surfaces each agent's identity, issuer, and tier.

---

## 4. Signing Flow

### 4.1 Producer-Side

A producer (the agent's operator) signs content in five steps:

1. **Compute** `content_hash` per §6 rules for the relevant media type.
2. **Mint** a fresh AgentPKI passport (with `intent: ["post-content"]` if applicable per v0.3-intent).
3. **Build** an `agentpki.declaration` assertion populating the §3.1 fields.
4. **Wrap** the assertion in a C2PA manifest with a `c2pa.claim_signature` using the agent's Ed25519 private key. The signing certificate stub MUST reference the AgentPKI issuer (§4.3).
5. **Embed or deliver** the manifest per §6 (sidecar / inline / HTTP header).

### 4.2 Hash Canonicalization

For deterministic verification, the input to `content_hash` MUST be the canonical byte representation per §6 (UTF-8 NFC for text, raw bytes for images, JCS for JSON). Without canonicalization, trivial whitespace or encoding differences would break verification.

### 4.3 Signing Certificate

C2PA expects an X.509 certificate chain. AgentPKI passports are NOT X.509 certificates. We bridge this via:

- An AgentPKI-issued **bridging certificate** (X.509 with `subjectAltName` containing the agent_id URI scheme `urn:agentpki:agent:<iss>:<sub>:<jti>`)
- Signed by the AgentPKI issuer's CA root key
- The certificate's `keyUsage` MUST include `digitalSignature`
- The certificate's `extendedKeyUsage` MUST include the C2PA OID `1.3.6.1.4.1.40384.1.1.1` (claim-signer)

The bridging cert can be cached and reused across many content signings within the passport's `exp` window — it does NOT need to be reissued per piece of content.

### 4.4 Multi-Agent Manifests

When two or more agents contribute, each adds its own `agentpki.declaration` assertion and the second agent's manifest references the first via C2PA's standard `c2pa.ingredient` mechanism. Verifiers walk the ingredient graph to surface the full chain.

---

## 5. Verification Flow

### 5.1 Reader-Side

A verifier (browser, client, server) checks content provenance in seven steps:

1. **Locate** the manifest (per §6/§7 delivery method).
2. **Validate** the C2PA manifest using a standard C2PA validator (Adobe `c2patool`, Truepic, open-source). The validator checks signature integrity, certificate validity, and manifest structure.
3. **Extract** each `agentpki.declaration` assertion.
4. **Re-compute** `content_hash` from the actual content bytes and compare to the assertion. Hash mismatch → fail.
5. **Verify** the embedded passport using a standard AgentPKI verifier (`https://verify.agentpki.dev/v1/verify`). Verdict must be `allow`.
6. **Resolve** the issuer directory and surface issuer name, tier, and contact.
7. **Surface** the chain to the user: which agent, which issuer, when produced, what transformation, and any parent producers.

### 5.2 Hosted Verifier

A reference verifier runs at:

```
POST https://provenance.agentpki.dev/v1/verify
Content-Type: application/json

{
  "manifest_b64": "<base64url-encoded C2PA manifest>",
  "content_hash": "sha256-...",
  "content_type": "text/markdown"
}
```

Response:

```jsonc
{
  "verified": true,
  "chain": [
    {
      "seq": 1,
      "agent_id": "agent:anthropic.com/claude-3-5-sonnet-bot",
      "issuer": "anthropic.com",
      "issuer_tier": 2,
      "produced_at": 1780967660,
      "transformation": "generated",
      "parent_hash": null
    },
    { "seq": 2, ... }
  ],
  "passport_verdict": "allow",
  "manifest_signature_valid": true,
  "content_hash_match": true,
  "verifier_id": "agentpki-provenance-edge"
}
```

If `manifest_signature_valid` is false, the verifier returns `verified: false` and a `failure_reason` from the union: `manifest_invalid`, `content_hash_mismatch`, `passport_expired`, `passport_revoked`, `issuer_unreachable`, `assertion_missing`.

---

## 6. Content Binding for Non-C2PA Containers

C2PA natively supports manifest embedding in PDF, JPEG, PNG, TIFF, MP4, MP3, AAC, WAV, AVI. For text, code, JSON, and other media without native containers, AgentPKI Provenance defines three binding methods.

### 6.1 Sidecar Manifest

A `.c2pa.json` file delivered alongside the content. Canonical naming:

```
my-article.md           ; the content
my-article.md.c2pa      ; the manifest (CBOR)
my-article.md.c2pa.json ; (alternative) the manifest as JSON for human inspection
```

Servers SHOULD return both files together (e.g., `Link: <my-article.md.c2pa>; rel="provenance"` header on the content response).

### 6.2 Inline Comment Block

For text/Markdown/source code where readers may save just the content file, the manifest MAY be embedded as an inline comment:

For Markdown / HTML:
```html
<!--c2pa-manifest
{"version":1,"manifest":"<base64url manifest>"}
-->
```

For JavaScript / TypeScript / Python / Go:
```js
// @c2pa-manifest {"version":1,"manifest":"<base64url manifest>"}
```

The comment MUST be the first non-blank line that is parseable as a comment in the file's primary language. The `content_hash` MUST be computed over the file content **with the manifest comment removed** — otherwise the manifest hash depends on itself.

### 6.3 JSON / JSONL

Two patterns depending on whether the content is one document or many:

**Single JSON:** add a `_c2pa` top-level key whose value is `{ "manifest": "<base64url>" }`. The `content_hash` MUST be computed over the JSON document **with the `_c2pa` key removed and the result canonicalized via JCS (RFC 8785)**.

**JSONL (newline-delimited):** the FIRST line is a manifest line:

```jsonl
{"_c2pa_header":1,"manifest":"<base64url>","content_lines":42}
{...actual line 1...}
{...actual line 2...}
```

The `content_hash` is over lines 2..N+1 concatenated with `\n` separators.

### 6.4 Image / Audio / Video

Use C2PA's native embedding per the C2PA specification. No new rules.

---

## 7. HTTP `Content-Provenance` Header

For streaming responses, dynamically-generated content, or APIs that cannot reasonably attach a sidecar, the manifest travels in a response header.

### 7.1 Header Format

```
Content-Provenance: v=1; manifest=<base64url>; sha256=<base64url-of-content-hash>
```

Field requirements:

- `v` — version, currently `1`
- `manifest` — base64url-encoded C2PA manifest (no padding)
- `sha256` — base64url SHA-256 of the response body, used for client-side cross-check
- (optional) `algo` — hash algorithm; defaults to sha256

### 7.2 Length Constraint

HTTP headers have practical size limits (varies; ~8 KB is widely safe, 16 KB pushes against limits). If the manifest exceeds 6 KB, producers SHOULD use sidecar delivery (§6.1) instead and emit a `Link: <url>; rel="provenance"` header pointing at the sidecar.

### 7.3 Streaming + Chunked Responses

For server-sent events (SSE) or chunked responses, the header attaches to the first event. The `content_hash` MUST cover the full concatenated response body. Clients verify after the stream completes.

### 7.4 Reverse Proxies

CDNs, load balancers, and middleware MUST preserve the `Content-Provenance` header. Cloudflare, Fastly, AWS CloudFront, and Vercel pass it through by default. Servers SHOULD also mirror to a `Trailer: Content-Provenance` for HTTP/1.1 if the manifest is computed during response generation.

### 7.5 Caching

Caches MUST treat `Content-Provenance` as varying with the response body. Two different response bodies MUST NOT share a cached `Content-Provenance` value.

---

## 8. Worked Examples

### 8.1 Article Generated by Claude

Anthropic's Claude generates a Markdown article. The Anthropic operator signs it.

```jsonc
// Manifest assertion (decoded)
{
  "label": "agentpki.declaration",
  "data": {
    "version": 1,
    "passport": "v4.public.eyJpc3M...",
    "content_hash": "sha256-9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "content_type": "text/markdown",
    "produced_at": 1780967660,
    "transformation": "generated"
  }
}
```

Delivered as a sidecar `article.md.c2pa.json` next to `article.md`.

### 8.2 Image Generated by Midjourney, Edited by Photoshop's Claude-Assistant

Two assertions in one manifest:

```jsonc
// First assertion — Midjourney generated
{ "label": "agentpki.declaration",
  "data": { "passport": "...mj passport...", "content_hash": "sha256-AAAA",
            "transformation": "generated", "produced_at": 1780960000 } }

// Second assertion — Adobe AI edited (Adobe is the issuer of the editor agent)
{ "label": "agentpki.declaration",
  "data": { "passport": "...adobe passport...", "content_hash": "sha256-BBBB",
            "transformation": "edited", "parent_hash": "sha256-AAAA",
            "parent_producer": "agent:midjourney.com/v6-bot",
            "produced_at": 1780967660 } }
```

Verifiers walk both and show: "Generated by Midjourney v6, then edited by Adobe AI on 2026-06-09."

### 8.3 Streaming LLM Response

A chatbot completion API streams a response via SSE. Producer computes the hash incrementally; on the first chunk, sets header:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Content-Provenance: v=1; manifest=<base64url>; sha256=<placeholder>
Trailer: Content-Provenance

data: ...
data: ...
data: [DONE]

Content-Provenance: v=1; manifest=<base64url>; sha256=<actual hash>
```

The client verifies against the trailer value if both header and trailer are present.

---

## 9. Threat Model

### 9.1 What Provenance Defends Against

- **Spoofed authorship.** A piece of content claiming "written by Claude" can be cryptographically verified or rejected.
- **Untraceable AI content laundering.** Once content is signed, anyone can walk back to the issuer; the issuer's `contact.abuse` provides a real reporting channel.
- **Content tampering after signing.** Any byte modification breaks the `content_hash` match.
- **Manifest stripping.** Detected via the absence of a `Content-Provenance` header / sidecar where one was expected (sites and platforms can require provenance).

### 9.2 What Provenance Does NOT Defend Against

- **Honest but adversarial agents.** A signed declaration of `generated` for content actually plagiarized from elsewhere is cryptographically valid. Detection of plagiarism is out of scope; this spec attests **who claims authorship**, not **whether the claim is original**.
- **Manifests removed before delivery.** A producer can choose not to sign or to strip manifests post-hoc. Sites and consumers must reject unsigned content if they want provenance enforcement.
- **Replay of valid manifests on different content.** Defeated by `content_hash`; cannot rebind.
- **Compromised issuer keys.** Same threat model as core AgentPKI v0.1 §13; CRL (v0.2) provides revocation.
- **Off-platform stripping.** A user copy-pastes the rendered text without the manifest — the cryptographic binding is lost. This is fundamental to display media and is not solvable cryptographically; out-of-band signaling (e.g., browser indicators) is the only practical layer.

### 9.3 Privacy

Manifests embed an `agent_id` and an `issuer`. They do NOT embed:

- User prompts that led to the generation
- User identifiers
- Server-side metadata not present in the passport
- Inference parameters (model, temperature, etc.) unless the producer explicitly chooses to surface them in `extra`

Operators wishing to attest "this was generated by Claude" without revealing which user requested it remain compatible with this spec.

---

## 10. Bridges to Adjacent Protocols and Specs

### 10.1 C2PA Content Credentials (Adobe-led, c2pa.org)

This spec **extends** C2PA. The `agentpki.declaration` assertion is a regular C2PA assertion; standard C2PA tooling (`c2patool`, Truepic Lens, Adobe Content Credentials viewer) recognizes the manifest envelope but treats the assertion as opaque metadata. AgentPKI-aware tooling adds the issuer-directory walk-back.

### 10.2 IETF AI-Preferences (AIP)

AIP focuses on opt-out signaling for training data. AgentPKI Provenance addresses the orthogonal question: "this content was created by an AI." Both can be advertised on the same content; the publisher can simultaneously opt out of being training data (AIP) and prove which AI created it (Provenance).

### 10.3 Anthropic MCP

MCP tools that generate content (text, code, search results) can attach a manifest to their output. The MCP server is the producer; the calling agent is the consumer. A future MCP extension MAY require provenance on outputs of certain tool calls.

### 10.4 Vercel AI SDK

The AI SDK generates LLM responses with metadata. A future SDK helper `generateText({ model, ..., provenance: true })` SHOULD attach a `Content-Provenance` header on the response. Reference adapter ships in Phase 4.

### 10.5 W3C Verifiable Credentials

VCs and AgentPKI passports occupy adjacent territory. A future profile MAY define a VC encoding for the AgentPKI bridging certificate; v0.1 sticks to X.509 for C2PA interop.

---

## 11. Backward Compatibility

| Implementer | Behavior |
|---|---|
| C2PA-only validator | Sees the assertion as unknown, ignores per C2PA §11.1 |
| AgentPKI-only verifier | Cannot read C2PA manifests; out of scope |
| AgentPKI Provenance v0.1 validator | Full verification (this spec) |
| Content without manifest | Returns `verified: false`, `failure_reason: "assertion_missing"` |

A producer MAY sign with v0.1 of this spec and remain conformant with all of C2PA v1.4.

---

## 12. Security Considerations

### 12.1 Manifest Integrity

The C2PA manifest is signed using Ed25519. Any byte modification of the manifest or the content invalidates the signature. This is the baseline cryptographic guarantee inherited from C2PA.

### 12.2 Bridge Certificate Lifetime

The bridging X.509 certificate (§4.3) SHOULD be short-lived (≤ passport `exp`). Long-lived bridging certs expand the revocation surface. Issuers SHOULD pin the bridging cert lifetime to the passport's `exp`.

### 12.3 Content Hash Algorithm Agility

v0.1 mandates SHA-256. A future revision (v0.2) MAY allow SHA-3-256 or BLAKE3 via a `hash_algo` field in the assertion. Implementations SHOULD reject unknown algorithm values rather than treating them as success.

### 12.4 Replay Across Content

The `content_hash` field binds the assertion to a specific byte sequence. A valid manifest cannot be replayed on different content without breaking the hash check. There is no need for a `jti`-style nonce within the manifest because the content hash itself is unique.

### 12.5 Issuer Key Compromise

Same threat as core v0.1. CRL revocation (v0.2) applies — a manifest signed by a revoked key fails verification at step 5 (passport verdict).

### 12.6 Quantum Forward Migration

Ed25519 is not post-quantum secure. The same migration path as core AgentPKI applies; manifests signed with Ed25519 before the cutover remain verifiable against archived keys, but new signing SHOULD adopt the chosen PQ scheme when the migration ships.

---

## 13. Implementation Phasing

| Phase | Deliverable | Status |
|---|---|---|
| 1 | This spec | **shipped** |
| 2 | `provenance.agentpki.dev/v1/sign` + `/v1/verify` reference Worker | Q3 2026 |
| 3 | `@agentpki/provenance` SDK (TypeScript, Python) — `signContent()`, `verifyContent()`, `verifyHeader()` | Q3 2026 |
| 4 | `agentpki provenance sign/verify` CLI subcommands | Q3 2026 |
| 5 | `/provenance` Public Provenance Explorer — drop any file or paste any text, see the chain | Q3 2026 |
| 6 | Integration adapters: Vercel AI SDK, MCP server response wrapper, Markdown editors | Q4 2026 |
| 7 | Browser extension surfaces provenance on visited pages | Q4 2026 |

Each phase is independently useful and ships incrementally. The wire format is fixed at the end of Phase 1 (this document); subsequent phases populate the surrounding ecosystem.

---

## 14. Open Issues for Review

The following are intentionally unresolved in v0.1 and invite community input:

- **Hash algorithm agility.** Per §12.3, SHA-3 / BLAKE3 are likely v0.2 additions. Should they be opt-in at the assertion level or signaled by manifest version?
- **Aggregate hashes for large content.** A 4 GB video requires re-reading to verify the hash. Should a Merkle-tree variant be added for incremental verification?
- **Anonymous transformations.** A user may want to claim "this was AI-touched" without revealing which agent. Should the spec define a `redacted` transformation that surfaces only `transformation` and issuer tier, hiding `agent_id`?
- **HTTP delivery in middleware.** Cloudflare Workers, Vercel functions, and lambdas often re-encode response bodies; the signed hash will not match. Should producers always use sidecar delivery in middleware-heavy environments?
- **Bridging cert format.** X.509 is C2PA's choice today; should we offer a JWS-encoded alternative for ecosystems that prefer JSON identity?

Comments and PRs welcomed at `github.com/agentpki/spec/issues`.

---

## 15. IANA Considerations

This document requests:

- One C2PA assertion label registration: `agentpki.declaration` (informational; C2PA does not yet operate an IANA registry but the C2PA TC has indicated it will accept assertion vocabulary submissions)
- One IANA HTTP Field name registration: `Content-Provenance`
- One IANA Link relation type registration: `provenance`

These registrations land alongside Phase 2 of this work.

---

## 16. References

### 16.1 Normative

- [AgentPKI core v0.1](/spec/v0.1) — passport format, signing keys, verification
- [AgentPKI v0.2 operational](/spec/v0.2) — CRL, replay cache, abuse reporting
- [AgentPKI v0.3-intent](/spec/v0.3-intent) — declared intent claim, complementary
- [C2PA Specification v1.4](https://c2pa.org/specifications/specifications/1.4/specs/C2PA_Specification.html) — base spec
- RFC 2119 — keyword conventions
- RFC 8785 — JSON Canonicalization Scheme (JCS)
- RFC 8410 — Ed25519 in X.509
- RFC 9110 — HTTP semantics (header field rules)
- PASETO v4.public — passport token format

### 16.2 Informative

- Adobe Content Credentials — implementation reference
- Truepic Lens — implementation reference
- IETF AI-Preferences (AIP) drafts — complementary signaling
- Anthropic Model Context Protocol — integration target
- W3C Verifiable Credentials — adjacent identity surface

---

*End of AgentPKI Provenance v0.1 draft.*
