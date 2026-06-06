# Build vs Buy — Payment & Subscription Infrastructure

> CTO/technical-strategist decision memo for Momentum Playbook.
> Pressure: fast. Budget: ample. Team: 2 (limited maintenance bandwidth).
> Triggered by the move from single-tier $19/mo to 3-tier ($29/$59/$149) + annual billing + grandfathering.

---

## 1. The Question

We need a payment + subscription management capability that supports:
- 3 monthly tiers ($29 Starter / $59 Pro / $149 Elite)
- 3 annual tiers (20% discount each)
- Free trial (7 days, no card required currently)
- Grandfathered Founding Member pricing ($19 legacy) — permanent custom plan
- Refund handling (14-day money-back per pricing strategy)
- Affiliate commissions (30% recurring per GTM plan)
- Coupons / promo codes
- Tax handling (Israeli VAT now; international VAT/sales tax if we expand)
- Failed-payment retries (dunning) → reduces involuntary churn
- Webhooks for subscription lifecycle events
- Self-service customer portal (update card, change plan, cancel)

## 2. The Capability Stated Plainly

Subscription management is **commodity infrastructure**. It is not a differentiator. Every paying SaaS in the world has solved this problem. The question is which proven solution costs us the least time, money, and operational risk over 24 months.

## 3. Options Evaluated

### A. Stay on Grow / Meshulam (current)
Israeli payment provider. Already wired (`app/api/grow/*`). Israeli VAT handling built-in. Single-tier integration today; would need to be extended for 3 tiers, annual cycles, grandfather rules, affiliates, and dunning.

### B. Migrate to Stripe Billing
Global SaaS standard. Best-in-class billing primitives (price objects, subscription schedules, proration, dunning, customer portal, tax via Stripe Tax). We become merchant of record. We handle VAT in jurisdictions we sell into.

### C. Migrate to Paddle (Merchant of Record)
Paddle becomes the merchant — they handle global VAT, sales tax, invoicing, fraud, and chargebacks. We surface their billing UI or use their API. Higher transaction fee (~5% + 50¢) vs Stripe (~2.9% + 30¢), but eliminates all tax/compliance overhead.

### D. Migrate to Lemon Squeezy (Merchant of Record)
Similar model to Paddle, smaller and more modern. Cleaner API, simpler pricing model, but smaller scale + less battle-tested. Acquired by Stripe in 2024 — strategically uncertain.

---

## 4. Decision Matrix

