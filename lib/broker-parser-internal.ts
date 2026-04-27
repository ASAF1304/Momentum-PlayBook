// lib/broker-parser-internal.ts
//
// Groups raw transactions into ImportedTrade objects, merging with any
// existing open positions already in the database.
//
// INVARIANT: at most ONE open trade per ticker+direction at any time.
// Key = `ticker|long` or `ticker|short` — lets a user be long AND short
// the same ticker simultaneously without the two positions colliding.
//
//   First BUY (no open position anywhere) → create new ImportedTrade
//   Scale-in BUY (position open in file)  → buy-partial on the in-file trade
//   Scale-in BUY (position open in DB)    → pending buy-partial on TradeUpdate
//   SELL (position open in file)          → sell-partial; may close the trade
//   SELL (position open in DB)            → pending sell-partial; may close via update
//   SELL (no open position anywhere)      → orphan — one inherited trade per ticker+direction
//
// Phase-1 buy is NOT added to partials.
// Journal formula:  getCurrentShares = phase1_shares + Σbuy_partials − Σsell_partials

import type {
  BrokerFormat,
  ExistingPosition,
  ImportedTrade,
  PartialRecord,
  RawTransaction,
  TradeUpdate,
} from './broker-parser';

// ── Internal state per open ticker+direction ──────────────────────────────────

interface OpenState {
  tradeIndex:            number;          // index into trades[]; -1 = DB trade
  existingId:            string | null;   // only when tradeIndex === -1
  existingPhase1Date:    string | null;   // for TradeUpdate display
  existingCurrentShares: number;          // shares at start of this import (for display)
  shares:                number;          // running ACB share count
  avgCost:               number;          // running ACB average
  initial_stop:          number;
  isShort:               boolean;         // true = short position (PnL inverted)
  ticker:                string;          // denormalized for updates loop
  pendingPartials:       PartialRecord[]; // queued new partials for DB trade
}

