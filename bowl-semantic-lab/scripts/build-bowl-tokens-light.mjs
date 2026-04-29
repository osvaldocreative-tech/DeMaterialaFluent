#!/usr/bin/env node
/**
 * Genera bowl-semantic-lab/data/bowl-tokens-light.json desde Light.tokens.json.
 * Por defecto lee: ~/Downloads/Semántica 2/Light.tokens.json
 * Uso: node scripts/build-bowl-tokens-light.mjs [ruta/al/Light.tokens.json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const defaultSrc = path.join(
  process.env.HOME || '',
  'Downloads',
  'Semántica 2',
  'Light.tokens.json'
);
const src = process.argv[2] || defaultSrc;
const dest = path.join(root, 'data', 'bowl-tokens-light.json');

function hexFromValue(val) {
  if (!val) return null;
  if (typeof val === 'object' && val.hex) return val.hex;
  if (typeof val === 'object' && Array.isArray(val.components)) {
    const c = val.components.map((x) => Math.round(x * 255));
    return '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  return null;
}

function refToPath(refStr) {
  const inner = refStr.replace(/^\{|\}$/g, '').replace(/^✅/, '');
  return inner.split('.').join(' / ');
}

function aliasNameFromExtensions(obj) {
  const ext = obj && obj['$extensions'];
  const ad = ext && ext['com.figma.aliasData'];
  return (ad && typeof ad.targetVariableName === 'string' && ad.targetVariableName.trim()) || null;
}

function walk(obj, pathParts, items, byPath) {
  if (!obj || typeof obj !== 'object') return;
  if (obj['$type'] === 'color') {
    const alias = aliasNameFromExtensions(obj);
    const v = obj['$value'];
    if (typeof v === 'string' && v.startsWith('{')) {
      const targetPath = refToPath(v);
      items.push({ path: pathParts.join(' / '), hex: null, refPath: targetPath, alias });
    } else {
      const hex = hexFromValue(v);
      const p = pathParts.join(' / ');
      items.push({ path: p, hex, alias });
      if (hex) byPath.set(p, hex);
    }
    return;
  }
  for (const k of Object.keys(obj)) {
    if (k === '$extensions') continue;
    const clean = k.replace(/^✅/, '');
    walk(obj[k], [...pathParts, clean], items, byPath);
  }
}

const j = JSON.parse(fs.readFileSync(src, 'utf8'));
const hasFigmaGroupKey = Object.keys(j).some(
  (k) => k.includes('✅') || k.includes('❌')
);
if (
  Array.isArray(j.items) &&
  typeof j.count === 'number' &&
  typeof j.source === 'string' &&
  !hasFigmaGroupKey
) {
  console.error(
    'Este archivo parece bowl-tokens-light.json (salida). Usa Light.tokens.json exportado desde Figma, no el JSON generado.'
  );
  process.exit(1);
}
const items = [];
const byPath = new Map();

for (const key of Object.keys(j)) {
  if (key === '$extensions') continue;
  if (key.includes('❌')) continue;
  const rootName = key.replace(/^✅/, '');
  walk(j[key], [rootName], items, byPath);
}

for (const it of items) {
  if (!it.hex && it.refPath) {
    it.hex = byPath.get(it.refPath) || null;
    if (it.hex) it.resolvedFrom = it.refPath;
  }
}

const out = {
  source: path.basename(src),
  includedGroups: Object.keys(j).filter((k) => k !== '$extensions' && !k.includes('❌')),
  count: items.length,
  items: items.map(({ path: p, hex, refPath, resolvedFrom, alias }) => {
    const o = { path: p, hex };
    if (alias) o.alias = alias;
    if (refPath) o.refPath = refPath;
    if (resolvedFrom) o.resolvedFrom = resolvedFrom;
    return o;
  }),
};

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
console.log('OK', dest, out.count, 'tokens');

const indexPath = path.join(root, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const embedRe = /<script id="bowl-tokens-light-embed" type="application\/json">[\s\S]*?<\/script>/;
const embedTag = `<script id="bowl-tokens-light-embed" type="application/json">${JSON.stringify(out)}</script>`;
if (embedRe.test(html)) {
  fs.writeFileSync(indexPath, html.replace(embedRe, embedTag), 'utf8');
  console.log('OK index.html · bloque embebido actualizado');
} else {
  console.warn('Aviso: no hay <script id="bowl-tokens-light-embed"> en index.html; añádelo junto al footer.');
}
