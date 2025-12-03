# GEMINI.md - Frontend Interaction Guidelines

This document outlines guidelines for frontend implementation and error handling within the 'src' directory.

## 1. Project Implementation Guidelines (Frontend)

-   **Component Structure:**
    -   Organize components logically (e.g., by feature, common, layout).
    -   Use functional components with React Hooks.
    -   Prefer composition over inheritance.
-   **State Management:**
    -   Use React Context API or a dedicated state management library (e.g., Zustand, Redux) for global state.
    -   Keep component-level state minimal and localized.
-   **Styling:**
    -   Utilize Tailwind CSS for utility-first styling.
    -   Maintain a consistent design system, potentially using a component library (e.g., Material UI, Chakra UI) if adopted.
-   **API Integration:**
    -   Use a dedicated service layer (e.g., `src/services`) for all API calls.
    -   Use `async/await` for handling asynchronous operations.
    -   Implement data fetching with libraries like React Query or SWR for caching, revalidation, and error handling.
-   **Routing:**
    -   Use React Router for client-side navigation.
    -   Implement protected routes for authenticated users.
-   **Performance:**
    -   Optimize rendering with `React.memo`, `useCallback`, `useMemo`.
    -   Lazy load components and routes using `React.lazy` and `Suspense`.

## 2. Error Handling Guidelines (Frontend)

-   **User Experience Focus:** Prioritize a good user experience even when errors occur. Avoid abrupt crashes or technical jargon.
-   **Error Boundaries:**
    -   Implement React Error Boundaries to gracefully catch JavaScript errors in components and display fallback UIs.
    -   Wrap main parts of the application and critical components with Error Boundaries.
-   **API Error Handling:**
    -   Catch errors from API calls (e.g., using `try-catch` in `async` functions or error handling provided by data fetching libraries).
    -   Map backend error codes/messages to user-friendly frontend messages.
    -   Display transient errors (e.g., network issues) with toast notifications that can be dismissed.
    -   For critical errors that prevent functionality, display an error message directly on the affected UI section or a dedicated error page.
-   **Form Validation Errors:**
    -   Provide immediate feedback for form validation errors, highlighting invalid fields.
    -   Display clear and concise error messages next to the input fields.
-   **Global Error Notifications:**
    -   Use a consistent UI component (e.g., a toast notification system) for displaying non-critical global error messages.
-   **Logging Frontend Errors:**
    -   Send client-side errors (especially those caught by Error Boundaries) to an error monitoring service (e.g., Sentry, Bugsnag) for tracking and analysis.
    -   Avoid logging sensitive user data.
-   **Retry Mechanisms:** For actions that can be retried (e.g., a failed API request due to network issues), provide a "Retry" button to the user.
