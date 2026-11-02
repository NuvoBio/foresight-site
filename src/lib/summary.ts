import type { AeCardData, Entry, ProteinInfo, Snapshot } from './types';
import { CONFIDENCE_SCORE, buildCards, precisionOf } from './evidence';

/** entry.proteins, or (for snapshots built before schema 2) a list rebuilt from the reasoning. */
export function proteinsOf(entry: Entry): ProteinInfo[] {
	if (entry.proteins?.length) return entry.proteins;
	const out = new Map<string, ProteinInfo>();
	const cards = buildCards(entry);
	const add = (gene: string) => {
		if (!out.has(gene))
			out.set(gene, {
				gene,
				accession: null,
				name: null,
				subcellular_location: null,
				location_class: 'unknown',
				location_source: null,
				is_target: false,
				rank: null,
				score: null,
				plausibility: null,
				plausibility_class: null,
				prediction_ids: []
			});
		return out.get(gene)!;
	};
	for (const s of entry.protein_sections) {
		const p = add(s.protein);
		p.plausibility ??= s.plausibility ?? null;
		p.plausibility_class ??= s.plausibility_class ?? null;
	}
	for (const c of cards)
		for (const g of new Set(c.evidence.flatMap((r) => r.proteins))) {
			const p = add(g);
			if (!p.prediction_ids.includes(c.prediction.id)) p.prediction_ids.push(c.prediction.id);
		}
	return [...out.values()];
}

/** The predictions an executive should see first: confidence, then evidence, then frequency. */
export function headlineCards(cards: AeCardData[], n = 5): AeCardData[] {
	return [...cards]
		.sort(
			(a, b) =>
				(b.confidence ? CONFIDENCE_SCORE[b.confidence] : 0) - (a.confidence ? CONFIDENCE_SCORE[a.confidence] : 0) ||
				b.rank - a.rank
		)
		.slice(0, n);
}

export interface PeptideSummary {
	entry: Entry;
	cards: AeCardData[];
	headline: AeCardData[];
	serious: AeCardData[];
	precision: ReturnType<typeof precisionOf>;
	severity: { mild_moderate: number; severe: number; fatal: number; unknown: number };
	confidence: { high: number; medium: number; low: number; none: number };
	triage: { likely: number; uncertain: number; unlikely: number; none: number };
	location: { cell_surface: number; secreted: number; intracellular: number; unknown: number };
	proteins: ProteinInfo[];
	targets: ProteinInfo[];
}

function tally<K extends string>(keys: K[], values: (string | null | undefined)[], fallback: K) {
	const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
	for (const v of values) out[(keys as string[]).includes(v ?? '') ? (v as K) : fallback]++;
	return out;
}

export function summarize(entry: Entry): PeptideSummary {
	const cards = buildCards(entry);
	const proteins = proteinsOf(entry);
	return {
		entry,
		cards,
		headline: headlineCards(cards),
		serious: cards
			.filter((c) => c.prediction.severity_normalized === 'severe' || c.prediction.severity_normalized === 'fatal')
			.sort((a, b) => (b.prediction.frequency_pct ?? 0) - (a.prediction.frequency_pct ?? 0)),
		precision: precisionOf(entry),
		severity: tally(
			['mild_moderate', 'severe', 'fatal', 'unknown'],
			cards.map((c) => c.prediction.severity_normalized),
			'unknown'
		),
		confidence: tally(['high', 'medium', 'low', 'none'], cards.map((c) => c.confidence), 'none'),
		triage: tally(['likely', 'uncertain', 'unlikely', 'none'], proteins.map((p) => p.plausibility_class), 'none'),
		location: tally(
			['cell_surface', 'secreted', 'intracellular', 'unknown'],
			proteins.map((p) => p.location_class),
			'unknown'
		),
		proteins,
		targets: proteins.filter((p) => p.is_target)
	};
}

export interface RunRow {
	run: string;
	predictions: number;
	tp: number;
	scored: number;
	highConfidence: number;
	withConfidence: number;
	serious: number;
}

/** One row per run, pooled over its peptides, for the run comparison table. */
export function runRows(snapshot: Snapshot): RunRow[] {
	return snapshot.runs.map((run) => {
		const entries = snapshot.entries.filter((e) => e.run === run);
		const sums = entries.map(summarize);
		return {
			run,
			predictions: sums.reduce((n, s) => n + s.cards.length, 0),
			tp: sums.reduce((n, s) => n + (s.precision?.tp ?? 0), 0),
			scored: sums.reduce((n, s) => n + (s.precision?.scored ?? 0), 0),
			highConfidence: sums.reduce((n, s) => n + s.confidence.high, 0),
			withConfidence: sums.reduce((n, s) => n + s.cards.length - s.confidence.none, 0),
			serious: sums.reduce((n, s) => n + s.serious.length, 0)
		};
	});
}

export function pct(n: number, d: number): string {
	return d ? `${Math.round((100 * n) / d)}%` : '–';
}
