# Changelog

All notable changes to **Smart MediCare** are recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Scope of this document

This is the public record. It reports **outcomes, security and data-integrity
posture, accessibility conformance, breaking changes, operator impact, and known
limitations** — the things a deploying clinician, auditor, or integrator needs.

It deliberately does **not** carry implementation detail: no component or file
paths, no database or schema identifiers, no query-parameter or internal symbol
names, no colour literals, no commit or branch topology, no tooling internals, and
no credentials. Demo accounts are documented in `DOCUMENTATION.md` and are
dev/mock-mode only.

If you are changing this codebase, the local-only engineering log carries the
implementation reasoning behind each entry here.

---

## [Unreleased]

### Data integrity — fabricated clinical data removed

These were integrity defects, not cosmetic ones, and are the most important
changes in this release.

- **A patient vitals trend chart was inventing a patient's medical history.** It
  synthesised a plausible random walk of blood pressure, heart rate, oxygen
  saturation and temperature — up to a year of it — and presented it with
  computed averages and a "Live" badge. **No vitals data source existed behind
  it at all.** It now renders an explicit no-data state instead of a confident
  fabrication.
- **An audit-log chart was fabricating audit records** — dozens of entries with
  plausible actions, users and timestamps, generated in both the success and the
  failure path. An audit trail is a security record; invented entries are
  indistinguishable from genuine activity, which undermines the entire point of
  logging. Both paths now leave the panel empty.
- **Clinical alerts were firing at random.** A ~5% chance per evaluation raised a
  "15 minutes approaching" notification for appointments that were not
  approaching. A time-critical alert that appears without cause trains staff to
  dismiss the real ones and invites acting on a fabricated one. Removed.
- **Landing-page census figures were presented as fact.** The hero page showed
  invented institution counts as though they were real. They are now labelled as
  illustrative.
- **A secondary call-to-action was labelled "Watch Demo"** but opened a request
  form, and no video exists. Now "Request a demo".

The governing principle, now standing: *do not fabricate data, especially clinical
or audit data.* A visible empty state is honest; a plausible invention is not.

### Security

- **Super-admin two-factor posture changed to unenrolled-by-default, with
  in-console enrolment.** Previously a secret was seeded, which forced a TOTP
  prompt on the master session and locked a fresh checkout out of the super-admin
  console until someone had that authenticator app's code. This was an explicit
  operator decision. **If you are deploying, enrol 2FA for the super-admin
  account as part of cutover** — it is no longer enforced by seed data.
- **Role-based access was under-granting.** The seeded administrator role was
  missing a guarded administrative module, so legitimate admin actions were
  refused. Grant corrected.
- **An admin password-reset link pointed at a port nothing was listening on.** The
  only way to obtain a working link was to edit source. The link host is now
  derived from configuration.
- **Reflected HTML injection in patient QR print previews** was sanitised
  (reported in 1.3.0).
- **Protected health information is not cached by the offline service worker.**
  Patient endpoints are network-only by policy; no PHI is written to a device
  cache by the app.

### Accessibility

Contrast was **measured in the rendered output**, not inferred from class names:
each text node's effective foreground is resolved against its nearest opaque
backdrop, in both themes, and checked against WCAG AA.

- **A previously reported "all clear" was wrong and has been corrected.** The
  automated audit itself had two defects: it could not interpret the modern
  wide-gamut colour notation the UI framework emits, so it was blind to a large
  part of the palette it was written to check; and it mis-composited translucent
  layers, so soft colour washes were scored as if they were solid. Both are fixed
  and the audit was re-run from scratch. The earlier claim is withdrawn.
- **Status labels were effectively invisible on filled status backgrounds**
  (measured 1.15–1.44:1 against a 4.5:1 requirement). A solid colour fill was
  paired with a hand-picked tint that lost precedence, leaving text in its own
  colour. Now every filled status surface uses the role's dedicated foreground,
  in both themes.
- **Chart legends failed contrast when the theme was switched.** A charting
  library inherits a series' colour as the legend text colour, so fixed mid-tone
  colours failed against either surface. Series colours are now theme-aware.
- **A button was filled with a live data-driven colour and painted with a fixed
  white label**, producing white-on-white text (2.1:1). The colour is now carried
  on a small swatch and the label sits on normal surfaces.
- **An alert-colour token had no foreground companion**, forcing call sites to
  hand-pick white or black. Added, for both themes.
- **Several role colours were too dim for their own surfaces** — the alert red on
  the default dark field, the muted label colour on secondary panels, and the
  link/accent colour on white were all below AA. Darkened, same hues, so clinical
  signal is preserved.
- **Diagnostic-image overlays were partly transparent.** The backdrop there is an
  unpredictable medical image, so a translucent overlay let whatever was behind
  it decide legibility. Overlay chips are now opaque.
- **Outline controls were using a foreground colour built for filled controls**,
  so the label landed on the page background instead of the control.
