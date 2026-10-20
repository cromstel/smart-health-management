-- 006 — Numeric quantity on the administration record
--
-- The stock decrement had to parse the leading number out of the free-text
-- dosage ("3 Tablets" -> 3), which is unreliable: a dose written as "One
-- tablet" has no number at all. The record now carries the quantity
-- explicitly, and the dosage text stays a human-readable description.

ALTER TABLE medication_administrations
  ADD COLUMN IF NOT EXISTS quantity INT NULL
  COMMENT 'Units consumed by this dose; NULL = derive from the dosage text';
