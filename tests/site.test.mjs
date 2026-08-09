import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_URL = 'https://antoniopereiraweb.co.uk/';
const SITE_DOMAIN = 'antoniopereiraweb.co.uk';
const SITE_EMAIL = 'info@antoniopereiraweb.co.uk';
const HERO_H1 = 'Get Found on Google Maps. Turn Local Searches Into Customers.';
const DESCRIPTION_PHRASES = [
  'Google Business Profile',
  'UK',
  'Jersey',
  'service businesses',
];
const PRICE_LINES = [
  '£299 one-time setup',
  '£149/month ongoing support',
  '£249 one-time setup',
  '£99/month for the first 3 months',
];
const PROHIBITED_PRICE_LINES = [
  ['£', '500', ' one-time ', 'optimisation'].join(''),
  ['£', '400', '/month ', 'growth ', 'service'].join(''),
];
const FOUNDING_OFFER_COPY = 'Founding Client Offer';
const FOUNDING_OFFER_LIMIT_COPY = 'first 5 clients';
const FOUNDING_OFFER_TRANSITION_COPY =
  'After the first 3 months, ongoing support continues at the standard £149/month only if you want to keep the service running.';
const REQUIRED_SECTION_IDS = [
  'services',
  'industries',
  'process',
  'pricing',
  'results',
  'faq',
  'contact',
];
const WHATSAPP_TEXT =
  'free Google Business Profile visibility audit';
