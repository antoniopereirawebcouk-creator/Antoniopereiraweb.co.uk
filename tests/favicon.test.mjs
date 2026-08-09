import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseXml } from '../scripts/validate-site.mjs';

const ROOT = process.cwd();
const REQUIRED_HTML_FILES = ['index.html', 'privacy.html', 'terms.html'];
const REQUIRED_ASSETS = [
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'site.webmanifest',
];
const REQUIRED_LINKS = [
  { rel: 'icon', href: 'favicon.svg', type: 'image/svg+xml' },
  { rel: 'icon', href: 'favicon.ico', type: 'image/x-icon' },
  { rel: 'apple-touch-icon', href: 'apple-touch-icon.png' },
  { rel: 'manifest', href: 'site.webmanifest' },
];
const PNG_DIMENSIONS = new Map([
  ['apple-touch-icon.png', 180],
  ['android-chrome-192x192.png', 192],
  ['android-chrome-512x512.png', 512],
]);
const PYTHON_BIN = fs.existsSync('/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3')
  ? '/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3'
  : 'python3';
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate-favicons.py');

function readTextFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readBinaryFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function copyGeneratorToTempRoot() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'apw-favicon-gen-'));
  const scriptsDir = path.join(tempRoot, 'scripts');

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.copyFileSync(GENERATOR_PATH, path.join(scriptsDir, 'generate-favicons.py'));

  return tempRoot;
}

function runGenerator(tempRoot) {
  const generatorCopy = path.join(tempRoot, 'scripts', 'generate-favicons.py');
  const importGuard = [
    'import builtins, runpy, sys',
    'blocked = {"PIL", "subprocess"}',
    'real_import = builtins.__import__',
    'def guarded(name, globals=None, locals=None, fromlist=(), level=0):',
    '    if name.split(".")[0] in blocked:',
    '        raise ImportError(f"blocked import: {name.split(\'.\')[0]}")',
    '    return real_import(name, globals, locals, fromlist, level)',
    'builtins.__import__ = guarded',
    'script_path = sys.argv[1]',
    'sys.argv = [script_path]',
    'runpy.run_path(script_path, run_name="__main__")',
  ].join('\n');

  childProcess.execFileSync(PYTHON_BIN, ['-I', '-c', importGuard, generatorCopy], {
    cwd: tempRoot,
    env: { ...process.env, PATH: '' },
    stdio: 'pipe',
  });
}

