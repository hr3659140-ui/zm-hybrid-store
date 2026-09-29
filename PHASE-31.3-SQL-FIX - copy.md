# Phase 31.3 SQL Fix

Two PostgreSQL PL/pgSQL `RAISE EXCEPTION` statements used `||` directly
inside the RAISE syntax. PostgreSQL does not accept that form.

This version uses `RAISE EXCEPTION USING message = format(...)` and also
creates `affiliate_payout_requests` before altering it.

Run the complete `supabase/phase31.3-affiliate-payouts.sql` from the
beginning in a new Supabase SQL Editor query.
