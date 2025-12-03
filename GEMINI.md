# GEMINI.md - Project Interaction Guidelines

This document outlines guidelines for interacting with the project for implementation and error handling.

## 1. Project Implementation Guidelines

-   **Adhere to existing conventions:** Always prioritize consistency with existing code style, naming conventions, and architectural patterns.
-   **Technology Stack:**
    -   **Frontend:** React with TypeScript, using Tailwind CSS and Material Design principles for UI/UX.
    -   **Backend:** Node.js with Express.js and TypeScript.
    -   **Database:** [Specify Database, e.g., PostgreSQL, MongoDB]
    -   **Package Manager:** npm
-   **Code Structure:**
    -   Organize files by feature or domain, rather than by type (e.g., `src/users` instead of `src/components`, `src/services`).
    -   Keep components small and focused.
-   **Testing:**
    -   All new features and bug fixes require corresponding unit and integration tests.
    -   Use `vitest` for frontend and `jest` for backend testing.
    -   Aim for high test coverage.
-   **Documentation:**
    -   Document complex logic, public APIs, and important design decisions.
    -   Keep `README.md` up-to-date.

## 2. Error Handling Guidelines

-   **Catch Errors Early:** Implement robust error boundaries in the UI and comprehensive `try-catch` blocks in the backend.
-   **Informative Error Messages:**
    -   **User-facing errors:** Should be clear, concise, and provide actionable advice without exposing sensitive system details.
    -   **Developer-facing errors:** Should include sufficient detail (e.g., stack traces, relevant variable values) for debugging.
-   **Centralized Logging:**
    -   Use a consistent logging mechanism across the application (e.g., Winston for Node.js).
    -   Log errors with appropriate severity levels (e.g., `error`, `warn`).
    -   Avoid logging sensitive information.
-   **Error Codes:** Consider using standardized error codes for different types of errors, especially for API responses.
-   **Frontend Error Display:**
    -   Show user-friendly error messages or fallback UIs.
    -   Avoid blank screens or crashes.
    -   Use toast notifications or dedicated error pages for critical issues.
-   **Backend Error Responses:**
    -   Return appropriate HTTP status codes (e.g., 400 for bad request, 401 for unauthorized, 404 for not found, 500 for internal server error).
    -   Include a structured error object in the response body (e.g., `{ "error": { "code": "INVALID_INPUT", "message": "Invalid email format." } }`).
-   **Retries:** Implement retry mechanisms with exponential backoff for transient network or service errors where appropriate.
