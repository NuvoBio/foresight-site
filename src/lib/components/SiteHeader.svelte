<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Logo from './Logo.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let { children }: { children?: Snippet } = $props();
	const onSummary = $derived(page.route.id === '/');
</script>

<header class="topbar">
	<div class="wrap bar">
		<a class="brand" href={resolve('/')} aria-label="Foresight home">
			<Logo height={50} />
		</a>
		<nav aria-label="Pages">
			<a href={resolve('/')} aria-current={onSummary ? 'page' : undefined}>Summary</a>
			<a href={resolve('/explore')} aria-current={!onSummary ? 'page' : undefined}>Explorer</a>
		</nav>
		<div class="right">
			{@render children?.()}
			<ThemeToggle />
		</div>
	</div>
</header>

<style>
	.wrap {
		max-width: 1440px;
		margin: 0 auto;
		padding-inline: 24px;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--topbar-bg);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--line);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 24px;
		padding-block: 12px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		color: inherit;
		text-decoration: none;
	}
	nav {
		display: flex;
		gap: 4px;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 3px;
	}
	nav a {
		color: var(--muted);
		text-decoration: none;
		font-size: 0.88rem;
		padding: 4px 14px;
		border-radius: 999px;
	}
	nav a:hover {
		color: var(--text);
	}
	nav a[aria-current='page'] {
		background: var(--green);
		color: var(--on-accent);
		font-weight: 600;
	}
	.right {
		margin-left: auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	@media (max-width: 900px) {
		.wrap {
			padding-inline: 16px;
		}
		.right {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
