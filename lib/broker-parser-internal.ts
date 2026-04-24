// lib/broker-parser-internal.ts
//
// Groups raw transactions into ImportedTrade objects.
//
// INVARIANT: at most ONE open trade per ticker at any time.
//   First BUY  → create trade, store phase1_price / phase1_shares
//   Scale-in   → add buy-partial to the SAME trade (no new trade)
//   Sell       → add sell-partial to the SAME trade; close if shares reach 0
//   Orphan sell (no prior buy) → single inherited trade per ticker
//
// Phase1 buy is NOT duplicated into partials.
// The journal's getCurrentShares = phase1_shares + Σbuy_partials - Σsell_partials.

import type { BrokerFormat, ImportedTrade, PartialRecord, RawTransaction } from './broker-parser';

// Running ACB state kept parallel to the trades array
interface OpenState {
  tradeIndex: number;   // index into trades[]
  shares:     number;   // remaining shares (ACB running count)
  avgCost:    number;   // ACB running average
}

export function groupToTrades(transactions: RawTransaction[], _format: BrokerFormat): ImportedTrade[] {
  console.log(`[PARSER] Processing ${transactions.length} transactions`);

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  // Map from ticker → running ACB state.  A ticker is in this map IFF it has an open trade.
  const openState   = new Map<string, OpenState>();
  // Orphan sells per ticker (sell rows with no prior buy in the file)
  const orphanSells = new Map<string, Array<{ date: string; price: number; shares: number }>>();
  // All trades (open and closed) built incrementally
  const trades: ImportedTrade[] = [];

  for (const { ticker, action, quantity, price, date } of sorted) {
    const open = openState.get(ticker);
    console.log(`[PARSER] ${ticker} ${action} ${quantity} @ ${price} on ${date} — open? ${open ? `yes (idx ${open.tradeIndex}, ${open.shares} sh)` : 'no'}`);

    if (action === 'buy') {

      if (!open) {
        // ── First buy for this ticker — create a brand-new trade ──────────────
        const estStop = price * 0.92;
        const trade: ImportedTrade = {
          _importId:             crypto.randomUUID(),
          ticker,
          phase1_date:           `${date}T12:00:00Z`,
          phase1_price:          price,
          phase1_shares:         quantity,
          initial_stop:          estStop,
          current_stop:          estStop,
          stop_distance_pct:     8,
          risk_dollars:          (price - estStop) * quantity,
          status:                'open',
          exit_date:             null,
          exit_price:            null,
          pnl_dollars:           null,
          pnl_pct:               null,
          r_multiple:            null,
          outcome:               null,
          partials:              [],
          current_shares:        quantity,
          trend_template_passed: false,
          is_what_if:            true,
          failed_gates:          ['imported_from_broker'],
          notes:                 'Imported from broker',
          isDuplicate:           false,
          hasWarning:            false,
          warningMsg:            '',
          isOrphan:              false,
        };
        trades.push(trade);
        openState.set(ticker, { tradeIndex: trades.length - 1, shares: quantity, avgCost: price });
        console.log(`[PARSER] → NEW trade for ${ticker} at index ${trades.length - 1}`);

      } else {
        // ── Scale-in: add buy-partial to existing open trade ─────────────────
        const trade      = trades[open.tradeIndex];
        const newShares  = open.shares + quantity;
        const newAvgCost = (open.shares * open.avgCost + quantity * price) / newShares;

        trade.partials.push({
          id:          crypto.randomUUID(),
          date:        `${date}T12:00:00Z`,
          action:      'buy',
          shares:      quantity,
          price,
          pnl_dollars: 0,
          pnl_pct:     0,
          r_multiple:  0,
        });

        open.shares      = newShares;
        open.avgCost     = newAvgCost;
        trade.current_shares = newShares;

        console.log(`[PARSER] → ADD to existing ${ticker} trade (idx ${open.tradeIndex}) — now ${newShares} sh @ $${newAvgCost.toFixed(2)} avg`);
      }

    } else {
      // ── SELL ────────────────────────────────────────────────────────────────

      if (!open) {
        // Orphan sell — no open position for this ticker
        if (!orphanSells.has(ticker)) orphanSells.set(ticker, []);
        orphanSells.get(ticker)!.push({ date, price, shares: quantity });
        console.log(`[PARSER] → ORPHAN sell for ${ticker} (no open position)`);
        continue;
      }

      const trade      = trades[open.tradeIndex];
      const sellShares = Math.min(quantity, open.shares);

      // PnL computed from ACB average at time of sale
      const pnlDollars = (price - open.avgCost) * sellShares;
      const pnlPct     = open.avgCost > 0 ? ((price - open.avgCost) / open.avgCost) * 100 : 0;
      const riskPerSh  = Math.max(0, open.avgCost - trade.initial_stop);
      const rMult      = riskPerSh > 0 ? pnlDollars / (riskPerSh * sellShares) : 0;

      trade.partials.push({
        id:          crypto.randomUUID(),
        date:        `${date}T12:00:00Z`,
        action:      'sell',
        shares:      sellShares,
        price,
        pnl_dollars: pnlDollars,
        pnl_pct:     pnlPct,
        r_multiple:  rMult,
      });

      open.shares         -= sellShares;
      trade.current_shares = open.shares;

      if (open.shares <= 0) {
        // ── Position fully closed ─────────────────────────────────────────────
        const sellPartials = trade.partials.filter(p => p.action === 'sell');
        const buyPartials  = trade.partials.filter(p => p.action === 'buy');
        const totalPnl     = sellPartials.reduce((s, p) => s + p.pnl_dollars, 0);
        const totalInvested = trade.phase1_price * trade.phase1_shares
          + buyPartials.reduce((s, p) => s + p.price * p.shares, 0);
        const riskPerShBase = Math.max(0, trade.phase1_price - trade.initial_stop);

        trade.status      = 'closed';
        trade.exit_date   = `${date}T12:00:00Z`;
        trade.exit_price  = price;
        trade.pnl_dollars = totalPnl;
        trade.pnl_pct     = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;
        trade.r_multiple  = riskPerShBase > 0 ? totalPnl / (riskPerShBase * trade.phase1_shares) : null;
        trade.outcome     = totalPnl > 0.005 ? 'winner' : totalPnl < -0.005 ? 'loser' : 'breakeven';

        openState.delete(ticker);
        console.log(`[PARSER] → ${ticker} CLOSED. PnL: $${totalPnl.toFixed(2)} | outcome: ${trade.outcome}`);
      } else {
        console.log(`[PARSER] → ${ticker} TRIM — ${open.shares} sh remaining`);
      }
    }
  }

  // ── Orphan (inherited) positions ────────────────────────────────────────────
  for (const [ticker, sells] of orphanSells) {
    if (openState.has(ticker)) continue;   // ticker later bought — already covered

    const totalShares  = sells.reduce((s, x) => s + x.shares, 0);
    const avgSellPrice = sells.reduce((s, x) => s + x.price * x.shares, 0) / totalShares;
    const partials: PartialRecord[] = sells.map(s => ({
      id:          crypto.randomUUID(),
      date:        `${s.date}T12:00:00Z`,
      action:      'sell' as const,
      shares:      s.shares,
      price:       s.price,
      pnl_dollars: 0,
      pnl_pct:     0,
      r_multiple:  0,
    }));

    trades.push({
      _importId:             crypto.randomUUID(),
      ticker,
      phase1_date:           `${sells[0].date}T12:00:00Z`,
      phase1_price:          avgSellPrice,      // placeholder — user must edit
      phase1_shares:         totalShares,       // = totalSold so getCurrentShares → 0
      initial_stop:          avgSellPrice * 0.92,
      current_stop:          avgSellPrice * 0.92,
      stop_distance_pct:     8,
      risk_dollars:          0,
      status:                'closed',
      exit_date:             `${sells[sells.length - 1].date}T12:00:00Z`,
      exit_price:            sells[sells.length - 1].price,
      pnl_dollars:           0,
      pnl_pct:               null,
      r_multiple:            null,
      outcome:               null,
      partials,
      current_shares:        0,
      trend_template_passed: false,
      is_what_if:            true,
      failed_gates:          ['imported_from_broker', 'inherited_position'],
      notes:                 '⚠ Sell with no prior buy — inherited position or short. Edit entry price manually.',
      isDuplicate:           false,
      hasWarning:            true,
      warningMsg:            'Inherited position — review entry price',
      isOrphan:              true,
    });
    console.log(`[PARSER] → ORPHAN trade created for ${ticker} (${totalShares} sh sold)`);
  }

  console.log(`[PARSER] Final: ${trades.length} trades produced from ${transactions.length} transactions`);

  // Sort: open first (entry date ASC), closed next (entry date DESC), orphans last
  const openTrades    = trades.filter(t => t.status === 'open'   && !t.isOrphan);
  const closedTrades  = trades.filter(t => t.status === 'closed' && !t.isOrphan);
  const orphanTrades  = trades.filter(t => t.isOrphan);

  return [
    ...openTrades.sort((a, b)   => a.phase1_date.localeCompare(b.phase1_date)),
    ...closedTrades.sort((a, b) => b.phase1_date.localeCompare(a.phase1_date)),
    ...orphanTrades,
  ];
}
