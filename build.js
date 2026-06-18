#!/usr/bin/env node
// build.js — package a clean release ZIP for the Chrome Web Store.
//
// No dependencies, no npm: uses Node built-ins only (fs, path, zlib).
// The version is read from manifest.json — the single source of truth.
//
//   node build.js   ->   dist/bookmarklets-extension-{version}.zip
//
// Only runtime files are included. Dev/docs/tooling files are left out.

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// Everything the extension needs at runtime. Directories are added recursively.
// Anything not listed here (docs/, CLAUDE.md, README.md, sidebar.css, build.js,
// package.json, test-data/, theme-test/, .github/, dist/, .gitignore, …) is excluded.
const INCLUDE = [
  'manifest.json',
  'background.js',
  'content.js',
  'themes.js',
  'popup.html',
  'popup.js',
  'options.html',
  'options.js',
  'welcome.html',
  'welcome.js',
  'icons',
];

/* ── Collect files ──────────────────────────────────────────────────── */

// Returns [{ name, abs }] where `name` is the POSIX path inside the ZIP.
function collect(entry) {
  const abs = path.join(ROOT, entry);
  if (!fs.existsSync(abs)) {
    throw new Error(`Required file/folder is missing: ${entry}`);
  }
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    return fs.readdirSync(abs)
      .sort()
      .flatMap(child => collect(path.posix.join(entry, child)));
  }
  return [{ name: entry.split(path.sep).join('/'), abs }];
}

/* ── Minimal ZIP writer (deflate) ───────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Convert a JS Date to DOS time/date words (used in ZIP headers).
function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

function buildZip(files) {
  const { time, date } = dosTime(new Date());
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const data = fs.readFileSync(file.abs);
    const nameBuf = Buffer.from(file.name, 'utf8');
    const crc = crc32(data);
    const compressed = zlib.deflateRawSync(data);

    // Local file header
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);  // signature
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // flags: UTF-8 names
    local.writeUInt16LE(8, 8);           // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // extra length
    chunks.push(local, nameBuf, compressed);

    // Central directory record
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);             // version made by
    cd.writeUInt16LE(20, 6);             // version needed
    cd.writeUInt16LE(0x0800, 8);         // flags
    cd.writeUInt16LE(8, 10);             // method
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);             // extra length
    cd.writeUInt16LE(0, 32);             // comment length
    cd.writeUInt16LE(0, 34);             // disk number start
    cd.writeUInt16LE(0, 36);             // internal attrs
    cd.writeUInt32LE(0o644 << 16, 38);   // external attrs (file mode)
    cd.writeUInt32LE(offset, 42);        // local header offset
    central.push(Buffer.concat([cd, nameBuf]));

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);    // entries on this disk
  end.writeUInt16LE(files.length, 10);   // total entries
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);         // central dir offset
  end.writeUInt16LE(0, 20);              // comment length

  return Buffer.concat([...chunks, centralBuf, end]);
}

/* ── Run ────────────────────────────────────────────────────────────── */

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const version = manifest.version;
  if (!version) throw new Error('manifest.json has no "version"');

  const files = INCLUDE.flatMap(collect);
  const zip = buildZip(files);

  fs.mkdirSync(DIST, { recursive: true });
  const outName = `bookmarklets-extension-${version}.zip`;
  const outPath = path.join(DIST, outName);
  fs.writeFileSync(outPath, zip);

  console.log(`\n  ✓ Built dist/${outName}`);
  console.log(`    ${files.length} files, ${(zip.length / 1024).toFixed(1)} KB\n`);
  for (const f of files) console.log(`      ${f.name}`);
  console.log('');
}

try {
  main();
} catch (err) {
  console.error(`\n  ✗ Build failed: ${err.message}\n`);
  process.exit(1);
}
