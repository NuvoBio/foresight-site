<script lang="ts">
	import { theme, toggleTheme } from '../theme.svelte';
	const light = $derived(theme.current === 'light');
</script>

<button
	class="toggle"
	onclick={toggleTheme}
	aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
	title={light ? 'Switch to dark mode' : 'Switch to light mode'}
>
	{#if light}
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
	{:else}
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		</svg>
	{/if}
	<span>{light ? 'Dark' : 'Light'}</span>
</button>

<style>
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--surface);
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 5px 12px 5px 9px;
		cursor: pointer;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.toggle:hover {
		border-color: var(--green);
		color: var(--text);
	}
	svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
