# Antonio Pereira Web Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a fast English-only landing page for `antoniopereiraweb.co.uk` that turns UK and Jersey local-business visitors into free Google Business Profile audit enquiries through WhatsApp.

**Architecture:** Use a dependency-free static site served from the repository root by GitHub Pages. Semantic HTML owns content and navigation, one focused stylesheet owns responsive presentation, and minimal JavaScript adds progressive enhancement for the mobile menu, FAQ controls, and reveal effects without making core content dependent on scripting.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Node.js built-in test runner, GitHub Pages.

## Global Constraints

- English-only content.
- Primary conversion is a WhatsApp request for a free visibility audit.
- No visible telephone number.
- Display £500 one-time optimisation and £400/month growth service.
- No fabricated statistics, rankings, results, or testimonials.
- Static site with no framework, package dependency, CMS, login, payment, booking system, or build step.
- Responsive, accessible, and fully usable without JavaScript.
- Custom domain is `antoniopereiraweb.co.uk`.

## File Map

- `index.html`: semantic page content, metadata, structured data, section anchors, and conversion links.
- `assets/css/styles.css`: design system, layout, responsive rules, accessible states, and reduced-motion behaviour.
- `assets/js/main.js`: progressive enhancement for navigation, FAQ state, header state, and reveal effects.
- `privacy.html`: concise UK-oriented privacy notice for enquiries and site operation.
- `terms.html`: service-site terms and clear non-guarantee language.
- `robots.txt`: crawler permissions and sitemap location.
- `sitemap.xml`: canonical page discovery.
- `CNAME`: GitHub Pages custom-domain declaration.
- `tests/site.test.mjs`: structural, content, link, accessibility, and metadata assertions.
- `.github/workflows/quality.yml`: automated test and HTML validation workflow.

---

### Task 1: Establish the testable static-site contract

**Files:**
- Create: `tests/site.test.mjs`
- Create: `package.json`

**Interfaces:**
- Consumes: repository-root website files.
- Produces: `npm test`, a zero-dependency validation command used by local verification and CI.

- [ ] **Step 1: Write failing Node tests**

Create tests that assert `index.html` exists; contains one `h1`; includes the exact two prices; contains the canonical URL, description, Open Graph tags, JSON-LD, every required section ID, email, secure WhatsApp URLs with pre-filled audit text, and no visible telephone-number text. Assert `CNAME`, `robots.txt`, `sitemap.xml`, `privacy.html`, and `terms.html` exist with required canonical/domain content.

- [ ] **Step 2: Add the test command**

Set `package.json` scripts to `{ "test": "node --test tests/*.test.mjs" }` and require Node 20 or newer.

- [ ] **Step 3: Run the tests and confirm the initial failure**

Run: `npm test`

Expected: FAIL because the website files do not yet exist.

- [ ] **Step 4: Commit the contract**

Commit message: `test: define landing page contract`

### Task 2: Build semantic conversion content and legal pages

**Files:**
- Create: `index.html`
- Create: `privacy.html`
- Create: `terms.html`
- Create: `CNAME`
- Create: `robots.txt`
- Create: `sitemap.xml`

**Interfaces:**
- Consumes: exact contract in `tests/site.test.mjs`.
- Produces: semantic section IDs `services`, `industries`, `process`, `pricing`, `results`, `faq`, and `contact`; reusable class hooks for styling; CTA links used without JavaScript.

- [ ] **Step 1: Implement metadata and navigation**

Add title, description, canonical URL, Open Graph metadata, theme colour, JSON-LD `ProfessionalService`, skip link, labelled navigation, and a sticky-header-compatible structure.

- [ ] **Step 2: Implement conversion sections**

Add the approved hero, trust strip, problem framing, four service benefits, four industries, three-step process, two pricing cards, honest deliverables/results proof, six FAQ items, final CTA, and footer.

- [ ] **Step 3: Implement secure contact behaviour**

Use `https://wa.me/447700704591?text=...` for audit CTAs while never rendering the phone number as visible text. Use `mailto:info@antoniopereiraweb.co.uk` for email.

- [ ] **Step 4: Implement privacy and terms pages**

Explain enquiry data, WhatsApp/email processing, retention, user rights, external services, service scope, payment terms, intellectual property, and that rankings or enquiry volumes are not guaranteed.

- [ ] **Step 5: Add discovery files**

Set `CNAME` to `antoniopereiraweb.co.uk`; allow crawling in `robots.txt`; list the canonical home, privacy, and terms URLs in `sitemap.xml`.

- [ ] **Step 6: Run the contract tests**

