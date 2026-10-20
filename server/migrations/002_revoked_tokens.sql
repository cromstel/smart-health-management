-- 002 — Revoked access tokens
--
-- Logout has to invalidate the token it is handed. Without a server-side
-- record the JWT stays usable until it expires, so the session is not really
-- ended.
--
-- Only the token hash is stored, never the token itself.

CREATE TABLE IF NOT EXISTS revoked_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_revoked_token (token_hash),
  INDEX idx_revoked_expiry (expires_at)
) ENGINE=InnoDB;
