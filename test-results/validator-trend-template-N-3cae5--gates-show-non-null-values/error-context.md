# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: validator-trend-template.spec.ts >> NVDA live — auto gates show non-null values
- Location: tests\e2e\validator-trend-template.spec.ts:31:5

# Error details

```
TimeoutError: locator.waitFor: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="gate-above_ath_avwap"]') to be visible

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - generic [ref=e4]:
        - link "Momentum Playbook Stage 2 only" [ref=e5] [cursor=pointer]:
          - /url: /
          - img [ref=e7]
          - generic [ref=e10]:
            - generic [ref=e11]: Momentum Playbook
            - generic [ref=e12]: Stage 2 only
        - generic [ref=e13]:
          - link "Dashboard" [ref=e14] [cursor=pointer]:
            - /url: /
            - img [ref=e15]
            - generic [ref=e18]: Dashboard
          - link "Journal" [ref=e20] [cursor=pointer]:
            - /url: /journal
            - img [ref=e21]
            - generic [ref=e23]: Journal
          - link "Watchlist" [ref=e24] [cursor=pointer]:
            - /url: /watchlist
            - img [ref=e25]
            - generic [ref=e26]: Watchlist
          - link "Playbook" [ref=e27] [cursor=pointer]:
            - /url: /playbook
            - img [ref=e28]
            - generic [ref=e32]: Playbook
          - link "Thoughts" [ref=e33] [cursor=pointer]:
            - /url: /thoughts
            - img [ref=e34]
            - generic [ref=e42]: Thoughts
          - link "Settings" [ref=e43] [cursor=pointer]:
            - /url: /settings
            - img [ref=e44]
          - button "Switch to dark mode" [ref=e47]:
            - generic [ref=e48]:
              - img [ref=e49]
              - img [ref=e55]
          - button "Sign out" [ref=e57]:
            - img [ref=e58]
    - main [ref=e61]:
      - generic [ref=e62]:
        - button "All Time" [ref=e63]
        - button "YTD" [ref=e64]
        - button "MTD" [ref=e65]
        - button "Last 30 Days" [ref=e66]
      - generic [ref=e67]:
        - generic [ref=e68]:
          - generic [ref=e69]: Account Equity
          - generic [ref=e71]: Live
        - generic [ref=e73]: …
        - generic [ref=e74]: 0 open positions
      - generic [ref=e75]:
        - generic [ref=e76]:
          - generic [ref=e77]: Realized PnL
          - generic [ref=e79]: $0
        - generic [ref=e81]:
          - generic [ref=e82]: Unrealized PnL
          - generic [ref=e84]: —
        - generic [ref=e85]:
          - generic [ref=e86]: Win Rate
          - generic [ref=e88]: —
        - generic [ref=e89]:
          - generic [ref=e90]: Avg R
          - generic [ref=e92]: —
      - generic [ref=e93]:
        - generic [ref=e94]:
          - generic [ref=e95]: Max Drawdown
          - generic [ref=e97]: —
        - generic [ref=e98]:
          - generic [ref=e99]: Avg Win
          - generic [ref=e101]: —
        - generic [ref=e102]:
          - generic [ref=e103]: Avg Loss
          - generic [ref=e105]: —
        - generic [ref=e106]:
          - generic [ref=e107]: Win / Loss
          - generic [ref=e109]: —
          - generic [ref=e110]: avg win ÷ avg loss
      - generic [ref=e111]:
        - generic [ref=e112]:
          - generic [ref=e113]:
            - heading "Pre-Trade Checklist" [level=2] [ref=e114]
            - paragraph [ref=e115]: Trend Template is the only hard gate. Optional checks below are quality enhancers.
          - generic [ref=e116]:
            - generic [ref=e117]:
              - generic [ref=e118]: Optional Quality Checks
              - generic [ref=e119]: quality enhancers, not blockers
            - generic [ref=e120]:
              - checkbox "VCP Characteristics (Volume dry-up) Volatility contracts left→right, volume dries up at pivot — no wide-and-loose bars" [ref=e121]:
                - img [ref=e123]
                - generic [ref=e126]:
                  - generic [ref=e127]: VCP Characteristics (Volume dry-up)
                  - generic [ref=e128]: Volatility contracts left→right, volume dries up at pivot — no wide-and-loose bars
              - checkbox "Clear Breakout Pivot Well-defined pivot point with tight price action; handle or base shelf is clean" [ref=e129]:
                - img [ref=e131]
                - generic [ref=e135]:
                  - generic [ref=e136]: Clear Breakout Pivot
                  - generic [ref=e137]: Well-defined pivot point with tight price action; handle or base shelf is clean
              - checkbox "Earnings Date is Safe (Not Imminent) No earnings report within the next 3–4 weeks — never buy before earnings" [ref=e138]:
                - img [ref=e140]
                - generic [ref=e142]:
                  - generic [ref=e143]: Earnings Date is Safe (Not Imminent)
                  - generic [ref=e144]: No earnings report within the next 3–4 weeks — never buy before earnings
              - checkbox "Price above 20-EMA, 50-EMA, 200-EMA Institutional support intact — riding all three moving averages" [ref=e145]:
                - img [ref=e147]
                - generic [ref=e149]:
                  - generic [ref=e150]: Price above 20-EMA, 50-EMA, 200-EMA
                  - generic [ref=e151]: Institutional support intact — riding all three moving averages
              - checkbox "IBD RS Rating > 80 Leader, not a laggard — 90+ preferred for A+ setups" [ref=e152]:
                - img [ref=e154]
                - generic [ref=e158]:
                  - generic [ref=e159]: IBD RS Rating > 80
                  - generic [ref=e160]: Leader, not a laggard — 90+ preferred for A+ setups
              - checkbox "Market in confirmed uptrend S&P / Nasdaq above key MAs, no distribution cluster in last 4 weeks" [ref=e161]:
                - img [ref=e163]
                - generic [ref=e165]:
                  - generic [ref=e166]: Market in confirmed uptrend
                  - generic [ref=e167]: S&P / Nasdaq above key MAs, no distribution cluster in last 4 weeks
          - generic [ref=e169]:
            - img [ref=e170]
            - generic [ref=e172]:
              - paragraph [ref=e173]: "\"The goal is not to be right. The goal is to be profitable. Small losses, big wins, and the math takes care of itself.\""
              - paragraph [ref=e174]: — Mark Minervini
        - generic [ref=e175]:
          - generic [ref=e176]:
            - generic [ref=e177]:
              - generic [ref=e178]:
                - heading "Active Positions" [level=2] [ref=e179]
                - paragraph [ref=e180]: Phase 1 entries
              - link "Journal" [ref=e181] [cursor=pointer]:
                - /url: /journal
                - text: Journal
                - img [ref=e182]
            - generic [ref=e185]:
              - img [ref=e186]
              - text: Loading…
            - button "Add position manually" [ref=e188]:
              - img [ref=e189]
              - text: Add position manually
          - generic [ref=e190]:
            - generic [ref=e191]:
              - generic [ref=e192]:
                - heading "Playbook" [level=2] [ref=e193]
                - paragraph [ref=e194]: Realized outcomes
              - link "View all" [ref=e195] [cursor=pointer]:
                - /url: /playbook
                - text: View all
                - img [ref=e196]
            - generic [ref=e198]:
              - link "0 Winners" [ref=e199] [cursor=pointer]:
                - /url: /playbook?filter=winners
                - generic [ref=e200]: "0"
                - generic [ref=e201]: Winners
              - link "0 Losers" [ref=e202] [cursor=pointer]:
                - /url: /playbook?filter=losers
                - generic [ref=e203]: "0"
                - generic [ref=e204]: Losers
              - link "0 Breakeven" [ref=e205] [cursor=pointer]:
                - /url: /playbook?filter=breakevens
                - generic [ref=e206]: "0"
                - generic [ref=e207]: Breakeven
              - link "0 What-If" [ref=e208] [cursor=pointer]:
                - /url: /playbook?filter=what-if
                - generic [ref=e209]: "0"
                - generic [ref=e210]: What-If
              - link "0 All" [ref=e211] [cursor=pointer]:
                - /url: /playbook
                - generic [ref=e212]: "0"
                - generic [ref=e213]: All
          - generic [ref=e214]:
            - generic [ref=e215]:
              - generic [ref=e216]:
                - generic [ref=e217]:
                  - heading "Stage 2 Leaders — Today's Strongest Setups" [level=2] [ref=e218]
                  - paragraph [ref=e219]: Stocks passing Minervini's Trend Template · Ranked by relative strength
                - generic [ref=e220]:
                  - generic [ref=e221]: Updated daily
                  - generic [ref=e222]: 15-min delayed data
              - paragraph [ref=e223]: "Last scan: May 8, 02:00 AM"
            - generic [ref=e225]:
              - generic [ref=e226]:
                - generic [ref=e227]: "1"
                - button "MU Micron Technology, Inc." [ref=e228]:
                  - generic [ref=e229]: MU
                  - generic [ref=e230]: Micron Technology, Inc.
                - generic [ref=e231]:
                  - generic [ref=e232]: $646.63
                  - generic [ref=e233]: 729.2B
                - generic [ref=e234]:
                  - img [ref=e235]
                  - text: "-3.02%"
                - button "Watch" [ref=e238]:
                  - img [ref=e239]
                  - text: Watch
              - generic [ref=e240]:
                - generic [ref=e241]: "2"
                - button "POWL Powell Industries, Inc." [ref=e242]:
                  - generic [ref=e243]: POWL
                  - generic [ref=e244]: Powell Industries, Inc.
                - generic [ref=e245]:
                  - generic [ref=e246]: $305.93
                  - generic [ref=e247]: 11.1B
                - generic [ref=e248]:
                  - img [ref=e249]
                  - text: "-4.49%"
                - button "Watch" [ref=e252]:
                  - img [ref=e253]
                  - text: Watch
              - generic [ref=e254]:
                - generic [ref=e255]: "3"
                - button "AMD Advanced Micro Devices, Inc." [ref=e256]:
                  - generic [ref=e257]: AMD
                  - generic [ref=e258]: Advanced Micro Devices, Inc.
                - generic [ref=e259]:
                  - generic [ref=e260]: $408.46
                  - generic [ref=e261]: 666.0B
                - generic [ref=e262]:
                  - img [ref=e263]
                  - text: "-3.09%"
                - button "Watch" [ref=e266]:
                  - img [ref=e267]
                  - text: Watch
              - generic [ref=e268]:
                - generic [ref=e269]: "4"
                - button "LRCX Lam Research Corporation" [ref=e270]:
                  - generic [ref=e271]: LRCX
                  - generic [ref=e272]: Lam Research Corporation
                - generic [ref=e273]:
                  - generic [ref=e274]: $286.52
                  - generic [ref=e275]: 358.3B
                - generic [ref=e276]:
                  - img [ref=e277]
                  - text: "-3.58%"
                - button "Watch" [ref=e280]:
                  - img [ref=e281]
                  - text: Watch
              - generic [ref=e282]:
                - generic [ref=e283]: "5"
                - button "RKLB Rocket Lab Corporation" [ref=e284]:
                  - generic [ref=e285]: RKLB
                  - generic [ref=e286]: Rocket Lab Corporation
                - generic [ref=e287]:
                  - generic [ref=e288]: $78.58
                  - generic [ref=e289]: 45.4B
                - generic [ref=e290]:
                  - img [ref=e291]
                  - text: "-7.17%"
                - button "Watch" [ref=e294]:
                  - img [ref=e295]
                  - text: Watch
              - generic [ref=e296]:
                - generic [ref=e297]: "6"
                - button "ALB Albemarle Corporation" [ref=e298]:
                  - generic [ref=e299]: ALB
                  - generic [ref=e300]: Albemarle Corporation
                - generic [ref=e301]:
                  - generic [ref=e302]: $198.35
                  - generic [ref=e303]: 23.4B
                - generic [ref=e304]:
                  - img [ref=e305]
                  - text: +2.98%
                - button "Watch" [ref=e308]:
                  - img [ref=e309]
                  - text: Watch
              - generic [ref=e310]:
                - generic [ref=e311]: "7"
                - button "MRVL Marvell Technology, Inc." [ref=e312]:
                  - generic [ref=e313]: MRVL
                  - generic [ref=e314]: Marvell Technology, Inc.
                - generic [ref=e315]:
                  - generic [ref=e316]: $160.01
                  - generic [ref=e317]: 139.9B
                - generic [ref=e318]:
                  - img [ref=e319]
                  - text: "-7.05%"
                - button "Watch" [ref=e322]:
                  - img [ref=e323]
                  - text: Watch
              - generic [ref=e324]:
                - generic [ref=e325]: "8"
                - button "MOD Modine Manufacturing Company" [ref=e326]:
                  - generic [ref=e327]: MOD
                  - generic [ref=e328]: Modine Manufacturing Company
                - generic [ref=e329]:
                  - generic [ref=e330]: $269.65
                  - generic [ref=e331]: 14.2B
                - generic [ref=e332]:
                  - img [ref=e333]
                  - text: "-1.67%"
                - button "Watch" [ref=e336]:
                  - img [ref=e337]
                  - text: Watch
              - generic [ref=e338]:
                - generic [ref=e339]: "9"
                - button "CAT Caterpillar, Inc." [ref=e340]:
                  - generic [ref=e341]: CAT
                  - generic [ref=e342]: Caterpillar, Inc.
                - generic [ref=e343]:
                  - generic [ref=e344]: $895.69
                  - generic [ref=e345]: 412.5B
                - generic [ref=e346]:
                  - img [ref=e347]
                  - text: "-3.37%"
                - button "Watch" [ref=e350]:
                  - img [ref=e351]
                  - text: Watch
              - generic [ref=e352]:
                - generic [ref=e353]: "10"
                - button "AMAT Applied Materials, Inc." [ref=e354]:
                  - generic [ref=e355]: AMAT
                  - generic [ref=e356]: Applied Materials, Inc.
                - generic [ref=e357]:
                  - generic [ref=e358]: $410.64
                  - generic [ref=e359]: 325.9B
                - generic [ref=e360]:
                  - img [ref=e361]
                  - text: "-4.19%"
                - button "Watch" [ref=e364]:
                  - img [ref=e365]
                  - text: Watch
              - generic [ref=e366]:
                - generic [ref=e367]: "11"
                - button "KLAC KLA Corporation" [ref=e368]:
                  - generic [ref=e369]: KLAC
                  - generic [ref=e370]: KLA Corporation
                - generic [ref=e371]:
                  - generic [ref=e372]: $1763.25
                  - generic [ref=e373]: 230.3B
                - generic [ref=e374]:
                  - img [ref=e375]
                  - text: "-2.92%"
                - button "Watch" [ref=e378]:
                  - img [ref=e379]
                  - text: Watch
              - generic [ref=e380]:
                - generic [ref=e381]: "12"
                - button "GOOGL Alphabet Inc." [ref=e382]:
                  - generic [ref=e383]: GOOGL
                  - generic [ref=e384]: Alphabet Inc.
                - generic [ref=e385]:
                  - generic [ref=e386]: $397.99
                  - generic [ref=e387]: 4.8T
                - generic [ref=e388]:
                  - img [ref=e389]
                  - text: +0.04%
                - button "Watch" [ref=e392]:
                  - img [ref=e393]
                  - text: Watch
              - generic [ref=e394]:
                - generic [ref=e395]: "13"
                - button "NEM Newmont Corporation" [ref=e396]:
                  - generic [ref=e397]: NEM
                  - generic [ref=e398]: Newmont Corporation
                - generic [ref=e399]:
                  - generic [ref=e400]: $113.49
                  - generic [ref=e401]: 121.2B
                - generic [ref=e402]:
                  - img [ref=e403]
                  - text: "-1.40%"
                - button "Watch" [ref=e406]:
                  - img [ref=e407]
                  - text: Watch
              - generic [ref=e408]:
                - generic [ref=e409]: "14"
                - button "AVGO Broadcom Inc." [ref=e410]:
                  - generic [ref=e411]: AVGO
                  - generic [ref=e412]: Broadcom Inc.
                - generic [ref=e413]:
                  - generic [ref=e414]: $412.56
                  - generic [ref=e415]: 2.0T
                - generic [ref=e416]:
                  - img [ref=e417]
                  - text: "-3.03%"
                - button "Watch" [ref=e420]:
                  - img [ref=e421]
                  - text: Watch
              - generic [ref=e422]:
                - generic [ref=e423]: "15"
                - button "ARM Arm Holdings plc" [ref=e424]:
                  - generic [ref=e425]: ARM
                  - generic [ref=e426]: Arm Holdings plc
                - generic [ref=e427]:
                  - generic [ref=e428]: $213.31
                  - generic [ref=e429]: 226.5B
                - generic [ref=e430]:
                  - img [ref=e431]
                  - text: "-10.11%"
                - button "Watch" [ref=e434]:
                  - img [ref=e435]
                  - text: Watch
              - generic [ref=e436]:
                - generic [ref=e437]: "16"
                - button "NET Cloudflare, Inc." [ref=e438]:
                  - generic [ref=e439]: NET
                  - generic [ref=e440]: Cloudflare, Inc.
                - generic [ref=e441]:
                  - generic [ref=e442]: $256.79
                  - generic [ref=e443]: 90.7B
                - generic [ref=e444]:
                  - img [ref=e445]
                  - text: +3.30%
                - button "Watch" [ref=e448]:
                  - img [ref=e449]
                  - text: Watch
              - generic [ref=e450]:
                - generic [ref=e451]: "17"
                - button "NVDA NVIDIA Corporation" [ref=e452]:
                  - generic [ref=e453]: NVDA
                  - generic [ref=e454]: NVIDIA Corporation
                - generic [ref=e455]:
                  - generic [ref=e456]: $211.50
                  - generic [ref=e457]: 5.1T
                - generic [ref=e458]:
                  - img [ref=e459]
                  - text: +1.85%
                - button "Watch" [ref=e462]:
                  - img [ref=e463]
                  - text: Watch
              - generic [ref=e464]:
                - generic [ref=e465]: "18"
                - button "TXN Texas Instruments Incorporated" [ref=e466]:
                  - generic [ref=e467]: TXN
                  - generic [ref=e468]: Texas Instruments Incorporated
                - generic [ref=e469]:
                  - generic [ref=e470]: $285.24
                  - generic [ref=e471]: 259.6B
                - generic [ref=e472]:
                  - img [ref=e473]
                  - text: "-1.45%"
                - button "Watch" [ref=e476]:
                  - img [ref=e477]
                  - text: Watch
              - generic [ref=e478]:
                - generic [ref=e479]: "19"
                - button "SAIA Saia, Inc." [ref=e480]:
                  - generic [ref=e481]: SAIA
                  - generic [ref=e482]: Saia, Inc.
                - generic [ref=e483]:
                  - generic [ref=e484]: $448.94
                  - generic [ref=e485]: 11.9B
                - generic [ref=e486]:
                  - img [ref=e487]
                  - text: "-0.10%"
                - button "Watch" [ref=e490]:
                  - img [ref=e491]
                  - text: Watch
              - generic [ref=e492]:
                - generic [ref=e493]: "20"
                - button "GS Goldman Sachs Group, Inc. (The)" [ref=e494]:
                  - generic [ref=e495]: GS
                  - generic [ref=e496]: Goldman Sachs Group, Inc. (The)
                - generic [ref=e497]:
                  - generic [ref=e498]: $925.87
                  - generic [ref=e499]: 273.1B
                - generic [ref=e500]:
                  - img [ref=e501]
                  - text: "-1.22%"
                - button "Watch" [ref=e504]:
                  - img [ref=e505]
                  - text: Watch
            - paragraph [ref=e507]: Not investment advice. Stocks listed pass Minervini Trend Template criteria at time of scan. Always perform your own due diligence. Market data delayed by 15 minutes.
        - generic [ref=e508]:
          - generic [ref=e509]:
            - heading "Position Sizer" [level=2] [ref=e510]
            - paragraph [ref=e511]: Stop loss capped at 8%. Enter account size in Settings.
          - generic [ref=e512]:
            - textbox "TICKER" [active] [ref=e513]: NVDA
            - generic [ref=e514]: Ticker
          - generic [ref=e515]:
            - img [ref=e516]
            - generic [ref=e519]: Unauthorized
          - generic [ref=e520]:
            - generic [ref=e521]:
              - generic [ref=e523]: Entry & Stop
              - generic [ref=e524]: acc $10,000
            - generic [ref=e525]:
              - generic [ref=e526]:
                - generic [ref=e527]: Entry
                - textbox [ref=e528]
              - generic [ref=e529]:
                - generic [ref=e530]: Stop
                - textbox [ref=e531]
            - generic [ref=e532]:
              - img [ref=e533]
              - generic [ref=e536]: Account size, entry and stop must all be positive numbers.
          - generic [ref=e537]:
            - generic [ref=e540]: Amount Invested
            - generic [ref=e541]:
              - generic [ref=e542]:
                - generic [ref=e543]: $
                - textbox "0.00" [ref=e544]
              - generic [ref=e545]:
                - generic [ref=e546]: Max loss
                - generic [ref=e547]: —
          - button "Enter a ticker to begin" [disabled] [ref=e548]
  - contentinfo [ref=e549]:
    - navigation [ref=e550]:
      - link "כתב ויתור" [ref=e551] [cursor=pointer]:
        - /url: /legal/disclaimer
      - link "תנאי שימוש" [ref=e552] [cursor=pointer]:
        - /url: /legal/terms
      - link "מדיניות פרטיות" [ref=e553] [cursor=pointer]:
        - /url: /legal/privacy
      - link "מדיניות החזרים" [ref=e554] [cursor=pointer]:
        - /url: /legal/refund
      - link "תמחור" [ref=e555] [cursor=pointer]:
        - /url: /pricing
      - link "מנוי" [ref=e556] [cursor=pointer]:
        - /url: /billing
  - button "Open Next.js Dev Tools" [ref=e562] [cursor=pointer]:
    - img [ref=e563]
  - alert [ref=e566]
```

