// CI builds first, then skips hosting publication when the live catalog is unchanged.
import { readFile, appendFile } from 'node:fs/promises';
const candidate = JSON.parse(await readFile('store/dist/catalog-version.json', 'utf8'));
let current;
try {
  const response = await fetch(`${process.env.VITE_STOREFRONT_URL}/catalog-version.json`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (response.ok) current = await response.json();
} catch { /* A first release or unavailable version should be republished. */ }
const changed = candidate.fingerprint !== current?.fingerprint;
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
console.log(changed ? 'Catalog metadata changed; publish storefront.' : 'Catalog metadata unchanged; skip deployment.');
