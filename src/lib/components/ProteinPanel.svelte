<script lang="ts">
	import type { AeCardData, Entry, ProteinInfo } from '../types';
	import { LOCATION_LABEL, PLAUSIBILITY_LABEL, plausibilityReason } from '../evidence';
	import { proteinsOf } from '../summary';
	import Badge from './Badge.svelte';

	interface Props {
		entry: Entry;
		cards: AeCardData[];
		onselect: (predictionId: string) => void;
	}
	let { entry, cards, onselect }: Props = $props();

	const ORDER: Record<string, number> = { likely: 0, uncertain: 1, unlikely: 2 };
	// intended target first, then by triage verdict, keeping the list order within each
	const proteins = $derived(
		proteinsOf(entry)
			.map((p, i) => ({ p, i }))
			.sort(
				(a, b) =>
					Number(b.p.is_target) - Number(a.p.is_target) ||
					(ORDER[a.p.plausibility_class ?? ''] ?? 3) - (ORDER[b.p.plausibility_class ?? ''] ?? 3) ||
					a.i - b.i
			)
			.map(({ p }) => p)
	);
	const hasLocations = $derived(proteins.some((p) => p.location_class !== 'unknown'));
	const hasTriage = $derived(proteins.some((p) => p.plausibility_class));
	const hasRank = $derived(proteins.some((p) => p.rank != null));
	/** the triage reason, unless it only repeats the verdict ('likely perturbed') */
	function reason(p: ProteinInfo): string | null {
		const r = plausibilityReason(p.plausibility);
		if (!r) return null;
		return /^(?:likely|unlikely|uncertain)(?:\s+perturbed)?\.?$/i.test(r.trim()) ? null : r;
	}
	const termById = $derived(new Map(cards.map((c) => [c.prediction.id, c.prediction.term])));
	const count = (f: (p: ProteinInfo) => boolean) => proteins.filter(f).length;
</script>

{#if proteins.length}
	<details class="panel">
		<summary>
			<span class="title">Proteins and triage</span>
			<span class="chips">
				<span class="n">{entry.protein_list_size ?? proteins.length} proteins</span>
				{#if hasTriage}
					{#each [['likely', 'green'], ['uncertain', 'orange'], ['unlikely', 'orange-solid']] as const as [cls, tone] (cls)}
						{@const n = count((p) => p.plausibility_class === cls)}
						{#if n}<Badge {tone}>{n} {cls}</Badge>{/if}
					{/each}
				{/if}
				{#if hasLocations}
					<span class="n">
						{count((p) => p.location_class === 'cell_surface')} surface ·
						{count((p) => p.location_class === 'secreted')} secreted ·
						{count((p) => p.location_class === 'intracellular')} intracellular
					</span>
				{/if}
			</span>
		</summary>

		{#if !hasLocations || !hasTriage}
			<p class="note">
				{#if !hasTriage}This run has no Step 1 triage verdicts.{/if}
				{#if !hasLocations}No subcellular locations in this snapshot; rebuild it with
					<code>--protein-lists</code> to add them.{/if}
			</p>
		{/if}

		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th scope="col">Protein</th>
						{#if hasLocations}<th scope="col">Location</th>{/if}
						{#if hasRank}<th scope="col" class="num">Rank</th>{/if}
						<th scope="col">Predicted AEs</th>
					</tr>
				</thead>
				<tbody>
					{#each proteins as p (p.gene)}
						<tr class:dim={p.plausibility_class === 'unlikely'}>
							<td class="prot">
								<span class="gene">
									{#if p.plausibility_class}
										<span
											class="dot {p.plausibility_class}"
											title={PLAUSIBILITY_LABEL[p.plausibility_class]}
											aria-label={PLAUSIBILITY_LABEL[p.plausibility_class]}
										></span>
									{/if}
									{p.gene}
								</span>
								{#if p.is_target}<span class="target" title="Intended target">target</span>{/if}
								{#if p.name}<span class="sub">{p.name}</span>{/if}
								{#if reason(p)}<span class="sub why">{reason(p)}</span>{/if}
							</td>
							{#if hasLocations}
								<td>
									<span class="loc {p.location_class}">{LOCATION_LABEL[p.location_class]}</span>
									{#if p.subcellular_location}<span class="sub">{p.subcellular_location}</span>{/if}
								</td>
							{/if}
							{#if hasRank}<td class="num">{p.rank ?? '–'}</td>{/if}
							<td>
								{#if p.prediction_ids.length}
									<span class="aes">
										{#each p.prediction_ids as id (id)}
											<button onclick={() => onselect(id)}>{termById.get(id) ?? id}</button>
										{/each}
									</span>
								{:else}<span class="sub">None</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
{/if}

<style>
	.panel {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 12px 18px;
		box-shadow: var(--card-shadow);
	}
	summary {
		cursor: pointer;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}
	.title {
		font-weight: 650;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.n {
		color: var(--faint);
		font-size: 0.82rem;
	}
	.note {
		color: var(--faint);
		font-size: 0.82rem;
		margin: 12px 0 0;
	}
	code {
		font-family: var(--mono);
		font-size: 0.8rem;
	}
	.scroll {
		overflow-x: auto;
		margin-top: 12px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	th {
		text-align: left;
		color: var(--faint);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 6px 10px 6px 0;
		border-bottom: 1px solid var(--line);
	}
	td {
		padding: 8px 10px 8px 0;
		border-bottom: 1px solid var(--line);
		vertical-align: top;
	}
	tr.dim td {
		opacity: 0.7;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.gene {
		font-family: var(--mono);
		font-weight: 600;
	}
	.prot {
		width: 260px;
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 6px;
		vertical-align: 1px;
		background: var(--line-strong);
	}
	.dot.likely {
		background: var(--green);
	}
	/* same encoding as the header tags: uncertain = orange outline, unlikely = solid orange */
	.dot.uncertain {
		background: var(--orange-soft);
		box-shadow: inset 0 0 0 1.5px var(--orange);
	}
	.dot.unlikely {
		background: var(--orange);
	}
	.why {
		font-style: italic;
	}
	.target {
		margin-left: 6px;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--green);
		border: 1px solid var(--green);
		border-radius: 4px;
		padding: 0 4px;
	}
	.sub {
		display: block;
		color: var(--faint);
		font-size: 0.78rem;
		max-width: 46ch;
		margin-top: 2px;
	}
	.loc {
		font-weight: 600;
	}
	.loc.intracellular {
		color: var(--orange);
	}
	.loc.unknown {
		color: var(--faint);
		font-weight: 400;
	}
	.aes {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.aes button {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 1px 7px;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.aes button:hover {
		border-color: var(--green);
	}
</style>
