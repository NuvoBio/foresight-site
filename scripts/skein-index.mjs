// List skein prediction runs: reports/predictions/<run>/<peptide>.json written by
// skein.prediction.predict_aes. The site can't list folders over HTTP, so this builds
// predictions-index.json: link-skein.mjs writes it before dev/build, and the Vite
// plugin in vite.config.ts serves a fresh copy on every request during `npm run dev`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} reportsDir skein's reports/ folder */
export function buildPredictionIndex(reportsDir) {
	const root = join(reportsDir, 'predictions');
	/** @type {{id: string, created: string | null, peptides: any[]}[]} */
	const runs = [];
	if (!existsSync(root)) return { runs };
	for (const run of readdirSync(root)) {
		const dir = join(root, run);
		if (!statSync(dir).isDirectory()) continue;
		/** @type {any[]} */
		const peptides = [];
		for (const f of readdirSync(dir)) {
			if (!f.endsWith('.json')) continue;
			try {
				const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
				if (!d || !Array.isArray(d.records)) continue;
				peptides.push({
					peptide: d.peptide,
					file: f,
					model: d.model ?? null,
					created: d.created ?? null,
					predictions: (d.predictions ?? []).length,
					kg_supported: d.records.filter((/** @type {any} */ r) => r.kg_supported).length
				});
			} catch {
				// not a prediction file, or written half-way: skip it
			}
		}
		if (!peptides.length) continue;
		peptides.sort((a, b) => a.peptide.localeCompare(b.peptide));
		const created = peptides.map((p) => p.created).filter(Boolean).sort().at(-1) ?? null;
		runs.push({ id: run, created, peptides });
	}
	runs.sort((a, b) => String(a.created ?? a.id).localeCompare(String(b.created ?? b.id)));
	return { runs };
}
