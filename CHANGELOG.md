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

- **Unified authentication backdrops.** Every sign-in and account-recovery page
  now shares the same crisp photographic backdrop as the privileged consoles:
  the background photograph renders at full sharpness with no translucent wash,
  sitting behind translucent panels so the image reads through while form content
  stays legible. This covers the patient sign-in, registration/sign-up,
  self-service recovery, password reset, two-factor, and demo-request pages, and
  keeps the existing light/dark theming intact.

- **Patient sign-in: unbroken backdrop and a carded form.** On the patient
  sign-in page the backdrop photograph now spans the entire layout as a single,
  unbroken image rather than being divided by two differently-tinted panels, and
  the credential form now sits in the same solid card as every other
  authentication form, so it stays readable against the bright photograph. The
  desktop marketing side panel is no longer shown on this page.

- **Registration / sign-up: unbroken backdrop and a carded header.** The
  registration page now shares that treatment: the backdrop photograph spans the
  entire layout as a single, unbroken image, and the page heading now sits inside
  the same solid card as the enrolment form so it stays readable against the
  bright photograph. The desktop marketing side panel is no longer shown on this
  page either.

- **Registration form: split identity, confirmed email, and placeholder-led
  fields.** Enrolment now collects a **first name and last name** as separate
  fields presented side by side, and asks for the **work email twice** — the
  second entry must match the first (case-insensitively, surrounding whitespace
  ignored) before the step advances, so a mistyped address is caught at enrolment
  rather than after the verification mail is sent. Field labels are no longer
  displayed; each field is now identified by its placeholder text, while the
  labels remain in the accessibility tree so screen-reader and voice-control
  users still hear an unambiguous field name. Facility and department selection
  likewise start from an explicit prompt and must be chosen before the step can
  be completed. The redundant step caption and the "Protected" status chip in the
  step header were removed, the step heading is now presented in uppercase, and
  the first-step action reads "Proceed to organization". The account created is
  unchanged: the two name parts are combined into the single display name the
  platform stores.

- **Registration form: uniform field geometry and a readable consent
  statement.** Every text field and dropdown across the enrolment steps now
  shares one control height and one set of internal paddings, so text sits the
  same distance from each edge and dropdowns no longer sit misaligned against the
  fields beside them; the fields also match the height already used on the
  sign-in page. The second step's action reads "Proceed to account security". The
  eligibility acknowledgement now renders as a single flowing sentence that wraps
  normally and lines up with its checkbox, with a visible keyboard focus ring on
  the checkbox; previously the sentence and its embedded privacy link were laid
  out as separate side-by-side blocks, which broke the sentence apart mid-line.

- **Hospital administration console aligned to the privileged-console design.**
  The hospital administrator sign-in now presents the same translucent credential
  panel, blue primary action, and layout as the site-owner console, on a
  hospital-specific backdrop, replacing the previous split marketing layout. The
  backdrop photograph renders unsoftened for a crisp image, with contrast carried
  by the panel surface. The hospital-specific journey is unchanged:
  assigned-administrator credential checks, remember-me, self-service recovery,
  role-based landing, and multi-factor handoff all behave as before, the recovery
  link's hover state is now legible on the dark panel, and the panel stays centred
  and free of horizontal overflow at every width.

- **Privileged console panel refinement.** The site-owner sign-in panel now
  carries a translucent surface so the photographic backdrop reads through it,
  and the panel is centred vertically on every viewport — and horizontally
  centred on handheld and tablet sizes while keeping its established desktop
  position. The credential subtitle now reads "Central hospital management
  console", and the primary action is presented in uppercase as "AUTHENTICATE".
  The backdrop photograph renders at full sharpness with no translucent wash
  over it, so the image stays crisp on both privileged consoles. All existing
  credential, multi-factor, role-based, and error behaviour is unchanged, and the
  layout remains free of horizontal overflow at every width.

- **Privileged console headline and action refinement.** The site-owner sign-in
  now opens directly on the credential panel: the standalone access heading was
  removed, and the panel carries a clear welcome title that scales with the
  viewport. The secondary key icon was removed from the panel header, and the
  credential subtitle was brought up to the standard secondary-text tone so
  every line on the panel stays legible against its surface. The primary action
  is now a short, direct "Authenticate". The photographic backdrop, the blue
  primary action, and all existing credential, multi-factor, role-based, and
  error behaviour are unchanged, and no panel text is clipped at any viewport
  size.