const WHATSAPP_URL_PREFIX = 'https://wa.me/447700704591?text=';
const STYLESHEET_PATH = 'assets/css/styles.css';
const SCRIPT_PATH = 'assets/js/main.js';
const QUALITY_WORKFLOW_PATH = '.github/workflows/quality.yml';
const TARGET_PHONE_VARIANTS = ['07700704591', '447700704591', '+447700704591'];
const PROHIBITED_PROOF_PATTERNS = [
  { pattern: /\b\d+(?:\.\d+)?%/i, reason: 'fabricated percentage results' },
  { pattern: /\b\d+(?:\.\d+)?\/5\b/i, reason: 'fabricated review scores' },
  { pattern: /\b\d+(?:\.\d+)?\s*stars?\b/i, reason: 'fabricated star ratings' },
  { pattern: /\b(?:x\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?x)\b/i, reason: 'fabricated multiplier results' },
  { pattern: /(?:^|[^\w])(?:ranked?\s*)?#1\b/i, reason: 'fabricated rankings' },
  { pattern: /\btop[- ]rated\b/i, reason: 'fabricated rankings' },
  { pattern: /\bbest in\b/i, reason: 'fabricated rankings' },
  { pattern: /\btestimonial(?:s)?\b/i, reason: 'testimonial claims' },
  { pattern: /["“][^"”]{10,}["”]\s*[—-]\s*[A-Z][^.!?]{1,60}/, reason: 'testimonial quotes' },
  {
    pattern:
      /\b(?:trusted by|serving|helping|worked with|supporting)\s+\d+\s+(?:local\s+)?(?:customers?|clients?|business(?:es)?|companies)\b/i,
    reason: 'fabricated customer or business count proof',
  },
];
const PROHIBITED_FRAMEWORK_PATTERNS = [
  /<div\b[^>]*id=["']root["'][^>]*>\s*<\/div>/i,
  /<div\b[^>]*id=["']app["'][^>]*>\s*<\/div>/i,
  /\bdata-reactroot\b/i,
  /\bng-app\b/i,
  /__NEXT_DATA__/i,
  /<script\b[^>]*src=["'][^"']*(?:react|vue|angular|svelte|next|nuxt|astro)[^"']*["'][^>]*>/i,
];

function readRequiredFile(relativePath) {
  const filePath = path.join(ROOT, relativePath);

  assert.ok(fs.existsSync(filePath), `${relativePath} should exist`);

  return fs.readFileSync(filePath, 'utf8');
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function getVisibleText(html) {
  return normalizeText(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMetaContent(html, attributeName, attributeValue) {
  const patterns = [
    new RegExp(
      `<meta\\b[^>]*${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta\\b[^>]*content=["']([^"']+)["'][^>]*${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]*>`,
      'i'
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function buildSeparatedDigitsPattern(value) {
  const separator = '[\\s().-]*';
  const pattern = Array.from(value, (char) => (char === '+' ? '\\+' : char)).join(separator);

  return new RegExp(pattern, 'i');
}

function containsVisibleTargetPhoneNumber(visibleText) {
  return TARGET_PHONE_VARIANTS
    .map((variant) => buildSeparatedDigitsPattern(variant))
    .some((pattern) => pattern.test(visibleText));
}

function assertNoFabricatedProofClaims(html) {
  const visibleText = getVisibleText(html);

  for (const { pattern, reason } of PROHIBITED_PROOF_PATTERNS) {
    assert.doesNotMatch(visibleText, pattern, `index.html should not include ${reason}`);
  }
}

function assertStaticSemanticContract(html) {
  assert.match(html, /<main\b/i, 'index.html should contain a semantic main element');
  assert.match(html, /<nav\b/i, 'index.html should contain semantic navigation');
  assert.doesNotMatch(html, /href=["']javascript:/i, 'index.html should not use javascript: links');
  assert.doesNotMatch(html, /\bonclick=/i, 'core interactions should not require inline JavaScript handlers');

  for (const pattern of PROHIBITED_FRAMEWORK_PATTERNS) {
    assert.doesNotMatch(html, pattern, 'index.html should not rely on framework bootstrapping shells');
  }

  for (const sectionId of REQUIRED_SECTION_IDS) {
    assert.match(
      html,
      new RegExp(`<a\\b[^>]*href=["']#${escapeRegExp(sectionId)}["'][^>]*>`, 'i'),
      `index.html should link to #${sectionId} with semantic anchor navigation`
    );
  }

  const faqSectionMatch = html.match(/<section\b[^>]*id=["']faq["'][^>]*>([\s\S]*?)<\/section>/i);
  assert.ok(faqSectionMatch, 'index.html should include an FAQ section');
  assert.match(faqSectionMatch[1], /<(?:h[2-6]|p|details|summary)\b/i, 'FAQ content should be present in HTML');
  assert.doesNotMatch(
    faqSectionMatch[1],
    /\b(?:hidden|aria-hidden=["']true["']|style=["'][^"']*display\s*:\s*none)/i,
    'FAQ answers should not be hidden in the initial HTML'
  );

  assert.match(
    html,
    new RegExp(`<a\\b[^>]*href=["']${escapeRegExp(WHATSAPP_URL_PREFIX)}[^"']+["'][^>]*>`, 'i'),
    'primary audit CTAs should be real anchor links'
  );
  assert.match(
    html,
    new RegExp(`<a\\b[^>]*href=["']mailto:${escapeRegExp(SITE_EMAIL)}["'][^>]*>`, 'i'),
    'email contact should be a real anchor link'
  );
}

function assertSharedStylesheetLink(html, file) {
  assert.match(
    html,
    new RegExp(
      `<link\\b(?=[^>]*rel=["']stylesheet["'])(?=[^>]*href=["']${escapeRegExp(STYLESHEET_PATH)}["'])[^>]*>`,
      'i'
    ),
    `${file} should link the shared stylesheet`
  );
}

test('fabricated-proof guard rejects invented statistics, rankings, results, and testimonials without blocking prices or years', () => {
  const compliantHtml = `
    <section id="results">
      <p>What you get is clear optimisation work, not invented performance claims.</p>
      <p>Standard setup is £299 one-time and ongoing support is £149/month in 2026.</p>
    </section>
  `;

  assert.doesNotThrow(() => assertNoFabricatedProofClaims(compliantHtml));

  const prohibitedExamples = [
    '<section id="results"><p>Win 37% more calls in 30 days.</p></section>',
    '<section id="results"><p>Rated 4.9/5 by 200 customers.</p></section>',
    '<section id="results"><p>We are the #1 Google Maps agency for trades.</p></section>',
    '<section id="results"><p>“Antonio doubled our leads in a week.” — Jane, Cleaning Co.</p></section>',
  ];

  for (const html of prohibitedExamples) {
    assert.throws(
      () => assertNoFabricatedProofClaims(html),
      /fabricated|ranking|testimonial|result/i
    );
  }
});

test('fabricated-proof guard rejects standalone customer and business count proof without blocking ordinary numbers', () => {
  const allowedHtml = `
    <section id="results">
      <p>Choose the right plan for your business.</p>
      <ol>
        <li>Step 1: Request your audit.</li>
        <li>Step 2: Review the findings.</li>
        <li>Step 3: Start optimisation.</li>
      </ol>
      <p>Pricing starts at £299 setup and £149/month in 2026.</p>
      <p>FAQ: 6 common questions.</p>
      <p>WhatsApp: https://wa.me/447700704591?text=hello</p>
    </section>
  `;

  assert.doesNotThrow(() => assertNoFabricatedProofClaims(allowedHtml));

  const prohibitedExamples = [
    '<section id="results"><p>Trusted by 200 customers across the UK.</p></section>',
    '<section id="results"><p>Serving 150 local businesses every month.</p></section>',
    '<section id="results"><p>Helping 80 companies get found on Google Maps.</p></section>',
    '<section id="results"><p>Worked with 65 clients in Jersey and the UK.</p></section>',
  ];

  for (const html of prohibitedExamples) {
    assert.throws(
      () => assertNoFabricatedProofClaims(html),
      /fabricated|customer|client|business|company/i
    );
  }
});

test('visible-phone guard catches spaced and hyphenated variants of the target number', () => {
  const safeVisibleText = 'Request your free visibility audit on WhatsApp or email us today.';
  assert.equal(containsVisibleTargetPhoneNumber(safeVisibleText), false);

  const visibleVariants = [
    'Call 07700 704591 for your audit.',
    'WhatsApp +44 7700 704591 to get started.',
    'Use 07 700 704 591 if you need support.',
    'Contact 07700-704-591 today.',
  ];

  for (const variant of visibleVariants) {
    assert.equal(containsVisibleTargetPhoneNumber(variant), true, `${variant} should be detected`);
  }
});

test('static semantic guard rejects framework shells and JavaScript-dependent interaction markup', () => {
  const compliantHtml = `
    <header>
      <nav aria-label="Primary">
        <a href="#services">Services</a>
        <a href="#industries">Industries</a>
        <a href="#process">Process</a>
        <a href="#pricing">Pricing</a>
        <a href="#results">Results</a>
        <a href="#faq">FAQ</a>
        <a href="#contact">Contact</a>
      </nav>
    </header>
    <main>
      <section id="faq">
        <h2>FAQ</h2>
        <p>Most optimisations start after the audit and remain readable without JavaScript.</p>
      </section>
      <section id="contact">
        <a href="${WHATSAPP_URL_PREFIX}hello" target="_blank" rel="noopener noreferrer">Free Audit</a>
        <a href="mailto:${SITE_EMAIL}">Email</a>
      </section>
    </main>
  `;

  assert.doesNotThrow(() => assertStaticSemanticContract(compliantHtml));

  const frameworkShellHtml = `
    <nav aria-label="Primary"><a href="#services">Services</a></nav>
    <main></main>
    <div id="root"></div>
    <script src="/assets/react-app.js"></script>
  `;
  assert.throws(() => assertStaticSemanticContract(frameworkShellHtml), /framework|static/i);

  const jsDependentFaqHtml = `
    <nav aria-label="Primary"><a href="#faq">FAQ</a></nav>
    <main>
      <section id="faq">
        <button onclick="toggleFaq()">How long does it take?</button>
        <div hidden>The answer is hidden until JavaScript runs.</div>
      </section>
      <section id="contact">
        <button>Free Audit</button>
      </section>
    </main>
  `;
  assert.throws(() => assertStaticSemanticContract(jsDependentFaqHtml), /JavaScript|semantic|CTA|FAQ/i);
});

test('index.html defines the landing-page content contract', () => {
  const html = readRequiredFile('index.html');
  const visibleText = getVisibleText(html);

  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, 'index.html should contain exactly one h1');

  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  assert.ok(h1Match, 'index.html should include an h1 element');
  assert.equal(normalizeText(h1Match[1]), HERO_H1, 'the h1 should match the approved hero headline');

  for (const priceLine of PRICE_LINES) {
    assert.match(
      visibleText,
      new RegExp(escapeRegExp(priceLine)),
      `index.html should include ${priceLine}`
    );
  }
  for (const priceLine of PROHIBITED_PRICE_LINES) {
    assert.doesNotMatch(
      visibleText,
      new RegExp(escapeRegExp(priceLine)),
      `index.html should not include stale pricing copy: ${priceLine}`
    );
  }

  assert.match(
    visibleText,
    new RegExp(escapeRegExp(FOUNDING_OFFER_COPY)),
    'index.html should include the founding-offer label'
  );
  assert.match(
    visibleText,
    new RegExp(escapeRegExp(FOUNDING_OFFER_LIMIT_COPY)),
    'index.html should state that the founding offer is limited to the first 5 clients'
  );
  assert.match(
    visibleText,
    new RegExp(escapeRegExp(FOUNDING_OFFER_TRANSITION_COPY)),
    'index.html should explain exactly what happens after the founding offer ends'
  );

  assert.match(
    html,
    /<link\b(?=[^>]*rel=["']canonical["'])(?=[^>]*href=["']https:\/\/antoniopereiraweb\.co\.uk\/["'])[^>]*>/i,
    'index.html should include the canonical URL'
  );
  const descriptionContent = getMetaContent(html, 'name', 'description');
  assert.ok(descriptionContent, 'index.html should include a meta description');

  const titleContent = normalizeText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  assert.ok(titleContent.length > 0, 'index.html should include a title');
  assert.ok(titleContent.length <= 60, 'the title should stay within 60 characters');

  for (const phrase of DESCRIPTION_PHRASES) {
    assert.match(
      descriptionContent,
      new RegExp(escapeRegExp(phrase), 'i'),
      `the meta description should mention ${phrase}`
    );
  }

  const ogExpectations = [
    /<meta\b(?=[^>]*property=["']og:title["'])(?=[^>]*content=["'][^"']+["'])[^>]*>/i,
    /<meta\b(?=[^>]*property=["']og:type["'])(?=[^>]*content=["']website["'])[^>]*>/i,
    /<meta\b(?=[^>]*property=["']og:site_name["'])(?=[^>]*content=["']Antonio Pereira Web["'])[^>]*>/i,
    /<meta\b(?=[^>]*property=["']og:url["'])(?=[^>]*content=["']https:\/\/antoniopereiraweb\.co\.uk\/["'])[^>]*>/i,
  ];

  for (const expectation of ogExpectations) {
    assert.match(html, expectation, 'index.html should include the required Open Graph tags');
  }

  const ogDescriptionContent = getMetaContent(html, 'property', 'og:description');
  assert.ok(ogDescriptionContent, 'index.html should include an Open Graph description');
  assert.equal(
    ogDescriptionContent,
    descriptionContent,
    'the Open Graph description should match the meta description'
  );

  assert.equal(getMetaContent(html, 'name', 'twitter:card'), 'summary');
  assert.equal(getMetaContent(html, 'name', 'twitter:title'), getMetaContent(html, 'property', 'og:title'));
  assert.equal(getMetaContent(html, 'name', 'twitter:description'), descriptionContent);

  assert.match(
    html,
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*"@type"\s*:\s*"ProfessionalService"[\s\S]*"url"\s*:\s*"https:\/\/antoniopereiraweb\.co\.uk\/"[\s\S]*"email"\s*:\s*"info@antoniopereiraweb\.co\.uk"[\s\S]*<\/script>/i,
    'index.html should include ProfessionalService JSON-LD with the canonical URL and email'
  );

  for (const sectionId of REQUIRED_SECTION_IDS) {
    assert.match(
      html,
      new RegExp(`id=["']${escapeRegExp(sectionId)}["']`, 'i'),
      `index.html should include a #${sectionId} section`
    );
  }

  assertNoFabricatedProofClaims(html);
  assertStaticSemanticContract(html);
});

test('index.html gives the hero audit group and trust section accurate accessible names', () => {
  const html = readRequiredFile('index.html');

  assert.match(
    html,
    /<div\b(?=[^>]*class=["'][^"']*\bhero__visual\b[^"']*["'])(?=[^>]*role=["']group["'])(?=[^>]*aria-labelledby=["']audit-reviews-title["'])[^>]*>/i,
    'the hero audit content should be a named group tied to its visible label'
  );
  assert.match(html, /<p\b[^>]*id=["']audit-reviews-title["'][^>]*>What your audit reviews<\/p>/i);
  assert.doesNotMatch(html, /aria-label=["']Local visibility summary["']/i);
  assert.match(
    html,
    /<section\b(?=[^>]*class=["'][^"']*\btrust-strip\b[^"']*["'])(?=[^>]*aria-label=["']Service areas and business types["'])[^>]*>/i
  );
});

test('index.html defines the secure contact contract without visible phone text', () => {
  const html = readRequiredFile('index.html');

  assert.match(
    html,
    new RegExp(`<a\\b[^>]*href=["']mailto:${escapeRegExp(SITE_EMAIL)}["'][^>]*>`, 'i'),
    'index.html should include the email contact link'
  );

  const whatsappAnchorPattern = new RegExp(
    `<a\\b(?=[^>]*href=["']${escapeRegExp(WHATSAPP_URL_PREFIX)}[^"']+["'])(?=[^>]*target=["']_blank["'])(?=[^>]*rel=["'][^"']*noopener)(?=[^>]*rel=["'][^"']*noreferrer)[^>]*>`,
    'gi'
  );
  const whatsappAnchors = html.match(whatsappAnchorPattern) ?? [];

  assert.ok(
    whatsappAnchors.length >= 1,
    'index.html should include at least one secure WhatsApp audit CTA with the approved pre-filled text'
  );

  for (const anchor of whatsappAnchors) {
    const hrefMatch = anchor.match(/href=["']([^"']+)["']/i);
    assert.ok(hrefMatch, 'each WhatsApp CTA should include an href');

    const linkUrl = new URL(hrefMatch[1]);
    const whatsappMessage = decodeURIComponent(linkUrl.searchParams.get('text') ?? '');

    assert.equal(linkUrl.origin, 'https://wa.me', 'WhatsApp CTAs should use the secure wa.me origin');
    assert.equal(linkUrl.pathname, '/447700704591', 'WhatsApp CTAs should target the approved number');
    assert.match(
      whatsappMessage,
      new RegExp(escapeRegExp(WHATSAPP_TEXT), 'i'),
      'the WhatsApp CTA should pre-fill a visibility audit request'
    );
  }

  const visibleText = getVisibleText(html);
  assert.ok(visibleText.includes(SITE_EMAIL), 'the contact email should be visible in the page content');
  assert.equal(
    containsVisibleTargetPhoneNumber(visibleText),
    false,
    'the phone number should not be visible text anywhere on the page'
  );
});

test('package.json keeps the validation contract dependency-free', () => {
  const pkg = JSON.parse(readRequiredFile('package.json'));

  assert.equal(pkg.scripts?.test, 'node --test tests/*.test.mjs');
  assert.equal(pkg.scripts?.['validate:site'], 'node scripts/validate-site.mjs');
  assert.match(pkg.engines?.node ?? '', />=\s*20/, 'package.json should require Node 20 or newer');
  assert.deepEqual(pkg.dependencies ?? {}, {}, 'package.json should not add runtime dependencies');
  assert.deepEqual(pkg.devDependencies ?? {}, {}, 'package.json should not add development dependencies');
});

test('progressive enhancement hooks and CI contract are present', () => {
  const html = readRequiredFile('index.html');
  const mainScript = readRequiredFile(SCRIPT_PATH);
  const workflow = readRequiredFile(QUALITY_WORKFLOW_PATH);

  assert.ok(normalizeText(mainScript).length > 0, 'main.js should contain progressive enhancement code');
  assert.match(
    html,
    new RegExp(
      `<script\\b(?=[^>]*src=["']${escapeRegExp(SCRIPT_PATH)}["'])(?=[^>]*defer\\b)[^>]*><\\/script>`,
      'i'
    ),
    'index.html should load the main script with defer'
  );
  assert.match(
    html,
    /<header\b[^>]*class=["'][^"']*\bsite-header\b[^"']*["'][^>]*data-site-header\b[^>]*>/i,
    'index.html should expose a header hook for progressive state changes'
  );
  assert.match(
    html,
    /<button\b[^>]*data-menu-toggle\b[^>]*aria-expanded=["']false["'][^>]*aria-controls=["'][^"']+["'][^>]*hidden\b[^>]*>/i,
    'index.html should include a menu toggle button that starts hidden and collapsed'
  );

  const navMatch = html.match(/<nav\b[^>]*class=["'][^"']*\bsite-nav\b[^"']*["'][^>]*>/i);
  assert.ok(navMatch, 'index.html should include the primary navigation');
  assert.match(navMatch[0], /\bid=["'][^"']+["']/i, 'the primary navigation should expose an id for the menu toggle');
  assert.match(navMatch[0], /\bdata-nav\b/i, 'the primary navigation should expose a data-nav hook');

  const revealHooks = html.match(/\bdata-reveal\b/gi) ?? [];
  assert.ok(revealHooks.length >= 6, 'index.html should add reveal hooks across key landing-page sections');

  const faqSectionMatch = html.match(/<section\b[^>]*id=["']faq["'][^>]*>([\s\S]*?)<\/section>/i);
  assert.ok(faqSectionMatch, 'index.html should include an FAQ section');
  const faqMarkup = faqSectionMatch[1];
  const detailsMatches = faqMarkup.match(/<details\b[^>]*class=["'][^"']*\bfaq-item\b[^"']*["'][^>]*>/gi) ?? [];
  const summaryMatches = faqMarkup.match(/<summary\b[^>]*>/gi) ?? [];
  assert.equal(detailsMatches.length, 6, 'the FAQ should keep all six questions in native details elements');
  assert.equal(summaryMatches.length, detailsMatches.length, 'every FAQ item should expose a native summary');
  assert.doesNotMatch(
    faqMarkup,
    /<(?:button|div)\b[^>]*data-faq/i,
    'FAQ interaction should not depend on custom button or div wrappers'
  );

  assert.match(workflow, /^name:\s*Quality Checks\b/m, 'quality workflow should have a clear name');
  assert.match(
    workflow,
    /^permissions:\s*\n\s+contents:\s*read\s*$/m,
    'quality workflow should explicitly use read-only contents access'
  );
  assert.match(workflow, /^\s*push:\s*$/m, 'quality workflow should run on pushes');
  assert.match(workflow, /^\s*pull_request:\s*$/m, 'quality workflow should run on pull requests');
  assert.match(
    workflow,
    /uses:\s*actions\/checkout@v4/i,
    'quality workflow should use actions/checkout@v4'
  );
  assert.match(
    workflow,
    /uses:\s*actions\/checkout@v4[\s\S]*?with:\s*\n\s+persist-credentials:\s*false\b/i,
    'checkout should not persist repository credentials'
  );
  assert.match(
    workflow,
    /uses:\s*actions\/setup-node@v4/i,
    'quality workflow should use actions/setup-node@v4'
  );
  assert.match(
    workflow,
    /node-version:\s*20\b/i,
    'quality workflow should use Node 20'
  );
  assert.match(
    workflow,
    /run:\s*npm test\b/i,
    'quality workflow should run npm test'
  );
  assert.match(
    workflow,
    /run:\s*npm run validate:site\b/i,
    'quality workflow should run executable HTML, XML, and internal-link validation'
  );
  assert.doesNotMatch(
    workflow,
    /npm\s+(?:install|ci)\b/i,
    'quality workflow should not install dependencies'
  );
});

test('discovery files exist with the required domain contract', () => {
  const cname = readRequiredFile('CNAME');
  const robots = readRequiredFile('robots.txt');
  const sitemap = readRequiredFile('sitemap.xml');
  readRequiredFile('privacy.html');
  readRequiredFile('terms.html');

  assert.equal(cname.trim(), SITE_DOMAIN, 'CNAME should contain the custom domain only');
  assert.match(robots, /User-agent:\s*\*/i, 'robots.txt should define a catch-all user agent');
  assert.match(robots, /Allow:\s*\//i, 'robots.txt should allow crawling');
  assert.match(
    robots,
    new RegExp(`Sitemap:\\s*${escapeRegExp(`${SITE_URL}sitemap.xml`)}`, 'i'),
    'robots.txt should declare the canonical sitemap URL'
  );

  for (const sitemapUrl of [SITE_URL, `${SITE_URL}privacy.html`, `${SITE_URL}terms.html`]) {
    assert.match(
      sitemap,
      new RegExp(`<loc>${escapeRegExp(sitemapUrl)}</loc>`, 'i'),
      `sitemap.xml should list ${sitemapUrl}`
    );
  }
});

test('privacy and terms pages use the site domain and their own canonical URLs', () => {
  const pageExpectations = [
    {
      file: 'privacy.html',
      canonical: `${SITE_URL}privacy.html`,
    },
    {
      file: 'terms.html',
      canonical: `${SITE_URL}terms.html`,
    },
  ];

  for (const { file, canonical } of pageExpectations) {
    const html = readRequiredFile(file);

    assert.match(
      html,
      new RegExp(
        `<link\\b(?=[^>]*rel=["']canonical["'])(?=[^>]*href=["']${escapeRegExp(canonical)}["'])[^>]*>`,
        'i'
      ),
      `${file} should include its canonical URL`
    );
    assert.match(
      html,
      new RegExp(escapeRegExp(SITE_DOMAIN), 'i'),
      `${file} should reference the canonical site domain`
    );
  }
});

test('legal pages identify the Jersey sole-trader counterparty and complete the required disclosures', () => {
  const privacy = readRequiredFile('privacy.html');
  const terms = readRequiredFile('terms.html');
  const privacyText = getVisibleText(privacy);
  const termsText = getVisibleText(terms);
  const controllerName = 'Antonio Pereira, trading as Antonio Pereira Web';

  for (const [file, visibleText] of [['privacy.html', privacyText], ['terms.html', termsText]]) {
    assert.match(visibleText, new RegExp(escapeRegExp(controllerName), 'i'), `${file} should identify the natural-person provider`);
    assert.match(visibleText, /Jersey, Channel Islands/i, `${file} should identify the Jersey establishment`);
    assert.doesNotMatch(visibleText, /UK[- ]established|established in (?:the )?UK/i, `${file} should not claim UK establishment`);
  }

  for (const heading of [
    'Controller and contact details',
    'Purposes and lawful bases',
    'Who receives personal data',
    'International transfers',
    'How long information is kept',
    'Your rights',
    'How to complain',
  ]) {
    assert.match(privacy, new RegExp(`<h2>${escapeRegExp(heading)}<\\/h2>`, 'i'));
  }

  assert.match(privacy, /https:\/\/www\.jerseylaw\.je\/laws\/current\/l_3_2018/i);
  assert.match(privacy, /https:\/\/portal\.jerseyoic\.org\/make-a-complaint/i);
  assert.match(privacy, /enquiries@jerseyoic\.org/i);
  assert.match(privacy, /<time\b[^>]*datetime=["']2026-08-09["'][^>]*>9 August 2026<\/time>/i);

  assert.match(termsText, /not a registered company/i);
  assert.match(termsText, /does not have a company registration number or VAT number/i);
  assert.match(termsText, /governed by the law of Jersey/i);
  assert.match(termsText, /courts of Jersey/i);
  assert.match(termsText, /formal notices.*email/i);
});

test('privacy notice transparently covers UK GDPR scope without inventing a UK establishment or representative', () => {
  const privacy = readRequiredFile('privacy.html');
  const privacyText = getVisibleText(privacy);

  assert.match(privacyText, /Data Protection \(Jersey\) Law 2018 and the UK GDPR/i);
  assert.match(privacyText, /service is offered to individuals in the UK/i);
  assert.match(privacyText, /UK GDPR applies to processing connected with that UK service offering/i);
  assert.match(privacyText, /established in Jersey, Channel Islands/i);
  assert.doesNotMatch(privacyText, /UK[- ]established|established in (?:the )?UK/i);

  for (const heading of [
    'When UK GDPR applies',
    'UK representative',
    'Your right to object',
  ]) {
    assert.match(privacy, new RegExp(`<h2>${escapeRegExp(heading)}<\\/h2>`, 'i'));
  }

  assert.match(privacyText, /Article 6\(1\)\(b\).*contract/i);
  assert.match(privacyText, /legal, tax, and accounting obligations.*Article 6\(1\)\(c\)/i);
  assert.match(privacyText, /Article 6\(1\)\(f\).*legitimate interests/i);
  assert.match(privacyText, /access.*rectification.*erasure.*restriction.*data portability.*object/i);
  assert.match(privacyText, /does not use.*automated decision.*profiling/i);

  assert.match(privacyText, /processing is only occasional.*low risk/i);
  assert.match(privacyText, /does not involve.*large-scale.*special category.*criminal offence data/i);
  assert.match(privacyText, /launch-stage.*never had a UK client.*does not receive regular UK enquiries/i);
  assert.match(privacyText, /works alone.*self-employed.*part-time/i);
  assert.match(privacyText, /reassess.*before UK processing becomes regular, systematic, or higher risk/i);

  assert.match(privacyText, /UK adequacy regulations.*Article 46.*derogation/i);
  assert.match(privacy, /https:\/\/ico\.org\.uk\/make-a-complaint/i);
  assert.match(privacy, /https:\/\/ico\.org\.uk\/global\/contact-us\//i);
  assert.match(privacy, /https:\/\/ico\.org\.uk\/for-organisations\/uk-gdpr-guidance-and-resources\/international-transfers\/receiving-personal-information-from-the-eea\//i);
  assert.match(privacyText, /0303 123 1113/i);
});

test('every HTML page uses the shared presentation layer', () => {
  for (const file of ['index.html', 'privacy.html', 'terms.html']) {
    assertSharedStylesheetLink(readRequiredFile(file), file);
  }
});

test('the stylesheet defines the responsive and accessible presentation contract', () => {
  const css = readRequiredFile(STYLESHEET_PATH);

  assert.match(css, /:focus-visible\s*\{/i, 'the stylesheet should provide visible keyboard focus');
  assert.match(
    css,
    /@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce[^)]*\)/i,
    'the stylesheet should provide reduced-motion safeguards'
  );
  assert.match(
    css,
    /@media\s*\(max-width\s*:\s*759px\)[\s\S]*?\.site-nav\s*\{/i,
    'the stylesheet should define mobile navigation rules'
  );
  assert.match(css, /@media\s*\(min-width\s*:\s*760px\)/i, 'the tablet breakpoint should start at 760px');
  assert.match(css, /@media\s*\(min-width\s*:\s*1024px\)/i, 'the desktop breakpoint should start at 1024px');
  assert.match(css, /\.mobile-audit-cta\s*\{/i, 'the stylesheet should define a mobile audit action');
  assert.match(css, /\.visibility-map\s*\{/i, 'the stylesheet should build the local-visibility visual');

  const rootRules = Array.from(css.matchAll(/(?:^|})\s*(?::root|html)\s*\{([^}]*)\}/gi));
  for (const [, declarations] of rootRules) {
    assert.doesNotMatch(
      declarations,
      /overflow(?:-x)?\s*:\s*(?:hidden|clip)/i,
      'the root element should not hide horizontal overflow as a layout workaround'
    );
  }
});

test('index.html exposes the CSS-built visibility visual and mobile audit action', () => {
  const html = readRequiredFile('index.html');

  assert.match(html, /class=["'][^"']*\bvisibility-map\b[^"']*["']/i);
  assert.match(
    html,
    new RegExp(
      `<a\\b(?=[^>]*class=["'][^"']*\\bmobile-audit-cta\\b[^"']*["'])(?=[^>]*href=["']${escapeRegExp(WHATSAPP_URL_PREFIX)}[^"']+["'])[^>]*>`,
      'i'
    ),
    'index.html should include a mobile WhatsApp audit action'
  );
});

test('footer links render as full-height touch targets', () => {
  const css = readRequiredFile(STYLESHEET_PATH);
  const footerLinkRule = css.match(/\.site-footer a\s*\{([^}]*)\}/i);

  assert.ok(footerLinkRule, 'the stylesheet should define footer link presentation');
  assert.match(
    footerLinkRule[1],
    /display\s*:\s*inline-flex/i,
    'footer links should use a box-generating display mode so minimum height applies'
  );
  assert.match(
    footerLinkRule[1],
    /min-height\s*:\s*var\(--touch-target\)/i,
    'footer links should preserve the shared 44px minimum touch target'
  );
  assert.match(footerLinkRule[1], /align-items\s*:\s*center/i);
});

test('the hero visual contains decorative paint without hiding page overflow', () => {
  const css = readRequiredFile(STYLESHEET_PATH);
  const heroVisualRule = css.match(/\.hero__visual\s*\{([^}]*)\}/i);

  assert.ok(heroVisualRule, 'the stylesheet should define the hero visual container');
  assert.match(
    heroVisualRule[1],
    /contain\s*:\s*paint/i,
    'the hero visual should clip its filtered glow at the component boundary'
  );

  const pageRules = Array.from(css.matchAll(/(?:^|})\s*(?::root|html|body)\s*\{([^}]*)\}/gi));
  for (const [, declarations] of pageRules) {
    assert.doesNotMatch(
      declarations,
      /overflow(?:-x)?\s*:\s*(?:hidden|clip)/i,
      'page-level elements should not hide horizontal overflow to mask component spill'
    );
  }
});

test('mobile navigation keeps a restrained horizontal-scroll affordance', () => {
  const css = readRequiredFile(STYLESHEET_PATH);
  const mobileStart = css.indexOf('@media (max-width: 759px)');
  const tabletStart = css.indexOf('@media (min-width: 760px)');

  assert.ok(mobileStart >= 0 && tabletStart > mobileStart, 'mobile rules should precede tablet rules');

  const mobileCss = css.slice(mobileStart, tabletStart);
  const mobileNavRule = mobileCss.match(/\.site-nav\s*\{([^}]*)\}/i);

  assert.ok(mobileNavRule, 'mobile rules should style the horizontal navigation');
  assert.match(
    mobileNavRule[1],
    /scrollbar-width\s*:\s*thin/i,
    'Firefox should retain a thin visible scrollbar'
  );
  assert.doesNotMatch(mobileCss, /scrollbar-width\s*:\s*none/i);
  assert.match(
    mobileCss,
    /\.site-nav::?-webkit-scrollbar\s*\{[^}]*height\s*:\s*0\.25rem[^}]*\}/i,
    'WebKit should retain a restrained scrollbar track height'
  );
  assert.doesNotMatch(
    mobileCss,
    /\.site-nav::?-webkit-scrollbar\s*\{[^}]*display\s*:\s*none/i,
    'the WebKit scrollbar should not be hidden'
  );
});
