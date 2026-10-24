## [Unreleased]

### Added

- **The platform is published and serving.** The application is live at its own
  address, with the clinical workforce, the hospital administrator and the
  platform owner each signing in at their own portal. The production database
  carries the full clinical schema, and the accounts are created with
  credentials that are held in the deployment's environment rather than in the
  repository.

- **One process answers the whole site.** In production a single service
  answers both the page requests and the application requests, so a page
  opened directly, refreshed, or shared as a link works, and an unknown
  application request still answers with a machine-readable error rather than
  with a page.

- **A notification inbox that is real.** Staff now receive notifications from
  the system rather than from a fixed list built in the browser: appointments
  starting shortly, prescriptions approaching the end of their course, stock
  that has fallen to its reorder level, and observations that came back
  abnormal. Each alert is raised once, is remembered per person, and can be
  read, confirmed or dismissed. The notification list starts empty until the
  real conditions are met.

- **Clinical notes are kept in the clinical record.** Notes taken during a
  consultation are now stored with the patient, attributed to the clinician
  who wrote them, and can be listed, corrected and withdrawn from the patient
  record. They are no longer written to the browser, where they could be read
  by anything running on the same device.

- **An emergency board with a real bed state.** The emergency panel now reads
  the patients currently admitted and the bays they occupy, allocates a bay
  through the service, and releases it when the patient is discharged. A bay
  held by one patient cannot be taken by another, and a bay being turned over
  cannot receive a patient until it is ready. Activating the emergency code is
  recorded against the audit trail, and the response says plainly that no
  external service was contacted, so nobody believes a team was dispatched
  when it was not.

- **Password reset works and signing out really signs out.** A forgotten
  password can now be reset with a single-use link that expires, and the new
  password takes effect immediately. Signing out ends the session on the
  service as well as in the browser, so the session cannot be carried on
  after the user has left.

- **Work done while offline is no longer lost.** Patient records created,
  changed or removed while the service was unreachable are now delivered when
  the connection returns, and the browser only discards a queued change once
  the service has confirmed it. Previously the browser reported the work as
  saved and then dropped it.

- **Patient vitals are recorded on the server.** Blood pressure, heart rate,
  temperature, respiratory rate and oxygen saturation readings are now held
  centrally and shared by every device that opens a patient record, instead
  of each browser keeping a private copy that vanished with the tab. The
  clinical thresholds are applied by the service, so the severity shown
  against a reading is the one the service derived, and a reading cannot be
  filed as unremarkable when the measurements say otherwise. Operator impact:
  the vitals log starts empty for every patient and fills with real
  observations, and a recorded reading is corrected or withdrawn through the
  service rather than in the browser.
- **A patient summary can be shared as a time-limited link.** A clinician can
  issue a link to a patient's summary for a recipient who has no account.
  The link carries a single-purpose, unguessable reference, expires on a
  fixed schedule, can be used by the recipient without a login, and every
  use is counted. An unknown, withdrawn or expired link reveals nothing.
  The link exposes the shared summary only: no other patient, no full
  record, and no access to anything the recipient was not sent.
- **The clinical AI assistant answers for real.** The assistant now reaches
  the model instead of failing silently, can ground an answer in current
  medical literature, and reports which model produced the reply. When the
  service is unavailable the reply is clearly labelled as a placeholder and
  is never presented as model output. Patient observations are not sent to
  the external service by default; the service answers from the recorded
  observations locally unless an operator deliberately switches the
  disclosure on.
- **Usage events are kept instead of being discarded.** Product usage events
  are stored centrally and reported back as stored, so the browser no longer
  believes an event was synchronised when it was not. When an event cannot
  be stored the browser keeps it in its offline queue and retries it later,
  so no event is lost by a transient failure.
- **The audit trail is readable by ordinary staff.** Staff can now review the
  recorded audit trail for their own actions, and platform administrators
  can review the whole trail, with the same paging and filtering the
  administrative view already offers. Entries carry the actor, the action,
  the module, the record and the time, and the trail is read from the
  central record rather than from a browser-local list that any user could
  erase.

