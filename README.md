# `@agentpki/web` — agentpki.dev

The marketing site at https://agentpki.dev. Astro 5 + Tailwind 4. Static
output, deployed via Cloudflare Pages. Includes:

- The protocol's public landing page
- The rendered AgentPKI Protocol v0.1 spec at `/spec/v0.1`
- An interactive "Try it live" widget that hits the demo issuer + verifier
  Workers from the browser and displays a real verdict

## Local development

```bash
git clone https://github.com/agentpki/web
cd web
pnpm install
pnpm dev               # http://localhost:4321
pnpm build             # static output to dist/
pnpm run release       # build + wrangler pages deploy
```

## Architecture

- `src/pages/index.astro` — the single landing page, including the
  Try-it-live widget (inline JS, no framework)
- `src/pages/spec/v0.1.md` — the spec, mirrored from `agentpki/spec/v0.1.md`
  with Astro frontmatter for layout
- `src/layouts/Base.astro`, `src/layouts/Doc.astro` — page chrome
- `src/styles/global.css` — Tailwind v4 + animated mesh-gradient background +
  hero diagram animations + standards-badge styles

## Animated diagrams

Two custom inline SVGs:

1. **Hero diagram** — the trust-flow visual under the hero. Three nodes
   (Issuer · Passport · Verifier), animated dashed flow lines, traveling
   pulse dots, glowing center, callout cards for the issuer key and the
   verdict.
2. **Compose diagram** — hub-and-spoke under "Designed to compose."
   AgentPKI in the center, satellites for MCP, A2A, Kite, SPIFFE, and
   OWASP ANS, with animated pulse dots radiating outward.

Both use SMIL `animateMotion` for traveling dots and CSS keyframes for
gradient sweeps. All animation is gated behind `prefers-reduced-motion`.

## License

MIT. Spec it implements is Apache 2.0.
