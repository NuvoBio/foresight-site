<script lang="ts">
	// A skein prediction run for one peptide: run facts, the model's reasoning, then one
	// horizontal card per predicted AE (mini graph of the cited path + AE info).
	import type { KgIndexPeptide, KgPredictionFile } from '../kgPredictions';
	import { loadKgPrediction } from '../kgPredictions';
	import KgPredictionCard from './KgPredictionCard.svelte';

	interface Props {
		run: string;
		entry: KgIndexPeptide;
	}
	let { run, entry }: Props = $props();

	let data = $state<KgPredictionFile | null>(null);
	let error = $state<string | null>(null);
	let expanded = $state(false);

	$effect(() => {
		const [r, f] = [run, entry.file];
		data = null;
		error = null;
		loadKgPrediction(r, f)
			.then((d) => (data = d))
			.catch((e) => (error = (e as Error).message));
	});

	const supported = $derived(data ? data.records.filter((r) => r.kg_supported).length : 0);
	const fromTools = $derived(data?.explored?.edges_cited_from_tools.length ?? 0);
	const paragraphs = $derived(
		(data?.reasoning ?? '')
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter(Boolean)
	);
	// records are written in prediction order; fall back to the prediction lines if records are missing
	const records = $derived(data?.records ?? []);
</script>

{#if error}
	<p class="status error">Could not load this prediction ({error}).</p>
{:else if !data}
	<p class="status">Loading prediction…</p>
{:else}
	<div class="title-row">
		<h2>{data.peptide} <span>· knowledge-graph prediction</span></h2>
		<p class="facts">
			{data.model} · {data.created.replace('T', ' ').replace('+00:00', ' UTC')} · graph built {data.kg.built_at ?? 'n/a'}
		</p>
	</div>

	<ul class="stats" aria-label="Summary">
		<li><strong>{data.predictions.length}</strong> predicted AEs</li>
		<li class="g"><strong>{supported}</strong> with cited graph paths</li>
		<li class="o"><strong>{records.length - supported}</strong> model inference only</li>
		<li><strong>{data.tool_calls.length}</strong> graph lookups</li>
		{#if fromTools}<li><strong>{fromTools}</strong> cited edges found by lookups</li>{/if}
		{#if data.overall_severity}<li>{data.overall_severity}</li>{/if}
	</ul>

	{#if data.error || data.record_error}
		<p class="status error">{[data.error, data.record_error].filter(Boolean).join('; ')}</p>
	{/if}

	{#if paragraphs.length}
		<section class="reasoning" aria-labelledby="kg-reasoning">
			<h3 id="kg-reasoning">Reasoning</h3>
			<div class="body" class:expanded>
				{#each paragraphs as p, i (i)}<p>{p.replace(/\*\*/g, '')}</p>{/each}
			</div>
			<button class="toggle" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
				{expanded ? 'Show less' : 'Read all'}
			</button>
		</section>
	{/if}

	<div class="cards">
		{#each records as record, i (i)}
			<KgPredictionCard {record} index={i} />
		{:else}
			<p class="status">No structured records in this file.</p>
		{/each}
	</div>
	<p class="legend">
		Left: the graph path the prediction cites (orange = literature relation, dashed orange = negated), continued by
		dotted grey steps the model inferred without a graph edge. A dashed card cites no graph path at all.
	</p>
{/if}

<style>
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 1.7rem;
	}
	h2 span {
		color: var(--faint);
		font-weight: 500;
	}
	.facts {
		margin: 0;
		color: var(--faint);
		font-size: 0.8rem;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.stats li {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 4px 14px;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.stats strong {
		color: var(--text);
		margin-right: 4px;
	}
	.stats .g strong {
		color: var(--green);
	}
	.stats .o strong {
		color: var(--orange);
	}
	.reasoning {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 16px 20px;
	}
	.reasoning h3 {
		margin: 0 0 8px;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.body {
		max-height: 9.5em;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, black 60%, transparent);
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--muted);
	}
	.body.expanded {
		max-height: none;
		mask-image: none;
	}
	.body p {
		margin: 0 0 8px;
		white-space: pre-line;
	}
	.toggle {
		margin-top: 8px;
		background: none;
		border: 1px solid var(--line-strong);
		border-radius: 8px;
		padding: 3px 12px;
		font-size: 0.82rem;
		cursor: pointer;
	}
	.cards {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.legend {
		color: var(--faint);
		font-size: 0.8rem;
		margin: 0;
	}
	.status {
		color: var(--muted);
		padding: 24px 0;
		margin: 0;
	}
	.status.error {
		color: var(--orange);
		padding: 0;
	}
</style>