- **Typography is now self-hosted and served from the application origin.** No
  third-party font CDN is contacted at runtime, which keeps every outbound request
  auditable for regulatory scope. Three families with distinct jobs: an editorial
  serif at structural breaks, a sans for UI and body text, and a monospaced face
  with tabular figures for clinical data where alignment is load-bearing
  (patient IDs, dosages, vitals, lab values, timestamps, money).
- **A short micro-label was rendered at reduced opacity** and measured 2.45:1.
  Now uses the standard secondary-text token.
- **The patient vitals surfaces were pinned to a light palette.** The vitals
  toolbar, device sync, clinical-insights sidebar and follow-up panels carried a
  fixed light palette with ad-hoc dark-theme patches, so their text resolved
  against white even in dark mode. About 100 sites across five components now
  consume the semantic layer, so surface and text flip together.
- **Overlay chips on the diagnostic image viewer used theme-responsive colours.**
  That viewer's backdrop is a fixed dark surface, so in light mode an
  accent-coloured label landed dark-on-dark. Fixed light tints are correct here
  and are now used.
- **Chart legends were unreadable in light mode.** A charting library reuses a
  series' stroke colour as its legend *label* colour, but the chart tokens are
  tuned for marks — a 3px line reads fine in a mid-tone where 16px text does not
  (measured 3.19:1 and 3.30:1). Legends now carry the colour as a swatch and set
  the words in a readable token, so colour identifies a series without having to
  be legible itself.
- **Every ghost button failed contrast on hover in dark mode.** The primitive
  paired a 50%-opacity accent wash with the foreground meant for a *solid*
  accent fill, measuring 1.11:1. Fixed in the shared button primitive so every
  ghost button benefits, not just the one that surfaced it.

### Known accessibility issues

One issue remains, reported rather than hidden:

- **A single contrast failure on the patient vitals surface in dark mode** — a
  toolbar label resolving to the accent foreground against the navy card, at
  1.11:1. It is not a hover state (a clean server restart confirmed the change
  was live), and the surrounding sweep of light-palette sites did not remove it.
  Located to the vitals toolbar, still unresolved.

Everything else is at zero: 17 mounted routes plus 17 interaction-gated steps,
across both themes.

- **Print output is deliberately decoupled from webfonts** — clinical records are
  pinned to a system serif so a printed record never depends on font delivery.
  Two report headers intentionally stay on the default font stack for the same
  reason.

### Breaking changes

- **The development server now listens on port 5175, not 3000.** This resolves a
  collision between the frontend and API dev ports. Update any local bookmarks,
  proxy configuration, or test runner configuration. The port is now strict: if
  something already occupies it, startup fails loudly instead of silently moving
  to a different port.
- **Patient status updates are now `PATCH`, not `PUT`.** Clients still sending
  `PUT` will receive `405 Method Not Allowed`. The previous verb was accepted by
  the route table but not implemented, so status changes silently did nothing.
- **Two API contracts were corrected where the server and its callers disagreed
  about the contract**, causing endpoints to fail at runtime:
  - The system-status endpoint is at its documented path; the previous path
    returned 404.
  - The inventory report generator reads the documented query parameter; the
    previous name caused it to reject valid requests.
- **Nine server-side defects were fixed where the code contradicted the database
  schema.** These caused runtime failures on live features: a permission lookup
  referenced a column that does not exist; a role hierarchy reference likewise;
  staff were matched to roles by a name field the schema does not carry; audit
  logging wrote to a column shape that does not exist (seven call sites); and the
  backup listing returned an error for an unreadable directory instead of
  reporting what it could not read.
- **Three multi-factor verification helpers changed their return type** from a
  boolean to the authenticated user or `null`, so callers can distinguish "wrong
  code" from "no account".
- **Super-admin sign-in now lands on the super-admin dashboard** rather than the
  standard one.

### Operator notes

- **Run database seed data before executing the full end-to-end suite.** One spec
  exercises a forced admin password change and previously left the account in a
  modified state, so a second consecutive run failed every login until someone
  re-seeded by hand. The test now restores the credential it changed, and the
  suite is repeatable — two consecutive full runs pass.
- **Only the seed script is safely re-runnable.** Re-running the schema script
  fails on duplicate unnamed foreign-key constraints.
- **The frontend and backend gates must be run sequentially on this
  environment.** Running builds and test suites in parallel exhausts memory.
- **New end-to-end coverage exists for role-aware landing, the migrated port,
  dashboard landmarks, and mobile layout.**

### Continuous integration and branch protection

- **There was no CI at all.** Nothing ran on push or pull request, so the gates
  below were enforced only by whoever remembered to run them.
  - **Frontend gates** — lint, type-check, unit tests, production build.
  - **Backend gates** — lint, build and unit tests against a real MySQL service.
    The suite exercises the database layer rather than mocking it, so a missing
    database would have turned several cases into silent passes.
  - **Secret and policy scan** — fails the build on a tracked environment file,
    on a credential-shaped literal in tracked files, and on any gradient
    reintroduced into source. These three encode operating rules that were
    previously enforced only by reviewer vigilance.
