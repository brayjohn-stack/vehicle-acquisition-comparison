import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Inlines the built CSS and JS into one self-contained index.html.
 *
 * Two hazards, both of which have bitten this script before:
 *  1. String replacements must use function replacers. A plain string
 *     replacement interprets $&, $1 and friends, and the React bundle contains
 *     literal "$&" inside .replace() calls, which corrupts the output.
 *  2. Any "</script" inside the JS would close the tag early, so it is escaped.
 */
const dist = 'dist';
const out = 'dist-single';

const assets = readdirSync(join(dist, 'assets'));
const cssFile = assets.find((f) => f.endsWith('.css'));
const jsFile = assets.find((f) => f.endsWith('.js'));
if (!cssFile || !jsFile) throw new Error('Run `npm run build` first — dist/assets is missing CSS or JS.');

const css = readFileSync(join(dist, 'assets', cssFile), 'utf8');
// Escaping "</script" and "<!--" keeps the HTML parser inside script-data state.
// A bare "<script" in the bundle is harmless and is left alone (React contains one).
const js = readFileSync(join(dist, 'assets', jsFile), 'utf8')
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--');

let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/i, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/i, () => `<script type="module">\n${js}\n</script>`);

// Verify before writing: exactly one script element, one style element, and no
// leftover external references.
const count = (needle) => html.split(needle).length - 1;
const problems = [];
const opens = count('<script type="module">');
if (opens !== 1) problems.push(`expected 1 inline <script type="module">, found ${opens}`);
if (count('</script>') !== 1) problems.push(`expected 1 </script>, found ${count('</script>')}`);
if (count('src="./assets')) problems.push('an external script reference survived inlining');
if (count('<style>') !== 1) problems.push(`expected 1 <style>, found ${count('<style>')}`);
if (html.includes('./assets/')) problems.push('an external ./assets/ reference survived inlining');
if (!html.includes('<div id="root">')) problems.push('the root element is missing');

// The failure mode this guards against: a prematurely closed <script> spills the
// remaining bundle into the document as visible text.
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const strayText = body.replace(/<[^>]*>/g, '').trim();
if (strayText.length > 0) {
  problems.push(`${strayText.length} characters of stray text leaked into <body>: ${JSON.stringify(strayText.slice(0, 80))}`);
}
if (problems.length) throw new Error(`Single-file build failed:\n  - ${problems.join('\n  - ')}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
console.log(`Wrote ${out}/index.html — ${(html.length / 1024).toFixed(0)} KB, verified.`);
