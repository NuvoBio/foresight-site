// Point the site at a skein checkout without copying anything.
// Creates static/skein/kg -> <SKEIN_DIR>/data/processed/kg and
//         static/skein/reports -> <SKEIN_DIR>/reports
// so `npm run dev` serves the pipeline's current outputs (refresh after a rerun) and
// `npm run build` ships them as they are. Only those two folders are linked, never the
// skein root (it holds .env and the source stores).
// SKEIN_DIR defaults to ../skein next to this site. Runs before dev and build.
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skein = resolve(root, process.env.SKEIN_DIR ?? '../skein');
const links = {
	kg: 'data/processed/kg',
	reports: 'reports'
};

const dest = resolve(root, 'static/skein');
mkdirSync(dest, { recursive: true });
for (const [name, rel] of Object.entries(links)) {
	const link = resolve(dest, name);
	const target = resolve(skein, rel);
	try {
		if (lstatSync(link)) rmSync(link, { recursive: true, force: true });
	} catch {
		// nothing there yet
	}
	if (!existsSync(target)) {
		console.warn(`[skein] ${target} not found; /kg will have no data (set SKEIN_DIR)`);
		continue;
	}
	symlinkSync(target, link, 'dir');
	console.log(`[skein] static/skein/${name} -> ${target}`);
}
