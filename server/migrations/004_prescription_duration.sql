-- 004 — Prescription duration
--
-- The refill rule needs to know how long a prescription is valid for. The
-- table had no duration column, so the browser kept its own copy of the
-- prescription list with a hardcoded duration instead of reading real rows.

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS duration_days INT NULL;
