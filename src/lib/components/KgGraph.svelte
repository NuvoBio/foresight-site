<script lang="ts" module>
	export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; index: number } | null;
</script>

<script lang="ts">
	// Force-directed view of one peptide's subgraph, drawn with D3 (d3-force, d3-zoom, d3-drag).
	// Colours come from CSS variables, so the light/dark toggle restyles it without a redraw.
	import { onMount, untrack } from 'svelte';
	import * as d3 from 'd3';
	import {
		EXTRA_PROTEIN_COLOUR,
		OTHER_COLOUR,
		TYPE_COLOURS,
		edgeText,
		isNegated,
		nodeLabel,
		type KgEdge,
		type Subgraph
	} from '../kg';

	interface Props {
		sub: Subgraph;
		selected: Selection;
		onselect: (sel: Selection) => void;
		label?: string;
	}
	let { sub, selected, onselect, label = 'Knowledge graph' }: Props = $props();

	interface SimNode extends d3.SimulationNodeDatum {
		id: string;
		label: string;
		kind: 'peptide' | 'protein' | 'other';
		colour: string;
		r: number;
	}
	interface SimLink extends d3.SimulationLinkDatum<SimNode> {
		index: number;
		edge: KgEdge;
		text: string;
		lit: boolean;
		/** offset for parallel edges between the same pair, 0 = straight */
		bend: number;
	}

	let svgEl: SVGSVGElement | undefined = $state();
	let width = $state(800);
	let height = $state(600);

	let sim: d3.Simulation<SimNode, SimLink> | null = null;
	let zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
	let nodeSel: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown> | null = null;
	let linkSel: d3.Selection<SVGGElement, SimLink, SVGGElement, unknown> | null = null;
	let links: SimLink[] = [];

	function build(s: Subgraph) {
		const nodes: SimNode[] = s.nodes.map((n) => {
			const kind = n.type === 'peptide' ? 'peptide' : s.rank.has(n.node_id) ? 'protein' : 'other';
			return {
				id: n.node_id,
				label: nodeLabel(n, n.node_id),
				kind,
				colour: s.extra.has(n.node_id) ? EXTRA_PROTEIN_COLOUR : (TYPE_COLOURS[n.type] ?? OTHER_COLOUR),
				r: kind === 'peptide' ? 20 : kind === 'protein' ? 12 : 7
			};
		});
		const pairCount = new Map<string, number>();
		const pairSeen = new Map<string, number>();
		const key = (e: KgEdge) => [e.source_node, e.target_node].sort().join('|');
		for (const e of s.edges) pairCount.set(key(e), (pairCount.get(key(e)) ?? 0) + 1);
		const ls: SimLink[] = s.edges.map((e, index) => {
			const k = key(e);
			const i = pairSeen.get(k) ?? 0;
			pairSeen.set(k, i + 1);
			const n = pairCount.get(k)!;
			// spread parallel edges either side of the straight line
			const bend = n === 1 ? 0 : (i - (n - 1) / 2) * 28 * (e.source_node < e.target_node ? 1 : -1);
			return { source: e.source_node, target: e.target_node, index, edge: e, text: edgeText(e), lit: e.origin === 'literature', bend };
		});
		return { nodes, links: ls };
	}

	function path(l: SimLink) {
		const s = l.source as SimNode;
		const t = l.target as SimNode;
		const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
		const dx = tx - sx, dy = ty - sy;
		const len = Math.hypot(dx, dy) || 1;
		// stop at the target's rim so the arrowhead is visible
		const ex = tx - (dx / len) * (t.r + 2), ey = ty - (dy / len) * (t.r + 2);
		if (!l.bend) return `M${sx},${sy}L${ex},${ey}`;
		const mx = (sx + tx) / 2 - (dy / len) * l.bend, my = (sy + ty) / 2 + (dx / len) * l.bend;
		return `M${sx},${sy}Q${mx},${my} ${ex},${ey}`;
	}

	function labelPos(l: SimLink) {
		const s = l.source as SimNode;
		const t = l.target as SimNode;
		const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
		const len = Math.hypot(tx - sx, ty - sy) || 1;
		// a quadratic curve's midpoint sits halfway to its control point
		const x = (sx + tx) / 2 - ((ty - sy) / len) * (l.bend / 2);
		const y = (sy + ty) / 2 + ((tx - sx) / len) * (l.bend / 2);
		let a = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
		if (a > 90 || a < -90) a += 180;
		return `translate(${x},${y}) rotate(${a})`;
	}

	function draw(s: Subgraph) {
		if (!svgEl) return;
		sim?.stop();
		const { nodes, links: ls } = build(s);
		links = ls;
		const svg = d3.select(svgEl);
		svg.selectAll('*').remove();

		svg
			.append('defs')
			.append('marker')
			.attr('id', 'kg-arrow')
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 9)
			.attr('markerWidth', 7)
			.attr('markerHeight', 7)
			.attr('orient', 'auto')
			.append('path')
			.attr('d', 'M0,-4L10,0L0,4')
			.attr('class', 'arrow');

		const root = svg.append('g');
		zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.15, 5])
			.on('zoom', (ev) => root.attr('transform', ev.transform.toString()));
		svg.call(zoom).on('dblclick.zoom', null);
		svg.on('click', (ev) => {
			if (ev.target === svgEl) onselect(null);
		});

		linkSel = root
			.append('g')
			.selectAll<SVGGElement, SimLink>('g')
			.data(ls)
			.join('g')
			.attr('class', (d) => `link ${d.edge.origin}${isNegated(d.edge) ? ' neg' : ''}`)
			.on('click', (ev, d) => {
				ev.stopPropagation();
				onselect({ kind: 'edge', index: d.index });
			});
		linkSel.append('path').attr('class', 'hit');
		linkSel
			.append('path')
			.attr('class', 'line')
			.attr('marker-end', (d) => (d.lit ? 'url(#kg-arrow)' : null));
		linkSel
			.filter((d) => !!d.text)
			.append('text')
			.attr('class', 'elabel')
			.attr('dy', -3)
			.text((d) => d.text);

		nodeSel = root
			.append('g')
			.selectAll<SVGGElement, SimNode>('g')
			.data(nodes, (d) => d.id)
			.join('g')
			.attr('class', (d) => `node ${d.kind}`)
			.on('click', (ev, d) => {
				ev.stopPropagation();
				onselect({ kind: 'node', id: d.id });
			})
			.call(
				d3
					.drag<SVGGElement, SimNode>()
					.on('start', (ev, d) => {
						if (!ev.active) sim?.alphaTarget(0.2).restart();
						d.fx = d.x;
						d.fy = d.y;
					})
					.on('drag', (ev, d) => {
						d.fx = ev.x;
						d.fy = ev.y;
					})
					.on('end', (ev, d) => {
						if (!ev.active) sim?.alphaTarget(0);
						d.fx = null;
						d.fy = null;
					})
			);
		nodeSel
			.append('circle')
			.attr('r', (d) => d.r)
			.style('fill', (d) => (d.kind === 'peptide' ? null : d.colour));
		nodeSel
			.append('text')
			.attr('class', 'nlabel')
			.attr('y', (d) => d.r + 11)
			.text((d) => d.label);
		nodeSel.append('title').text((d) => d.id);

		const peptide = nodes.find((n) => n.kind === 'peptide');
		if (peptide) {
			peptide.fx = 0;
			peptide.fy = 0;
		}
		sim = d3
			.forceSimulation(nodes)
			.force(
				'link',
				d3
					.forceLink<SimNode, SimLink>(ls)
					.id((d) => d.id)
					.distance((l) => (l.lit ? 90 : (l.source as SimNode).kind === 'peptide' ? 160 : 95))
					.strength((l) => (l.lit ? 0.7 : 0.25))
			)
			.force('charge', d3.forceManyBody<SimNode>().strength((d) => (d.kind === 'other' ? -260 : -600)))
			.force('collide', d3.forceCollide<SimNode>().radius((d) => d.r + 14))
			.force('x', d3.forceX(0).strength(0.03))
			.force('y', d3.forceY(0).strength(0.03))
			.on('tick', tick)
			.on('end', () => {
				if (peptide) {
					peptide.fx = null;
					peptide.fy = null;
				}
			});
		// settle most of the layout before the first paint, then fit and let it finish live
		sim.tick(400);
		tick();
		fit(false);
		applySelection(selected);
	}

	function tick() {
		linkSel?.selectAll<SVGPathElement, SimLink>('path').attr('d', path);
		linkSel?.select<SVGTextElement>('text').attr('transform', labelPos);
		nodeSel?.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
	}

	export function fit(animate = true) {
		if (!svgEl || !zoom || !nodeSel) return;
		const xs = nodeSel.data().map((d) => d.x ?? 0);
		const ys = nodeSel.data().map((d) => d.y ?? 0);
		if (!xs.length) return;
		const pad = 60;
		const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const k = Math.min(4, 0.95 * Math.min(width / (x1 - x0 + 2 * pad), height / (y1 - y0 + 2 * pad)));
		const t = d3.zoomIdentity
			.translate(width / 2, height / 2)
			.scale(k)
			.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
		const svg = d3.select(svgEl);
		if (animate) svg.transition().duration(400).call(zoom.transform, t);
		else svg.call(zoom.transform, t);
	}

	function applySelection(sel: Selection) {
		if (!nodeSel || !linkSel) return;
		if (!sel) {
			nodeSel.classed('faded', false).classed('selected', false);
			linkSel.classed('faded', false).classed('selected', false);
			return;
		}
		const near = new Set<string>();
		const nearLinks = new Set<number>();
		if (sel.kind === 'node') {
			near.add(sel.id);
			for (const l of links) {
				const s = (l.source as SimNode).id, t = (l.target as SimNode).id;
				if (s === sel.id || t === sel.id) {
					near.add(s);
					near.add(t);
					nearLinks.add(l.index);
				}
			}
		} else {
			const l = links[sel.index];
			if (l) {
				near.add((l.source as SimNode).id);
				near.add((l.target as SimNode).id);
				nearLinks.add(l.index);
			}
		}
		nodeSel.classed('faded', (d) => !near.has(d.id)).classed('selected', (d) => sel.kind === 'node' && d.id === sel.id);
		linkSel.classed('faded', (d) => !nearLinks.has(d.index)).classed('selected', (d) => sel.kind === 'edge' && d.index === sel.index);
	}

	onMount(() => {
		const ro = new ResizeObserver(([entry]) => {
			width = entry.contentRect.width;
			height = entry.contentRect.height;
		});
		ro.observe(svgEl!.parentElement!);
		return () => {
			ro.disconnect();
			sim?.stop();
		};
	});

	$effect(() => {
		const s = sub;
		untrack(() => draw(s));
	});
	$effect(() => {
		applySelection(selected);
	});
	// refit when the frame is first measured or resized
	$effect(() => {
		void width;
		void height;
		untrack(() => fit(false));
	});
