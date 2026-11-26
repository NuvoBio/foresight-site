<script lang="ts">
	// One KG-grounded prediction: the cited path as a mini graph on the left,
	// the adverse event, its rating and the model's mechanism summary on the right.
	import type { KgContextEdge, KgRecord } from '../kgPredictions';
	import { severityKey } from '../kgPredictions';
	import { SEVERITY_LABEL, pubmedUrl } from '../evidence';
	import Badge from './Badge.svelte';
	import KgMiniGraph from './KgMiniGraph.svelte';
	import { confidenceTone, plausibilityTone, severityTone } from './tones';

	interface Props {
		record: KgRecord;
		index: number;
	}
	let { record, index }: Props = $props();

	const sev = $derived(severityKey(record.severity));
	const literature = $derived(record.context.edges.filter((e) => e.origin === 'literature'));
	// A cited path is a walk, and an edge can point against it: a drug -agonist_of->
	// protein edge is traversed protein -> drug. Follow the node reached so far, the
	// same way the mini graph lays the path out, and mark the backwards hops.
	const chains = $derived(
		record.kg_paths.map((path) => {
			const steps: {
				edge: KgContextEdge;
				fromName: string;
				toName: string;
				reversed: boolean;
			}[] = [];
			let at: string | null = null;
			for (const id of path) {
				const e: KgContextEdge | undefined = record.context.edges.find((x) => x.edge_id === id);
				if (!e) continue;
				const reversed: boolean = at !== null && at !== e.source;
				steps.push({
					edge: e,
					fromName: reversed ? e.target_name : e.source_name,
					toName: reversed ? e.source_name : e.target_name,
					reversed
				});
				at = reversed ? e.source : e.target;
			}
			return steps;
		})
	);
	const plaus = $derived((record.perturbation_plausibility ?? '').toLowerCase().match(/likely|uncertain|unlikely/)?.[0] ?? null);
	const pmid = (v: unknown) => (v ? String(Math.round(Number(v))) : null);
	const pred = (p: string | null, neg?: boolean) => (neg ? 'NOT ' : '') + String(p ?? '').replaceAll('_', ' ');
	/** The figure a pharmacology edge carries, for the hop's tooltip. */
	const figure = (e: KgContextEdge) =>
		[e.percent && `${e.percent} of reports`, e.affinity, e.warning_type, e.max_phase && `phase ${e.max_phase}`]
			.filter(Boolean)
			.join(' · ');
</script>

