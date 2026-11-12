<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snapshot } from '../../lib/types';
	import { loadSnapshot } from '../../lib/data';
	import { buildCards, groupBySoc, hasConfidence, runLabel, type SortMode } from '../../lib/evidence';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import ReasoningBlock from '#lib/components/ReasoningBlock.svelte';
	import ProteinPanel from '#lib/components/ProteinPanel.svelte';
	import AeCard from '#lib/components/AeCard.svelte';
	import DetailPanel from '#lib/components/DetailPanel.svelte';

	let snapshot = $state<Snapshot | null>(null);
	let error = $state<string | null>(null);
	let run = $state('discovery');
	let peptide = $state('');
	let selectedId = $state<string | null>(null);
	let sort = $state<SortMode>('strength');

	onMount(async () => {
		try {
			const data = await loadSnapshot();
			const q = new URLSearchParams(location.search);
			run = data.runs.includes(q.get('run') ?? '') ? q.get('run')! : data.runs[data.runs.length - 1];
			const inRun = peptidesIn(data, run);
			peptide = inRun.includes(q.get('peptide') ?? '') ? q.get('peptide')! : inRun[0] ?? data.peptides[0];
			selectedId = q.get('ae');
			const s = q.get('sort');
			if (s === 'confidence' || s === 'frequency') sort = s;
			snapshot = data;
		} catch (e) {
			error = `Could not load the dataset (${(e as Error).message}).`;
		}
	});

	// A run need not cover every peptide (e.g. a single-peptide run like semaglutide_pharm4), so the
	// peptide picker lists only the peptides that run has.
	function peptidesIn(data: { entries: { run: string; peptide: string }[]; peptides: string[] }, r: string) {
		const have = new Set(data.entries.filter((e) => e.run === r).map((e) => e.peptide));
		return data.peptides.filter((p) => have.has(p));
	}
	const runPeptides = $derived(snapshot ? peptidesIn(snapshot, run) : []);

	const entry = $derived(snapshot?.entries.find((e) => e.run === run && e.peptide === peptide) ?? null);
	const cards = $derived(entry ? buildCards(entry) : []);
	const withConfidence = $derived(hasConfidence(cards));
	const groups = $derived(groupBySoc(cards, sort));
	const selected = $derived(cards.find((c) => c.prediction.id === selectedId) ?? null);
	const counts = $derived({
		strong: cards.filter((c) => c.strength === 'strong').length,
		moderate: cards.filter((c) => c.strength === 'moderate').length,
		weak: cards.filter((c) => c.strength === 'weak').length,
		high: cards.filter((c) => c.confidence === 'high').length,
		medium: cards.filter((c) => c.confidence === 'medium').length,
		low: cards.filter((c) => c.confidence === 'low').length
	});

	// keep the view in the URL so a link reopens the same run, peptide, sort and card
	$effect(() => {
		if (!snapshot) return;
		const q = new URLSearchParams({ run, peptide });
		if (sort !== 'strength') q.set('sort', sort);
		if (selectedId) q.set('ae', selectedId);
		history.replaceState(history.state, '', `?${q}`);
	});

	function choose(r: string, p: string) {
		const inRun = snapshot ? peptidesIn(snapshot, r) : [];
		run = r;
		peptide = inRun.includes(p) ? p : inRun[0] ?? p;
		selectedId = null;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') selectedId = null;
	}

	const SORT_NOTE: Record<SortMode, string> = {
		strength: 'Cards are sorted from strongest to weakest stated evidence.',
		confidence: 'Cards are sorted from highest to lowest confidence of prediction, then by evidence.',
		frequency: 'Cards are sorted from most to least frequent predicted AE.'
	};
</script>

<svelte:window {onkeydown} />
<svelte:head><title>Explorer · Foresight</title></svelte:head>

