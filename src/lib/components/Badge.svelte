<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		tone?: 'green' | 'orange' | 'orange-solid' | 'neutral';
		children: Snippet;
	}
	let { tone = 'neutral', children }: Props = $props();
</script>

<span class="badge {tone}">{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-radius: 999px;
		padding: 1px 9px;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.6;
		white-space: nowrap;
		border: 1px solid var(--line-strong);
		color: var(--muted);
	}
	.green {
		color: var(--green);
		border-color: var(--green);
		background: var(--green-soft);
	}
	.orange {
		color: var(--orange);
		border-color: var(--orange);
		background: var(--orange-soft);
	}
	.orange-solid {
		color: var(--black);
		background: var(--orange);
		border-color: var(--orange);
	}
</style>
