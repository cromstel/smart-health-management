-- 015 -- OAuth authorization transactions for document storage providers
--
-- Initiating a cloud-storage connection used to redirect straight to the
-- provider with no state, no PKCE and no record of who started it. The callback
-- then trusted whatever code arrived and stored the resulting tokens against
-- whichever account the (absent) bearer token resolved to -- which was none, so
-- the tokens were never stored at all.
--
-- The connection is now a single-use, expiring transaction:
--
--   state  -- random, unguessable; it is the CSRF token for the callback and
--             the key the callback looks the transaction up by.
--   user_id -- the account that initiated it, resolved at callback time from
--             the transaction rather than from a bearer token the browser cannot
--             send on a top-level navigation.
--   code_verifier -- the PKCE verifier; the challenge goes to the provider and
--             the verifier is presented at the token exchange.
--   consumed_at -- NULL until the callback consumes the transaction. The
--             consumption is an UPDATE that succeeds for exactly one caller, so
--             two concurrent callbacks cannot both redeem the same code.
--
-- Rows older than their expiry are left to be pruned by the retention service
-- (or removed manually); the callback refuses an expired transaction.

CREATE TABLE IF NOT EXISTS oauth_authorization_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  provider ENUM('googledrive', 'onedrive') NOT NULL,
  code_verifier VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_oauth_state (state),
  KEY idx_oauth_user (user_id),
  KEY idx_oauth_expires (expires_at),
  CONSTRAINT fk_oauth_auth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;