- **Medication administration is recorded on the server.** Scheduled doses,
  their notes and the nurse they are assigned to are now held centrally
  instead of in the browser, and signing a dose off moves the pharmacy
  stock in the same, single, all-or-nothing step. A dose can never be
  recorded as given while the shelf still shows the full quantity, and a
  dose that is signed off against an empty shelf is refused outright rather
  than driving the stock negative. Doses that fall past their scheduled
  time while still pending are identified by the service, so every ward
  screen agrees on what is overdue. Operator impact: the compliance tracker
  now starts empty and fills with real records; it no longer ships sample
  entries, and the patient and nurse pick-lists are drawn from the live
  roster.
- **Inventory forecasting is computed from real movement.** Shortage
  predictions, days of supply, depletion dates and restock suggestions are
  now calculated from actual dispensing and administration history rather
  than from sample figures, and the seasonal surge control is applied by the
  service instead of in the browser. A medicine with no recorded movement in
  the window is reported as unknown instead of being given an invented
  consumption rate, and it is left out of the risk ranking and out of the
  restock suggestions. Operator impact: the forecast reads empty until
  medicines and dispensing activity exist in the inventory.
- **Dispensing history is kept centrally.** Every dispense is recorded
  against the patient and the medicine, attributed to the staff member who
  dispensed it, and can be reviewed per patient, per medicine and per date
  range. Operator impact: dispensing history no longer lives in the
  browser and is no longer lost when the tab is closed.

- **Hero motion and structure across the public pages.** Every full-width hero
  banner (home, About Us, Contact Us, FAQ, and request-a-demo) now shares one
  entrance treatment: the column hairlines draw downward once on load, a thin
  accent rule sweeps across the banner, and each hero's eyebrow, heading,
  supporting copy, and side panel rise into place in sequence. The home hero
  also carries a soft expanding ring behind its live-status dot, and the
  request-a-demo hero keeps its linked benefit panels. All of this is
  decorative: it never blocks reading, and any visitor who has asked their
  device for reduced motion sees the finished layout immediately with no
  animation at all. No content, route, or form behaviour changed.

- **The records that only ever grew are now pruned on a schedule.** The audit
  trail, the product analytics, the notification markers and the patient
  summary share links were all kept forever, so an installation that ran for a
  year carried a year of rows that nothing would ever read again. They are
  pruned now, each with its own window, and the windows are configuration: an
  operator with a different record-keeping obligation states it in the
  environment rather than waiting for a code change. The audit trail is the
  exception that proves the rule — its window is never shorter than the period
  the audit report schedule covers, so a scheduled report is never produced
  from a trail with a hole in it. A window that is not a whole number of days
  is reported and the default is used, so a mistyped setting can never empty a
  table. Operator impact: the four tables stop growing without bound, and a
  deployment that has to keep its audit trail for longer states the longer
  window.

- **The emergency board can be worked, not only read.** A clinician can now
  admit a patient, record the readings taken on arrival, re-triage an
  admission, discharge a patient and put a bay back into service, and every
  one of those actions is written to the clinical record by the service rather
  than held in the browser. The triage level of every patient and the state of
  every bay are stated in words as well as in colour, so the board can be read
  at a glance and by a reader who cannot distinguish the colours. A patient is
  never put into a bay by a rule alone: the pairing is confirmed before it is
  written, because the wrong patient in a bay is a clinical safety error that
  no automatic rule should be allowed to make on its own. A bay that a patient
  has just left is queued for turnover and cannot receive the next patient
  until it is marked ready, which is the same rule the service applies when a
  patient is discharged. A record belonging to another hospital is reported as
  not available to the caller rather than as a failure worth retrying, and the
  actions that need a permission the caller does not hold are not offered at
  all.

- **Role permissions can be granted and withdrawn from the screen.** The roles
  screen could list roles and create them, and nothing else: the capability
  switches were not connected to anything, the save button did nothing, and
  the delete button only wrote a note about itself. A role is now read from
  the service before it is changed, its capabilities are shown as they are
  actually held rather than as a default guess, and the changes are written
  back and confirmed by the service. A part of the system the role does not
  cover yet can be granted, and a capability that was switched off is
  withdrawn rather than quietly left behind. The grant that reaches every
  part of the system at once is reserved for the platform administrator and
  cannot be handed out from the ordinary editor. Deleting a role asks first
  and says how many accounts would lose their access.

- **The browser now agrees with the service about what a person may do.** The
  service issues a person's capabilities as a part of the system and an action
  on it, and checks exactly that. The browser was looking for a different
  spelling of the same grant, so every permission-gated control read as "not
  allowed" for every account except the platform owner's — adding a patient,
  adding a member of staff, working the emergency board and editing a role
  were all dead ends for the clinical workforce. The two answers now agree, so
  a control is offered to the people who may use it and withheld from the
  people who may not.

