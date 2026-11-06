-- 005 — Widen the phone columns so the value can be encrypted
--
-- The phone number is a sensitive field and is encrypted at rest like the
-- patient's name, email and address. The columns were VARCHAR(20), which
-- holds a phone number but not the hex encoded ciphertext, so the field had
-- to be stored as entered while every other sensitive field was encrypted.
--
-- Widening the column is forward-only and loses no data.

ALTER TABLE patients MODIFY COLUMN phone VARCHAR(255) NULL;
ALTER TABLE staff MODIFY COLUMN phone VARCHAR(255) NULL;