| Dimension | A. Grow (stay) | B. Stripe Billing | C. Paddle MoR | D. Lemon Squeezy MoR |
|---|---|---|---|---|
| **Time to value** | 2-3 wks build-out | 1.5-2 wks migration | 1 wk migration | 1 wk migration |
| **Hidden timeline** | Each new feature = bespoke work (annual, grandfather, affiliates, dunning). 4-6 wks cumulative. | Affiliate program needs Rewardful/PartnerStack add-on (~1 wk). Tax via Stripe Tax (~2 days). | Affiliates via PartnerStack (~1 wk). Tax handled. | Affiliates built-in. Tax handled. Uncertain post-acquisition roadmap. |
| **Direct cost / mo (at $10k MRR)** | ~2.9% + IL bank fees | 2.9% + $0.30/txn ≈ $290 + tax | ~5% + $0.50/txn ≈ $500 | ~5% + $0.50/txn ≈ $500 |
| **Direct cost / 24 mo (avg $15k MRR scaling)** | ~$13k | ~$13.5k + Stripe Tax (~$2k) = ~$15.5k | ~$22k all-in (tax included) | ~$22k all-in |
| **Eng time cost / 24 mo** | ~120 hrs = ~$18k contractor / huge oppty cost | ~40 hrs = ~$6k | ~25 hrs = ~$4k | ~25 hrs = ~$4k |
| **Total 24-mo cost (incl. eng oppty)** | **~$31k** | **~$21.5k** | **~$26k** | **~$26k** |
| **Strategic fit** | Wrong layer. Billing is not a differentiator. Custom build = wasted effort. | Industry standard for SaaS at this stage. Sensible. | Excellent for global expansion. Slight overkill for IL-first stage. | Smaller bet on a now-Stripe-owned product. |
| **Risk profile** | HIGH — single contractor on Meshulam quirks; affiliate program nonexistent; international expansion blocked; dunning self-built (revenue leakage). | LOW — most-documented, most-talented integrators available globally. | LOW-MEDIUM — vendor lock-in is real, but VAT abstraction is correctness insurance. | MEDIUM — small vendor + post-acquisition uncertainty. |
| **Reversal pain** | Switching costs grow weekly. Each week we stay = more bespoke logic to migrate later. | Easy migration in/out (open Stripe API). Customers can re-key cards. | Harder to leave (Paddle handles MoR — customer relationships partially through them). | Same as Paddle. |
| **Maintenance burden** | HIGH — every flow we want, we build. Annual cycles, proration, retries, invoices, tax = months of integration work over 24mo. | LOW — Stripe ships features (Stripe Tax, Connect for affiliates, Climate, Sigma). We consume. | LOWEST — they handle tax, compliance, chargebacks, dunning. | LOW. Smaller team behind it. |
| **Vendor risk** | LOW (local, accessible). | LOW (Stripe is closer to infra than vendor at this point). | LOW. | MEDIUM (post-acquisition direction unclear). |

---

## 5. Reasoning by Dimension

### Time to value
"Fast" timeline is the primary constraint. Stripe and Paddle both clear the 3-tier + annual + dunning + customer portal requirements **out of the box**. Grow requires 2-3 weeks of bespoke build for the same outcome — and that's just to reach feature parity, not for the next capability we want.

### Total 24-month cost (incl. opportunity cost)
Grow appears "cheapest" if we only count transaction fees. But once we price the engineering time to bring it to feature parity with Stripe, it is actually the most expensive option. Engineering time has the highest unit cost on the team — every hour ido spends on payment plumbing is an hour not spent on Phase B (Edge Heatmap, Cooling-Off) or Phase C (Morning Prep, Streak Counter).

**Opportunity cost dominates direct cost** at this stage. This is the single most important framing.

### Strategic fit
Subscription billing is **commodity infrastructure**. Building bespoke on Grow makes sense only if billing is a competitive moat — it is not. Our moat is method enforcement (Phase A) and personal edge data (Phase B). Spending eng cycles on subscription primitives is misallocation.

### Risk profile
- Grow: high risk of revenue leakage from un-built dunning (industry data: well-implemented dunning recovers 10-15% of involuntary churn).
- Stripe: lowest risk — most-documented API on the internet, easy hire-to-help-with.
- Paddle: lowest tax/compliance risk for international expansion. Slightly more vendor lock-in.
- Lemon Squeezy: medium risk due to post-acquisition uncertainty.

### Maintenance burden
Every flow we want with Grow, we build and maintain. Grow becomes a forever-tax on eng time. Stripe/Paddle/LS ship features quarterly that we consume for free.

---

## 6. Recommendation

### **Buy: migrate to Stripe Billing now. Add Stripe Tax for VAT.**

Reasoning in 3 sentences:
1. **Subscription billing is not our moat — methodology enforcement is.** Spending engineering time on payment plumbing instead of Phase B/C features is strategic misallocation.
2. **Stripe wins on the only two dimensions that matter at our stage**: time-to-launch (1.5-2 wks vs 2-3 wks bespoke) and total 24-month cost when opportunity cost is included (~$10k cheaper than staying on Grow).
3. **The reversal risk is asymmetric**: Stripe migration is cheap to undo (open API, customers can re-key cards). Building deeper on Grow gets harder to reverse weekly.

