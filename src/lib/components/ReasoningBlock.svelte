<script lang="ts">
	interface Props {
		thinking: string;
		response: string;
	}
	let { thinking, response }: Props = $props();

	let tab = $state<'thinking' | 'response'>('thinking');
	let expanded = $state(false);
	const text = $derived(tab === 'thinking' ? thinking : response);
	const paragraphs = $derived(
		text
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter(Boolean)
	);
</script>

<section class="reasoning" aria-labelledby="reasoning-title">
	<div class="head">
		<h2 id="reasoning-title">Overall reasoning</h2>
		<div class="tabs" role="tablist" aria-label="Reasoning source">
			<button role="tab" aria-selected={tab === 'thinking'} onclick={() => (tab = 'thinking')}>
				Thinking summary
			</button>
			<button role="tab" aria-selected={tab === 'response'} onclick={() => (tab = 'response')}>
				Full response reasoning
			</button>
		</div>
	</div>

	{#if text}
		<div class="body" class:expanded>
			{#each paragraphs as p, i (i)}
				<p>{p.replace(/\*\*/g, '')}</p>
			{/each}
		</div>
		<button class="toggle" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
			{expanded ? 'Show less' : 'Read all'}
		</button>
	{:else}
		<p class="empty">No {tab === 'thinking' ? 'thinking summary' : 'response reasoning'} in this run.</p>
	{/if}
</section>

<style>
	.reasoning {
		background: var(--surface);
		border: 1px solid var(--line);
		border-left: 3px solid var(--green);
		border-radius: var(--radius);
		padding: 20px 24px;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.tabs {
		display: flex;
		gap: 4px;
		background: var(--black);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 3px;
	}
	.tabs button {
		background: none;
		border: 0;
		border-radius: 999px;
		padding: 4px 12px;
		color: var(--muted);
		cursor: pointer;
		font-size: 0.85rem;
	}
	.tabs button[aria-selected='true'] {
		background: var(--green);
		color: var(--black);
		font-weight: 600;
	}
	.body {
		max-height: 15.5em;
		overflow: hidden;
		position: relative;
		color: var(--muted);
	}
	.body::after {
		content: '';
		position: absolute;
		inset: auto 0 0 0;
		height: 4em;
		background: linear-gradient(transparent, var(--surface));
	}
	.body.expanded {
		max-height: none;
	}
	.body.expanded::after {
		display: none;
	}
	.body p {
		margin: 0 0 0.8em;
		white-space: pre-wrap;
	}
	.toggle {
		margin-top: 8px;
		background: none;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 4px 14px;
		cursor: pointer;
		color: var(--white);
	}
	.toggle:hover {
		border-color: var(--green);
	}
	.empty {
		color: var(--faint);
	}
</style>