- **Privileged console backdrop and layout refinement.** The site-owner sign-in
  page now presents a full-width photographic backdrop of secured infrastructure
  work, with the application's dark base colour sitting behind it so the
  composition stays coherent at every viewport size. The access heading now sits
  directly above the credential panel as its own statement, and the introductory
  paragraph and the secondary protocol summary have been removed so the surface
  carries only the access context and the form. The primary action now uses the
  same blue as the application wordmark, unifying the console's colour story.
  Existing credential checks, multi-factor handoff, role-based redirection, and
  error feedback are unchanged, and the layout stays free of horizontal overflow
  from the narrowest handsets to wide desktops.

- **Refined password-recovery request surface.** The password-recovery page now
  presents a single clear request action labelled "Send Request", replacing a
  longer technical-sounding label, and a transport-version indicator badge has
  been removed so the surface shows only what a person recovering access needs.
  Existing validation, submission, success, and error behavior are unchanged, as
  is the underlying transport security the removed badge described.

- **Refined privileged console sign-in and responsive branding.** The site-owner
  sign-in page now carries the application wordmark above its credential panel
  so the privileged console is identifiable at a glance, and it scales fluidly
  from narrow handsets to wide desktops without horizontal overflow. A redundant
  terminal banner and the portal-switching links to the other sign-in surfaces
  have been removed, so the page shows a single, unambiguous access context.
  Existing credential checks, multi-factor handoff, role-based redirection, and
  error feedback are unchanged.

- **Hospital administration access refinement.** The privileged hospital
  sign-in experience now presents a clearer operational context, protected
  access status, and session-security cues while retaining the established
  administrator-only access checks, multi-factor handoff, error feedback, and
  routing behavior. It now uses the same familiar email, password-recovery,
  remembered-email, and sign-in control pattern as the clinical sign-in flow.
  The streamlined credential surface and updated care-setting imagery reduce
  visual distraction without changing access safeguards. A redundant restricted-entry notice has been removed, so
  the protected-access context and administrator safeguards are carried by a
  single, unambiguous statement rather than repeated messaging. The primary
  action has been simplified to one prominent "Sign In" control, while a
  development-only credential autofill helper, the portal-switching links, and
  a build marker have been removed from the account panel so the surface shows
  only what an administrator needs to authenticate. The operational heading now
  scales fluidly to remain on one line across the supported range of screen
  sizes, from narrow handsets to wide desktops. The responsive interface
  remains keyboard-accessible, honours reduced-motion preferences, and does not
  introduce new personal or clinical-data handling.

- **Refined clinical sign-in experience.** Staff now enter the workspace through
  a clearer, more focused account-entry surface that makes the care-team context
  and protected-access status easier to understand. Existing sign-in, password
  recovery, multi-factor verification, remembered-email, validation, and
  role-based routing behavior are unchanged. Motion now better respects
  visitors who request reduced movement; the experience remains fully
  keyboard-accessible and does not introduce any new clinical or personal-data
  handling. The desktop context now uses a non-interactive care-setting image
  while preserving high-contrast, readable sign-in content at supported screen
  sizes.

- **Focused account-entry pages.** Authentication and account-adjacent flows now omit global marketing navigation, reducing visual distraction while preserving their existing access, recovery, verification, and support journeys.

- **Refined secure registration experience.** New clinical accounts now move
  through a clearer, three-step enrollment experience with explicit identity,
  organization, and credential sections; concise protection cues; and improved
  small-screen readability. The enrollment card now has a wider desktop canvas
  for paired clinical-profile fields without compromising compact layouts.
  Primary and alternate account-access actions now provide clearer visual
  hierarchy and keyboard/pointer feedback.
  Existing validation, password requirements,
  accessibility feedback, and account-provisioning behavior are preserved.

- **Public FAQ experience.** Visitors can now search and filter clear answers
  about platform evaluation, care workflows, privacy boundaries, account access,
  and support. The responsive page uses keyboard-accessible disclosure controls,
  reports search results to assistive technology, and directs account-specific
  help into authenticated channels. It neither requests nor processes clinical
  or personal health information.

