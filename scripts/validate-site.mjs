import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HTML_VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const SITE_ORIGIN = 'https://antoniopereiraweb.co.uk';

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function fail(file, source, index, message) {
  throw new Error(`${file}:${lineNumber(source, index)}: ${message}`);
}

function findTagEnd(source, start, file) {
  let quote = null;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === '>') return index;
  }

  fail(file, source, start, 'unterminated start tag');
}

function parseAttributes(source, raw, rawStart, file, xml) {
  const attributes = new Map();
  let offset = 0;

  while (offset < raw.length) {
    while (/\s/.test(raw[offset] ?? '')) offset += 1;
    if (offset >= raw.length) break;

    const nameMatch = raw.slice(offset).match(/^[^\s"'<>\/=]+/);
    if (!nameMatch) fail(file, source, rawStart + offset, 'invalid attribute syntax');

    const originalName = nameMatch[0];
    const name = xml ? originalName : originalName.toLowerCase();
    if (attributes.has(name)) {
      fail(file, source, rawStart + offset, `duplicate attribute "${originalName}"`);
    }

    offset += originalName.length;
    while (/\s/.test(raw[offset] ?? '')) offset += 1;

    if (raw[offset] !== '=') {
      if (xml) fail(file, source, rawStart + offset, `attribute "${originalName}" requires a value`);
      attributes.set(name, '');
      continue;
    }

    offset += 1;
    while (/\s/.test(raw[offset] ?? '')) offset += 1;

    const quote = raw[offset];
    if (quote !== '"' && quote !== "'") {
      fail(file, source, rawStart + offset, `attribute "${originalName}" must use a quoted value`);
    }

    const valueStart = offset + 1;
    const valueEnd = raw.indexOf(quote, valueStart);
    if (valueEnd < 0) fail(file, source, rawStart + offset, `unterminated value for attribute "${originalName}"`);

    attributes.set(name, raw.slice(valueStart, valueEnd));
    offset = valueEnd + 1;
  }

  return attributes;
}

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseMarkup(source, file, { xml }) {
  const ids = new Set();
  const references = [];
  const stack = [];
  const tagCounts = new Map();
  let index = 0;
  let rootCount = 0;
  let rootName = null;
  let sawDoctype = false;

  while (index < source.length) {
    const tagStart = source.indexOf('<', index);

    if (tagStart < 0) {
      if (xml && stack.at(-1)?.name === 'loc') stack.at(-1).text += source.slice(index);
      index = source.length;
      break;
    }

    if (xml && stack.at(-1)?.name === 'loc') stack.at(-1).text += source.slice(index, tagStart);

    if (source.startsWith('<!--', tagStart)) {
      const commentEnd = source.indexOf('-->', tagStart + 4);
      if (commentEnd < 0) fail(file, source, tagStart, 'unterminated comment');
      index = commentEnd + 3;
      continue;
    }

    if (source.startsWith('<![CDATA[', tagStart)) {
      if (!xml) fail(file, source, tagStart, 'CDATA is not allowed in HTML documents');
      const cdataEnd = source.indexOf(']]>', tagStart + 9);
      if (cdataEnd < 0) fail(file, source, tagStart, 'unterminated CDATA section');
      if (stack.at(-1)?.name === 'loc') stack.at(-1).text += source.slice(tagStart + 9, cdataEnd);
      index = cdataEnd + 3;
      continue;
    }

    if (source.startsWith('<?', tagStart)) {
      if (!xml) fail(file, source, tagStart, 'processing instructions are not allowed in HTML documents');
      const instructionEnd = source.indexOf('?>', tagStart + 2);
      if (instructionEnd < 0) fail(file, source, tagStart, 'unterminated processing instruction');
      index = instructionEnd + 2;
      continue;
    }

    if (/^<!doctype\s+html\s*>/i.test(source.slice(tagStart))) {
      if (xml) fail(file, source, tagStart, 'HTML doctype is not valid for this XML document');
      if (sawDoctype) fail(file, source, tagStart, 'duplicate doctype');
      if (rootCount > 0 || stack.length > 0) fail(file, source, tagStart, 'doctype must precede the root element');
      const doctypeEnd = source.indexOf('>', tagStart + 2);
      sawDoctype = true;
      index = doctypeEnd + 1;
      continue;
    }

    if (source.startsWith('<!', tagStart)) {
      fail(file, source, tagStart, 'unsupported markup declaration');
    }

    if (source.startsWith('</', tagStart)) {
      const closingEnd = source.indexOf('>', tagStart + 2);
      if (closingEnd < 0) fail(file, source, tagStart, 'unterminated closing tag');
      const closingRaw = source.slice(tagStart + 2, closingEnd).trim();
      if (!/^[A-Za-z][A-Za-z0-9:-]*$/.test(closingRaw)) {
        fail(file, source, tagStart, 'invalid closing tag syntax');
      }

      const name = xml ? closingRaw : closingRaw.toLowerCase();
      const expected = stack.at(-1);
      if (!expected) fail(file, source, tagStart, `unexpected closing tag </${closingRaw}>`);
      if (expected.name !== name) {
        fail(file, source, tagStart, `expected </${expected.name}> before </${closingRaw}>`);
      }

      const closed = stack.pop();
      if (xml && closed.name === 'loc') {
        const value = decodeXmlText(closed.text.trim());
        if (!value) fail(file, source, tagStart, '<loc> must not be empty');
        references.push({ attribute: 'loc', value, line: closed.line });
      }
      index = closingEnd + 1;
      continue;
    }

    const tagEnd = findTagEnd(source, tagStart + 1, file);
    let startRaw = source.slice(tagStart + 1, tagEnd);
    const selfClosing = /\/\s*$/.test(startRaw);
    if (selfClosing) startRaw = startRaw.replace(/\/\s*$/, '');

    const nameMatch = startRaw.match(/^\s*([A-Za-z][A-Za-z0-9:-]*)/);
    if (!nameMatch) fail(file, source, tagStart, 'invalid start tag syntax');

    const originalName = nameMatch[1];
    const name = xml ? originalName : originalName.toLowerCase();
    const attributesStart = nameMatch.index + nameMatch[0].length;
    const attributesRaw = startRaw.slice(attributesStart);
    const attributes = parseAttributes(
      source,
      attributesRaw,
      tagStart + 1 + attributesStart,
      file,
      xml
    );

    if (stack.length === 0) {
      rootCount += 1;
      rootName ??= name;
      if (rootCount > 1) fail(file, source, tagStart, 'document has multiple root elements');
    }

    tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);

    if (!xml) {
      const id = attributes.get('id');
      if (id !== undefined) {
        if (!id) fail(file, source, tagStart, 'id attributes must not be empty');
        if (ids.has(id)) fail(file, source, tagStart, `duplicate id "${id}"`);
        ids.add(id);
      }

      for (const attribute of ['href', 'src']) {
        const value = attributes.get(attribute);
        if (value !== undefined) references.push({ attribute, value, line: lineNumber(source, tagStart) });
      }

      for (const attribute of ['aria-controls', 'aria-labelledby', 'for']) {
        const value = attributes.get(attribute);
        if (value === undefined) continue;
        for (const targetId of value.trim().split(/\s+/).filter(Boolean)) {
          references.push({ attribute, value: `#${targetId}`, line: lineNumber(source, tagStart) });
        }
      }
    }

    const isVoid = !xml && HTML_VOID_ELEMENTS.has(name);
    if (!xml && selfClosing && !isVoid) {
      fail(file, source, tagStart, `non-void HTML element <${name}> must use an explicit closing tag`);
    }
    if (xml && !selfClosing || !xml && !isVoid) {
      stack.push({ name, line: lineNumber(source, tagStart), text: '' });
    }

    index = tagEnd + 1;
  }

  if (stack.length > 0) {
    const unclosed = stack.at(-1);
    throw new Error(`${file}:${unclosed.line}: unclosed <${unclosed.name}> element`);
  }
  if (rootCount !== 1) throw new Error(`${file}: document must contain exactly one root element`);

  if (!xml) {
    if (!sawDoctype) throw new Error(`${file}: missing <!doctype html>`);
    if (rootName !== 'html') throw new Error(`${file}: root element must be <html>`);
    for (const element of ['html', 'head', 'body']) {
      if (tagCounts.get(element) !== 1) throw new Error(`${file}: expected exactly one <${element}> element`);
    }
  }

  return { ids, references, rootName, tagCounts };
}

export function parseHtml(source, file = '<html>') {
  return parseMarkup(source, file, { xml: false });
}

export function parseXml(source, file = '<xml>') {
  return parseMarkup(source, file, { xml: true });
}

function localTarget(sourceFile, value) {
  if (!value || /^(?:mailto|tel|data):/i.test(value)) return null;
  if (/^javascript:/i.test(value)) throw new Error(`${sourceFile}: javascript: references are not allowed`);

  let pathname;
  let hash;

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.origin !== SITE_ORIGIN) return null;
    pathname = url.pathname;
    hash = url.hash;
  } else {
    const hashIndex = value.indexOf('#');
    const queryIndex = value.indexOf('?');
    const endIndex = [hashIndex, queryIndex].filter((entry) => entry >= 0).sort((a, b) => a - b)[0] ?? value.length;
    pathname = value.slice(0, endIndex);
    hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  }

  const decodedPath = decodeURIComponent(pathname);
  const sourceDirectory = path.posix.dirname(sourceFile);
  let normalized = decodedPath.startsWith('/')
    ? path.posix.normalize(decodedPath.slice(1))
    : path.posix.normalize(path.posix.join(sourceDirectory, decodedPath));

  if (!decodedPath || decodedPath.endsWith('/')) normalized = path.posix.join(normalized, 'index.html');
  if (normalized === '.') normalized = 'index.html';
  if (normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`${sourceFile}: reference "${value}" escapes the site root`);
  }

  return { file: normalized, hash: decodeURIComponent(hash.replace(/^#/, '')) };
}

export function validateInternalReferences(root, parsedDocuments) {
  const errors = [];
  let referencesChecked = 0;

  for (const [sourceFile, parsed] of parsedDocuments) {
    for (const reference of parsed.references) {
      let target;
      try {
        target = localTarget(sourceFile, reference.value);
      } catch (error) {
        errors.push(`${sourceFile}:${reference.line}: ${error.message.replace(`${sourceFile}: `, '')}`);
        continue;
      }
      if (!target) continue;

      referencesChecked += 1;
      const targetPath = path.join(root, ...target.file.split('/'));
      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
        errors.push(`${sourceFile}:${reference.line}: ${reference.attribute} target "${target.file}" does not exist`);
        continue;
      }

      if (!target.hash) continue;
      const targetDocument = parsedDocuments.get(target.file);
      if (!targetDocument) {
        errors.push(`${sourceFile}:${reference.line}: cannot validate #${target.hash} in non-HTML target "${target.file}"`);
        continue;
      }
      if (!targetDocument.ids.has(target.hash)) {
        errors.push(`${sourceFile}:${reference.line}: fragment #${target.hash} does not exist in "${target.file}"`);
      }
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
  return referencesChecked;
}

export function validateSite(root = process.cwd()) {
  const htmlFiles = fs.readdirSync(root).filter((file) => file.endsWith('.html')).sort();
  const xmlFiles = fs.readdirSync(root).filter((file) => file.endsWith('.xml')).sort();
  if (htmlFiles.length === 0) throw new Error('no HTML files found');
  if (xmlFiles.length === 0) throw new Error('no XML files found');

  const parsedDocuments = new Map();

  for (const file of htmlFiles) {
    parsedDocuments.set(file, parseHtml(fs.readFileSync(path.join(root, file), 'utf8'), file));
  }
  for (const file of xmlFiles) {
    parsedDocuments.set(file, parseXml(fs.readFileSync(path.join(root, file), 'utf8'), file));
  }

  const referencesChecked = validateInternalReferences(root, parsedDocuments);
  return { htmlFiles, xmlFiles, referencesChecked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = validateSite(process.cwd());
    console.log(
      `Validated ${result.htmlFiles.length} HTML files, ${result.xmlFiles.length} XML file, and ${result.referencesChecked} internal references.`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