### Fixed

- **The pharmacy stock can no longer go negative.** A batch recall subtracted
  the recalled quantity from the stock without checking what the stock held,
  so recalling more than was in stock left the medicine with a negative
  quantity. A negative quantity is not something that can be dispensed, and
  it made the low-stock warning fire for stock that did not exist. The stock
  is now held to a non-negative quantity by the database itself, and the
  records that were already below zero have been brought back to zero.

- **Records can no longer be created or edited through a broken request.**
  Creating a hospital, a patient, a member of staff, a supplier, a purchase
  order, a batch or a prescription returned a server error every time, so
  those screens could not add anything. All of them now work, and each new
  record receives its own identifier in the same format as the existing ones.

- **A request can no longer write fields it was not meant to.** Several edit
  screens passed whatever they were given straight through to the record, so
  a request could alter fields the form does not show, including the
  identifiers and the ownership fields. Each screen now accepts only the
  fields it is meant to change.

- **The dashboard no longer shows invented numbers.** When the service could
  not be reached, the dashboard filled itself with plausible-looking patient
  counts, revenue and activity that had never been measured. It now says the
  figures could not be loaded and leaves the panels empty, so a failure is
  visible instead of being disguised as data.

- **The emergency hotline and the patient roster are no longer sample
  entries.** The emergency panel and several selection lists were populated
  with made-up patients and staff who do not exist. They are now drawn from
  the live records.

- **The pharmacy reports can be exported again.** Exporting a pharmacy report
  as a document was refused outright, and the same fault stopped the
  financial statements from being exported. Both work again, and the exported
  document opens correctly.

- **Purchase orders follow a single workflow.** Orders moved through their
  states with button labels that did not match what the service accepts, so
  the request was rejected. The buttons now offer only the moves the order
  can actually make, and the goods-received entry is posted when the order
  is marked delivered.

- **Patient contact details are protected at rest.** Phone numbers were the
  one patient field stored in the clear, because the column was too narrow to
  hold the protected form. The column has been widened, so the phone number
  is now protected in the same way as the other patient details.

- **A record can no longer be attached to a hospital outside the user's
  own.** Some requests were checked against the wrong field name when
  enforcing the hospital boundary, which let a record be attached to a
  hospital the user does not have access to. The boundary is now enforced for
  both spellings.

- **The member list shows the right number of people.** The count beside each
  role was always zero because nothing maintained it. It is now derived from
  the accounts that actually carry the role.

- **A failed report request is reported as a failure.** The report scheduler
  appeared to succeed even when the request behind it failed. It now reports
  the failure and its reason.

- **A closed session is not counted as a working one.** Several test suites
  decided at the start whether the database was available and then never
  checked, so the checks were silently skipped and the suites reported a
  pass while asserting nothing. The checks now run against the live service.

- **Money and measurements are numbers again.** The platform read exact
  numeric columns as text, so a price arrived as a string and the pharmacy
  screen failed to render at all, and the financial exports wrote money into
  the spreadsheet as text — where a total over the column returned zero and
  the rows sorted as words rather than as amounts. Exact numeric columns are
  now read as numbers everywhere, so the pharmacy screen renders, the
  exported statements total correctly, and the displayed figures carry their
  proper precision.

- **The hospital administrator sign-in screen no longer carries a
  credential.** The form was prefilled with a working administrator password
  in development. A prefilled password is a password in the repository, and
  the sign-in screen is not a place to keep one. The form now starts empty
  in every environment, and the account's password comes from the
  environment.

- **The API status panel can now see the API.** The panel asked the local
  page for the API, which only works when both are served from one host. It
  now asks the configured API address, so it reports the real state during
  development as well as in production.

- **Restock orders are no longer reported as sent when they were not.**
  Creating a restock order now uses the supplier recorded against the
  medicine, one order per supplier, and a failure is reported to the
  operator with its reason instead of being hidden behind a success
  message. Medicines with no supplier on file are listed as skipped rather
  than posted against the wrong supplier.

### Changed

