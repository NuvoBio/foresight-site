// The skein knowledge graph, read straight from kg.sqlite (sql.js, in the browser).
// No export or parsing step: whatever construct_kg last wrote is what the page shows.
import { asset } from '$app/paths';
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export const KG_PATH = 'skein/kg/kg.sqlite';

export type Row = Record<string, string | number | null>;

export interface KgNode extends Row {
	node_id: string;
	type: string;
	name: string;
}

export interface KgEdge extends Row {
	source_node: string;
	target_node: string;
	predicate: string;
	origin: string;
}

export interface Kg {
	nodes: Map<string, KgNode>;
	edges: KgEdge[];
	meta: Record<string, string>;
	peptides: string[];
}

function rows(db: import('sql.js').Database, sql: string): Row[] {
	const res = db.exec(sql);
	if (!res.length) return [];
	const { columns, values } = res[0];
	return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i] as string | number | null])));
}

function hasTable(db: import('sql.js').Database, name: string) {
	return rows(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`).length > 0;
}

let cached: Promise<Kg> | null = null;

/** kg.sqlite, fetched once per page load (no browser cache, so a rerun shows on refresh). */
export function loadKg(): Promise<Kg> {
	cached ??= (async () => {
		const [SQL, res] = await Promise.all([
			initSqlJs({ locateFile: () => wasmUrl }),
			fetch(asset(KG_PATH as Parameters<typeof asset>[0]), { cache: 'no-store' })
		]);
		if (!res.ok) throw new Error(`${KG_PATH}: HTTP ${res.status}`);
		const db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
		try {
			const nodes = new Map<string, KgNode>();
			for (const r of rows(db, 'SELECT * FROM nodes')) nodes.set(String(r.node_id), r as KgNode);
			// older builds called the column provenance
			const edges = rows(db, 'SELECT * FROM edges').map((r) => ({
				...r,
				origin: String(r.origin ?? r.provenance ?? '')
			})) as KgEdge[];
			const meta = hasTable(db, 'meta')
				? Object.fromEntries(rows(db, 'SELECT key, value FROM meta').map((r) => [r.key, String(r.value)]))
				: {};
			const peptides = [...nodes.values()]
				.filter((n) => n.type === 'peptide')
				.map((n) => n.node_id)
				.sort();
			return { nodes, edges, meta, peptides };
		} finally {
			db.close();
		}
	})();
	cached.catch(() => (cached = null));
	return cached;
}

export interface SubgraphOptions {
	maxProteins: number;
	maxNeighbours: number;
	/** also show lower-ranked proteins that have literature relations */
	extras: boolean;
	/** edge origins to include (shortlist edges are always kept) */
	origins: Set<string>;
}

export interface Subgraph {
	nodes: KgNode[];
	edges: KgEdge[];
	/** protein id -> rank on the peptide's shortlist */
	rank: Map<string, number>;
	/** lower-ranked proteins shown for their literature */
	extra: Set<string>;
}

const PROTEIN_TYPES = new Set(['peptide', 'protein', 'gene']);

const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));

/** Same selection as skein/plots/generate_kg_plot.py: peptide -> top proteins -> neighbours, literature first. */
export function peptideSubgraph(kg: Kg, peptide: string, opt: SubgraphOptions): Subgraph {
	const pep = peptide.startsWith('peptide:') ? peptide : `peptide:${peptide}`;
	const keep = (e: KgEdge) => e.origin === 'shortlist' || opt.origins.has(e.origin);
	const incident = new Map<string, KgEdge[]>();
	for (const e of kg.edges) {
		if (!keep(e)) continue;
		for (const n of [e.source_node, e.target_node]) {
			if (!incident.has(n)) incident.set(n, []);
			incident.get(n)!.push(e);
		}
	}
	const other = (e: KgEdge, n: string) => (e.source_node === n ? e.target_node : e.source_node);
	const literature = (n: string) =>
		new Set((incident.get(n) ?? []).filter((e) => e.origin === 'literature').map((e) => other(e, n)));

	const rank = new Map<string, number>();
	for (const e of kg.edges) {
		if (e.source_node !== pep || e.predicate !== 'predicted_interaction') continue;
		const r = num(e.rank);
		const v = Number.isFinite(r) && r > 0 ? r : Infinity;
		if (!rank.has(e.target_node) || v < rank.get(e.target_node)!) rank.set(e.target_node, v);
	}
	const ordered = [...rank.keys()].sort((a, b) => rank.get(a)! - rank.get(b)! || a.localeCompare(b));
	const top = ordered.slice(0, opt.maxProteins);
	const extras = opt.extras
		? ordered.slice(opt.maxProteins).filter((p) => literature(p).size > 0).slice(0, opt.maxProteins)
		: [];
	const proteins = [...top, ...extras];

	const touches = new Map<string, Set<string>>();
	const lit = new Set<string>();
	for (const p of proteins) {
		for (const e of incident.get(p) ?? []) {
			const n = other(e, p);
			if (PROTEIN_TYPES.has(String(kg.nodes.get(n)?.type ?? ''))) continue;
			if (!touches.has(n)) touches.set(n, new Set());
			touches.get(n)!.add(p);
			if (e.origin === 'literature') lit.add(n);
		}
	}
	const spec = (n: string) => {
		const s = num(kg.nodes.get(n)?.specificity);
		return Number.isFinite(s) ? s : 1;
	};
	const neighbours = [...touches.keys()]
		.sort(
			(a, b) =>
				Number(!lit.has(a)) - Number(!lit.has(b)) ||
				touches.get(b)!.size - touches.get(a)!.size ||
				spec(b) - spec(a) ||
				a.localeCompare(b)
		)
		.slice(0, opt.maxNeighbours);

	const ids = new Set([pep, ...proteins, ...neighbours]);
	const nodes = [...ids].map((id) => kg.nodes.get(id) ?? ({ node_id: id, type: '', name: id } as KgNode));
	const edges = kg.edges.filter((e) => keep(e) && ids.has(e.source_node) && ids.has(e.target_node));
	return { nodes, edges, rank, extra: new Set(extras) };
}

/** Display name: gene symbol, then name, then the id without its prefix. */
export function nodeLabel(n: Row | undefined, id = ''): string {
	const text = String(n?.gene || n?.name || id.split(':').slice(1).join(':') || id);
	return text.length > 24 ? `${text.slice(0, 23)}…` : text;
}

/** Literature edges show their predicate ("NOT x" when negated), shortlist edges their rank. */
export function edgeText(e: KgEdge): string {
	if (e.origin === 'literature') {
		const p = String(e.predicate ?? '').replaceAll('_', ' ');
		return isNegated(e) ? `NOT ${p}` : p;
	}
	if (e.predicate === 'predicted_interaction' && e.rank) return `#${Math.round(Number(e.rank))}`;
	return '';
}

export const isNegated = (e: Row) => String(e.negated).toLowerCase() === 'true' || e.negated === 1;

export const TYPE_COLOURS: Record<string, string> = {
	peptide: '#8a8f98',
	protein: '#2a78d6',
	gene: '#2a78d6',
	pathway: '#3aa65b',
	biological_process: '#1fa5a5',
	disease: '#c8432f',
	adverse_event: '#e08a1e',
	phenotype: '#9b59b6',
	drug: '#7f6a4f'
};
export const OTHER_COLOUR = '#9aa0a6';
export const EXTRA_PROTEIN_COLOUR = '#9cc3ee';
export const LITERATURE_COLOUR = '#e08a1e';
