// Shape of static/data/ae_dashboard_snapshot.json (see the parser's README for every field).

export type StrengthClass = 'strong' | 'moderate' | 'weak' | null;
export type ConfidenceClass = 'high' | 'medium' | 'low' | null;
export type PlausibilityClass = 'likely' | 'uncertain' | 'unlikely' | null;
export type LocationClass = 'cell_surface' | 'secreted' | 'intracellular' | 'unknown';

// Fields marked "schema 2" are absent from snapshots built before 2026-11-02, so they are optional here.

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
	/** Step 1 triage verdict for this record's protein(s), with its reason. */
	plausibility?: string | null;
	plausibility_class?: PlausibilityClass;
	/** Confidence of prediction (schema 2). */
	confidence?: string | null;
	confidence_class?: ConfidenceClass;
	confidence_rationale?: string | null;
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
	/** schema 2: from '| Confidence:' on the predictions line, else the first linked record that states one */
	confidence?: string | null;
	confidence_class?: ConfidenceClass;
	confidence_rationale?: string | null;
	confidence_source?: 'predictions_line' | 'evidence_record' | null;
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
	plausibility?: string | null;
	plausibility_class?: PlausibilityClass;
	confidence?: string | null;
	location?: string | null;
	text: string;
}

/** One protein of the run's list (schema 2): shortlist annotations merged with the Step 1 triage. */
export interface ProteinInfo {
	gene: string;
	accession: string | null;
	name: string | null;
	subcellular_location: string | null;
	location_class: LocationClass;
	location_source: 'shortlist' | 'reasoning' | null;
	is_target: boolean;
	rank: number | null;
	score: number | null;
	plausibility: string | null;
	plausibility_class: PlausibilityClass;
	prediction_ids: string[];
}

export interface Entry {
	id: string;
	run: string;
	peptide: string;
	predictions: Prediction[];
	evidence_records: EvidenceRecord[];
	protein_sections: ProteinSection[];
	proteins?: ProteinInfo[];
	protein_list_size?: number;
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
	confidence: ConfidenceClass;
	/** the weakest triage verdict among the linked records' proteins */
	plausibility: PlausibilityClass;
	rank: number;
}