function stateKey(ticker: string, isShort: boolean): string {
  return `${ticker}|${isShort ? 'short' : 'long'}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function groupToTrades(
  transactions:       RawTransaction[],
  _format:            BrokerFormat,
  existingPositions:  Map<string, ExistingPosition> = new Map(),
  existingSignatures: Set<string>                  = new Set(),
): { newTrades: ImportedTrade[]; updates: TradeUpdate[]; skippedCount: number } {

  console.log(`[PARSER] Processing ${transactions.length} transactions; ${existingPositions.size} existing open positions`);

  // Stable sort: primary = date ASC, secondary = original file row order
  const sorted = transactions
    .map((tx, idx) => ({ ...tx, _idx: idx }))
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a._idx - b._idx;
    });

  // Pre-seed openState from DB open positions so sells/scale-ins merge correctly
  const openState = new Map<string, OpenState>();
  for (const [ticker, pos] of existingPositions) {
    const key = stateKey(ticker, pos.isShort ?? false);
    openState.set(key, {
      tradeIndex:            -1,
      existingId:            pos.existingId,
      existingPhase1Date:    pos.phase1Date,
      existingCurrentShares: pos.shares,
      shares:                pos.shares,
      avgCost:               pos.avgCost,
      initial_stop:          pos.initial_stop,
      isShort:               pos.isShort ?? false,
      ticker,
      pendingPartials:       [],
    });
    console.log(`[PARSER] Pre-seeded DB position: ${ticker} (${pos.shares} sh @ $${pos.avgCost.toFixed(2)} avg${pos.isShort ? ' SHORT' : ''})`);
  }

  const orphanSells   = new Map<string, Array<{ date: string; price: number; shares: number }>>();
  const closedDbUpdates: TradeUpdate[] = [];
  const trades: ImportedTrade[] = [];
  let skippedCount = 0;

  for (const { ticker, action, quantity, price, date, isShort = false, pnl: txPnl } of sorted) {

    // ── Deduplication: skip if this exact transaction is already in the DB ────
    const sig = `${ticker}|${date}|${price.toFixed(2)}|${quantity}|${action}`;
    if (existingSignatures.has(sig)) {
      console.log(`[PARSER] SKIP dup: ${sig}`);
      skippedCount++;
      continue;
    }

    const key  = stateKey(ticker, isShort);
    const open = openState.get(key);
    console.log(`[PARSER] ${ticker}${isShort ? '[SHORT]' : ''} ${action.toUpperCase()} ${quantity} @ ${price} on ${date} — open? ${open ? (open.tradeIndex === -1 ? `DB (${open.shares} sh${open.isShort ? ' SHORT' : ''})` : `in-file idx ${open.tradeIndex} (${open.shares} sh)`) : 'no'}`);

    // ── BUY ──────────────────────────────────────────────────────────────────
    if (action === 'buy') {

      if (!open) {
        // No open position anywhere → create brand-new trade
        // Short stop is ABOVE entry (8% upside risk); long stop is below
        const estStop      = isShort ? price * 1.08 : price * 0.92;
        const riskPerShare = isShort ? (estStop - price) : (price - estStop);
        const trade: ImportedTrade = {
          _importId:             crypto.randomUUID(),
          ticker,
          phase1_date:           `${date}T12:00:00Z`,
          phase1_price:          price,
          phase1_shares:         quantity,
          initial_stop:          estStop,
          current_stop:          estStop,
          stop_distance_pct:     8,
          risk_dollars:          riskPerShare * quantity,
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
          is_short:              isShort,
          failed_gates:          ['imported_from_broker'],
          notes:                 isShort ? 'Short position (imported from broker)' : 'Imported from broker',
          isDuplicate:           false,
          hasWarning:            false,
          warningMsg:            '',
          isOrphan:              false,
        };
        trades.push(trade);
        openState.set(key, {
          tradeIndex:            trades.length - 1,
          existingId:            null,
          existingPhase1Date:    null,
          existingCurrentShares: 0,
          shares:                quantity,
          avgCost:               price,
          initial_stop:          estStop,
          isShort,
          ticker,
          pendingPartials:       [],
        });
        console.log(`[PARSER] → NEW ${isShort ? 'SHORT' : 'LONG'} trade for ${ticker} at idx ${trades.length - 1}`);

      } else {
        // Open position exists → scale-in (add buy partial)
        const newShares  = open.shares + quantity;
        const newAvgCost = (open.shares * open.avgCost + quantity * price) / newShares;
        const partial: PartialRecord = {
          id:          crypto.randomUUID(),
          date:        `${date}T12:00:00Z`,
          action:      'buy',
          shares:      quantity,
          price,
          pnl_dollars: 0,
          pnl_pct:     0,
          r_multiple:  0,
        };

        if (open.tradeIndex === -1) {
          // Scale-in into an existing DB trade
          open.pendingPartials.push(partial);
          console.log(`[PARSER] → ADD partial to DB trade ${ticker}${isShort ? '[SHORT]' : ''}`);
        } else {
          // Scale-in into an in-file trade
          const trade = trades[open.tradeIndex];
          trade.partials.push(partial);
          trade.current_shares = newShares;
          console.log(`[PARSER] → ADD partial to in-file trade ${ticker}${isShort ? '[SHORT]' : ''} (idx ${open.tradeIndex})`);
        }
        open.shares  = newShares;
        open.avgCost = newAvgCost;
      }

    // ── SELL ─────────────────────────────────────────────────────────────────
    } else {

      if (!open) {
        // No open position anywhere → orphan sell
        if (!orphanSells.has(key)) orphanSells.set(key, []);
        orphanSells.get(key)!.push({ date, price, shares: quantity });
        console.log(`[PARSER] → ORPHAN ${isShort ? 'COVER' : 'sell'} ${ticker}`);
        continue;
      }

      const sellShares = Math.min(quantity, open.shares);
      // Prefer the realized P&L supplied directly by the broker file (Meitav).
      // Fall back to price-based calculation for formats that don't supply it.
      const pnlDollars = txPnl !== undefined
        ? txPnl
        : open.isShort
          ? (open.avgCost - price) * sellShares
          : (price - open.avgCost) * sellShares;
      const pnlPct    = open.avgCost > 0
        ? (pnlDollars / (open.avgCost * sellShares)) * 100
        : 0;
      const riskPerSh = open.isShort
        ? Math.max(0, open.initial_stop - open.avgCost)   // short risk: stop above entry
        : Math.max(0, open.avgCost - open.initial_stop);  // long  risk: stop below entry
      const rMult     = riskPerSh > 0 ? pnlDollars / (riskPerSh * sellShares) : 0;

      const partial: PartialRecord = {
        id:          crypto.randomUUID(),
        date:        `${date}T12:00:00Z`,
        action:      'sell',
        shares:      sellShares,
        price,
        pnl_dollars: pnlDollars,
        pnl_pct:     pnlPct,
        r_multiple:  rMult,
      };

      open.shares -= sellShares;

      if (open.tradeIndex === -1) {
        // Sell against existing DB trade
        open.pendingPartials.push(partial);

        if (open.shares <= 0) {
          // DB trade fully closed
          closedDbUpdates.push({
            _updateId:          crypto.randomUUID(),
            existingId:         open.existingId!,
            ticker,
            existingPhase1Date: open.existingPhase1Date!,
            currentShares:      open.existingCurrentShares,
            newPartials:        open.pendingPartials,
            newShares:          0,
            willClose:          true,
            closeDate:          `${date}T12:00:00Z`,
            closePrice:         price,
          });
          openState.delete(key);
          console.log(`[PARSER] → DB trade ${ticker}${open.isShort ? '[SHORT]' : ''} CLOSED. PnL: $${pnlDollars.toFixed(2)}`);
        } else {
          console.log(`[PARSER] → DB trade ${ticker}${open.isShort ? '[SHORT]' : ''} TRIM — ${open.shares} sh remaining`);
        }

      } else {
        // Sell against in-file trade
        const trade = trades[open.tradeIndex];
        trade.partials.push(partial);
        trade.current_shares = open.shares;

        if (open.shares <= 0) {
          const sellPs       = trade.partials.filter(p => p.action === 'sell');
          const buyPs        = trade.partials.filter(p => p.action === 'buy');
          const totalPnl     = sellPs.reduce((s, p) => s + p.pnl_dollars, 0);
          const totalInvested = trade.phase1_price * trade.phase1_shares
            + buyPs.reduce((s, p) => s + p.price * p.shares, 0);
          const riskBase = trade.is_short
            ? Math.max(0, trade.initial_stop - trade.phase1_price)
            : Math.max(0, trade.phase1_price - trade.initial_stop);

          trade.status      = 'closed';
          trade.exit_date   = `${date}T12:00:00Z`;
          trade.exit_price  = price;
          trade.pnl_dollars = totalPnl;
          trade.pnl_pct     = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : null;
          trade.r_multiple  = riskBase > 0 ? totalPnl / (riskBase * trade.phase1_shares) : null;
          trade.outcome     = totalPnl > 0.005 ? 'winner' : totalPnl < -0.005 ? 'loser' : 'breakeven';
          openState.delete(key);
          console.log(`[PARSER] → in-file trade ${ticker}${open.isShort ? '[SHORT]' : ''} CLOSED. PnL: $${totalPnl.toFixed(2)}`);
        } else {
          console.log(`[PARSER] → in-file trade ${ticker}${open.isShort ? '[SHORT]' : ''} TRIM — ${open.shares} sh remaining`);
        }
      }
    }
  }

  // ── Still-open DB positions that received new partials ────────────────────
  const stillOpenUpdates: TradeUpdate[] = [];
  for (const state of openState.values()) {
    if (state.tradeIndex === -1 && state.pendingPartials.length > 0) {
      stillOpenUpdates.push({
        _updateId:          crypto.randomUUID(),
        existingId:         state.existingId!,
        ticker:             state.ticker,
        existingPhase1Date: state.existingPhase1Date!,
        currentShares:      state.existingCurrentShares,
        newPartials:        state.pendingPartials,
        newShares:          Math.max(0, state.shares),
        willClose:          false,
        closeDate:          null,
        closePrice:         null,
      });
    }
  }

  // ── Orphan (inherited) positions ──────────────────────────────────────────
  // Key = `ticker|long` or `ticker|short` — skip only if same direction has open position
  for (const [key, sells] of orphanSells) {
    if (openState.has(key)) continue;
    const ticker = key.split('|')[0];
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
      phase1_price:          avgSellPrice,
      phase1_shares:         totalShares,
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
      is_short:              false,
      failed_gates:          ['imported_from_broker', 'inherited_position'],
      notes:                 '⚠ Sell with no prior buy — inherited position or short. Edit entry price manually.',
      isDuplicate:           false,
      hasWarning:            true,
      warningMsg:            'Inherited position — review entry price',
      isOrphan:              true,
    });
    console.log(`[PARSER] → ORPHAN trade ${ticker} (${totalShares} sh sold)`);
  }

  const updates = [...closedDbUpdates, ...stillOpenUpdates];
  console.log(`[PARSER] Final: ${trades.length} new trades, ${updates.length} updates, ${skippedCount} duplicates skipped`);

  // Sort: open (entry ASC), closed (entry DESC), orphans last
  const openTrades   = trades.filter(t => t.status === 'open'   && !t.isOrphan);
  const closedTrades = trades.filter(t => t.status === 'closed' && !t.isOrphan);
  const orphanTrades = trades.filter(t => t.isOrphan);

  return {
    newTrades: [
      ...openTrades.sort((a, b)   => a.phase1_date.localeCompare(b.phase1_date)),
      ...closedTrades.sort((a, b) => b.phase1_date.localeCompare(a.phase1_date)),
      ...orphanTrades,
    ],
    updates,
    skippedCount,
  };
}
