-- 013_user_preferences.sql — per-user persistent settings (replaces localStorage)
-- Idempotent; safe to re-run with db:migrate
CREATE TABLE IF NOT EXISTS user_preferences (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  category VARCHAR(32) NOT NULL COMMENT 'theme | settings | dashboard | inventory | pharmacy | form_draft | auth',
  preference_key VARCHAR(64) NOT NULL,
  preference_value TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY user_pref_unique (user_id, category, preference_key),
  INDEX idx_user_pref_lookup (user_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
