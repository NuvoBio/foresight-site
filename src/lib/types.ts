// Shape of static/data/ae_dashboard_snapshot.json (see the parser's README for every field).

export type StrengthClass = 'strong' | 'moderate' | 'weak' | null;

export interface EvidenceRecord {
	id: string;
	ae: string;
	ae_raw: string | null;
	proteins: string[];
	pathways: string[];
	relationship_type: string[];
	relationship_type_text: string | null;
	direction: string | null;
	direction_class: string | null;
	direction_assumed: boolean;
	mechanistic_chain: string | null;
	evidence: string | null;
	pmids: string[];
	strength: string | null;
	strength_class: StrengthClass;
	frequency_hint: string | null;
	severity_hint: string | null;
	borrowed_fields: Record<string, string>;
	source: 'ae_record' | 'protein_section';
	line_start: number;
	line_end: number;
	raw: string;
	chunk_ids: string[];
}

export interface Prediction {
	id: string;
	term: string;
	frequency_text: string | null;
	frequency_pct: number | null;
	severity: string | null;
	severity_normalized: 'mild_moderate' | 'severe' | 'fatal' | 'unknown';
	soc: string | null;
	preferred_term: string | null;
	score_status: string | null;
	score_match: string | null;
	evidence_status: 'explicit' | 'inferred' | 'none';
	evidence_record_ids: string[];
	match_methods: Record<string, string>;
	inferred_evidence: EvidenceRecord[];
	chunk_ids: string[];
	protein_chunk_ids: string[];
}

export interface Chunk {
	id: string;
	rank: number | null;
	score: number | null;
	pmid: string | null;
	doi: string | null;
	title: string | null;
	year: string | null;
	journal: string | null;
	section: string | null;
	source: string | null;
	mesh_terms: string[];
	publication_types: string[];
	text: string | null;
}

export interface ProteinSection {
	protein: string;
	header: string;
	line_start: number;
	line_end: number;
	pmids: string[];
	pathways: string[];
	text: string;
}

export interface Entry {
	id: string;
	run: string;
	peptide: string;
	predictions: Prediction[];
	evidence_records: EvidenceRecord[];
	protein_sections: ProteinSection[];
	thinking_summary: string;
	response_reasoning: string;
	rag: { context_source?: string; chunk_count: number };
	chunks: Chunk[];
	parse_warnings: string[];
}

export interface Snapshot {
	schema_version: number;
	generated_at: string;
	label: string;
	runs: string[];
	peptides: string[];
	entries: Entry[];
}

/** A prediction with its evidence resolved, ready for a card. */
export interface AeCardData {
	prediction: Prediction;
	evidence: EvidenceRecord[];
	primary: EvidenceRecord | null;
	strength: StrengthClass;
	rank: number;
}