- **The list endpoints answer with a page instead of with the whole table.**
  The medicine catalogue, the supplier list, the account list and the settings
  list were each read in full and sent in full, so a single request carried a
  copy of the installation's records with it and the answer grew with the
  installation. Each of them now answers with a page of at most two hundred
  rows and reports how many rows exist, so a client can ask for the rest. A
  request for a page size that is not a page is refused rather than quietly
  answered with something the caller did not ask for, and the order of the
  rows is fixed so that paging through them does not repeat or skip records.
  The shape of the answer is unchanged where the console reads it as a list,
  so nothing in the browser had to change.

- **The product name is configuration, not source.** The name shown to people —
  in the browser tab, the installable app, the screens, the emails, the
  calendar invitations, the generated reports and the printable summaries — is
  read from the environment now instead of being written into the application.
  Deploying the platform under a different name is a configuration change and
  no longer a code change, and the name can no longer drift between the page
  title, the installable app, the mails and the screens. The browser and the
  API read separate variables and must be given the same value; both fall back
  to the shipped name outside production.

- **Credentials, ports and host names are configuration, not source.** The
  database credentials, the demo account passwords, the API and web server
  ports, and the host names the platform is served on are all read from the
  environment now. No credential and no port number is written into the
  application any more, and the demo accounts are created with the passwords
  the operator configures rather than with a password that was published in
  the documentation. Where a value has a sensible development default, that
  default is documented and applies outside production only; in production the
  platform refuses to start rather than guess.

- **The environment files are complete and agree with each other.** Every
  setting the platform reads is now listed once, in the section that owns it,
  in the template as well as in the deployment and development files — the
  same keys, in the same order, with the differences that matter and only
  those. A setting that was present but never read has been removed, a
  setting that was read but absent has been added, and the optional
  integrations that are not switched on are shown with a placeholder so
  nothing is missing from a fresh setup. A placeholder now reads as "not
  configured" rather than as a value, so an integration that was never
  switched on stays off instead of failing the first time it is used.

- **Settings the platform already promised are now honoured.** The card
  currency, the document store's location, the session cookie, the sign-in
  lockout window, the password hashing cost, the certificate and key
  locations, the backup retention window and the notification sender's
  display name were all present in the environment and ignored by the
  application. They are read now, and the two that had no behaviour at all —
  pruning old backups, and sending with a sender's name — do what their
  names say.

- **A configured path means the same directory everywhere.** The upload and
  backup locations were resolved against the working directory, which is
  different in development and in a deployment, so one setting named two
  different places. They are resolved against the repository root now.

- **The tenant administrator recovers on their own pages.** The hospital
  administrator's recovery link pointed at the clinical workforce's recovery
  page, so an administrator was filling in a form belonging to a different
  portal. There are now three separate recovery surfaces, one per audience:
  the clinical workforce, the hospital administrator, and the platform site
  owner. The recovery email points each account at its own page, and the
  clinical pages link to the administrator ones so a signed-out
  administrator can find the right one.

- **Every call to action on an authentication page leads to the right
  place.** A two-factor screen that was cancelled sent a platform owner or a
  hospital administrator back to the clinical sign-in page, which is not
  where they started. Each of these now returns the person to the portal
  they belong to, and the routes are declared once so a link, a redirect and
  a back-link cannot disagree about where a surface lives.

- **A development shortcut on the recovery screen is gone.** The reset page
  offered a button that filled in a made-up recovery token, so a developer
  could walk through a reset that could never work. The recovery flow is
  real, and a made-up token is authentication material; the only way in is a
  link the account owner received.

- **Nothing about the deployment is written in the code any more.** The
  ports, the product name, the mail settings and every secret come from
  the environment. A value that is missing is reported by name rather than
  guessed, and a production build refuses to run without the product name,
  so a release can never carry a name that was baked in. The address written
  into a calendar invitation and the one shown in the interface follow the
  published address rather than a host name written down.

- **The tenant administrator recovers on their own pages.** The site owner used
  to be sent into the same recovery screen as patients and hospital staff, so
  one audience's link led to another's flow. The administrator now has their
  own recovery and password-set pages, on the administrator's own addresses
  and in the administrator portal's own styling, and the clinical pages send
  anyone who lands on them to the right place. The two audiences share no
  address. The recovery request itself is unchanged, and it answers the same
  way whether or not the address is registered, so it still cannot be used to
  find out who has an account.

- **Password recovery now looks like the sign-in page.** The forgotten-password
  screen previously used a different arrangement — a separate promotional
  panel, a heading outside the card, and differently sized controls — so
  moving between the two felt like leaving one product and entering another.
  It now shares the sign-in page's layout exactly: the same panel, the same
  card, the same heading treatment, and the same form controls. The recovery
  request, the resend timer and the confirmation state are unchanged, and the
  screen still announces the field to assistive technology.