function generatedHashes(tempRoot) {
  return Object.fromEntries(
    REQUIRED_ASSETS.map((asset) => [asset, sha256(fs.readFileSync(path.join(tempRoot, asset)))])
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readPngMetadata(relativePath) {
  const buffer = readBinaryFile(relativePath);

  assert.ok(buffer.length >= 24, `${relativePath} should be long enough to contain a PNG header`);
  assert.equal(
    buffer.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    `${relativePath} should start with the PNG signature`
  );

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readIcoEntries(relativePath) {
  const buffer = readBinaryFile(relativePath);

  assert.ok(buffer.length >= 6, `${relativePath} should contain an ICO header`);
  assert.equal(buffer.readUInt16LE(0), 0, `${relativePath} should reserve the first two bytes`);
  assert.equal(buffer.readUInt16LE(2), 1, `${relativePath} should declare icon type 1`);

  const count = buffer.readUInt16LE(4);
  assert.ok(count >= 3, `${relativePath} should contain common small favicon sizes`);
  assert.ok(buffer.length >= 6 + count * 16, `${relativePath} should contain a complete directory table`);

  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = buffer[offset] || 256;
    const height = buffer[offset + 1] || 256;
    const size = buffer.readUInt32LE(offset + 8);
    const imageOffset = buffer.readUInt32LE(offset + 12);

    assert.ok(size > 0, `${relativePath} entry ${index + 1} should include image data`);
    assert.ok(imageOffset >= 6 + count * 16, `${relativePath} entry ${index + 1} should point past the directory table`);
    assert.ok(
      imageOffset + size <= buffer.length,
      `${relativePath} entry ${index + 1} should stay within the file bounds`
    );

    entries.push({ width, height, size, imageOffset });
  }

  return entries;
}

function assertLinkTag(html, { rel, href, type }) {
  const lookaheads = [
    `(?=[^>]*rel=["']${escapeRegExp(rel)}["'])`,
    `(?=[^>]*href=["']${escapeRegExp(href)}["'])`,
  ];
  if (type) lookaheads.push(`(?=[^>]*type=["']${escapeRegExp(type)}["'])`);

  assert.match(
    html,
    new RegExp(`<link\\b${lookaheads.join('')}[^>]*>`, 'i'),
    `expected <link rel="${rel}" href="${href}"> metadata`
  );
}

test('favicon assets exist and every shipped HTML page links to them', () => {
  for (const asset of REQUIRED_ASSETS) {
    const assetPath = path.join(ROOT, asset);
    assert.ok(fs.existsSync(assetPath), `${asset} should exist`);
    assert.ok(fs.statSync(assetPath).isFile(), `${asset} should be a file`);
  }

  for (const htmlFile of REQUIRED_HTML_FILES) {
    const html = readTextFile(htmlFile);

    for (const link of REQUIRED_LINKS) {
      assertLinkTag(html, link);
    }

    assert.match(
      html,
      /<meta\b(?=[^>]*name=["']theme-color["'])(?=[^>]*content=["']#0d1726["'])[^>]*>/i,
      `${htmlFile} should declare the site theme colour`
    );
  }
});

test('favicon.svg is valid standalone SVG markup with no external asset dependency', () => {
  const svg = readTextFile('favicon.svg');
  const parsed = parseXml(svg, 'favicon.svg');

  assert.equal(parsed.rootName, 'svg', 'favicon.svg should use an <svg> root');
  assert.match(svg, /<svg\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["'][^>]*>/i);
  assert.match(svg, /<svg\b[^>]*viewBox=["']0 0 64 64["'][^>]*>/i);
  assert.doesNotMatch(svg, /<image\b/i, 'favicon.svg should be self-contained vector markup');
  assert.doesNotMatch(
    svg,
    /\b(?:href|src)=["']https?:\/\//i,
    'favicon.svg should not reference remote assets'
  );
});

test('site.webmanifest defines the installed-icon contract and theme colours', () => {
  const manifest = JSON.parse(readTextFile('site.webmanifest'));

  assert.equal(manifest.theme_color, '#0d1726');
  assert.equal(manifest.background_color, '#ffffff');
  assert.ok(Array.isArray(manifest.icons), 'manifest should expose icons');

  const requiredIcons = [
    {
      src: 'android-chrome-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'android-chrome-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
  ];

  for (const requiredIcon of requiredIcons) {
    assert.ok(
      manifest.icons.some(
        (icon) =>
          icon.src === requiredIcon.src &&
          icon.sizes === requiredIcon.sizes &&
          icon.type === requiredIcon.type
      ),
      `manifest should include ${requiredIcon.src}`
    );
  }
});

test('PNG favicon variants use valid PNG signatures and exact required dimensions', () => {
  for (const [relativePath, dimension] of PNG_DIMENSIONS) {
    const metadata = readPngMetadata(relativePath);

    assert.equal(metadata.width, dimension, `${relativePath} should be ${dimension}px wide`);
    assert.equal(metadata.height, dimension, `${relativePath} should be ${dimension}px tall`);
  }
});

test('favicon.ico is a valid icon bundle with common small square entries', () => {
  const entries = readIcoEntries('favicon.ico');
  const dimensions = new Set(entries.map((entry) => `${entry.width}x${entry.height}`));

  for (const dimension of ['16x16', '32x32', '48x48']) {
    assert.ok(dimensions.has(dimension), `favicon.ico should include a ${dimension} entry`);
  }
});

test('favicon generator runs without blocked imports or PATH-dependent binaries', () => {
  const tempRoot = copyGeneratorToTempRoot();

  try {
    assert.doesNotThrow(() => runGenerator(tempRoot));

    for (const asset of REQUIRED_ASSETS) {
      assert.ok(fs.existsSync(path.join(tempRoot, asset)), `generator should create ${asset}`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('favicon generator deterministically reproduces the checked-in asset hashes', () => {
  const firstRoot = copyGeneratorToTempRoot();
  const secondRoot = copyGeneratorToTempRoot();

  try {
    runGenerator(firstRoot);
    runGenerator(secondRoot);

    const expectedHashes = Object.fromEntries(
      REQUIRED_ASSETS.map((asset) => [asset, sha256(readBinaryFile(asset))])
    );
    const firstHashes = generatedHashes(firstRoot);
    const secondHashes = generatedHashes(secondRoot);

    assert.deepEqual(firstHashes, expectedHashes);
    assert.deepEqual(secondHashes, expectedHashes);
  } finally {
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  }
});
