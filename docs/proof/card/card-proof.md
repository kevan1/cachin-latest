# Cachin Card / Cold-Wallet Card Proof

Status: separate product line; not required for the Frontier submission. Documented here for completeness.
Last updated: 2026-05-12

## Current Context

- Founder has another repo for the card flow.
- Physical card exists as an EAL6+ white card with no branding.
- This should now be treated as a separate product line / white-label opportunity being submitted separately with a partner.
- Cachin can be positioned as the first wallet implementation if that is true and demo-proven.
- The strategic idea is a 2-in-1 self-custodial cold-wallet and daily-spend Visa card product. This is interesting, but it is not required for the core Cachin LATAM QR payment wedge.
- Visa BIN is a possible side-track / expansion path, not a current claim unless confirmed.

## Evidence Status

The card is **out of scope for the Frontier core demo**; Cachin's submission stands on the LATAM QR payment flow. Card evidence is collected here for completeness, as moat / defensibility proof, and for the separate card-product submission with the partner.

| Evidence | Status | Link / Location |
|----------|--------|-----------------|
| Public APDU interface specification | Published in this repo | [`cachin_card/cachin-card-apdu-spec.md`](../../../cachin_card/cachin-card-apdu-spec.md) |
| JavaCard applet source (Cachin cold-wallet applet) | Published in this repo | [`cachin_card/CachinWalletApplet.java`](../../../cachin_card/CachinWalletApplet.java) |
| Physical card | Founder-held EAL6+ white card with no branding | Pending public photo capture |
| Secure-element model | NXP SE; Ed25519 on-chip key generation, key never leaves the card | See APDU spec, Section 2 (Security Model) |
| Video: card used end-to-end | Out of scope for Frontier window; planned for the separate card submission | TBD |
| App/activity confirmation after card payment | Will be available via Cachin app activity once the card flow is wired into the mobile build | TBD |
| Visa BIN plan memo | Internal; not a public claim for Frontier | Internal |

## Safe Submission Wording

> Cachin is planned as the first wallet implementation for a separate self-custodial cold-wallet / daily-spend card product.

For the separate card submission:

> A white-label self-custodial cold-wallet card product that can combine daily Visa-style spending with hardware-wallet custody.

## Avoid Until Confirmed

> Cachin works globally with Visa.
> Cachin has a Visa BIN.
> Cachin card is production-ready.
> Cachin requires the card to work.