- **Demo-request page hero scoped to its own section.** The request-a-demo
  page now opens with a full-width hero banner section in the same style as
  the About Us and Contact Us pages (photographic banner with overlay and
  grid lines), with the enquiry form and supporting points below. The page
  is served within the public site frame, so the global header and footer are
  present. Page layout, form behaviour, and submitted data are unchanged, and
  the banner remains legible in both light and dark themes.

- **Public navigation labels clarified.** The public-site header now presents
  the account-entry and registration actions as uppercase **LOGIN** and
  **GET STARTED**, with their destinations and keyboard accessibility unchanged.

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

- **The role list is now reachable with the keyboard.** The roles were
  click-only panels, so a person who does not use a pointer could not choose a
  role at all and therefore could not reach the permission editor. They are
  real buttons now, with the selected role announced.
- **The triage level and the state of a bay are no longer carried by colour
  alone.** Every patient states its triage level and every bay states whether
  it is occupied, ready or being turned over, in words, so the board is
  readable by a person who cannot distinguish the colours, and the colour is
  an addition rather than the message.
- **Filled status surfaces use their own foreground in both themes.** The
  emergency badges and the bay states pair a status colour with the matching
  foreground the theme defines, instead of a hand-picked white or black.
- **Every control on the two screens has a name**, the board's search field is
  labelled, the admission form reports which reading is out of range and in
  which direction, and the permission switches say which module and which
  capability they belong to.

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

- **The API now requires the product name in production.** `APP_NAME` must be
  present in the production environment; the platform refuses to start without
  it rather than serving mail, invitations and reports that call the product
  the wrong thing. Development is unaffected: a documented default applies when
  the variable is unset. The browser reads its own variable, `VITE_APP_NAME`,
  and the two must be set to the same value.

- **The API now requires its ports in production.** `PORT` and `HTTPS_PORT`
  must be present in the production environment; the platform refuses to start
  without them rather than binding a port it was never told to use. Development
  is unaffected: a documented default applies when the variable is unset.
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

- **Password-reset links work again.** The account and recovery screens moved
  under a single sign-in area, but reset emails were still being generated
  against the old address. Following one dropped the single-use token and
  landed the recipient on the public site with no error and no way forward;
  asking for another email was the only recovery. Newly generated links now use
  the current address, and links already sitting in an inbox are forwarded
  intact, token included, instead of being discarded.

- **Landing-page section links now move the viewport.** A link such as
  "Patient records", followed from any other page, changed the address but left
  the visitor at the previous scroll position, because those links navigate
  within the single-page app rather than loading a page. The target section is
  now scrolled into view, and honours a visitor's reduced-motion preference.

- **The public site header no longer overflows at tablet width.** The full
  navigation was shown from the small-phone breakpoint upward, but six links
  plus two buttons do not fit there: the landing page gained a horizontal
  scrollbar and header controls were pushed out of reach with no visible
  affordance. The compact menu now covers that whole range, and the menu itself
  is checked at those widths so it cannot go dead.

- **Registration rejects a name made only of spaces.** Two spaces were enough to
  satisfy the length check while the submitted name was built from trimmed
  values, so a staff record could be created with a blank name. The fields are
  trimmed before they are validated.

- **Keyboard focus is visible on FAQ questions.** The questions removed their
  focus outline without replacing it, so a keyboard user tabbing through the
  page could not tell which question had focus.

- **Motion honours the reduced-motion preference.** The preference was applied
  through stylesheet rules that the animation library does not read, so sections,
  the contact hero and the mobile menu still slid and faded in for visitors who
  asked for stillness.

- **Registration progress is announced correctly.** The step indicator is
  numbered from one, so it was being read aloud as 0% on the first step. It now
  announces "Step 1 of 3" and so on.

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

### Fixed

- **The keyboard cheatsheet is gone from the pages.** A floating "Hotkeys"
  control sat in the corner of every page, including the public ones, and
  opened a dialog listing the clinical navigation shortcuts. It has been
  removed from the interface and from the code.

- **Two records created in the same second no longer collide.** The public
  identifier of an appointment was built from the last few digits of the
  clock, so two appointments made in the same second asked for the same
  identifier and one of them failed with an error nobody could do anything
  about. Identifiers are now random, and a collision is retried.

