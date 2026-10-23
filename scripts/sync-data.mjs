// Copy the latest dataset snapshot into static/data so the site ships it.
// Usage: npm run sync-data [-- path/to/ae_dashboard_snapshot.json]
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(
	process.argv[2] ?? process.env.AE_SNAPSHOT ?? '../Benchmarks_22102026/dashboard_data/ae_dashboard_snapshot.json'
);
const dest = resolve(root, 'static/data/ae_dashboard_snapshot.json');

if (!existsSync(src)) {
	console.error(`snapshot not found: ${src}`);
	process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`copied ${src} -> ${dest}`);
