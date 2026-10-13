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

### Added

- **Public Contact experience.** Visitors can now choose an appropriate route
  for sales, partnership, or existing-customer conversations from a dedicated,
  responsive contact page. The page makes the public-contact boundary explicit:
  it directs visitors not to include patient or other sensitive health
  information, and routes existing customers back to their authenticated
  workspace. It follows the established keyboard navigation, semantic heading,
  focus, and motion-accessibility patterns. The optional contact intake has
  client- and server-side validation, clear pending and result states, and an
  explicit warning not to submit clinical or sensitive health information.
- **Public About Us experience.** Visitors can now learn the platform’s purpose,
  design principles, and care-team commitments through a dedicated, responsive
  page. It is available from the public navigation on desktop and mobile.
  The experience follows the existing accessible navigation, keyboard focus,
  semantic heading, and reduced-motion-friendly interaction patterns. No
  clinical or personal data is displayed or collected by this page.
- **Expanded company story.** The public company page now includes an Our Team
  section describing the disciplines that shape the product, plus a branded
  visual hero and purposeful entrance and hover effects. These additions do not
  collect, display, or transmit clinical or personal data.
- **Supplied company hero artwork.** The public company page now uses a
  bandwidth-efficient WebP healthcare-team visual with accessible descriptive
  text. This presentation-only change does not process clinical or personal
  data.
- **Accessibility refinements on the public company page.** Entrance animations
  and decorative effects now honour the visitor's reduced-motion preference, and
  team cards render their text in normal document flow so content never clips at
  large zoom or font sizes. Presentation-only; no data-processing change.
- **Separate privileged sign-in experiences.** Hospital administration and
  platform-wide super-administration now have distinct, clearly named sign-in
  portals, each with its own route, visual identity, and role-scoped guidance.
  Clinical staff use the hospital portal; platform operators use the super-admin
  portal. The scope of a privilege — hospital-scoped versus global — is explicit
  in each flow, and each portal carries the system-author attribution. Portal
  ownership now matches each privilege's scope: the hospital portal accepts
  hospital-administrator credentials, while the super-admin portal accepts
  site-owner credentials; neither leaves a rejected account signed in.
- **Site-wide navigation to the privileged portals corrected.** Public links,
  self-service recovery exits, and access-route guards now agree on which portal
  serves each privilege, and the former registration entrypoint keeps working for
  existing call-to-action links.
- **Single platform identity.** One canonical logo now appears consistently
  across the public site, the workstation shell, and every sign-in experience,
  replacing the previous icon-and-text marks. The change is visual only; no
  licensing or data-processing implications.
- **Redesigned hospital admin sign-in.** The portal presents a full-height split
  layout with the sign-in form beside an editorial landscape photograph of a
  modern hospital facility, using a translucency treatment so the form and
  imagery remain legible in both themes while the image fills the panel at every
  desktop size. Presentation-only; no data is processed by this change. Imagery
  is stock photography used under a free commercial licence.

### Changed

- **Upper-case brand lockup, and the brand mark now sits in the admin portal
  footer.** The platform name shown beside the logo renders in upper case for a
  stronger, more consistent lockup across the public site, the workstation shell,
  and every sign-in experience. The hospital portal's footer panel now presents
  the brand mark itself in place of a secondary clinical-team photograph, so the
  identity appears once and in the same form everywhere. Visual only; no
  data-processing change.
- **The sign-in background is now a landscape, bandwidth-efficient image.** The
  privileged sign-in panel uses a wide hospital-building view served as a WebP
  image, replacing the earlier portrait photograph that had to be heavily cropped
  to fill the panel. Large displays now get a purpose-framed image with less data
  transferred. Presentation-only; no data-processing change.
- **One-click demo-credential filler removed from the hospital sign-in form.** The
  privileged sign-in form no longer renders a shortcut control that populated
  demonstration credentials. Local development still pre-fills the sample account
  for convenience, and demonstration accounts remain documented in
  `DOCUMENTATION.md`. No authentication behaviour, credential handling, or
  production flow is affected.
- **Decorative frame removed from the brand mark in the sign-in footer.** The
  brand mark now sits directly on the panel with no surrounding tint, border, or
  rounded container, so it reads as part of the composition rather than as a
  badge. Presentation-only.

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
- **Every outline button failed contrast on hover in dark mode, for the same
  reason as the ghost variant** — a translucent hover wash sat beneath the
  foreground meant for a solid accent fill, leaving a dark-navy label on a
  near-navy surface (measured 1.11:1 on the patient vitals toolbar). Fixed in
  the shared button primitive, so every outline control benefits. This closed
  the last item previously listed under "Known accessibility issues".
