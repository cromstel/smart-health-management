# Phase 8 RBAC Completion Plan

## Scope & Pending Items
- Pending tasks to complete under Phase 8 (src/docs/IMPLEMENTATION_CHECKLIST.md:280-288):
  1) Role hierarchy
  2) Department-based permissions
  3) Permission inheritance
  4) Audit logging for permission changes
  5) Real-time permission updates
- Current RBAC status:
  - Backend permission gates exist in `server/src/middleware/auth.ts:53-107` (`requirePermission` with hospital scoping).
  - Frontend gating via `src/contexts/AuthContext.tsx:30-34` (`hasPermission`).
  - Audit logs exist (`server/src/database/schema.sql:267-283`) and are used for Super Admin actions, but not permission changes.
  - Real-time updates are not implemented.

## Data Model Changes
- Extend `roles` to support hierarchy:
  - Add `parent_id BIGINT UNSIGNED NULL REFERENCES roles(id)` and optional `level INT DEFAULT 0` in `server/src/database/schema.sql`.
- Extend `permissions` to support department scoping:
  - Add `department_id BIGINT UNSIGNED NULL REFERENCES departments(id)`.
  - Update unique key to `(role_id, module, department_id)`.
- Migrations:
  - Create idempotent ALTER statements and backfill `parent_id = NULL`, `department_id = NULL` for existing rows.

## Backend Enforcement
- Permission resolution order (in `server/src/middleware/auth.ts`):
  - Check `all:<action>` for user’s role.
  - Check `(module:<action>, department_id=NULL)` for user’s role.
  - If not allowed, traverse role hierarchy (parent_id chain) and repeat checks to implement inheritance.
  - For hospital-scoped modules, keep existing hospital checks (`auth.ts:89-101`).
  - For department-scoped enforcement, read `req.query.departmentId | req.body.departmentId | req.params.departmentId` and prefer department-specific permission row when present; otherwise fall back to global module permission.
- Implementation:
  - Add helper: `resolvePermission({ userId, module, action, departmentId })` that queries current role, then iteratively checks parent roles until root.
  - Unit tests: extend `server/src/tests/middleware/requirePermission.test.ts` to cover hierarchy and department scoping.

## Backend APIs
- Roles CRUD (`server/src/controllers/role.controller.ts`):
  - Add support to set `parent_id` on create/update.
  - On update/create/delete of roles, write audit logs for role structure changes.
- Permissions management (new endpoint or extend roles):
  - Add controller to upsert permissions with optional `department_id`.
  - Log audit entries on permission changes with old/new values.
- User role assignment:
  - When a user’s `role_id` changes, emit audit log and real-time event.

## Audit Logging for Permission Changes
- Insert into `audit_logs` on:
  - Role `parent_id` updates (action: `role_hierarchy_update`, module: `role`).
  - Permission upserts (action: `permission_update`, module: `permissions`), storing `record_id` (permission row id), `old_value`, `new_value` JSON snapshots, `ip_address`, `user_agent`.
  - User role assignment changes (action: `role_assignment`, module: `users`).
- Reference table: `server/src/database/schema.sql:267-283`.
- Add paginated query endpoint `/api/audit/permissions` for stakeholders.

## Real-Time Permission Updates
- Implement SSE endpoint `/api/permissions/stream`:
  - On relevant changes (permission rows, role hierarchy, user role assignment), push events: `{ type, userId?, roleId?, module?, action?, departmentId?, timestamp }`.
  - Maintain a simple in-memory broadcaster; scope by hospital if necessary.
- Frontend subscription:
  - Add `PermissionsProvider` to open an `EventSource` and update `AuthContext.user.permissions` when a change affects current user/user role.
  - Update components relying on `hasPermission` to re-render when permissions change.
  - Fallback: poll `/api/auth/me` permissions every N minutes when SSE unavailable.

## Frontend Updates
- AuthContext (`src/contexts/AuthContext.tsx`):
  - Add `canActOnDepartment(deptId)` utility mirroring hospital logic.
  - Accept live permission updates via context from `PermissionsProvider`.
- RolesPage (`src/pages/RolesPage.tsx`):
  - Enable parent role selection (hierarchy).
  - Add department-scoped toggles if a department is selected.
  - On save/delete, call backend endpoints and display audit confirmation.
- Sidebar/menu filters (`src/components/layout/AppSidebar.tsx:113`):
  - No change required; re-renders on context update.

## Documentation Updates
- Update `src/docs/IMPLEMENTATION_CHECKLIST.md:262-288`:
  - Mark all five pending items as completed with timestamp and responsible party.
  - Add implementation notes detailing:
    - Role hierarchy model and traversal in middleware.
    - Department permission schema and enforcement.
    - Inheritance resolution order and fallbacks.
    - Audit logging coverage and endpoints.
    - Real-time SSE endpoint and client integration.
  - Keep formatting consistent with existing checklist.
- Cross-references:
  - Link to backend files: `server/src/middleware/auth.ts`, `server/src/controllers/role.controller.ts`.
  - Link to frontend files: `src/contexts/AuthContext.tsx`, `src/pages/RolesPage.tsx`.
  - Ensure README “Current Status” and Super Admin audit section reflect new capabilities.

## Verification
- Backend tests:
  - Extend `server/src/tests/middleware/requirePermission.test.ts` for hierarchy and department scenarios.
  - Add tests for permission update audit logs.
- Frontend tests:
  - Add tests verifying `AuthContext` refreshes permissions on SSE event.
  - Verify `RolesPage` parent selection and department toggles respect gating.
- Manual checks:
  - Use a role without direct permission but with inherited rights to confirm access.
  - Confirm audit log entries appear after permission changes.

## Rollout & Notes
- Backward compatibility: `department_id` is NULL by default; existing behavior unchanged until department-specific rows are used.
- If database uses strict BIGINT ids, align controllers with schema ids when inserting (adjust `uuidv4()` usage to auto-increment or switch to VARCHAR ids consistently after separate migration).
- Security: do not expose audit log sensitive data; follow existing middleware gates.

## Documentation Edits to Perform
- For each completed item, append: `— Completed: <ISO timestamp> — Responsible: Assistant`.
- Add a concise “Implementation Notes” block under Phase 8 with 4–6 bullets summarizing specifics.
- Verify references to modules and endpoints are accurate and consistent.
