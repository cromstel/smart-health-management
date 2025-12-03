# GEMINI.md - Server-side Interaction Guidelines

This document outlines guidelines for server-side implementation and error handling within the 'server' directory.

## 1. Project Implementation Guidelines (Server)

-   **API Design:**
    -   Follow RESTful principles for API endpoints.
    -   Use clear and descriptive endpoint names.
    -   Version APIs (e.g., `/api/v1/...`).
-   **Middleware:**
    -   Use middleware for authentication, authorization, logging, and error handling.
    -   Keep middleware functions focused on a single responsibility.
-   **Database Interactions:**
    -   Use an ORM/ODM (e.g., TypeORM, Mongoose) for database interactions.
    -   Implement proper indexing and query optimization.
    -   Sanitize and validate all incoming data before database operations to prevent injection attacks.
-   **Security:**
    -   Implement JWT-based authentication as per `JWT_SECURITY_GUIDE.md`.
    -   Encrypt sensitive data at rest and in transit.
    -   Protect against common web vulnerabilities (XSS, CSRF, etc.).
    -   Rate limiting on API endpoints.
-   **Configuration:**
    -   Manage environment-specific configurations using `.env` files and a configuration management library (e.g., `dotenv`, `config`).
    -   Never hardcode sensitive information.

## 2. Error Handling Guidelines (Server)

-   **Centralized Error Handling Middleware:** Implement a global error handling middleware to catch all unhandled exceptions and send consistent error responses.
-   **Logging:**
    -   Log all server-side errors using a structured logger (e.g., Winston, Pino).
    -   Include request ID, stack trace, and relevant context for every error.
    -   Configure log rotation and retention policies.
-   **Error Types:**
    -   Define custom error classes for specific business logic errors (e.g., `NotFoundError`, `ValidationError`, `UnauthorizedError`).
    -   Map these custom errors to appropriate HTTP status codes in the error handling middleware.
-   **Avoid Leaking Information:**
    -   In production environments, never send raw stack traces or internal server details to the client.
    -   Provide generic error messages for unhandled exceptions (e.g., "An unexpected error occurred").
-   **Monitoring and Alerts:** Integrate with monitoring tools (e.g., Sentry, Prometheus) to track error rates and receive alerts for critical issues.
