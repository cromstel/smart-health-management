-- 011 -- The table the sessions are kept in
--
-- The sessions used to be kept in the memory of the process that served
-- them: every visitor added to it, a restart signed everybody out at once,
-- and a deployment with more than one instance gave each instance its own
-- set of sessions, so a member of staff who moved between instances had to
-- sign in again. The store is now the database.
--
-- The shape of the table is the one the session store expects, so the store
-- finds the table it was written for and does not have to change it. The
-- index is on the expiry, which is what the store's cleanup of the expired
-- sessions reads.
--
-- The table is created only when it is missing, so the file can be applied
-- to an installation that already has it.

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id),
  INDEX idx_sessions_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
