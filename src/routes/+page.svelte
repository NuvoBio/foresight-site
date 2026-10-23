<script lang="ts">
	import Logo from '#lib/components/Logo.svelte';
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import type { Snapshot } from '../lib/types';
	import { buildCards, groupBySoc, runLabel } from '../lib/evidence';
	import ReasoningBlock from '../lib/components/ReasoningBlock.svelte';
	import AeCard from '../lib/components/AeCard.svelte';
	import DetailPanel from '../lib/components/DetailPanel.svelte';

	let snapshot = $state<Snapshot | null>(null);
	let error = $state<string | null>(null);
	let run = $state('discovery');
	let peptide = $state('');
	let selectedId = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await fetch(asset('data/ae_dashboard_snapshot.json'));
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: Snapshot = await res.json();
			const q = new URLSearchParams(location.search);
			run = data.runs.includes(q.get('run') ?? '') ? q.get('run')! : data.runs[0];
			peptide = data.peptides.includes(q.get('peptide') ?? '') ? q.get('peptide')! : data.peptides[0];
			selectedId = q.get('ae');
			snapshot = data;
		} catch (e) {
			error = `Could not load the dataset (${(e as Error).message}).`;
		}
	});

	const entry = $derived(snapshot?.entries.find((e) => e.run === run && e.peptide === peptide) ?? null);
	const cards = $derived(entry ? buildCards(entry) : []);
	const groups = $derived(groupBySoc(cards));
	const maxFreq = $derived(Math.max(0, ...cards.map((c) => c.prediction.frequency_pct ?? 0)));
	const selected = $derived(cards.find((c) => c.prediction.id === selectedId) ?? null);
	const counts = $derived({
		strong: cards.filter((c) => c.strength === 'strong').length,
		moderate: cards.filter((c) => c.strength === 'moderate').length,
		weak: cards.filter((c) => c.strength === 'weak').length
	});

	// keep the view in the URL so a link reopens the same run, peptide and card
	$effect(() => {
		if (!snapshot) return;
		const q = new URLSearchParams({ run, peptide });
		if (selectedId) q.set('ae', selectedId);
		history.replaceState(history.state, '', `?${q}`);
	});

	function choose(r: string, p: string) {
		run = r;
		peptide = p;
		selectedId = null;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') selectedId = null;
	}
</script>

<svelte:window {onkeydown} />

<header class="topbar">
	<div class="wrap bar">
		<div class="brand">
			<span class="logo"><Logo size={52} /></span>
			<div>
				<h1>Foresight</h1>
				<p>Predicted adverse events and the reasoning behind them</p>
			</div>
		</div>
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
						{#each snapshot.peptides as p (p)}<option value={p}>{p}</option>{/each}
					</select>
				</label>
			</div>
		{/if}
	</div>
</header>

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

		<ul class="stats" aria-label="Summary">
			<li><strong>{cards.length}</strong> predicted AEs</li>
			<li><strong>{groups.length}</strong> organ classes</li>
			<li class="g"><strong>{counts.strong}</strong> strong</li>
			<li><strong>{counts.moderate}</strong> moderate</li>
			<li class="o"><strong>{counts.weak}</strong> weak</li>
			<li><strong>{entry.rag.chunk_count}</strong> retrieved chunks</li>
		</ul>

		<div class="layout" class:has-detail={!!selected}>
			<div class="groups">
				{#each groups as g (g.soc)}
					<section class="group" aria-labelledby="soc-{g.soc}">
						<h3 id="soc-{g.soc}">{g.soc} <span>{g.cards.length}</span></h3>
						<div class="cards">
							{#each g.cards as c (c.prediction.id)}
								<AeCard
									card={c}
									{maxFreq}
									selected={c.prediction.id === selectedId}
									onselect={() =>
										(selectedId = selectedId === c.prediction.id ? null : c.prediction.id)}
								/>
							{/each}
						</div>
					</section>
				{/each}
				<p class="legend">
					Cards are sorted from strongest to weakest stated evidence. A dashed card means the run had
					no per-AE record, so its evidence comes from the protein reasoning that names it.
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
		padding: 0 24px;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: rgba(11, 11, 11, 0.92);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--line);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-block: 14px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.logo {
		display: grid;
		place-items: center;
	}
	h1 {
		margin: 0;
		font-size: 1.15rem;
		letter-spacing: 0.02em;
	}
	.brand p {
		margin: 0;
		color: var(--faint);
		font-size: 0.8rem;
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
		color: var(--white);
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
		color: var(--white);
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
		color: var(--white);
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
			padding: 0 16px;
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
			background: rgba(0, 0, 0, 0.6);
		}
		.detail {
			position: fixed;
			inset: auto 0 0 0;
			top: 15vh;
			max-height: none;
			z-index: 20;
			border-radius: var(--radius) var(--radius) 0 0;
			box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.6);
		}
	}
</style>
