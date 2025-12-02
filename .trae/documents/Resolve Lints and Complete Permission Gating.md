## Scope
- Fix all reported lint errors and warnings, starting with redeclaration errors in `src/pages/AppointmentsPage.tsx`
- Address React hook dependency warnings across Super Admin pages
- Resolve fast-refresh notices with a minimal, codebase-consistent approach
- Complete granular permission gating for edit/delete actions in Roles and Staff
- Connect Super Admin UI actions to visible permission gating and audit logging
- Prepare hospital-based permission support to align UI gating with backend

## Lint Fixes: AppointmentsPage Redeclarations
- Remove duplicated function declarations introduced after refactor; keep memoized versions only
- Consolidate to `useCallback` functions for:
  - `loadAppointments`, `loadPatients`, `loadDoctors`
  - `loadInitialData` depends on the three memoized loaders
- Update `useEffect` to depend on `loadInitialData`
- Verify no duplicate names remain and imports are unchanged

## Hook Dependency Warnings
- SuperAdminAuditLogs:
  - Wrap `loadLogs` and `filterLogs` in `useCallback`
  - Update `useEffect` dependencies to include memoized functions
- SuperAdminUsers:
  - Wrap `loadUsers` and `filterUsers` in `useCallback`
  - Update `useEffect` dependencies accordingly
- Documents/Patients/Staff/Appointments:
  - Ensure newly added memoized loaders are referenced in `useEffect` dependency arrays
  - Prefer `useCallback` over inline functions used by `useEffect`

## Fast-Refresh Notices
- Preferred fix (least invasive and standards-aligned):
  - Move non-component exports to dedicated files and update imports:
    - `src/components/ui/button.tsx` → move `buttonVariants` to `src/components/ui/button.variants.ts`
    - `src/components/ui/badge.tsx` → move `badgeVariants` to `src/components/ui/badge.variants.ts`
  - Update references (e.g., `calendar.tsx`) to import from the new variant files
- Alternative (if you prefer config-only):
  - Keep current exports and set `react-refresh/only-export-components` to off in `eslint.config.js`
  - This avoids file churn; we will follow your preference during implementation

## Granular Permission Gating (Roles & Staff)
- Roles:
  - Disable Edit/Delete UI when lacking `role:edit`/`role:delete`
  - Add tooltips explaining required permission
  - Log denied attempts with `AuditContext` as `permission_block`
- Staff:
  - Gate edit actions with `staff:edit`
  - Add tooltips and `permission_block` logging on denied attempts
- Ensure consistent gating across table action buttons and dialogs

## Super Admin UI Gating
- Users management and operations:
  - Gate actions (`inactive`, `active`, `lock`, `unlock`, backup/upgrade) using `superadmin:edit`
  - Add tooltips for disabled states and log permission-block events
  - Retain server validation via existing route guard

## Hospital-Based Permissions (Pending Checklist Item)
- Backend: extend `requirePermission` to optionally scope by `req.user.hospital_id` where relevant modules require hospital context (e.g., Staff, Patients)
- Client: hide actions when the current record’s hospital doesn’t match `user.hospital_id` unless `all:view/all:edit` is granted
- Document rules in checklist and ensure UI reflects hospital scoping in tooltips/messages

## Verification
- Run `npm run lint` and ensure 0 errors; warnings limited to acceptable ones or resolved per chosen fast-refresh strategy
- Run `npm run type-check` and `npm --prefix server run build`
- Sanity check key pages: Appointments, Documents, Staff, Roles, Super Admin Users/Operations

## Tracking Updates
- Update todos to mark lint fixes and gating tasks complete
- Update `src/docs/IMPLEMENTATION_CHECKLIST.md`:
  - Mark hook dependency fixes and fast-refresh strategy applied
  - Mark granular gating completed
  - Add/update “Hospital-based permissions” as in-progress or completed based on chosen backend scope change

## Execution Order
1. Fix Appointments redeclarations
2. Fix hook dependency warnings (Super Admin pages)
3. Apply fast-refresh resolution (file split or ESLint rule)
4. Complete Roles/Staff gating and tooltips with audit logs
5. Connect Super Admin UI gating to permissions with feedback and logging
6. Implement hospital-based permissions scope (if approved)
7. Verify via lint/type-check/build and update tracking