- **A prescription can no longer be marked as dispensed on its own.** The
  dispensing record is the only thing that moves a medicine off the shelf. A
  prescription that could be marked as dispensed directly left the inventory
  saying the medicine was still there while the prescription said it had been
  given out.

- **The records brought in from another system are stored the way this one
  stores them.** The import wrote the patient's name, phone, email and address
  in the clear, into columns that are ciphertext everywhere else, and left the
  records belonging to no hospital — which, now that every clinical record is
  confined to a hospital, made them invisible to everybody. The import now
  writes them the way the application does, puts them in the hospital the
  deployment states, reads the external table a page at a time, and cannot
  collide with a record created here.

- **The migration ledger exists in the production database.** The production
  database was provisioned by applying the schema and the migrations directly,
  so the table that records what has been applied was never created. It is
  there now, with every applied migration recorded, so a later run of the
  runner knows what it has already done.

- **The signing in works again through the platform's proxy.** The service
  was being published through a proxy that terminates the connection, and it
  did not know it was behind one. It believed every request arrived over an
  insecure connection, so it refused to set the secure session cookie — and
  with no session, no one could sign in. It now recognises the proxy it sits
  behind, and the sessions are kept in the database rather than in the memory
  of the process, so a restart no longer signs everybody out at once.

- **Every visitor is counted separately.** Rate limiting identified clients by
  the proxy's address rather than by theirs, so the whole hospital shared one
  allowance and a busy moment locked everyone out at once. The audit trail
  recorded the proxy's address for the same reason, and now records the
  person's.

- **The seeded application name is the configured one.** The name written into
  the platform's own settings was the literal text of the placeholder rather
  than the name the deployment is configured with, so the platform referred to
  itself by a token on that screen.

- **A mistyped backup schedule can no longer stop the service.** The schedule
  is configuration, and a schedule that cannot be parsed is now reported and
  replaced with the default instead of preventing the service from starting.
  The daily backup also runs on the schedule the deployment states, rather
  than on one written into the code.

- **The database is no longer read end to end for one answer.** The lists of
  medicines, suppliers, staff, patients, prescriptions, appointments and
  purchase orders are paged, the stock and the prescriptions have the indexes
  their queries need, the stock cannot go negative, and the tables that grew
  without bound — the trail, the events, the notices and the shared summaries —
  are now kept for a stated period and swept.

- **A request from an unknown origin is refused quietly.** It was refused
  correctly, but it was recorded as a server fault, so a routine refusal
  looked like an outage in the log.

### Added

- **The emergency board can be worked.** The board could be read but not
  acted on: a patient could be shown on it and never admitted, and a bay could
  never be allocated or released through the interface. Admitting a patient,
  changing their triage level, allocating a bay and discharging them are now
  available, and the interface shows the triage level and the bay's state at a
  glance.

- **A role's permissions can be edited.** The backend has always been able to
  change what a role may do; there was no way to reach it from the interface.

- **A notification inbox that is real.** Staff now receive notifications from
  the system rather than from a fixed list built in the browser: appointments
  starting shortly, prescriptions approaching the end of their course, stock
  that has fallen to its reorder level, and observations that came back
  abnormal. Each alert is raised once, is remembered per person, and can be
  read, confirmed or dismissed. The notification list starts empty until the
  real conditions are met.

### Security and integrity

- **The production environment is held by the platform, not in the
  repository.** The deployment's configuration — including the rotated
  database credentials — is now held by the hosting platform and applied to
  the running service. It is never committed, never printed, and never
  written into a build artefact.

- **Nothing sensitive is reachable from the public address.** The deployment
  archive is removed from the public directory once the platform has taken
  it, the compiled application is not served as a static file, and the
  environment file is refused by the web server.

### Known issues and limitations

- **Sessions are held in memory.** A restart signs everyone out, and the
  session store grows with the number of people who have visited. A published
  deployment would be better served by a session store that outlives the
  process; this is recorded as the next piece of work rather than changed
  during a hardening pass.

- **A request from an unknown origin is refused loudly.** A browser sending
  a request from a page it does not belong to is turned away, and the refusal
  is recorded as a server error. The request is refused either way.

### Hardening

- **The uploaded records are no longer handed out to the world.** The
  patient's documents were served as ordinary static files, so anybody who
  could work out a document's address could read it without signing in. They
  are now served only through the route that authenticates the caller, checks
  the permission and checks whose record it is.

