import type {
	AeCardData,
	ConfidenceClass,
	Entry,
	EvidenceRecord,
	LocationClass,
	PlausibilityClass,
	StrengthClass
} from './types';

const STRENGTH_SCORE: Record<string, number> = { strong: 3, moderate: 2, weak: 1 };
export const CONFIDENCE_SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };
const PLAUSIBILITY_SCORE: Record<string, number> = { likely: 3, uncertain: 2, unlikely: 1 };

export type SortMode = 'strength' | 'confidence' | 'frequency';

/** Strongest evidence first: strength class, then explicit over inferred, then frequency. */
function rankOf(strength: StrengthClass, status: string, freq: number | null): number {
	const s = strength ? STRENGTH_SCORE[strength] : 0;
	const st = status === 'explicit' ? 2 : status === 'inferred' ? 1 : 0;
	return s * 1000 + st * 100 + Math.min(freq ?? 0, 99);
}

export function buildCards(entry: Entry): AeCardData[] {
	const byId = new Map(entry.evidence_records.map((r) => [r.id, r]));
	return entry.predictions.map((prediction) => {
		const evidence: EvidenceRecord[] = prediction.evidence_record_ids.length
			? prediction.evidence_record_ids.map((id) => byId.get(id)).filter((r): r is EvidenceRecord => !!r)
			: prediction.inferred_evidence;
		const primary = evidence[0] ?? null;
		// the best stated strength across the linked records
		const strength =
			evidence
				.map((r) => r.strength_class)
				.filter((s): s is NonNullable<StrengthClass> => !!s)
				.sort((a, b) => STRENGTH_SCORE[b] - STRENGTH_SCORE[a])[0] ?? null;
		const confidence: ConfidenceClass =
			prediction.confidence_class ?? evidence.find((r) => r.confidence_class)?.confidence_class ?? null;
		// the weakest triage verdict: one doubtful protein is enough to flag the card
		const plausibility =
			evidence
				.map((r) => r.plausibility_class)
				.filter((p): p is NonNullable<PlausibilityClass> => !!p)
				.sort((a, b) => PLAUSIBILITY_SCORE[a] - PLAUSIBILITY_SCORE[b])[0] ?? null;
		return {
			prediction,
			evidence,
			primary,
			strength,
			confidence,
			plausibility,
			rank: rankOf(strength, prediction.evidence_status, prediction.frequency_pct)
		};
	});
}

export interface SocGroup {
	soc: string;
	cards: AeCardData[];
	best: number;
}

/** Sort key for a card under a sort mode (higher first). Ties fall back to the evidence rank. */
export function sortKey(c: AeCardData, mode: SortMode): number {
	if (mode === 'confidence') return (c.confidence ? CONFIDENCE_SCORE[c.confidence] : 0) * 100000 + c.rank;
	if (mode === 'frequency') return (c.prediction.frequency_pct ?? -1) * 100000 + c.rank;
	return c.rank;
}

export function sortCards(cards: AeCardData[], mode: SortMode): AeCardData[] {
	return [...cards].sort((a, b) => sortKey(b, mode) - sortKey(a, mode));
}

export function groupBySoc(cards: AeCardData[], mode: SortMode = 'strength'): SocGroup[] {
	const groups = new Map<string, AeCardData[]>();
	for (const c of cards) {
		const soc = c.prediction.soc ?? 'Unclassified';
		groups.set(soc, [...(groups.get(soc) ?? []), c]);
	}
	return [...groups.entries()]
		.map(([soc, list]) => {
			const sorted = sortCards(list, mode);
			return { soc, cards: sorted, best: sorted[0] ? sortKey(sorted[0], mode) : 0 };
		})
		.sort((a, b) => b.best - a.best || b.cards.length - a.cards.length || a.soc.localeCompare(b.soc));
}

/** Split 'A → B → C | D → E' into chains of steps. */
export function chainSteps(chain: string | null): string[][] {
	if (!chain) return [];
	return chain
		.split(/\s\|\s/)
		.map((c) => c.replace(/^(?:Chain|Mechanistic chain|Causal chain)\s*:\s*/i, '').trim())
		.filter(Boolean)
		.map((c) =>
			c
				.split(/\s*→\s*/)
				.map((s) => s.trim().replace(/\.$/, ''))
				.filter(Boolean)
		);
}

export const SEVERITY_LABEL: Record<string, string> = {
	mild_moderate: 'Mild / moderate',
	severe: 'Severe',
	fatal: 'Fatal',
	unknown: 'Unknown'
};

export const MATCH_LABEL: Record<string, string> = {
	exact: 'Exact AE record',
	contains: 'AE record names this term',
	fuzzy: 'Near-identical AE record',
	token_overlap: 'Synonymous AE record',
	same_head_noun: 'Related AE record',
	mentioned_in_record: 'Mentioned inside an AE record'
};

export function runLabel(run: string): string {
	if (run === 'discovery') return 'Discovery';
	const m = run.match(/^quarter_(\d+)$/);
	if (m) return `Random quarter ${m[1]}`;
	const s = run.replace(/_/g, ' ');
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pubmedUrl(pmid: string): string {
	return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

/** Bar width for a frequency on a square-root scale of 0–100%, so 1% / 10% / 50% sit at 10 / 32 / 71% and rare events stay visible. */
export function freqBarWidth(pct: number | null | undefined): number {
	if (pct == null || pct <= 0) return 0;
	return Math.min(100, Math.max(2, Math.sqrt(pct) * 10));
}

export const CONFIDENCE_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const PLAUSIBILITY_LABEL: Record<string, string> = {
	likely: 'Likely perturbed',
	uncertain: 'Uncertain',
	unlikely: 'Unlikely perturbed'
};

export const LOCATION_LABEL: Record<LocationClass, string> = {
	cell_surface: 'Cell surface',
	secreted: 'Secreted',
	intracellular: 'Intracellular',
	unknown: 'Location unknown'
};

/** The verdict word stripped from a triage line, leaving its reason ('likely perturbed: X' → 'X'). */
export function plausibilityReason(text: string | null | undefined): string | null {
	if (!text) return null;
	const r = text.replace(/^\s*(?:likely|unlikely|uncertain(?:ly)?)(?:\s+perturbed)?\s*[:;,.\-–—]\s*/i, '').trim();
	return r && r.toLowerCase() !== text.trim().toLowerCase() ? r : r || null;
}

/** Share of scored predictions that matched the label, or null when the run has no benchmark. */
export function precisionOf(entry: Entry): { tp: number; scored: number; pct: number } | null {
	const scored = entry.predictions.filter((p) => p.score_status === 'TP' || p.score_status === 'FP');
	if (!scored.length) return null;
	const tp = scored.filter((p) => p.score_status === 'TP').length;
	return { tp, scored: scored.length, pct: (100 * tp) / scored.length };
}

export function hasConfidence(cards: AeCardData[]): boolean {
	return cards.some((c) => c.confidence);
}
