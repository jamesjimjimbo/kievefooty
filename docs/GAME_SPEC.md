# Kieve Footy game specification

Kieve Footy is a private, single-competition Premier League picks game using points only.

## Calendar and bankroll

The season is scripted as Competition Weeks, independent of official matchweek numbers. Active weeks have a common lock at the first eligible fixture; breaks may be represented as non-betting weeks. Every player receives an append-only `weekly_credit` of 10 at the start of each active week, including players with negative balances. Credits affect usable bankroll but never competitive performance.

## Normal weekly picks

Each player picks Home, Draw or Away for the admin-selected Game of the Week and one other eligible fixture. Stakes must be integers of at least 1 and total exactly 10. A high bankroll does not increase that allocation. Both choices and stakes lock together at the week deadline. Before lock, only the owner and admins see picks; after lock, the league may see them.

If a player is incomplete at lock, an idempotent job creates two auto-picks: 5 on the shortest-priced GOTW outcome and 5 on the shortest-priced outcome across all non-GOTW fixtures. Draws may be favorites.

## Settlement and ledger

Decimal odds use net result: a win is `stake × odds − stake`; a loss is `−stake`. Settlement creates unique ledger records, so reruns cannot duplicate points. The ledger is authoritative and append-only; bankroll is the sum of all balance-affecting entries.

## Challenges

A challenge is directional, requires no acceptance, and must be made before lock. Each challenger can use a specific opponent only once per season. It compares normal weekly betting net only. The better result transfers 10 from loser to winner; a tie transfers zero but consumes the token. Balances may become negative.

## Standings

First Half and Second Half include only normal weekly bet wins and losses assigned to that half. Overall currently includes normal weekly betting plus challenge transfers. Weekly credits are excluded everywhere. Prize shares are informational: 15% First Half, 15% Second Half and 70% Overall.

## Future extension points

Ledger types and week flags reserve space for Holiday/Final Casinos, streak bonuses, season predictions, manager markets, Golden Boot, January mover and the Champions League Final. `OddsProvider` isolates future fixture/odds ingestion. Email preferences reserve new-week, reminder, challenge and results events without sending mail in v1.