- **A registration can no longer create an administrator.** Self-service
  registration took the role from the request, so anybody who could reach the
  sign-up page could create themselves an account with the widest possible
  access — and then read every hospital's records. The role is now taken from
  a list the deployment states, the administrative roles are not on it, and a
  new account cannot sign in until somebody with the authority to say so has
  said so.

- **The second factor is now actually a second factor.** The short-lived
  token that is issued between the password and the verification code was
  accepted everywhere a session token was accepted, so knowing somebody's
  password was enough to read their patients. It is now accepted only by the
  endpoints that complete the verification it was issued for.

- **A record now stays inside its hospital.** The list of patients, of
  appointments, of notes, of medication administrations, of documents, of
  purchase orders and the emergency board were all answered without regard to
  which hospital asked. A clinician at one hospital could read another's
  records, and a patient record could be read, changed or deleted by anyone
  who knew its number. Every one of them is now confined to the caller's own
  hospital, and a record that belongs to another is reported as absent rather
  than as forbidden.

- **A suspended account stays suspended.** Signing in with the right
  password quietly set the account back to active, which undid a suspension
  and released a lock that an administrator had applied. The status is no
  longer touched by a successful sign-in, and an account that is not active
  does not sign in at all.

- **The account balances and the transactions behind them now agree.** The
  ledger wrote a transaction and moved the balance by rules that did not
  match each other, and a changed or removed transaction left the balance
  where it was. Every path that writes now moves the balance the same way,
  and the change and the removal move it back.

- **The installation's settings can only be written with the installation's
  own settings.** Any key the request carried was stored, so a caller could
  write a setting the application reads — including where its reports are
  sent — for the whole installation. The keys are now the same list the
  application reads, and an unknown key is refused.

- **The application's own errors are no longer echoed to the caller.** A
  failure that reached the error handler answered with the message the
  database or the driver had written, which named tables, columns and
  occasionally the value that had collided. The detail is now kept in the
  operator's log, and the caller is told what happened without being told
  the shape of the system.

- **The recovery link is no longer written to the log.** When the mail
  service was not configured, the password reset link — with its live token
  — was printed, where anybody with log access could take the account over.
  The link is never written down now.

- **A file's name can no longer decide where it is written.** A document's
  name, and the name an upload arrived with, were used as parts of a path.
  They are reduced to names that cannot mean anything to the filesystem
  before they are used, and a stored path is checked against the directory it
  is supposed to be in.

- **A document is no longer served as whatever the uploader said it was.** A
  document declared as a web page was served as one, so opening a patient's
  record ran that record's own script in the hospital's own address. The
  type is now decided by the file itself, only the types that cannot carry a
  script are shown in place, and everything else is downloaded.

- **The restore of a backup is no longer a command line.** The restore was
  built by pasting values into a string and handing it to a shell, where a
  value carrying a quote or a command substitution became part of the
  command. It is now run as an argument list, with no shell, and the database
  name is checked before it is used.

- **The deployment's secrets are required in every environment.** A secret
  that was missing fell back to a value published in the source, so a
  deployment that started in the wrong mode signed its own sessions with a
  key anybody could read. The secret is now required, and the only way to run
  without one is to ask for it deliberately.

- **The addresses the browser uses are all the same rule now.** Several
  places called a fixed path on the application's own host, so on a
  deployment where the API is on another host those calls never reached it.
  They go through the one resolver, and the health panel asks the service
  whether it is alive rather than asking it to refuse a sign-in.

- **A patient's record can be read again.** The schema the browser checked
  the answer against asked for a shape the API does not send, so the picker
  that used it was permanently empty with nothing to show for it.

- **The changes the browser asks for are the changes that are made.** A batch
  number and an expiry date were dropped on every edit, and the answer said
  the edit had been saved.

- **A request that names another hospital is refused with a plain refusal.**
  The answer says the hospital does not match, which is what the caller
  asked about, and does not say whose it was.

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

## 2026-10-24 — Patient Portal (feat/patient-portal)
- /patient-portal full RBAC portal (patient role, patient_id scope), backend routes/controller, frontend PatientPortalPage, App.tsx lazy route.
- Billing/invoicing verified robust (invoice schema + financial controller + audit + ledger).
- Build/type-clean; deploy bundle rebuild blocked by .env NODE_ENV restriction (operator gate).
