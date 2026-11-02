<script lang="ts">
	import type { AeCardData, Chunk, Entry } from '../types';
	import {
		CONFIDENCE_LABEL,
		LOCATION_LABEL,
		MATCH_LABEL,
		PLAUSIBILITY_LABEL,
		SEVERITY_LABEL,
		chainSteps,
		plausibilityReason,
		pubmedUrl
	} from '../evidence';
	import { proteinsOf } from '../summary';
	import Badge from './Badge.svelte';
	import { confidenceTone, plausibilityTone, severityTone, strengthTone } from './tones';

	interface Props {
		card: AeCardData;
		entry: Entry;
		onclose: () => void;
	}
	let { card, entry, onclose }: Props = $props();

	let recordIndex = $state(0);
	$effect(() => {
		// back to the first record whenever another card is opened
		void card.prediction.id;
		recordIndex = 0;
	});

	const p = $derived(card.prediction);
	const record = $derived(card.evidence[recordIndex] ?? null);
	const steps = $derived(chainSteps(record?.mechanistic_chain ?? null));
	const chunkById = $derived(new Map(entry.chunks.map((c) => [c.id, c])));
	const cited = $derived(p.chunk_ids.map((id) => chunkById.get(id)).filter((c): c is Chunk => !!c));
	const related = $derived(p.protein_chunk_ids.map((id) => chunkById.get(id)).filter((c): c is Chunk => !!c));
	const sections = $derived(
		record ? entry.protein_sections.filter((s) => record.proteins.includes(s.protein)) : []
	);
	const proteinInfo = $derived(new Map(proteinsOf(entry).map((pi) => [pi.gene, pi])));
	const rationale = $derived(p.confidence_rationale ?? record?.confidence_rationale ?? null);
	const fileName = $derived(`${entry.peptide}_reasoning.txt`);
	const BORROW_LABEL: Record<string, string> = {
		proteins: 'Proteins',
		mechanistic_chain: 'Mechanistic chain',
		evidence: 'Evidence',
		relationship_type: 'Relationship type',
		direction: 'Direction',
		strength: 'Strength',
		plausibility: 'Plausibility',
		confidence: 'Confidence',
		confidence_rationale: 'Confidence rationale'
	};
</script>

