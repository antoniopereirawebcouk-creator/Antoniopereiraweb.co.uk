import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseHtml,
  parseXml,
  validateInternalReferences,
  validateSite,
} from '../scripts/validate-site.mjs';

test('the validator parses every shipped HTML page, sitemap XML, and internal reference', () => {
  const result = validateSite(process.cwd());

  assert.deepEqual(result.htmlFiles, ['index.html', 'privacy.html', 'terms.html']);
  assert.deepEqual(result.xmlFiles, ['sitemap.xml']);
  assert.ok(result.referencesChecked >= 20, 'the validator should resolve the full internal reference set');
});

test('the HTML parser rejects duplicate ids, duplicate attributes, and misnested elements', () => {
  assert.throws(
    () => parseHtml('<!doctype html><html lang="en"><body><p id="same">One</p><p id="same">Two</p></body></html>', 'duplicate-id.html'),
    /duplicate id "same"/i
  );
  assert.throws(
    () => parseHtml('<!doctype html><html lang="en"><body><a href="/" href="#main">Home</a></body></html>', 'duplicate-attribute.html'),
    /duplicate attribute "href"/i
  );
  assert.throws(
    () => parseHtml('<!doctype html><html lang="en"><body><section><p>Broken</section></p></body></html>', 'misnested.html'),
    /expected <\/p> before <\/section>/i
  );
});

test('the XML parser rejects malformed sitemap markup', () => {
  assert.throws(
    () => parseXml('<?xml version="1.0"?><urlset><url><loc>https://example.com/</url></loc></urlset>', 'sitemap.xml'),
    /expected <\/loc> before <\/url>/i
  );
  assert.throws(
    () => parseXml('<?xml version="1.0"?><urlset><url></urlset><extra/>', 'sitemap.xml'),
    /expected <\/url> before <\/urlset>|multiple root elements/i
  );
});

test('internal-reference validation rejects missing files and fragments', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'apw-validator-'));

  try {
    fs.writeFileSync(
      path.join(fixtureRoot, 'index.html'),
      '<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main id="main"><a href="missing.html">Missing</a><a href="#absent">Absent</a></main></body></html>'
    );
    const parsed = new Map([
      ['index.html', parseHtml(fs.readFileSync(path.join(fixtureRoot, 'index.html'), 'utf8'), 'index.html')],
    ]);

    assert.throws(
      () => validateInternalReferences(fixtureRoot, parsed),
      /missing\.html.*does not exist|#absent.*does not exist/i
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
