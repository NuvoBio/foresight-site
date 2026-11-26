<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import KgGraph, { type Selection } from '#lib/components/KgGraph.svelte';
	import {
		EXTRA_PROTEIN_COLOUR,
		KG_PATH,
		LITERATURE_COLOUR,
		OTHER_COLOUR,
		TYPE_COLOURS,
		edgeText,
		isNegated,
		loadKg,
		nodeLabel,
		peptideSubgraph,
		type Kg,
		type KgEdge
	} from '../../lib/kg';

	let kg = $state.raw<Kg | null>(null);
	let error = $state<string | null>(null);
	let peptide = $state('');
	let maxProteins = $state(10);
	let maxNeighbours = $state(30);
	let maxOutcomes = $state(4); // outcomes followed out of each drug or compound
	let extras = $state(true);
	let hidden = $state<string[]>([]); // edge origins switched off
	let selected = $state<Selection>(null);
	let graph: KgGraph | undefined = $state();

	onMount(() => {
		const q = new URLSearchParams(location.search);
		const int = (k: string, d: number, min = 1) => {
			const v = Number(q.get(k));
			// q.get returns null for a missing param, and Number(null) is 0, so ask first
			return q.has(k) && Number.isInteger(v) && v >= min ? v : d;
		};
		maxProteins = int('proteins', 10);
		maxNeighbours = int('neighbours', 30);
		maxOutcomes = int('outcomes', 4, 0);
		extras = q.get('extras') !== '0';
		loadKg()
			.then((g) => {
				const want = q.get('peptide') ?? '';
				const ids = g.peptides.map((p) => p.replace(/^peptide:/, ''));
				peptide = ids.includes(want) ? want : (ids[0] ?? '');
				kg = g;
			})
			.catch((e) => (error = (e as Error).message));
	});

	const origins = $derived(
		kg ? [...new Set(kg.edges.map((e) => e.origin))].filter((o) => o && o !== 'shortlist').sort() : []
	);
	const sub = $derived(
		kg && peptide
			? peptideSubgraph(kg, peptide, {
					maxProteins,
					maxNeighbours,
					maxOutcomes,
					extras,
					origins: new Set(origins.filter((o) => !hidden.includes(o)))
				})
			: null
	);
	$effect(() => {
		void sub;
		selected = null;
	});
	const proteins = $derived(
		sub ? sub.nodes.filter((n) => sub.rank.has(n.node_id)).sort((a, b) => sub.rank.get(a.node_id)! - sub.rank.get(b.node_id)!) : []
	);
	const literatureEdges = $derived(sub ? sub.edges.filter((e) => e.origin === 'literature') : []);
	const typesShown = $derived(sub ? [...new Set(sub.nodes.map((n) => n.type || 'other'))] : []);

	$effect(() => {
		if (!kg || !peptide) return;
		const q = new URLSearchParams({ peptide });
		if (maxProteins !== 10) q.set('proteins', String(maxProteins));
		if (maxNeighbours !== 30) q.set('neighbours', String(maxNeighbours));
		if (maxOutcomes !== 4) q.set('outcomes', String(maxOutcomes));
		if (!extras) q.set('extras', '0');
		goto(`?${q}`, { replace: true, shallow: true });
	});

	function focus(sel: Selection) {
		selected = sel;
	}

	const selNode = $derived(selected?.kind === 'node' && kg ? (kg.nodes.get(selected.id) ?? null) : null);
	const selEdge = $derived(selected?.kind === 'edge' && sub ? (sub.edges[selected.index] ?? null) : null);
	const selNodeEdges = $derived(
		selNode && sub ? sub.edges.filter((e) => e.source_node === selNode.node_id || e.target_node === selNode.node_id) : []
	);

	const name = (id: string) => nodeLabel(kg?.nodes.get(id), id);
	const SKIP = new Set(['node_id', 'type', 'name', 'source_node', 'target_node', 'key', 'provenance']);
	const fields = (r: Record<string, unknown>) =>
		Object.entries(r).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v)));
	const pmidOf = (e: KgEdge) => {
		const m = String(e.pmid ?? e.doc_id ?? '').match(/(\d{5,9})/);
		return m ? m[1] : null;
	};

	function toggleOrigin(o: string) {
		hidden = hidden.includes(o) ? hidden.filter((x) => x !== o) : [...hidden, o];
	}
	function fit() {
		graph?.fit();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (selected = null)} />
