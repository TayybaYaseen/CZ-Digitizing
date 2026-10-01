// Locale consistency check for apps/web/i18n/messages (docs/i18n.md). The TypeScript `Messages`
// type already guarantees every locale has every key; this catches what types can't: a translation
// that drops or renames a `{placeholder}` or `<tag>` (which would silently lose the amount, email,
// link… at runtime), empty strings, and keys that don't exist in English.
//
// Run: pnpm --filter @czd/web i18n:check
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const DIR = path.join(__dirname, '..', 'i18n', 'messages');
const PLURAL = /_(zero|one|two|few|many|other)$/;

function load(code) {
  const source = fs.readFileSync(path.join(DIR, `${code}.ts`), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
  return mod.exports.default;
}

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else flatten(value, full, out);
  }
  return out;
}

const tokens = (s) => [...s.matchAll(/\{(\w+)\}|<(\w+)>/g)].map((m) => (m[1] ? `{${m[1]}}` : `<${m[2]}>`));

const codes = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'en.ts')
  .map((f) => f.replace(/\.ts$/, ''));
const en = flatten(load('en'));
let problems = 0;

for (const code of codes) {
  const messages = flatten(load(code));
  for (const [key, value] of Object.entries(messages)) {
    const base = key.replace(PLURAL, '');
    const enKey = en[key] !== undefined ? key : en[`${base}_other`] !== undefined ? `${base}_other` : undefined;
    if (!enKey) {
      console.log(`${code}: unknown key ${key}`);
      problems++;
      continue;
    }
    if (!value.trim()) {
      console.log(`${code}: empty value for ${key}`);
      problems++;
    }
    // A singular/dual plural form may spell the number out ("one design") instead of using {count}.
    const optionalCount = PLURAL.test(key) && !key.endsWith('_other');
    const expected = tokens(en[enKey]);
    const actual = tokens(value);
    const missing = expected.filter((t) => !actual.includes(t) && !(optionalCount && t === '{count}'));
    const extra = actual.filter((t) => !expected.includes(t));
    if (missing.length || extra.length) {
      console.log(`${code}: ${key} — missing [${missing.join(' ')}] extra [${extra.join(' ')}]`);
      problems++;
    }
  }
}

console.log(problems ? `\n${problems} problem(s) found.` : `All ${codes.length + 1} locales are consistent with en.ts.`);
process.exitCode = problems ? 1 : 0;
