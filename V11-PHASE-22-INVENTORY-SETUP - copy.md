# V11 Phase 22 — Inventory Pro

## SQL
Run `supabase/phase22-inventory.sql` in Supabase SQL Editor.

## Admin
Deploy the production ZIP, then open Admin → Inventory.

Features:
- live parent/variant stock overview
- low-stock and out-of-stock counts
- secure atomic manual adjustments
- inventory ledger
- variant-specific adjustments
- manager/admin authorization

Manual adjustment examples:
- `+10` adds 10 units
- `-3` removes 3 units
- `=25` sets final stock to 25

Stock can never become negative.