<svelte:head><title>Graph · Foresight</title></svelte:head>

<SiteHeader>
	{#if kg && kg.peptides.length}
		<div class="controls">
			<label>
				<span>Peptide</span>
				<select bind:value={peptide}>
					{#each kg.peptides as p (p)}
						{@const id = p.replace(/^peptide:/, '')}
						<option value={id}>{id}</option>
					{/each}
				</select>
			</label>
		</div>
	{/if}
</SiteHeader>

<main class="wrap">
	{#if error}
		<div class="status error">
			<p><strong>Could not load the knowledge graph.</strong> {error}</p>
			<p>
				The page reads <code>static/{KG_PATH}</code>, which <code>npm run dev</code> links to
				<code>$SKEIN_DIR/data/processed/kg/kg.sqlite</code> (default <code>../skein</code>). Run
				<code>python -m skein.data.construction.construct_kg</code> in skein, or start the site with
				<code>SKEIN_DIR=/path/to/skein npm run dev</code>.
			</p>
		</div>
	{:else if !kg}
		<p class="status">Loading knowledge graph…</p>
	{:else if !kg.peptides.length}
		<p class="status">kg.sqlite has no peptide nodes yet.</p>
	{:else if sub}
		<div class="title-row">
			<h2>
				{peptide}
				<span>
					· top {Math.min(maxProteins, sub.rank.size)} ranked proteins{#if sub.extra.size}&nbsp;+ {sub.extra.size} lower-ranked with literature relations{/if}
				</span>
			</h2>
			<p class="meta">
				{sub.nodes.length} of {kg.nodes.size} nodes · {sub.edges.length} of {kg.edges.length} edges{#if kg.meta.built_at}&nbsp;· built {kg.meta.built_at}{/if}
			</p>
		</div>

		<div class="toolbar">
			<label class="num">
				<span>Proteins</span>
				<input type="number" min="1" max="200" bind:value={maxProteins} />
			</label>
			<label class="num">
				<span>Neighbours</span>
				<input type="number" min="0" max="500" bind:value={maxNeighbours} />
			</label>
			<label class="num" title="Reported events and warnings followed out of each drug or compound">
				<span>Per drug</span>
				<input type="number" min="0" max="50" bind:value={maxOutcomes} />
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={extras} />
				<span>Lower-ranked proteins with literature</span>
			</label>
			<div class="origins" role="group" aria-label="Edge sources">
				<span>Sources</span>
				{#each origins as o (o)}
					<button class="chip" class:off={hidden.includes(o)} aria-pressed={!hidden.includes(o)} onclick={() => toggleOrigin(o)}>
						{#if o === 'literature'}<i class="line lit"></i>{:else}<i class="line"></i>{/if}{o}
					</button>
				{/each}
			</div>
			<button class="ghost" onclick={fit}>Fit</button>
		</div>

		<ul class="legend" aria-label="Node types">
			{#each typesShown as t (t)}
				<li><i style:background={t === 'peptide' ? 'var(--text)' : (TYPE_COLOURS[t] ?? OTHER_COLOUR)}></i>{t.replaceAll('_', ' ')}</li>
			{/each}
			{#if sub.extra.size}<li><i style:background={EXTRA_PROTEIN_COLOUR}></i>protein (lower rank, has literature)</li>{/if}
			<li><i class="line lit"></i>literature relation</li>
		</ul>

		<div class="layout">
			<div class="graph">
				<KgGraph bind:this={graph} {sub} {selected} onselect={focus} label="Knowledge graph for {peptide}" />
			</div>

			<aside class="panel">
				{#if selEdge}
					<p class="kicker">{selEdge.origin} relation</p>
					<h3>
						<button class="link" onclick={() => focus({ kind: 'node', id: selEdge.source_node })}>{name(selEdge.source_node)}</button>
						<span class="pred" class:neg={isNegated(selEdge)}>{isNegated(selEdge) ? 'NOT ' : ''}{String(selEdge.predicate).replaceAll('_', ' ')}</span>
						<button class="link" onclick={() => focus({ kind: 'node', id: selEdge.target_node })}>{name(selEdge.target_node)}</button>
					</h3>
					{#if selEdge.evidence}<blockquote>{selEdge.evidence}</blockquote>{/if}
					{#if selEdge.document}<p class="doc">{selEdge.document}</p>{/if}
					{#if pmidOf(selEdge)}
						<p><a href="https://pubmed.ncbi.nlm.nih.gov/{pmidOf(selEdge)}/" target="_blank" rel="noreferrer">PubMed {pmidOf(selEdge)} ↗</a></p>
					{/if}
					<dl>
						{#each fields(selEdge).filter(([k]) => !['predicate', 'evidence', 'document', 'negated'].includes(k)) as [k, v] (k)}
							<dt>{k.replaceAll('_', ' ')}</dt><dd>{v}</dd>
						{/each}
					</dl>
				{:else if selNode}
					<p class="kicker">{selNode.type.replaceAll('_', ' ')}{#if sub.rank.has(selNode.node_id)}&nbsp;· rank #{sub.rank.get(selNode.node_id)}{/if}</p>
					<h3>{selNode.name || selNode.node_id}</h3>
					<dl>
						<dt>id</dt><dd><code>{selNode.node_id}</code></dd>
						{#each fields(selNode) as [k, v] (k)}<dt>{k.replaceAll('_', ' ')}</dt><dd>{v}</dd>{/each}
					</dl>
					<h4>Edges in view ({selNodeEdges.length})</h4>
					<ul class="edges">
						{#each selNodeEdges as e (sub.edges.indexOf(e))}
							{@const out = e.source_node === selNode.node_id}
							<li>
								<button class="row" onclick={() => focus({ kind: 'edge', index: sub.edges.indexOf(e) })}>
									<span class="o {e.origin}">{e.origin}</span>
									<span>{out ? '→' : '←'} {edgeText(e) || String(e.predicate).replaceAll('_', ' ')}</span>
									<strong>{name(out ? e.target_node : e.source_node)}</strong>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="kicker">Proteins in view</p>
					<ul class="edges">
						{#each proteins as p (p.node_id)}
							<li>
								<button class="row" onclick={() => focus({ kind: 'node', id: p.node_id })}>
									<span class="rank" class:extra={sub.extra.has(p.node_id)}>#{sub.rank.get(p.node_id)}</span>
									<strong>{nodeLabel(p, p.node_id)}</strong>
									<span class="dim">{p.name}</span>
								</button>
							</li>
						{/each}
					</ul>
					<h4>Literature relations in view ({literatureEdges.length})</h4>
					{#if literatureEdges.length}
						<ul class="edges">
							{#each literatureEdges as e (sub.edges.indexOf(e))}
								<li>
									<button class="row" onclick={() => focus({ kind: 'edge', index: sub.edges.indexOf(e) })}>
										<strong>{name(e.source_node)}</strong>
										<span class="pred" class:neg={isNegated(e)}>{edgeText(e)}</span>
										<strong>{name(e.target_node)}</strong>
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="dim">None for these proteins.</p>
					{/if}
					<p class="hint">Click a node or edge for details. Esc clears.</p>
				{/if}
			</aside>
		</div>
	{/if}
</main>

<style>
	.wrap {
		max-width: 1440px;
		margin: 0 auto;
		padding: 20px 24px 40px;
	}
	.controls {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.controls label,
	.toolbar label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.82rem;
		color: var(--muted);
	}
	select,
	input[type='number'] {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: 8px;
		padding: 4px 8px;
		font: inherit;
		font-size: 0.88rem;
	}
	input[type='number'] {
		width: 70px;
	}
	.status {
		color: var(--muted);
		padding: 40px 0;
	}
	.status.error {
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 16px 20px;
	}
	code {
		font-family: var(--mono);
		font-size: 0.85em;
	}
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
	}
	h2 {
		margin: 0;
		font-size: 1.35rem;
	}
	h2 span {
		color: var(--muted);
		font-weight: 400;
		font-size: 1rem;
	}
	.meta {
		margin: 0;
		color: var(--faint);
		font-size: 0.82rem;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 20px;
		margin: 14px 0 8px;
	}
	.check input {
		accent-color: var(--green);
	}
	.origins {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		border-radius: 999px;
		padding: 2px 10px;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.chip.off {
		opacity: 0.45;
		text-decoration: line-through;
	}
	.ghost {
		margin-left: auto;
		border: 1px solid var(--line-strong);
		background: transparent;
		border-radius: 8px;
		padding: 3px 12px;
		font-size: 0.82rem;
		cursor: pointer;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.legend i:not(.line) {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
	}
	.line {
		display: inline-block;
		width: 16px;
		height: 0;
		border-top: 1.5px solid var(--line-strong);
	}
	.line.lit {
		border-top: 2px solid #e08a1e;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 360px;
		gap: 16px;
	}
	.graph {
		height: calc(100vh - 250px);
		min-height: 480px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--card-shadow);
	}
	.panel {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 16px 18px;
		max-height: calc(100vh - 250px);
		min-height: 480px;
		overflow: auto;
		font-size: 0.88rem;
		box-shadow: var(--card-shadow);
	}
	.kicker {
		margin: 0 0 4px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.72rem;
		color: var(--faint);
	}
	h3 {
		margin: 0 0 10px;
		font-size: 1.05rem;
		line-height: 1.35;
	}
	h4 {
		margin: 18px 0 6px;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.pred {
		color: #e08a1e;
		font-weight: 600;
		margin: 0 4px;
	}
	.pred.neg {
		color: var(--red);
	}
	blockquote {
		margin: 0 0 10px;
		padding: 8px 12px;
		border-left: 3px solid #e08a1e;
		background: var(--surface-2);
		border-radius: 0 8px 8px 0;
		line-height: 1.45;
	}
	.doc {
		font-style: italic;
		color: var(--muted);
		margin: 0 0 6px;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 3px 12px;
		margin: 8px 0 0;
		font-size: 0.82rem;
	}
	dt {
		color: var(--faint);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.edges {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 8px;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid var(--line);
		padding: 6px 2px;
		cursor: pointer;
		font-size: 0.84rem;
	}
	.row:hover {
		background: var(--surface-2);
	}
	.rank {
		font-family: var(--mono);
		color: var(--muted);
		min-width: 3ch;
	}
	.rank.extra {
		color: #6fa8e6;
	}
	.o {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--faint);
	}
	.o.literature {
		color: #e08a1e;
	}
	.dim {
		color: var(--faint);
		font-size: 0.8rem;
	}
	.hint {
		margin-top: 16px;
		color: var(--faint);
		font-size: 0.78rem;
	}
	.link {
		background: none;
		border: none;
		padding: 0;
		color: var(--green);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	@media (max-width: 900px) {
		.wrap {
			padding-inline: 16px;
		}
		.layout {
			grid-template-columns: 1fr;
		}
		.graph {
			height: 60vh;
			min-height: 360px;
		}
		.panel {
			max-height: none;
			min-height: 0;
		}
		.ghost {
			margin-left: 0;
		}
	}
</style>