<aside class="panel" aria-labelledby="detail-title">
	<header>
		<div>
			<p class="soc">{p.soc ?? 'Unclassified'}</p>
			<h3 id="detail-title">{p.term}</h3>
			{#if p.preferred_term && p.preferred_term !== p.term}
				<p class="pt">MedDRA PT: {p.preferred_term}</p>
			{/if}
		</div>
		<button class="close" onclick={onclose} aria-label="Close details">✕</button>
	</header>

	<div class="facts">
		<div><span class="label">Frequency</span><strong>{p.frequency_text ?? '–'}</strong></div>
		<div>
			<span class="label">Severity</span>
			<Badge tone={severityTone(p.severity_normalized)}>{SEVERITY_LABEL[p.severity_normalized]}</Badge>
		</div>
		<div>
			<span class="label">Evidence</span>
			<Badge tone={strengthTone(card.strength)}>{card.strength ?? 'not stated'}</Badge>
		</div>
		<div>
			<span class="label">Confidence</span>
			<Badge tone={confidenceTone(card.confidence)}>
				{card.confidence ? CONFIDENCE_LABEL[card.confidence] : 'not rated'}
			</Badge>
		</div>
		{#if p.score_status}
			<div>
				<span class="label">Benchmark</span>
				<Badge tone={p.score_status === 'TP' ? 'green' : 'orange'}>
					{p.score_status === 'TP' ? 'Matched label' : 'Not in label'}
				</Badge>
			</div>
		{/if}
	</div>

	{#if rationale}
		<p class="rationale"><span class="label">Least certain part</span>{rationale}</p>
	{/if}

	{#if !record}
		<p class="empty">The parser found no reasoning for this AE in {fileName}.</p>
	{:else}
		{#if card.evidence.length > 1}
			<div class="records" role="tablist" aria-label="Evidence records">
				{#each card.evidence as r, i (r.id)}
					<button role="tab" aria-selected={i === recordIndex} onclick={() => (recordIndex = i)}>
						{r.ae_raw ?? r.proteins.join(', ')}
					</button>
				{/each}
			</div>
		{/if}

		<section>
			<h4>Proteins</h4>
			<ul class="chips proteins">
				{#each record.proteins as pr (pr)}
					{@const info = proteinInfo.get(pr)}
					<li title={info?.subcellular_location ?? undefined}>
						<span class="mono">{pr}</span>
						{#if info?.is_target}<span class="target">target</span>{/if}
						{#if info && info.location_class !== 'unknown'}
							<span class="loc {info.location_class}">{LOCATION_LABEL[info.location_class]}</span>
						{/if}
					</li>
				{/each}
				{#if !record.proteins.length}<li class="muted">Not stated</li>{/if}
			</ul>
		</section>

		<section>
			<h4>Pathways</h4>
			{#if record.pathways.length}
				<ul class="chips">
					{#each record.pathways as pw (pw)}<li>{pw}</li>{/each}
				</ul>
			{:else}
				<p class="muted">No pathway annotation in the reasoning for these proteins.</p>
			{/if}
		</section>

		<section>
			<h4>Reasoning</h4>
			<dl class="grid">
				<dt>Relationship</dt>
				<dd>
					{#if record.relationship_type.length}
						{record.relationship_type.map((r) => r.replace(/_/g, ' ')).join(', ')}
					{:else}<span class="muted">Not stated</span>{/if}
				</dd>
				<dt>Direction</dt>
				<dd>
					{#if record.direction}{record.direction}{:else}<span class="muted">Not stated</span>{/if}
				</dd>
				<dt>Strength</dt>
				<dd class="with-chip">
					{#if record.strength_class}<Badge tone={strengthTone(record.strength_class)}>{record.strength_class}</Badge>{/if}
					{#if record.strength}<span>{record.strength}</span>{:else}<span class="muted">Not stated</span>{/if}
				</dd>
				<dt>Plausibility</dt>
				<dd class="with-chip">
					{#if record.plausibility_class}
						<Badge tone={plausibilityTone(record.plausibility_class)}>
							{PLAUSIBILITY_LABEL[record.plausibility_class]}
						</Badge>
					{/if}
					{#if plausibilityReason(record.plausibility)}
						<span>{plausibilityReason(record.plausibility)}</span>
					{:else if !record.plausibility_class}<span class="muted">Not stated</span>{/if}
				</dd>
				{#if record.confidence_class && record.confidence_class !== card.confidence}
					<dt>Confidence</dt>
					<dd class="with-chip">
						<Badge tone={confidenceTone(record.confidence_class)}>{record.confidence_class}</Badge>
						<span class="muted">for this record; the prediction as a whole is rated
							{card.confidence ?? 'not rated'}</span>
					</dd>
				{/if}
			</dl>
			{#if steps.length}
				{#each steps as chain, ci (ci)}
					<ol class="chain" aria-label="Mechanistic chain">
						{#each chain as step, si (si)}<li>{step}</li>{/each}
					</ol>
				{/each}
			{:else}
				<p class="muted">No mechanistic chain stated.</p>
			{/if}
		</section>

		<section>
			<h4>Supporting evidence</h4>
			{#if record.evidence}<p>{record.evidence}</p>{:else}<p class="muted">Not stated.</p>{/if}
			{#if record.pmids.length}
				<ul class="chips">
					{#each record.pmids as pm (pm)}
						<li><a href={pubmedUrl(pm)} target="_blank" rel="noopener">PMID {pm}</a></li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<h4>Retrieved chunks</h4>
			{#if cited.length || related.length}
				{#each [...cited.map((c) => ({ c, why: 'Cited for this AE' })), ...related.map((c) => ({ c, why: 'Cited for the same protein' }))] as { c, why } (c.id)}
					<details class="chunk">
						<summary>
							<span class="chunk-title">{c.title ?? c.id}</span>
							<span class="chunk-meta">{why} · {c.journal ?? ''} {c.year ?? ''} · {c.section ?? ''}</span>
						</summary>
						<p>{c.text}</p>
						{#if c.pmid}<a href={pubmedUrl(c.pmid)} target="_blank" rel="noopener">Open PMID {c.pmid}</a>{/if}
					</details>
				{/each}
			{:else}
				<p class="muted">
					No retrieved chunk is cited for this AE. This run retrieved {entry.rag.chunk_count}
					chunk{entry.rag.chunk_count === 1 ? '' : 's'} in total.
				</p>
			{/if}
		</section>

		{#if sections.length}
			<section>
				<h4>Protein reasoning</h4>
				{#each sections as s (s.line_start)}
					<details class="chunk">
						<summary><span class="chunk-title mono">{s.protein}</span><span class="chunk-meta">lines {s.line_start}–{s.line_end}</span></summary>
						<p class="pre">{s.text.replace(/\*\*/g, '')}</p>
					</details>
				{/each}
			</section>
		{/if}

		<footer>
			<p>
				{record.source === 'protein_section'
					? 'Inferred: this run has no AE record for this term, so the evidence comes from the protein reasoning that names it.'
					: (MATCH_LABEL[p.match_methods[record.id]] ?? 'AE record')}
				· {fileName}, lines {record.line_start}–{record.line_end}
			</p>
			{#if Object.keys(record.borrowed_fields).length}
				<p>
					Filled from elsewhere in the reasoning:
					{Object.entries(record.borrowed_fields)
						.map(([f, src]) => `${BORROW_LABEL[f] ?? f} (${src})`)
						.join('; ')}
				</p>
			{/if}
			<details>
				<summary>Raw text</summary>
				<p class="pre mono">{record.raw}</p>
			</details>
		</footer>
	{/if}
</aside>

<style>
	.panel {
		background: var(--surface);
		border: 1px solid var(--line);
		border-top: 3px solid var(--orange);
		box-shadow: var(--card-shadow);
		border-radius: var(--radius);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	.soc {
		margin: 0;
		color: var(--orange);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	h3 {
		margin: 2px 0 0;
		font-size: 1.35rem;
		line-height: 1.25;
	}
	.pt {
		margin: 2px 0 0;
		color: var(--faint);
		font-size: 0.85rem;
	}
	.close {
		background: none;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		width: 32px;
		height: 32px;
		flex: none;
		cursor: pointer;
	}
	.close:hover {
		border-color: var(--orange);
		color: var(--orange);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		padding: 12px 0;
		border-block: 1px solid var(--line);
	}
	.facts div {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-start;
	}
	.label,
	h4 {
		color: var(--faint);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	h4 {
		margin: 0 0 8px;
	}
	section p {
		margin: 0;
	}
	.records {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.records button {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 4px 10px;
		font-size: 0.8rem;
		color: var(--muted);
		cursor: pointer;
		max-width: 100%;
		text-align: left;
	}
	.records button[aria-selected='true'] {
		border-color: var(--green);
		color: var(--text);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	section > .chips:first-of-type {
		margin-top: 0;
	}
	.chips li {
		padding: 2px 9px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--bg);
		font-size: 0.82rem;
	}
	.rationale {
		margin: -6px 0 0;
		font-size: 0.88rem;
		color: var(--muted);
	}
	.rationale .label {
		display: block;
		margin-bottom: 2px;
	}
	.with-chip {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
	}
	.proteins li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.target {
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--green);
	}
	.loc {
		font-size: 0.72rem;
		color: var(--faint);
	}
	.loc.intracellular {
		color: var(--orange);
	}
	.mono {
		font-family: var(--mono);
	}
	.muted {
		color: var(--faint);
	}
	.grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px 14px;
		margin: 0 0 12px;
	}
	dt {
		color: var(--faint);
		font-size: 0.85rem;
	}
	dd {
		margin: 0;
	}
	.chain {
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.chain li {
		position: relative;
		padding: 6px 10px 6px 26px;
		border-left: 2px solid var(--green);
		margin-left: 6px;
	}
	.chain li::before {
		content: '';
		position: absolute;
		left: -6px;
		top: 12px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--bg);
		border: 2px solid var(--green);
	}
	.chain li:last-child {
		border-left-color: transparent;
		font-weight: 600;
	}
	.chain li:last-child::before {
		background: var(--orange);
		border-color: var(--orange);
	}
	.chunk {
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 8px 12px;
		margin-bottom: 8px;
		background: var(--bg);
	}
	.chunk summary {
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.chunk-title {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.chunk-meta {
		color: var(--faint);
		font-size: 0.75rem;
	}
	.chunk p {
		color: var(--muted);
		font-size: 0.85rem;
		margin: 8px 0;
	}
	.pre {
		white-space: pre-wrap;
	}
	footer {
		border-top: 1px solid var(--line);
		padding-top: 12px;
		color: var(--faint);
		font-size: 0.8rem;
	}
	footer p {
		margin: 0 0 6px;
	}
	footer summary {
		cursor: pointer;
	}
	.empty {
		color: var(--orange);
	}
</style>
