import type { AeCardData, Entry, EvidenceRecord, StrengthClass } from './types';

const STRENGTH_SCORE: Record<string, number> = { strong: 3, moderate: 2, weak: 1 };

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
		return {
			prediction,
			evidence,
			primary,
			strength,
			rank: rankOf(strength, prediction.evidence_status, prediction.frequency_pct)
		};
	});
}

export interface SocGroup {
	soc: string;
	cards: AeCardData[];
	best: number;
}

export function groupBySoc(cards: AeCardData[]): SocGroup[] {
	const groups = new Map<string, AeCardData[]>();
	for (const c of cards) {
		const soc = c.prediction.soc ?? 'Unclassified';
		groups.set(soc, [...(groups.get(soc) ?? []), c]);
	}
	return [...groups.entries()]
		.map(([soc, list]) => {
			const sorted = list.sort((a, b) => b.rank - a.rank);
			return { soc, cards: sorted, best: sorted[0]?.rank ?? 0 };
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
	return m ? `Random quarter ${m[1]}` : run.replace(/_/g, ' ');
}

export function pubmedUrl(pmid: string): string {
	return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

/** Bar width for a frequency on a square-root scale of 0–100%, so 1% / 10% / 50% sit at 10 / 32 / 71% and rare events stay visible. */
export function freqBarWidth(pct: number | null | undefined): number {
	if (pct == null || pct <= 0) return 0;
	return Math.min(100, Math.max(2, Math.sqrt(pct) * 10));
}