- **Shared public-site footer.** Marketing and demo pages now end with a consistent, responsive footer offering clear routes to platform information, company pages, account entry, and privileged administration. Landing-page links remain useful when reached from other public pages. Sign-in, registration, recovery, verification, and privileged-access pages intentionally omit it to keep attention on account access; authenticated and shared-record views retain their purpose-specific boundaries.

- **Consistent public navigation.** Visitor-facing pages now share the same responsive site header, with a keyboard-accessible mobile menu and clear paths to platform information, contact, and account entry points. Secure application and shared-record views retain their purpose-specific navigation.

- **Refined public wordmark presentation.** The public header now presents the
  application name in uppercase while retaining the established logo mark,
  navigation structure, accessible name, and layout behaviour.

- **Demo-request journey alignment.** The public demo form now has a canonical
  authentication-namespace address, while older saved links redirect there.
  Its selection controls preserve readable labels in the supported themes, and
  the submission action now uses a clear, uppercase “SEND REQUEST” label.

- **Refined public-site hierarchy and control contrast.** Public section
  headings now use a more restrained responsive scale while preserving their
  semantic heading order. Calls to action retain readable labels in every hover
  state, including alternative and dark-surface actions. The change improves
  visual consistency and keyboard/pointer feedback without changing platform
  behaviour or data handling.
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
  layout with the sign-in form beside editorial photography of hospital
  clinicians, using a translucency treatment so the form and imagery remain
  legible in both themes. Presentation-only; no data is processed by this
  change. Imagery is stock photography used under a free commercial licence.
- **Scroll-to-top control on public pages.** Visitor-facing pages now offer a
  floating control that returns the reader to the top once they have scrolled
  down, so long pages such as the FAQ no longer require scrolling back up by
  hand. It appears only after the page has actually been scrolled, is legible in
  both themes, respects reduced-motion preferences, and is reachable and
  operable by keyboard. It covers the public site and the account-entry pages,
  and is not shown inside the signed-in workspace.

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

- **Two-factor posture changed to unenrolled-by-default for both privileged
  consoles, with in-console enrolment.** Previously a secret was seeded for the
  hospital-admin account (the super-admin account had already been switched),
  which forced a TOTP prompt on sign-in and locked a fresh checkout out of that
  console until someone had that authenticator app's code. Both privileged
  accounts now sign in with credentials and enrol their own authenticator from
  their own settings surfaces. This was an explicit operator decision.
  **If you are deploying, enrol 2FA for both privileged accounts as part of
  cutover** — it is no longer enforced by seed data. Once an account enrols, the
  sign-in flow correctly re-challenges with TOTP on every subsequent login until
  it is disabled again from settings.
- **Development-only sign-in autofill helpers removed.** The privileged sign-in
  pages and the multi-factor step no longer pre-fill credentials or offer a
  one-click demo code, and the development endpoint behind that code helper has
  been removed from the codebase entirely. This closes a development path that
  could reveal a valid second factor for a fixed demo secret without
  authentication. Multi-factor codes must now come from the enrolled
  authenticator app.
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

### Fixed

- **The public site header no longer overflows at tablet width.** The full
  navigation was shown from the small-phone breakpoint upward, but six links
  plus two buttons do not fit there: the landing page gained a horizontal
  scrollbar and header controls were pushed out of reach with no visible
  affordance. The compact menu now covers that whole range.

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
- **The browser-level job now states the coverage it actually has.** It
  previously described itself as running the whole suite because a development
  mock served the API in-process; that mock has since been removed, so every
  mode calls the real API. Checks that need a live API are now marked as such
  and skipped explicitly, rather than failing for want of a backend and being
  read as product defects. The job covers the sign-in, registration and
  recovery screens plus the responsive layout guard; anything that signs in is
  left to a local run with the API and a seeded database.
- **Sign-in and privileged-portal checks match the current screens.** These
  checks were still asserting wording and structure from a superseded design, so
  they failed for reasons unrelated to the code under test. They now assert what
  the pages actually present, including that the privileged console offers no
  cross-portal navigation and that no second-factor shortcut has returned.

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