<SiteHeader>
	{#if snapshot}
		<div class="controls">
			<label>
				<span>Run</span>
				<select value={run} onchange={(e) => choose(e.currentTarget.value, peptide)}>
					{#each snapshot.runs as r (r)}<option value={r}>{runLabel(r)}</option>{/each}
				</select>
			</label>
			<label>
				<span>Peptide</span>
				<select value={peptide} onchange={(e) => choose(run, e.currentTarget.value)}>
					{#each runPeptides as p (p)}<option value={p}>{p}</option>{/each}
				</select>
			</label>
		</div>
	{/if}
</SiteHeader>

<main class="wrap">
	{#if error}
		<p class="status error">{error}</p>
	{:else if !snapshot}
		<p class="status">Loading predictions…</p>
	{:else if !entry}
		<p class="status">No predictions for {peptide} in {runLabel(run)}.</p>
	{:else}
		<div class="title-row">
			<h2>{peptide} <span>· {runLabel(run)}</span></h2>
			<p class="snapshot">Snapshot: {snapshot.label}</p>
		</div>

		<ReasoningBlock thinking={entry.thinking_summary} response={entry.response_reasoning} />

		<div class="stats-row">
			<ul class="stats" aria-label="Summary">
				<li><strong>{cards.length}</strong> predicted AEs</li>
				<li><strong>{groups.length}</strong> organ classes</li>
				<li class="g"><strong>{counts.strong}</strong> strong</li>
				<li><strong>{counts.moderate}</strong> moderate</li>
				<li class="o"><strong>{counts.weak}</strong> weak evidence</li>
				{#if withConfidence}
					<li class="sep g"><strong>{counts.high}</strong> high</li>
					<li><strong>{counts.medium}</strong> medium</li>
					<li class="o"><strong>{counts.low}</strong> low confidence</li>
				{/if}
				<li><strong>{entry.rag.chunk_count}</strong> retrieved chunks</li>
			</ul>
			<label class="sort">
				<span>Sort by</span>
				<select bind:value={sort}>
					<option value="strength">Evidence strength</option>
					<option value="confidence" disabled={!withConfidence}>
						Confidence{withConfidence ? '' : ' (not in this run)'}
					</option>
					<option value="frequency">Frequency</option>
				</select>
			</label>
		</div>

		<ProteinPanel {entry} {cards} onselect={(id) => (selectedId = id)} />

		<div class="layout" class:has-detail={!!selected}>
			<div class="groups">
				{#each groups as g (g.soc)}
					<section class="group" aria-labelledby="soc-{g.soc}">
						<h3 id="soc-{g.soc}">{g.soc} <span>{g.cards.length}</span></h3>
						<div class="cards">
							{#each g.cards as c (c.prediction.id)}
								<AeCard
									card={c}
									selected={c.prediction.id === selectedId}
									onselect={() =>
										(selectedId = selectedId === c.prediction.id ? null : c.prediction.id)}
								/>
							{/each}
						</div>
					</section>
				{/each}
				<p class="legend">
					{SORT_NOTE[sort]} A dashed card means the run had no per-AE record, so its evidence comes from the
					protein reasoning that names it. An orange triage note means at least one protein behind the AE
					was rated uncertain or unlikely to be perturbed.
				</p>
			</div>

			{#if selected}
				<button class="backdrop" aria-label="Close details" onclick={() => (selectedId = null)}></button>
				<div class="detail">
					<DetailPanel card={selected} {entry} onclose={() => (selectedId = null)} />
				</div>
			{/if}
		</div>
	{/if}
</main>

<style>
	.wrap {
		max-width: 1440px;
		margin: 0 auto;
		padding-inline: 24px;
	}
	.controls {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.8rem;
		color: var(--faint);
	}
	select {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: 8px;
		padding: 6px 10px;
		font: inherit;
		font-size: 0.9rem;
	}
	select:hover {
		border-color: var(--green);
	}
	main {
		padding-block: 24px 64px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.title-row h2 {
		margin: 0;
		font-size: 1.7rem;
	}
	.title-row h2 span {
		color: var(--faint);
		font-weight: 500;
	}
	.snapshot {
		margin: 0;
		color: var(--faint);
		font-size: 0.8rem;
	}
	.stats-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
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
	.stats li.sep {
		margin-left: 8px;
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
	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 24px;
		align-items: start;
	}
	.layout.has-detail {
		grid-template-columns: minmax(0, 1fr) minmax(360px, 460px);
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.group h3 {
		margin: 0 0 12px;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.group h3::before {
		content: '';
		width: 4px;
		height: 1em;
		background: var(--orange);
		border-radius: 2px;
	}
	.group h3 span {
		color: var(--faint);
		font-weight: 500;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}
	.detail {
		position: sticky;
		top: 88px;
		max-height: calc(100vh - 104px);
		overflow-y: auto;
		border-radius: var(--radius);
	}
	.backdrop {
		display: none;
	}
	.legend {
		color: var(--faint);
		font-size: 0.8rem;
		margin: 0;
	}
	.status {
		color: var(--muted);
		padding: 40px 0;
	}
	.status.error {
		color: var(--orange);
	}

	@media (max-width: 900px) {
		.wrap {
			padding-inline: 16px;
		}
		.layout.has-detail {
			grid-template-columns: 1fr;
		}
		.backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 15;
			border: 0;
			background: var(--overlay);
		}
		.detail {
			position: fixed;
			inset: auto 0 0 0;
			top: 15vh;
			max-height: none;
			z-index: 20;
			border-radius: var(--radius) var(--radius) 0 0;
			box-shadow: var(--shadow);
		}
	}
</style>
