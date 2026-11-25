<script lang="ts">
	// The cited mechanism of one prediction as a small left-to-right graph:
	// intervention -> protein -> ... -> end of the path, one column per hop.
	// Laid out once with d3-force (columns fixed in x, spread in y); no zoom.
	import * as d3 from 'd3';
	import { EXTRA_PROTEIN_COLOUR, OTHER_COLOUR, TYPE_COLOURS } from '../kg';
	import type { KgContextEdge, KgContextNode } from '../kgPredictions';

	interface Props {
		nodes: KgContextNode[];
		edges: KgContextEdge[];
		paths: string[][];
		/** gene symbols or names of the proteins the record names */
		proteins?: string[];
		/** steps the model supplied without a graph edge, as "a -> b" */
		inferred?: string[];
		height?: number;
	}
	let { nodes, edges, paths, proteins = [], inferred = [], height = 220 }: Props = $props();

	const WIDTH = 420;

	interface LNode extends d3.SimulationNodeDatum {
		id: string;
		label: string;
		type: string;
		layer: number;
		r: number;
		inferred?: boolean;
	}
	interface LEdge {
		id: string;
		source: string;
		target: string;
		edge?: KgContextEdge;
		text: string;
	}

	const label = (n: KgContextNode) => {
		const t = String(n.gene || n.name || n.node_id.split(':').slice(1).join(':') || n.node_id);
		return t.length > 34 ? `${t.slice(0, 33)}…` : t;
	};

	const layout = $derived.by(() => {
		const byId = new Map(nodes.map((n) => [n.node_id, n]));
		const edgeById = new Map(edges.map((e) => [e.edge_id, e]));
		// column = hop index along the cited paths (shortest when paths converge)
		const layer = new Map<string, number>();
		for (const path of paths) {
			let prev: string | null = null;
			path.forEach((eid, i) => {
				const e = edgeById.get(eid);
				if (!e) return;
				const [a, b] = prev === null || prev === e.source ? [e.source, e.target] : [e.target, e.source];
				if (i === 0) layer.set(a, Math.min(layer.get(a) ?? 0, 0));
				layer.set(b, Math.min(layer.get(b) ?? Infinity, i + 1));
				prev = b;
			});
		}
		for (const n of nodes) if (!layer.has(n.node_id)) layer.set(n.node_id, 1);

		// inferred hops become dashed nodes/edges, attached to a graph node when the names match
		const byLabel = new Map(nodes.map((n) => [label(n).toLowerCase(), n.node_id]));
		for (const n of nodes) if (n.name) byLabel.set(n.name.toLowerCase(), n.node_id);
		const extra: KgContextNode[] = [];
		const extraEdges: LEdge[] = [];
		const idFor = (name: string) => {
			const key = name.trim().toLowerCase();
			const hit = byLabel.get(key) ?? byLabel.get(key.replace(/…$/, ''));
			if (hit) return hit;
			const id = `inferred:${key}`;
			if (!byLabel.has(key)) {
				byLabel.set(key, id);
				extra.push({ node_id: id, type: 'inferred', name: name.trim() });
			}
			return id;
		};
		for (const hop of inferred) {
			const parts = hop.split(/\s*(?:->|→)\s*/).filter(Boolean);
			for (let i = 0; i + 1 < parts.length; i++) {
				const a = idFor(parts[i]);
				const b = idFor(parts[i + 1]);
				if (!layer.has(a)) layer.set(a, layer.size ? Math.max(...layer.values()) : 0);
				layer.set(b, Math.max(layer.get(b) ?? 0, layer.get(a)! + 1));
				extraEdges.push({ id: `inf${extraEdges.length}`, source: a, target: b, text: '' });
			}
		}
		const allNodes = [...nodes, ...extra];
		const depth = Math.max(1, ...layer.values());
		const padX = 56;
		const colX = (l: number) => padX + (l / depth) * (WIDTH - 2 * padX);

		const sim: LNode[] = allNodes.map((n, i) => {
			const type = n.type ?? '';
			return {
				inferred: type === 'inferred',
				id: n.node_id,
				label: label(n),
				type,
				layer: layer.get(n.node_id)!,
				r: type === 'peptide' ? 11 : type === 'protein' || type === 'gene' ? 8 : 6,
				x: colX(layer.get(n.node_id)!),
				y: height / 2 + (i % 2 ? 1 : -1) * (6 + i * 4) // deterministic spread, same layout every load
			};
		});
		const links: LEdge[] = [
			...edges
				.filter((e) => byId.has(e.source) && byId.has(e.target))
				.map((e) => ({ id: e.edge_id, source: e.source, target: e.target, edge: e, text: '' })),
			...extraEdges
		];
		const s = d3
			.forceSimulation(sim)
			.force('x', d3.forceX<LNode>((d) => colX(d.layer)).strength(1))
			.force('y', d3.forceY(height / 2).strength(0.08))
			.force('collide', d3.forceCollide<LNode>().radius(26))
			.force(
				'link',
				d3
					.forceLink<LNode, d3.SimulationLinkDatum<LNode>>(
						links.map((l) => ({ source: l.source, target: l.target }))
					)
					.id((d) => d.id)
					.strength(0.2)
			)
			.stop();
		s.tick(200);
		for (const n of sim) n.y = Math.max(34, Math.min(height - 34, n.y ?? height / 2));
		const pos = new Map(sim.map((n) => [n.id, n]));
		return {
			nodes: sim,
			links: links.map((l) => ({ ...l, a: pos.get(l.source)!, b: pos.get(l.target)! }))
		};
	});

	const wanted = $derived(new Set(proteins.map((p) => p.toLowerCase())));
	function colour(n: LNode) {
		if (n.type === 'peptide') return 'var(--text)';
		if (n.inferred) return 'var(--surface-2)';
		if ((n.type === 'protein' || n.type === 'gene') && wanted.size && !wanted.has(n.label.toLowerCase()))
			return EXTRA_PROTEIN_COLOUR;
		return TYPE_COLOURS[n.type] ?? OTHER_COLOUR;
	}
	/** at most two lines of ~16 characters, split on spaces */
	function wrap(text: string): string[] {
		if (text.length <= 16) return [text];
		const words = text.split(' ');
		let first = '';
		while (words.length && (first + ' ' + words[0]).trim().length <= 16) first = (first + ' ' + words.shift()).trim();
		if (!first) return [text.slice(0, 15) + '…'];
		const rest = words.join(' ');
		return [first, rest.length > 16 ? rest.slice(0, 15) + '…' : rest];
	}

	function path(a: LNode, b: LNode) {
		const mx = ((a.x ?? 0) + (b.x ?? 0)) / 2;
		return `M${a.x},${a.y}C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
	}
	const predLabel = (e: KgContextEdge) =>
		(e.negated ? 'NOT ' : '') + String(e.predicate ?? '').replaceAll('_', ' ');
	const tip = (e: KgContextEdge) =>
		`${e.edge_id}: ${e.source_name} ${predLabel(e)} ${e.target_name} (${e.origin ?? ''})` +
		(e.evidence ? `\n"${e.evidence}"` : '');
</script>

<svg viewBox="0 0 {WIDTH} {height}" role="img" aria-label="Knowledge-graph path behind this prediction">
	<defs>
		<marker id="mini-arrow" viewBox="0 -5 10 10" refX="16" markerWidth="6" markerHeight="6" orient="auto">
			<path d="M0,-4L10,0L0,4" fill="#e08a1e" />
		</marker>
	</defs>
	{#each layout.links as l (l.id)}
		{@const e = l.edge}
		<g class="edge" class:lit={e?.origin === 'literature'} class:neg={e?.negated} class:inf={!e}>
			<title>{e ? tip(e) : 'Inferred by the model (no graph edge)'}</title>
			<path d={path(l.a, l.b)} marker-end={e?.origin === 'literature' ? 'url(#mini-arrow)' : undefined} />
			{#if e}
				<text x={((l.a.x ?? 0) + (l.b.x ?? 0)) / 2} y={((l.a.y ?? 0) + (l.b.y ?? 0)) / 2 - 4}>
					{e.predicate === 'predicted_interaction' && e.rank ? `#${Math.round(Number(e.rank))}` : predLabel(e)}
				</text>
			{/if}
		</g>
	{/each}
	{#each layout.nodes as n (n.id)}
		<g class="node" class:peptide={n.type === 'peptide'} class:inf={n.inferred} transform="translate({n.x},{n.y})">
			<title>{n.id} ({n.type})</title>
			<circle r={n.r} style:fill={colour(n)} />
			{#each wrap(n.label) as line, i (i)}
				<!-- alternate labels above/below by column so neighbours don't collide -->
				<text y={n.layer % 2 ? -(n.r + 6) - (wrap(n.label).length - 1 - i) * 12 : n.r + 12 + i * 12}>{line}</text>
			{/each}
		</g>
	{/each}
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: auto;
		font-family: var(--font);
	}
	.edge path {
		fill: none;
		stroke: var(--line-strong);
		stroke-width: 1.2;
	}
	.edge.lit path {
		stroke: #e08a1e;
		stroke-width: 2;
	}
	.edge.neg path {
		stroke-dasharray: 5 3;
	}
	.edge.inf path {
		stroke: var(--faint);
		stroke-dasharray: 2 3;
	}
	.node.inf circle {
		stroke: var(--faint);
		stroke-dasharray: 2 2;
	}
	.node.inf text {
		fill: var(--muted);
		font-style: italic;
	}
	.edge text {
		font-size: 9px;
		text-anchor: middle;
		fill: var(--muted);
		paint-order: stroke;
		stroke: var(--surface-2);
		stroke-width: 3px;
	}
	.edge.lit text {
		fill: #e08a1e;
		font-weight: 600;
	}
	.edge.neg text {
		fill: var(--red);
	}
	.node circle {
		stroke: var(--surface-2);
		stroke-width: 1.5;
	}
	.node text {
		font-size: 11px;
		text-anchor: middle;
		fill: var(--text);
		paint-order: stroke;
		stroke: var(--surface-2);
		stroke-width: 3px;
	}
	.node.peptide text {
		font-weight: 700;
	}
</style>