# Test source

```ts
  1   | // tests/e2e/validator-trend-template.spec.ts
  2   | //
  3   | // End-to-end tests for the 3 new auto-computed Minervini gates:
  4   | //   above_ath_avwap, near_52wh, above_52wl
  5   | //
  6   | // Scenarios:
  7   | //   1. NVDA — live API, gates should show a value (not all gray)
  8   | //   2. LAGGARD_FIXTURE — mocked: all 3 auto gates fail (red)
  9   | //   3. NEW_IPO_FIXTURE — mocked: data_quality insufficient, all 3 gates gray
  10  | //   4. Ticker switch — stale gate state is cleared when ticker changes
  11  | 
  12  | import { test, expect } from '@playwright/test';
  13  | import laggardFixture from './fixtures/laggard-response.json';
  14  | import newIpoFixture  from './fixtures/new-ipo-response.json';
  15  | 
  16  | // ── Helpers ───────────────────────────────────────────────────────────────────
  17  | 
  18  | async function waitForValidatorReady(page: import('@playwright/test').Page) {
  19  |   // Wait for auth loading spinner to disappear
  20  |   await page.waitForSelector('text=TICKER', { timeout: 20_000 });
  21  | }
  22  | 
  23  | async function fillTicker(page: import('@playwright/test').Page, symbol: string) {
  24  |   const input = page.locator('input[placeholder="TICKER"]');
  25  |   await input.clear();
  26  |   await input.fill(symbol);
  27  | }
  28  | 
  29  | // ── Test 1: NVDA live ─────────────────────────────────────────────────────────
  30  | 
  31  | test('NVDA live — auto gates show non-null values', async ({ page }) => {
  32  |   await page.goto('/');
  33  |   await waitForValidatorReady(page);
  34  |   await fillTicker(page, 'NVDA');
  35  | 
  36  |   // Wait for one of the auto gate rows to appear (API responds)
  37  |   const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
> 38  |   await avwapGate.waitFor({ state: 'visible', timeout: 15_000 });
      |                   ^ TimeoutError: locator.waitFor: Timeout 15000ms exceeded.
  39  | 
  40  |   // All 3 gates must have a state that is NOT 'insufficient' (data is available for NVDA)
  41  |   for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
  42  |     const gate  = page.locator(`[data-testid="gate-${key}"]`);
  43  |     const state = await gate.getAttribute('data-state');
  44  |     expect(['pass', 'fail'], `gate ${key} should be pass or fail, got: ${state}`).toContain(state);
  45  |   }
  46  | 
  47  |   await page.screenshot({ path: 'tests/e2e/screenshots/nvda.png' });
  48  | });
  49  | 
  50  | // ── Test 2: LAGGARD_FIXTURE — all auto gates fail ─────────────────────────────
  51  | 
  52  | test('LAGGARD fixture — all 3 auto gates are red (fail)', async ({ page }) => {
  53  |   await page.route('**/api/ticker/LAGGARD', route =>
  54  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(laggardFixture) }),
  55  |   );
  56  | 
  57  |   await page.goto('/');
  58  |   await waitForValidatorReady(page);
  59  |   await fillTicker(page, 'LAGGARD');
  60  | 
  61  |   const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
  62  |   await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });
  63  | 
  64  |   for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
  65  |     const gate  = page.locator(`[data-testid="gate-${key}"]`);
  66  |     const state = await gate.getAttribute('data-state');
  67  |     expect(state, `gate ${key} should be 'fail'`).toBe('fail');
  68  |   }
  69  | });
  70  | 
  71  | // ── Test 3: NEW_IPO_FIXTURE — all 3 auto gates gray (insufficient) ────────────
  72  | 
  73  | test('NEW_IPO fixture — all 3 auto gates are gray (insufficient)', async ({ page }) => {
  74  |   await page.route('**/api/ticker/NEWIPO', route =>
  75  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(newIpoFixture) }),
  76  |   );
  77  | 
  78  |   await page.goto('/');
  79  |   await waitForValidatorReady(page);
  80  |   await fillTicker(page, 'NEWIPO');
  81  | 
  82  |   const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
  83  |   await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });
  84  | 
  85  |   for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
  86  |     const gate  = page.locator(`[data-testid="gate-${key}"]`);
  87  |     const state = await gate.getAttribute('data-state');
  88  |     expect(state, `gate ${key} should be 'insufficient'`).toBe('insufficient');
  89  |   }
  90  | 
  91  |   // Insufficient data banner should be visible
  92  |   await expect(page.locator('text=Insufficient price history')).toBeVisible();
  93  | });
  94  | 
  95  | // ── Test 4: Ticker switch — stale state cleared ───────────────────────────────
  96  | 
  97  | test('Ticker switch — previous ticker gates cleared immediately', async ({ page }) => {
  98  |   // First mock LAGGARD (all fail) then switch to NEWIPO (all gray)
  99  |   await page.route('**/api/ticker/LAGGARD', route =>
  100 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(laggardFixture) }),
  101 |   );
  102 |   await page.route('**/api/ticker/NEWIPO', route =>
  103 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(newIpoFixture) }),
  104 |   );
  105 | 
  106 |   await page.goto('/');
  107 |   await waitForValidatorReady(page);
  108 | 
  109 |   // Load LAGGARD
  110 |   await fillTicker(page, 'LAGGARD');
  111 |   const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
  112 |   await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });
  113 |   expect(await avwapGate.getAttribute('data-state')).toBe('fail');
  114 | 
  115 |   // Switch to NEWIPO — gates should immediately clear to 'insufficient'
  116 |   await fillTicker(page, 'NEWIPO');
  117 | 
  118 |   // After ticker change, the gates should reset to gray before new data arrives
  119 |   // (they may briefly disappear since data is null, then reappear)
  120 |   await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });
  121 |   expect(await avwapGate.getAttribute('data-state')).toBe('insufficient');
  122 | 
  123 |   // Confirm no stale 'fail' state from previous ticker
  124 |   for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
  125 |     const gate  = page.locator(`[data-testid="gate-${key}"]`);
  126 |     const state = await gate.getAttribute('data-state');
  127 |     expect(state, `gate ${key} should not be stale 'fail' from LAGGARD`).toBe('insufficient');
  128 |   }
  129 | });
  130 | 
```