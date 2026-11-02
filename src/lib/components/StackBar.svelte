<script lang="ts">
	export interface Segment {
		label: string;
		value: number;
		color: string;
	}
	interface Props {
		label: string;
		segments: Segment[];
	}
	let { label, segments }: Props = $props();
	const total = $derived(segments.reduce((n, s) => n + s.value, 0));
	const shown = $derived(segments.filter((s) => s.value > 0));
</script>

<figure class="stack">
	<figcaption>{label}</figcaption>
	{#if total}
		<div class="bar" role="img" aria-label="{label}: {shown.map((s) => `${s.value} ${s.label}`).join(', ')}">
			{#each shown as s (s.label)}
				<span
					class="seg"
					style="flex-grow: {s.value}; background: {s.color}"
					title="{s.label}: {s.value} of {total} ({Math.round((100 * s.value) / total)}%)"
				></span>
			{/each}
		</div>
		<ul class="key">
			{#each shown as s (s.label)}
				<li><span class="sw" style="background: {s.color}"></span>{s.label} <strong>{s.value}</strong></li>
			{/each}
		</ul>
	{:else}
		<p class="none">Not reported in this run</p>
	{/if}
</figure>

<style>
	.stack {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	figcaption {
		color: var(--faint);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.bar {
		display: flex;
		gap: 2px;
		height: 10px;
	}
	.seg {
		flex-basis: 0;
		min-width: 4px;
		border-radius: 3px;
	}
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.key li {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.key strong {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.sw {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}
	.none {
		margin: 0;
		font-size: 0.8rem;
		color: var(--faint);
	}
</style>