</script>

<div class="frame">
	<svg bind:this={svgEl} {width} {height} role="img" aria-label={label}></svg>
</div>

<style>
	.frame {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	svg {
		display: block;
		cursor: grab;
		font-family: var(--font);
	}
	svg:active {
		cursor: grabbing;
	}
	svg :global(.link .line) {
		fill: none;
		stroke: var(--line-strong);
		stroke-width: 1;
	}
	svg :global(.link .hit) {
		fill: none;
		stroke: transparent;
		stroke-width: 10;
		cursor: pointer;
	}
	svg :global(.link.literature .line) {
		stroke: #e08a1e;
		stroke-width: 2;
	}
	svg :global(.link.literature.neg .line) {
		stroke-dasharray: 5 3;
	}
	svg :global(.link.selected .line) {
		stroke: var(--orange);
		stroke-width: 3;
	}
	svg :global(.arrow) {
		fill: #e08a1e;
	}
	svg :global(.elabel) {
		font-size: 8px;
		fill: var(--muted);
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 3px;
		pointer-events: none;
	}
	svg :global(.link.literature .elabel) {
		fill: #e08a1e;
		font-weight: 600;
	}
	svg :global(.link.literature.neg .elabel) {
		fill: var(--red);
	}
	svg :global(.node) {
		cursor: pointer;
	}
	svg :global(.node circle) {
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	svg :global(.node.peptide circle) {
		fill: var(--text);
	}
	svg :global(.node.selected circle) {
		stroke: var(--orange);
		stroke-width: 3;
	}
	svg :global(.nlabel) {
		font-size: 10px;
		fill: var(--text);
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 3px;
		pointer-events: none;
	}
	svg :global(.node.protein .nlabel) {
		font-size: 11px;
		font-weight: 600;
	}
	svg :global(.node.peptide .nlabel) {
		font-size: 13px;
		font-weight: 700;
	}
	svg :global(.node.other .nlabel) {
		fill: var(--muted);
	}
	svg :global(.faded) {
		opacity: 0.12;
	}
	svg :global(.link),
	svg :global(.node) {
		transition: opacity 0.15s;
	}
</style>
