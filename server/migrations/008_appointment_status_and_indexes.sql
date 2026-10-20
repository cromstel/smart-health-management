-- 008 -- Appointment confirmation, prescription duration backfill, lookup index
--
-- Three small improvements to the schema that the notification scanner and
-- the refill rule depend on.
--
-- 1. `appointments.status` had no 'confirmed' member, so a booked
--    appointment could not record that a clinician had accepted it. The
--    scanner had to infer it from whether a doctor was assigned. Adding the
--    member is backward compatible: the existing values are unchanged.
-- 2. Legacy prescriptions have no `duration_days`, so the refill rule had to
--    derive the course length from the quantity and the dosing frequency.
-- 3. The scanner looks for appointments starting in the next quarter of an
--    hour, which the index supports.

ALTER TABLE appointments
  MODIFY COLUMN status ENUM('scheduled', 'confirmed', 'completed', 'cancelled') DEFAULT 'scheduled';

UPDATE prescriptions SET duration_days = 30 WHERE duration_days IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_status_start
  ON appointments (status, appointment_date, appointment_time);