- **The dashboard's seven-day vitals chart legend failed contrast in light
  mode** — the same charting-library behaviour as above (a series' stroke
  colour reused as its legend label colour) on a widget that had kept the
  default legend, measuring 3.19:1 and 4.10:1 against a 4.5:1 requirement. It
  now uses the shared readable legend, in both themes.
- **The hospital administrator sign-in became cramped and clipped on smaller
  screens.** The form column is only 30% of the window on laptops and tablets,
  but its spacing was sized as though it were the whole page, so the sign-in card
  narrowed to roughly 207px at a 1024-wide window and its primary action was cut
  off. Spacing, padding, and type now scale to the space available, and the
  editorial panel steps down on shorter screens; the form presents without any
  clipped content from 360-wide phones through 3440-wide desktops. The password
  reveal control is now a full-size touch target rather than a bare icon.
  Presentation-only; authentication behaviour is unchanged.

### Known accessibility issues

None. The last outstanding failure — a toolbar label on the patient vitals
surface in dark mode at 1.11:1 — was the outline-button hover defect described
above and is now closed in the shared primitive.

Everything measured is at zero: 17 mounted routes plus 17 interaction-gated
steps, across both themes.

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
- **`main` is protected.** Direct pushes are refused; changes must arrive
  through a pull request with all three status checks green, a branch up to date
  with its base, resolved conversations, no force pushes, no deletions, and a
  linear history. The rule applies to administrators too, so there is no
  privileged bypass. Enforcement was confirmed by attempting a direct push and
  watching it be declined.
- **No approving review is required, and that is deliberate.** A pull request
  cannot be approved by whoever pushed its last commit, and this repository has
  a single maintainer — so a one-review requirement cannot be satisfied by
  anyone, ever. Protection that blocks every merge does not survive contact
  with a real deadline; it gets switched off. Review remains enforced by the
  human running the project rather than by a rule that cannot be met.
- **Verification matters here.** GitHub silently discards a required status
  check whose name no longer exists, which downgrades protection to a suggestion
  with no error anywhere — so the policy is checked in as a script that applies
  it and then re-reads it to confirm the write landed.
- **The pipeline was run before it was trusted.** The first run on `main`
  failed both gates. Both causes were environmental rather than product defects,
  and neither could be caught by the local checks, which run against an
  existing dependency tree and never reinstall: one gate depended on a runtime
  newer than the one CI was pinned to, and one depended on a tool declared
  outside the package it was invoked from. Both are fixed and green.
- **Concurrent runs on the same ref are cancelled**, so a stale green result
  cannot be read as evidence about the commit in front of you.

### Repository consolidated onto one branch

- **All development branches were merged into `main` and retired.** Three
  feature branches and one pre-split backup branch are gone; `main` is now the
  only long-lived branch. Content already present in `main` was recorded as
  contained rather than re-merged, so consolidating changed no files.
- **Two merges needed conflict resolution.** Both were conflicts between
  equivalent versions of the same fix arriving by different routes — one page
  test and one server test — not disagreements about intent. In each case the
  version carrying the explanatory comment was kept.
- **`main` is now protected** (see above). As a direct consequence, work must
  land through a pull request; a direct push was attempted during this change
  and was refused by the protection rule.

### Dependencies and security posture

- **A series of automated dependency updates was merged** across the three
  dependency trees in the project (web application, API, documentation site),
  each arriving through the protected pull-request flow with all three status
  checks green before merging.
- **Open advisories on the default branch dropped from 6 to 0, and all three
  critical ones are now closed.**
- **The two medium-severity advisories recorded as "deliberately not merged"
  have both been resolved:**
  - The CSS selector-parsing advisory is fixed by pinning the parser to its
    patched line in the documentation build, which avoided the forced downgrade
    of the typography package entirely. The documentation stylesheet build was
    verified to produce identical output before and after, so this is a
    supply-chain fix with no visual or behavioural change.
  - The formatting-helper advisory is fixed by removing an unused test-runner
    dependency that pulled it in. All of this project's suites run on a single
    test runner; the second runner was dead weight declared but never invoked,
    and removing it took the advisory's whole dependency chain with it. No
    runtime dependency changed, and the lockfile diff is purely subtractive.

### Verification

- Accessibility: 17 mounted routes and 17 interaction-gated steps across both
  light and dark themes, **zero contrast failures** (previously: 1 known
  failure), down from 26 originally.
- Dependency posture: **zero open advisories** on the default branch, verified
  against the repository's advisory list rather than a local scan alone.
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
