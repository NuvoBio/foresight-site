<script lang="ts">
	let { size = 32 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
	<g stroke="var(--green)" stroke-width="2" stroke-linecap="round">
		<path d="M16 3v3.5M8.5 5.5l1.8 2.8M23.5 5.5l-1.8 2.8" />
	</g>
	<path
		d="M2.5 18C7 11.5 11.3 9.5 16 9.5S25 11.5 29.5 18C25 24.5 20.7 26.5 16 26.5S7 24.5 2.5 18Z"
		fill="none"
		stroke="var(--green)"
		stroke-width="2.2"
		stroke-linejoin="round"
	/>
	<circle cx="16" cy="18" r="6" fill="var(--orange)" />
	<path d="M16 13.2c1.4 1.6 1.4 8 0 9.6c-1.4-1.6-1.4-8 0-9.6Z" fill="var(--black)" />
	<circle cx="18.6" cy="15.6" r="1.2" fill="var(--white)" />
</svg>
