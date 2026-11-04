<script lang="ts">
	// The Foresight wordmark. The dark-mode copy only lightens the green so it reads on black;
	// CSS shows the one that matches the theme (lazy, so only the visible one is fetched).
	import logo from '#lib/assets/foresight-logo.svg';
	import logoDark from '#lib/assets/foresight-logo-dark.svg';

	let { height = 40 }: { height?: number } = $props();
	// the artwork is 5292 x 1152
	const width = $derived(Math.round((height * 5292) / 1152));
</script>

<span class="wordmark" style="height: {height}px">
	<img class="on-light" src={logo} {width} {height} alt="Foresight, powered by Darwin Ai" loading="lazy" />
	<img class="on-dark" src={logoDark} {width} {height} alt="Foresight, powered by Darwin Ai" loading="lazy" />
</span>

<style>
	.wordmark {
		display: inline-flex;
	}
	img {
		display: block;
		max-width: 100%;
		height: 100%;
		width: auto;
	}
	.on-light {
		display: none;
	}
	:global(:root[data-theme='light']) .on-light {
		display: block;
	}
	:global(:root[data-theme='light']) .on-dark {
		display: none;
	}
</style>