### Why not Paddle (Merchant of Record)
Paddle is the right answer **if and only if** we expand internationally in the next 6 months. For an Israel-first launch, Paddle's tax-abstraction premium (~$10k extra over 24 mo) is overkill. Reconsider Paddle migration when:
- International revenue > 25% of MRR, AND
- We're filing VAT in 3+ jurisdictions

### Why not Lemon Squeezy
Post-Stripe-acquisition strategic direction is unclear. If you want MoR, Paddle is the safer bet. If you want self-managed billing, Stripe is the safer bet. LS now occupies neither end of the spectrum cleanly.

### Why not stay on Grow
The only honest case for Grow is "we already built it." Sunk cost. Every metric except in-place inertia points to migration. Each additional week we stay on Grow accumulates more bespoke logic that must be ported later — and the GTM plan requires features (affiliates, annual, grandfather, dunning) Grow doesn't ship.

---

## 7. Migration Plan (if Stripe selected)

| Day | Action | Owner |
|---|---|---|
| 0 | Decision locked. Open Stripe account, complete onboarding & verification. | Asaf |
| 1 | Create products in Stripe: Starter / Pro / Elite (monthly + annual prices each = 6 prices total) | Asaf |
| 1 | Create coupons: `FOUNDING_19_LIFETIME` for grandfathered cohort | Asaf |
| 2-3 | Build `/api/stripe/create-checkout-session` (replaces `/api/grow/create-checkout-session`) | ido |
| 2-3 | Build `/api/stripe/webhook` (subscription.created, customer.subscription.updated, invoice.paid, invoice.payment_failed) | ido |
| 4 | Build Stripe Customer Portal link (replaces Grow's portal — they get card update, plan change, cancel for free) | ido |
| 5 | Test migration script: existing Grow subscriptions → create Stripe customers + subscriptions at $19 lifetime locked rate | ido |
| 6 | Enable Stripe Tax for IL VAT auto-calculation | Asaf |
| 7 | Soft launch: new sign-ups route to Stripe; existing customers stay on Grow temporarily | both |
| 8-10 | Migrate existing customers in batch: email "your billing is moving" + auto-create Stripe subscription, cancel Grow | both |
| 11 | Decommission Grow webhook + checkout routes after 30-day overlap. | ido |

Total eng time: ~30-40 hours over 1.5-2 weeks. No customer downtime if the soft-launch overlap is respected.

---

## 8. Affiliates (separate decision, related)

Per the GTM plan, we want 30% recurring affiliate commissions. Options:

| Option | Cost | Why |
|---|---|---|
| **Rewardful** (built for Stripe) | $49/mo at our scale | Cleanest. Stripe-native. Recommended. |
| PartnerStack | $500+/mo | Enterprise-scale. Premature. |
| Build in-house | 60+ hrs eng | Misallocation. Same logic as billing. |
| Lemon Squeezy / Paddle built-in | Free with platform | Only relevant if we choose those for billing. |

**Recommendation: Rewardful.** $49/mo to skip a 60-hour eng project that's not differentiating. Trivially the right answer.

---

## 9. Assumptions Flagged

- Current MRR: estimated at $1,000-$2,500 (50-100 active subscribers at mixed $14-$19). Not confirmed.
- Geographic mix: assumed 95% IL today. If significant international already, Paddle moves up in priority.
- Bandwidth: ido currently working solo on backend. Assumes no contractor added.
- Stripe availability in IL: verified — Stripe operates in Israel since 2023, accepts ILS, supports IL bank payouts.
- Grow contractual obligations: assumed cancellable on standard 30-day notice. Confirm before lock-in.

---

## 10. Final Verdict

**Migrate to Stripe Billing within 2 weeks. Add Rewardful for affiliates. Defer Paddle until international revenue justifies it. Decommission Grow within 60 days.**

The single decision-driver is opportunity cost: every eng hour spent on payment plumbing instead of Phase B/C differentiation is strategic loss we cannot recover.
