<script lang="ts">
	import type { AeCardData } from '../types';
	import { SEVERITY_LABEL } from '../evidence';
	import Badge from './Badge.svelte';
	import { severityTone, strengthTone } from './tones';

	interface Props {
		card: AeCardData;
		selected: boolean;
		maxFreq: number;
		onselect: () => void;
	}
	let { card, selected, maxFreq, onselect }: Props = $props();

	const p = $derived(card.prediction);
	const proteins = $derived([...new Set(card.evidence.flatMap((r) => r.proteins))]);
	const snippet = $derived(
		(card.primary?.evidence ?? card.primary?.mechanistic_chain ?? '').replace(/^(?:Chain|Mechanistic chain)\s*:\s*/i, '') || null
	);
	const width = $derived(p.frequency_pct != null && maxFreq > 0 ? Math.max(3, (p.frequency_pct / maxFreq) * 100) : 0);
</script>

<button
	class="card"
	class:selected
	class:inferred={p.evidence_status === 'inferred'}
	class:none={p.evidence_status === 'none'}
	aria-pressed={selected}
	onclick={onselect}
>
	<div class="top">
		<h4>{p.term}</h4>
		<Badge tone={severityTone(p.severity_normalized)}>{SEVERITY_LABEL[p.severity_normalized]}</Badge>
	</div>

	<div class="freq" aria-label="Predicted frequency {p.frequency_text ?? 'unknown'}">
		<span class="freq-value">{p.frequency_text ?? '–'}</span>
		<span class="bar"><span style="width: {width}%"></span></span>
	</div>

	<div class="meta">
		<Badge tone={strengthTone(card.strength)}>
			{card.strength ? `${card.strength} evidence` : 'strength not stated'}
		</Badge>
		{#if p.evidence_status === 'inferred'}
			<span class="note">from protein reasoning</span>
		{:else if p.evidence_status === 'none'}
			<span class="note warn">no evidence found</span>
		{/if}
	</div>

	{#if proteins.length}
		<ul class="proteins" aria-label="Proteins">
			{#each proteins.slice(0, 5) as pr (pr)}<li>{pr}</li>{/each}
			{#if proteins.length > 5}<li class="more">+{proteins.length - 5}</li>{/if}
		</ul>
	{/if}

	{#if snippet}<p class="snippet">{snippet}</p>{/if}
</button>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		text-align: left;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 14px 16px;
		cursor: pointer;
		transition:
			border-color 0.15s,
			transform 0.15s,
			background 0.15s;
	}
	.card:hover {
		border-color: var(--line-strong);
		background: var(--surface-2);
	}
	.card.selected {
		border-color: var(--green);
		box-shadow: 0 0 0 1px var(--green);
		background: var(--surface-2);
	}
	.card.inferred {
		border-style: dashed;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}
	h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 650;
		line-height: 1.3;
	}
	.freq {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.freq-value {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		min-width: 3.4em;
	}
	.bar {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: var(--line);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--green);
		border-radius: 3px;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.note {
		font-size: 0.75rem;
		color: var(--faint);
	}
	.note.warn {
		color: var(--orange);
	}
	.proteins {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.proteins li {
		font-family: var(--mono);
		font-size: 0.72rem;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--black);
		border: 1px solid var(--line);
		color: var(--white);
	}
	.proteins .more {
		color: var(--faint);
	}
	.snippet {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