<article class="card" class:unsupported={!record.kg_supported} aria-labelledby="kg-ae-{index}">
	<div class="graph">
		{#if record.context.nodes.length || record.inferred_hops.length}
			<KgMiniGraph
				nodes={record.context.nodes}
				edges={record.context.edges}
				paths={record.kg_paths}
				proteins={record.proteins}
				inferred={record.inferred_hops}
			/>
		{:else}
			<p class="empty">No graph edges cited. This prediction rests on the model's own inference (see the hops on the right).</p>
		{/if}
	</div>

	<div class="info">
		<div class="top">
			<h4 id="kg-ae-{index}">{record.ae}</h4>
			<Badge tone={severityTone(sev)}>{SEVERITY_LABEL[sev] ?? record.severity ?? 'severity n/a'}</Badge>
		</div>

		<div class="meta">
			<span class="freq">{record.frequency_pct != null ? `${record.frequency_pct}%` : '–'}</span>
			{#if record.confidence}<Badge tone={confidenceTone(record.confidence)}>{record.confidence} confidence</Badge>{/if}
			{#if plaus}<Badge tone={plausibilityTone(plaus)}>{plaus} perturbed</Badge>{/if}
			{#if record.kg_supported}
				<Badge tone="green">graph-supported</Badge>
			{:else}
				<Badge tone="orange">model inference</Badge>
			{/if}
		</div>

		{#if record.proteins.length}
			<p class="proteins"><span>Proteins</span> {record.proteins.join(', ')}</p>
		{/if}

		{#if record.mechanism}<p class="mechanism">{record.mechanism}</p>{/if}

		{#if chains.length}
			<div class="block">
				<h5>Cited path{chains.length > 1 ? 's' : ''}</h5>
				{#each chains as chain, i (i)}
					<p class="chain">
						{#each chain as s, j (s.edge.edge_id)}
							{#if j === 0}<strong>{s.fromName}</strong>{/if}
							<span
								class="hop"
								class:lit={s.edge.origin === 'literature'}
								class:rev={s.reversed}
								title="{s.edge.edge_id} · {s.edge.origin}{figure(s.edge) ? ` · ${figure(s.edge)}` : ''}"
							>{pred(s.edge.predicate, s.edge.negated)}</span>
							<strong>{s.toName}</strong>
						{/each}
					</p>
				{/each}
			</div>
		{/if}

		{#if record.inferred_hops.length}
			<div class="block">
				<h5>Inferred by the model</h5>
				<ul class="inferred">
					{#each record.inferred_hops as h, i (i)}<li>{h}</li>{/each}
				</ul>
			</div>
		{/if}

		{#if literature.length}
			<div class="block">
				<h5>Literature evidence</h5>
				{#each literature as e (e.edge_id)}
					<blockquote>
						{#if e.evidence}“{e.evidence}”{/if}
						<cite>
							{e.source_name} {pred(e.predicate, e.negated)} {e.target_name}{#if e.species}&nbsp;· {e.species}{/if}
							{#if pmid(e.pmid)}&nbsp;· <a href={pubmedUrl(pmid(e.pmid)!)} target="_blank" rel="noreferrer">PubMed {pmid(e.pmid)}</a>{/if}
						</cite>
					</blockquote>
				{/each}
			</div>
		{/if}

		{#if record.relationship_types.length}
			<p class="types">{#each record.relationship_types as t (t)}<span>{t.replaceAll('_', ' ')}</span>{/each}</p>
		{/if}
		{#if record.unknown_edges.length}
			<p class="warn">Cites edge IDs not in the graph: {record.unknown_edges.join(', ')}</p>
		{/if}
	</div>
</article>

<style>
	.card {
		display: grid;
		grid-template-columns: minmax(260px, 420px) minmax(0, 1fr);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--card-shadow);
		overflow: hidden;
	}
	.card.unsupported {
		border-style: dashed;
	}
	.graph {
		background: var(--surface-2);
		border-right: 1px solid var(--line);
		padding: 10px;
		display: flex;
		align-items: center;
	}
	.empty {
		color: var(--faint);
		font-size: 0.82rem;
		margin: 0;
		padding: 16px;
	}
	.info {
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	h4 {
		margin: 0;
		font-size: 1.1rem;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.freq {
		font-weight: 700;
		font-size: 1rem;
		margin-right: 4px;
	}
	.proteins {
		margin: 0;
		font-size: 0.85rem;
	}
	.proteins span,
	h5 {
		color: var(--faint);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.7rem;
		font-weight: 600;
		margin: 0 6px 0 0;
	}
	h5 {
		margin: 0 0 4px;
	}
	.mechanism {
		margin: 0;
		line-height: 1.5;
		font-size: 0.92rem;
	}
	.chain {
		margin: 0 0 4px;
		font-size: 0.84rem;
		line-height: 1.7;
	}
	.hop {
		color: var(--muted);
		margin: 0 4px;
	}
	.hop::before {
		content: '— ';
	}
	.hop::after {
		content: ' →';
	}
	/* an edge traversed against its direction, e.g. protein <- agonist_of - drug */
	.hop.rev::before {
		content: '← ';
	}
	.hop.rev::after {
		content: ' —';
	}
	.hop.lit {
		color: #e08a1e;
		font-weight: 600;
	}
	.inferred {
		margin: 0;
		padding-left: 18px;
		font-size: 0.84rem;
		color: var(--muted);
	}
	.inferred li::marker {
		content: '⋯ ';
	}
	blockquote {
		margin: 0 0 6px;
		padding: 6px 10px;
		border-left: 3px solid #e08a1e;
		background: var(--surface-2);
		border-radius: 0 8px 8px 0;
		font-size: 0.84rem;
		line-height: 1.45;
	}
	cite {
		display: block;
		font-style: normal;
		color: var(--faint);
		font-size: 0.76rem;
		margin-top: 2px;
	}
	.types {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
	}
	.types span {
		font-size: 0.72rem;
		color: var(--muted);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 1px 8px;
	}
	.warn {
		margin: 0;
		color: var(--orange);
		font-size: 0.8rem;
	}
	@media (max-width: 900px) {
		.card {
			grid-template-columns: 1fr;
		}
		.graph {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
	}
</style>
