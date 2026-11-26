// Prediction runs from skein (skein.prediction.predict_aes), read as written: no parser.
// Files: static/skein/reports/predictions/<run>/<peptide>.json, listed in
// static/skein/predictions-index.json (served live in dev by vite.config.ts).
import { asset } from '$app/paths';

export interface KgIndexPeptide {
	peptide: string;
	file: string;
	model: string | null;
	created: string | null;
	predictions: number;
	kg_supported: number;
}
export interface KgIndexRun {
	id: string;
	created: string | null;
	peptides: KgIndexPeptide[];
}

export interface KgContextNode {
	node_id: string;
	type: string | null;
	name: string | null;
	gene?: string;
	degree?: number;
}
export interface KgContextEdge {
	edge_id: string;
	source: string;
	source_name: string;
	predicate: string | null;
	target: string;
	target_name: string;
	origin: string | null;
	negated?: boolean;
	rank?: number;
	species?: string;
	document?: string;
	doc_id?: string;
	pmid?: number | string;
	evidence?: string;
	// copied from the edge by predict_aes.describe_edge, when it has them
	action_type?: string;
	max_phase?: string;
	affinity?: string;
	warning_type?: string;
	percent?: string;
	reports?: string;
}
export interface KgRecord {
	ae: string;
	frequency_pct: number | null;
	severity: string | null;
	confidence: string | null;
	proteins: string[];
	perturbation_plausibility: string | null;
	relationship_types: string[];
	kg_paths: string[][];
	inferred_hops: string[];
	mechanism: string | null;
	unknown_edges: string[];
	kg_supported: boolean;
	context: { nodes: KgContextNode[]; edges: KgContextEdge[] };
}
export interface KgPredictionFile {
	peptide: string;
	model: string;
	prompt_version: string;
	created: string;
	kg: { built_at: string | null; nodes: number; edges: number };
	settings: Record<string, unknown>;
	usage: { input_tokens: number; output_tokens: number; requests: number };
	error: string;
	record_error: string;
	predictions: { ae: string; frequency_pct: number; severity: string }[];
	overall_severity: string | null;
	records: KgRecord[];
	tool_calls: { tool: string; args: Record<string, unknown>; error: string | null }[];
	explored?: {
		nodes_shown: number;
		edges_shown: number;
		nodes_from_tools: string[];
		edges_from_tools: string[];
		edges_cited: string[];
		nodes_cited: string[];
		edges_cited_from_tools: string[];
	};
	/** filled in by the page from <peptide>_reasoning.txt */
	reasoning?: string;
}

export const KG_RUN_PREFIX = 'kg:';
export const isKgRun = (run: string) => run.startsWith(KG_RUN_PREFIX);

type AssetPath = Parameters<typeof asset>[0];
const url = (p: string) => asset(p as AssetPath);

export async function loadKgIndex(): Promise<KgIndexRun[]> {
	try {
		const res = await fetch(url('skein/predictions-index.json'), { cache: 'no-store' });
		if (!res.ok) return [];
		const data = (await res.json()) as { runs?: KgIndexRun[] };
		return data.runs ?? [];
	} catch {
		return []; // no skein linked: the explorer just shows the snapshot runs
	}
}

export async function loadKgPrediction(run: string, file: string): Promise<KgPredictionFile> {
	const dir = `skein/reports/predictions/${encodeURIComponent(run)}`;
	const res = await fetch(url(`${dir}/${encodeURIComponent(file)}`), { cache: 'no-store' });
	if (!res.ok) throw new Error(`${run}/${file}: HTTP ${res.status}`);
	const data = (await res.json()) as KgPredictionFile;
	try {
		const r = await fetch(url(`${dir}/${encodeURIComponent(file.replace(/\.json$/, '_reasoning.txt'))}`), {
			cache: 'no-store'
		});
		if (r.ok) data.reasoning = await r.text();
	} catch {
		// reasoning is optional
	}
	return data;
}

export function kgRunLabel(run: KgIndexRun): string {
	const m = run.id.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
	return m ? `KG · ${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]} UTC` : `KG · ${run.id}`;
}

/** mild/moderate | severe | fatal -> the snapshot's severity keys, for the shared badges */
export function severityKey(sev: string | null): 'mild_moderate' | 'severe' | 'fatal' | 'unknown' {
	const s = (sev ?? '').toLowerCase();
	if (s.startsWith('mild')) return 'mild_moderate';
	if (s.startsWith('severe')) return 'severe';
	if (s.startsWith('fatal')) return 'fatal';
	return 'unknown';
}
