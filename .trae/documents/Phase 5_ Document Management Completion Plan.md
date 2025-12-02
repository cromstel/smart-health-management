## Scope & Findings
- Frontend UI for documents exists and loads from backend: `src/pages/DocumentsPage.tsx` (search, upload dialog, category tabs, storage badges).
- Backend routes and controller support local uploads and listing only: `server/src/routes/document.routes.ts:9-11`, `server/src/controllers/document.controller.ts:6-61`, `server/src/middleware/multer.ts:16-28`.
- Schema–controller mismatch: controller uses `filename`, `storage_location`, `upload_date` while DB defines `name`, `file_path`, `storage_type`, `uploaded_at` (`server/src/database/schema.sql:176-194`).
- No cloud integrations, versioning, per-document ACL, encryption, backups automation, or bulk operations implemented.

## Frontend Completion Verification
- Validate library search: test exact match, partial substring, category term overlap, case-insensitive behavior at `src/pages/DocumentsPage.tsx:201-204`.
- Test upload UI: run through file selection for `PDF/DOCX/JPG/PNG/DICOM`; verify `FormData` fields at `src/pages/DocumentsPage.tsx:171-199` and backend acceptance.
- Verify category filters: tabs and filtered views at `src/pages/DocumentsPage.tsx:359-366` and content placeholders `451-461`.
- Storage badges: confirm dynamic rendering at `src/pages/DocumentsPage.tsx:423-426`, ensure updates after refresh/reload.
- Actions buttons: fix preview URL construction at `src/pages/DocumentsPage.tsx:429-432` once backend provides preview/download endpoints.
- Cross-browser checks: Chrome, Firefox, Edge; responsive validation.

## Backend Implementation
### 1) Local Storage (secure, monitored)
- Directory structure: `server/uploads/{hospitalId}/{patientId}/{category}/{documentId}/version-{n}`; enforce via dynamic `multer` destination.
- Size limits: configure `multer` limits and application-level checks; return clear errors.
- Quota management: DB fields to track used space per hospital/user; reject when exceeding quotas.
- Storage monitoring: implement disk space checks via a lightweight library and expose `/storage/usage` endpoint for UI.
- Schema alignment: choose one canonical mapping and update controller or schema for consistency.

### 2) Cloud Storage Integration (OneDrive & Google Drive)
- Unified provider interface `IStorageProvider` with methods: `upload(file, meta)`, `download(id)`, `delete(id)`, `getMetadata(id)`, `list(query)`, `getSignedUrl(id)`.
- Adapters:
  - Local: wraps filesystem operations.
  - OneDrive: Microsoft Graph API with OAuth; scopes `Files.ReadWrite.AppFolder`; token storage and refresh.
  - Google Drive: `googleapis` with OAuth; scope `drive.file`; token storage and refresh.
- Provider switching: read from persisted settings; route document operations through selected adapter; implement hybrid sync rules.
- Sync logic: background job to mirror local↔cloud with conflict resolution by latest version hash and audit trail.

## Advanced Document Features
### Version Control
- DB: add `document_versions(document_id, version, file_path|storage_ref, checksum, created_at, uploaded_by, notes)`.
- Save version on every upload/update; expose endpoints: `GET /documents/:id/versions`, `POST /documents/:id/rollback/:version`, `GET /documents/:id/compare?vA=&vB=`.
- Comparison: for text/PDF use metadata and diff summaries; for binaries, compare checksums and basic properties.

### Access Control
- Per-document ACL table `document_acl(document_id, principal_type, principal_id, permissions)`; integrate with existing RBAC (`server/src/middleware/auth.js`).
- Enforce in controllers for view/download/update/delete; add sharing endpoints.
- Audit logging: record document actions (view/download/upload/delete/rollback) with actor and timestamp.

### Document Encryption
- AES-256-GCM at rest; encrypt file content before storage for sensitive categories.
- Key management: master key via environment/KMS; generate per-document data keys; store envelopes separate from documents.
- Decryption workflow: authorize → fetch key → decrypt in streaming; never log keys or plaintext paths.

## System Operations
### Automatic Backup
- Scheduler: periodic jobs (daily/weekly) for DB and files.
- Incremental backups: track changed `document_versions` and deltas; maintain manifests.
- Verification: checksum validation and test restore to a temp location; expose status for UI.

### Bulk Operations
- Batch upload/download endpoints supporting multiple files and zip packages.
- Mass metadata editing: transactional updates on selected documents.
- Bulk permission management: apply ACL changes to sets of documents with audit entries.

## Quality Assurance
- Unit tests: storage adapters, controllers, ACL checks, encryption routines.
- Integration tests: local storage with quota limits; mock cloud providers for OneDrive/Drive flows.
- E2E tests: upload/search/filter/badges via a browser runner; preview/download flows.
- Security audit: review key handling, permission enforcement, audit log completeness, error pathways.
- Performance: paginate lists, index common queries, test large sets.

## Milestones
1. Align schema/controller and finalize Local Storage (limits, quotas, monitoring).
2. Implement Unified Storage Interface and OneDrive/Google Drive adapters with OAuth.
3. Add Versioning APIs and UI hooks; implement rollback and comparisons.
4. Build Document ACL and audit logging; integrate with RBAC.
5. Implement AES-256 encryption and key management for sensitive documents.
6. Add Backup scheduler (incremental + verification) and Bulk operations.
7. Comprehensive tests, cross-browser/device validation, and performance passes.
8. Documentation, test reports, user manuals, and deployment artifacts.

## Risks & Alignment
- OAuth token lifecycle and secure storage.
- Encryption key management and rotation strategy.
- Schema migration safety and backward compatibility.
- Sync conflict resolution between providers.

## Deliverables
- Fully functional document management system covering local/cloud storage, versioning, ACL, encryption, backups, and bulk ops.
- Technical documentation, test reports, user manuals, deployment package with env configuration.

## Next Actions
- Proceed to implement Milestone 1, then iterate through milestones with verification at each stage.
- Confirm provider credentials availability and environment configurations for OAuth and encryption.