- **Branch protection is now defined as reviewable, executable intent.** GitHub
  stores it in repository settings rather than in any version-controllable
  format, so it is checked in as a script that applies the policy and then
  verifies the write actually landed. It requires a pull request with one
  approving review from a code owner, up-to-date branches before merge,
  resolved conversations, no force pushes, no deletions, and a linear history.
  Verification matters here: GitHub silently discards a required status check
  whose name no longer exists, which downgrades protection to a suggestion with
  no error anywhere.
- **Concurrent runs on the same ref are cancelled**, so a stale green result
  cannot be read as evidence about the commit in front of you.

### Verification

- Accessibility: 17 mounted routes and 17 interaction-gated steps across both
  light and dark themes, **1 known failure** (see above), down from 26.
- Automated checks green: lint, type-check, unit tests and production build,
  frontend and backend.
- The three new CI policy scans were run against the current tree before being
  committed, so the pipeline starts green rather than failing on arrival. Two
  real problems surfaced that way and were fixed.

### Corrected

- The earlier accessibility claim in this project — that all contrast failures had
  been resolved — was produced by the defective audit described above and was not
  trustworthy. The audit is fixed and the figures re-measured from scratch.
- An earlier reported end-to-end test count was off by one; the authoritative
  count is 76.

---

## [1.3.0] - 2026-09-08

### Added

- **WebAuthn biometric authentication** for clinician sign-in, with public-key
  registration and fallback options.
- **Global voice navigation** for hands-free route changes with spoken feedback.
- **Speech-to-text vitals dictation** — microphone dictation inside the vitals
  modal, parsing natural speech into blood pressure, heart rate, temperature,
  oxygen saturation and nurse notes.
- **Emergency mode** — a header toggle that simplifies the layout, hides
  non-critical widgets, and surfaces trauma records and triage tools
  immediately.
- **Shift handover report generator** — a concise summary of active patients,
  critical alerts and pending tasks, with secure internal messaging.
- **AI inventory forecasting** — burn-rate analytics, depletion countdowns, an
  epidemic surge simulator, and auto-generated purchase orders.
- **Constraint-based shift scheduler** — a weekly multi-department shift matrix
  with a constraint solver and a clinician swap-request manager.
- **Real-time wait-time monitor** — a live department queue monitor with target
  thresholds, trend sparklines and admin intervention triggers.
- **Post-discharge outreach manager** — an automated four-phase outreach
  protocol with red-flag symptom screening and one-click physician escalation.
- **Visual offline indicator** in the header, reflecting service-worker state so
  clinicians know when the app is not connected.
- **Form auto-save engine** backed by local storage, preventing data loss on
  browser refresh.
- **Audit log compliance exporter** producing timestamped JSON and CSV for
  regulatory reporting.
- **Module-level error boundary** isolating runtime failures so one failing
  feature cannot take down the interface.

### Security & bug fixes

- Sanitised HTML interpolation in patient QR print previews, eliminating a
  reflected cross-site-scripting vector.
- Improved permission handling for single-word roles and wildcard rules.
- Server-side authentication streams now receive their token correctly.
- Resolved hook dependency warnings across custom hooks and components.

---

## [1.2.0] - 2026-09-08

### Added

- **Rapid intake QR generation** producing scannable intake passes with patient
  ID, latest biometrics and triage classification.
- **Outlier alert banners** flagging abnormal blood pressure, pulse, temperature
  and hypoxaemia in bold, with critical-result toast notifications.
- **Side-by-side session baseline comparison** showing current readings against
  previous session baselines with calculated deltas.
- **Health trend insight cards** with longitudinal stability scores and
  Improving / Stable / Concerning badges.
- **Seven-day AI workload forecast** inside staff capacity, identifying future
  high-load days with risk levels and trend lines.
- **Shift filter controls** across morning, afternoon, night and all shifts.
- **Command-palette search** (Cmd/Ctrl+K) with fuzzy lookup across patients,
  appointments, staff and routes.
- **Notification badge engine** tracking pending appointment authorisations and
  critical clinical alerts.
- **User-facing dark/light theme switcher**, persistent and available in both the
  settings page and the header.

### Changed

- Authentication, super-admin sign-in and two-factor pages unified under one
  visual identity.
- Standardised vitals and triage types across the codebase.
- Drove the lint baseline to zero errors and zero warnings.

---

## [1.1.0] - 2026-09-01

### Added

- Pharmacy and medication compliance tracker.
- Financials and insurance claims ledger.
- Super-admin multi-tenancy hospital onboarding with system licence key
  management.
- Two-factor authentication setup with backup recovery codes.

---

## [1.0.0] - 2026-08-15

### Added

- Initial release of Smart MediCare.
- Core React + Vite + Express full-stack architecture.
- Patient management, appointment scheduling and vitals logging.
- Role-based access control authorisation layer.