Run: `npm test`

Expected: structural/content tests pass; styling and script-specific tests remain pending.

- [ ] **Step 7: Commit content**

Commit message: `feat: add landing page content and SEO`

### Task 3: Implement the premium responsive visual system

**Files:**
- Create: `assets/css/styles.css`
- Modify: `index.html`
- Modify: `privacy.html`
- Modify: `terms.html`
- Modify: `tests/site.test.mjs`

**Interfaces:**
- Consumes: semantic HTML and class hooks from Task 2.
- Produces: responsive layouts at 760px and 1024px breakpoints, consistent design tokens, focus states, mobile CTA, and a CSS-built local-visibility visual.

- [ ] **Step 1: Extend tests for presentation requirements**

Assert every HTML page links `assets/css/styles.css`; the CSS defines `:focus-visible`, `prefers-reduced-motion`, mobile navigation rules, and no horizontal-overflow hack on the root element.

- [ ] **Step 2: Confirm presentation tests fail**

Run: `npm test`

Expected: FAIL because `styles.css` does not yet exist.

- [ ] **Step 3: Implement design tokens and global styles**

Create colour, spacing, radius, shadow, and typography variables; strong contrast; fluid type using `clamp()`; container primitives; button states; and accessible focus rings.

- [ ] **Step 4: Implement responsive components**

Style the header, hero, CSS map/profile visual, trust strip, card grids, process timeline, pricing emphasis, FAQ, final CTA, footer, and mobile fixed audit action.

- [ ] **Step 5: Implement accessibility and motion safeguards**

Support keyboard navigation, touch targets of at least 44px, visible focus, high contrast, and reduced-motion overrides.

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit presentation**

Commit message: `feat: add responsive premium visual system`

### Task 4: Add progressive interaction and automated quality checks

**Files:**
- Create: `assets/js/main.js`
- Create: `.github/workflows/quality.yml`
- Modify: `index.html`
- Modify: `tests/site.test.mjs`

**Interfaces:**
- Consumes: `[data-menu-toggle]`, `[data-nav]`, `details`, `[data-reveal]`, and site-header hooks.
- Produces: keyboard-safe mobile menu state, single-open FAQ enhancement, header scroll state, and reveal classes; CI on pushes and pull requests.

- [ ] **Step 1: Extend tests for script and CI hooks**

Assert the script is deferred, required data hooks exist, all FAQ content uses native `details/summary`, and the workflow runs `npm test` on Node 20.

- [ ] **Step 2: Confirm interaction tests fail**

Run: `npm test`

Expected: FAIL because `main.js` and the workflow do not yet exist.

- [ ] **Step 3: Implement progressive JavaScript**

Toggle `aria-expanded` and navigation state; close navigation after a link selection or Escape; enhance FAQ so opening one item closes another; use `IntersectionObserver` only when motion is allowed; and add the compact header state after scrolling.

- [ ] **Step 4: Add CI**

Create a GitHub Actions workflow using `actions/checkout@v4` and `actions/setup-node@v4`, install no dependencies, and run `npm test`.

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit interactions and CI**

Commit message: `feat: add progressive interactions and quality checks`

### Task 5: Verify, publish, and connect the domain

**Files:**
- Modify only if verification finds a defect.

**Interfaces:**
- Consumes: completed root static site and GitHub repository settings.
- Produces: live GitHub Pages deployment at `https://antoniopereiraweb.co.uk/` with HTTPS after DNS propagation.

- [ ] **Step 1: Run automated verification**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run local browser verification**

Serve the repository locally and inspect at 390×844, 768×1024, and 1440×1000. Verify no horizontal overflow; header/menu operation; FAQ keyboard operation; readable pricing; and working email and WhatsApp destinations.

- [ ] **Step 3: Publish code to `main`**

Push the tested files and confirm the workflow succeeds.

- [ ] **Step 4: Enable GitHub Pages**

Configure Pages to deploy from the repository root on `main` and retain the custom domain `antoniopereiraweb.co.uk`.

- [ ] **Step 5: Configure Namecheap DNS**

Set apex `A` records to GitHub Pages IPs `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`; set `www` CNAME to `antoniopereirawebcouk-creator.github.io`; remove only conflicting web-host records after resolving their exact targets.

- [ ] **Step 6: Verify the live domain**

Confirm apex and `www` reach the same site, the TLS certificate is valid, GitHub reports the domain check as successful, and the main audit CTA reaches the intended WhatsApp pre-filled message.

- [ ] **Step 7: Final commit if verification required changes**

Commit message: `fix: resolve launch verification findings`
