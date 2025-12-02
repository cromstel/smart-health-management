declare namespace NodeJS {
  interface ProcessEnv {
    // Application Server Configuration
    NAME: string;
    PORT: string;
    HTTPS_PORT?: string;
    NODE_ENV: 'development' | 'production' | 'test';

    // Backend Configuration
    VITE_API_URL: string;

    // Frontend Configuration
    VITE_BASE_URL: string;
    FRONTEND_URL: string;

    // Database Configuration
    DB_HOST: string;
    DB_PORT: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;
    DB_DIALECT: string;

    // JWT Configuration
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;

    // Security
    BCRYPT_ROUNDS: string;
    MAX_LOGIN_ATTEMPTS: string;
    LOCKOUT_DURATION: string;

    // File Upload
    UPLOAD_DIR: string;
    MAX_FILE_SIZE: string;

    // Email SMTP Configuration
    SMTP_HOST: string;
    SMTP_PORT: string;
    SMTP_USERNAME: string;
    SMTP_PASSWORD: string;
    EMAIL_FROM: string;

    // Twilio Configuration
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_PHONE_NUMBER: string;

    // OneDrive OAuth Configuration
    ONEDRIVE_CLIENT_ID: string;
    ONEDRIVE_CLIENT_SECRET: string;
    ONEDRIVE_REDIRECT_URI: string;

    // Google Drive OAuth Configuration
    GOOGLE_DRIVE_CLIENT_ID: string;
    GOOGLE_DRIVE_CLIENT_SECRET: string;
    GOOGLE_DRIVE_REDIRECT_URI: string;

    // Encryption
    ENCRYPTION_KEY: string;
    ENCRYPTION_IV: string;
    SESSION_SECRET: string;

    // Logging
    LOG_LEVEL: string;
    LOG_DIR: string;

    // CORS Configuration
    CORS_ORIGINS: string;
    CORS_METHODS: string;

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: string;
    RATE_LIMIT_MAX_REQUESTS: string;

    // Session Configuration
    SESSION_COOKIE_NAME: string;
    SESSION_COOKIE_MAX_AGE: string;
    SESSION_RESAVE: string;
    SESSION_SAVE_UNINITIALIZED: string;
    SESSION_SECURE: string;
    SESSION_HTTP_ONLY: string;
    SESSION_SAME_SITE: 'lax' | 'strict' | 'none';

    // Redis Configuration for Session Store
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD: string;
    REDIS_DB: string;
    REDIS_SESSION_TTL: string;

    // OAuth Configuration
    OAUTH_GOOGLE_CLIENT_ID: string;
    OAUTH_GOOGLE_CLIENT_SECRET: string;
    OAUTH_GOOGLE_REDIRECT_URI: string;
    OAUTH_FACEBOOK_CLIENT_ID: string;
    OAUTH_FACEBOOK_CLIENT_SECRET: string;
    OAUTH_FACEBOOK_REDIRECT_URI: string;

    // Stripe Payment Gateway Configuration
    STRIPE_API_KEY: string;
    STRIPE_API_SECRET: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_CURRENCY: string;

    // Application Features
    FEATURE_X_ENABLED: string;
    FEATURE_Y_ENABLED: string;
    FEATURE_Z_ENABLED: string;
    FEATURE_W_ENABLED: string;
    PASSWORD_MAX_POSTPONES: string;

    // HTTPS Configuration
    HTTPS_KEY_PATH: string;
    HTTPS_CERT_PATH: string;

    // Analytics Configuration
    ANALYTICS_ENABLED: string;
    ANALYTICS_PROVIDER: string;
    ANALYTICS_TRACKING_ID: string;

    // Backup Configuration
    BACKUP_SCHEDULE: string;
    BACKUP_RETENTION_DAYS: string;
    BACKUP_DIRECTORY: string;

    // Monitoring Configuration
    MONITORING_ENABLED: string;
    MONITORING_INTERVAL_MS: string;

    // Ghana Health Service Database
    GHS_DB_HOST: string;
    GHS_DB_PORT: string;
    GHS_DB_NAME: string;
    GHS_DB_USER: string;
    GHS_DB_PASSWORD: string;
  }
}
