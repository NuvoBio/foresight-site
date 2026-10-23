<script lang="ts">
	import logo from '#lib/assets/favicon.svg';

	let { size = 32 }: { size?: number } = $props();
</script>

<img src={logo} width={size} height={size} alt="" />
