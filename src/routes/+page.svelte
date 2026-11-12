<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Snapshot } from '../lib/types';
	import { loadSnapshot } from '../lib/data';
	import { CONFIDENCE_LABEL, SEVERITY_LABEL, runLabel } from '../lib/evidence';
	import { pct, runRows, summarize } from '../lib/summary';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import Badge from '#lib/components/Badge.svelte';
	import StackBar from '#lib/components/StackBar.svelte';
	import { confidenceTone, severityTone } from '../lib/components/tones';

	let snapshot = $state<Snapshot | null>(null);
	let error = $state<string | null>(null);
	let run = $state('');

	onMount(async () => {
		try {
			const data = await loadSnapshot();
			const q = new URLSearchParams(location.search).get('run');
			run = q && data.runs.includes(q) ? q : data.runs[data.runs.length - 1];
			snapshot = data;
		} catch (e) {
			error = `Could not load the dataset (${(e as Error).message}).`;
		}
	});

	$effect(() => {
		if (snapshot) history.replaceState(history.state, '', `?${new URLSearchParams({ run })}`);
	});

	const peptides = $derived(
		snapshot ? snapshot.entries.filter((e) => e.run === run).map(summarize) : []
	);
	const totals = $derived.by(() => {
		const sum = (f: (s: (typeof peptides)[number]) => number) => peptides.reduce((n, s) => n + f(s), 0);
		return {
			predictions: sum((s) => s.cards.length),
			tp: sum((s) => s.precision?.tp ?? 0),
			scored: sum((s) => s.precision?.scored ?? 0),
			high: sum((s) => s.confidence.high),
			rated: sum((s) => s.cards.length - s.confidence.none),
			serious: sum((s) => s.serious.length),
			proteins: sum((s) => s.proteins.length),
			unlikely: sum((s) => s.triage.unlikely),
			triaged: sum((s) => s.proteins.length - s.triage.none)
		};
	});
	const rows = $derived(snapshot ? runRows(snapshot) : []);
	const anyScored = $derived(rows.some((r) => r.scored));
	const anyConfidence = $derived(rows.some((r) => r.withConfidence));

	function explore(peptide: string, ae?: string) {
		const q = new URLSearchParams({ run, peptide });
		if (ae) q.set('ae', ae);
		return `${resolve('/explore')}?${q}`;
	}

	const generated = $derived(
		snapshot?.generated_at
			? new Date(snapshot.generated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
			: ''
	);
</script>

<svelte:head><title>Summary · Foresight</title></svelte:head>

{#snippet labelTag(status: string | null)}
	{#if status === 'TP'}
		<span class="tp" title="Matched an AE on the drug label">✓ label</span>
	{:else if status === 'FP'}
		<span class="tp no" title="Not on the drug label">not in label</span>
	{:else}
		<span class="tp no"></span>
	{/if}
{/snippet}

<SiteHeader>
	{#if snapshot}
		<label class="pick">
			<span>Run</span>
			<select bind:value={run}>
				{#each snapshot.runs as r (r)}<option value={r}>{runLabel(r)}</option>{/each}
			</select>
		</label>
	{/if}
</SiteHeader>

<main class="wrap">
	{#if error}
		<p class="status error">{error}</p>
	{:else if !snapshot}
		<p class="status">Loading predictions…</p>
	{:else}
		<section class="hero" aria-labelledby="hero-title">
			<p class="eyebrow">Executive summary · {snapshot.label}{generated ? ` · built ${generated}` : ''}</p>
			<h1 id="hero-title">{runLabel(run)}: predicted safety profile for {peptides.length} peptide{peptides.length === 1 ? '' : 's'}</h1>
			<p class="lead">
				Foresight predicted <strong>{totals.predictions}</strong> adverse events across
				{peptides.map((p) => p.entry.peptide).join(', ')}.
				{#if totals.scored}
					Of the {totals.scored} it could be scored on, <strong>{pct(totals.tp, totals.scored)}</strong> matched
					the drug label.
				{/if}
				{#if totals.rated}
					<strong>{totals.high}</strong> {totals.high === 1 ? 'is' : 'are'} rated high confidence.
				{/if}
				{#if totals.serious}
					<strong>{totals.serious}</strong> {totals.serious === 1 ? 'is' : 'are'} predicted severe or fatal.
				{/if}
			</p>
		</section>

		<ul class="kpis" aria-label="Headline numbers">
			<li>
				<span class="k-label">Predicted AEs</span>
				<span class="k-value">{totals.predictions}</span>
				<span class="k-sub">across {peptides.length} peptide{peptides.length === 1 ? '' : 's'}</span>
			</li>
			<li>
				<span class="k-label">Matched the label</span>
				<span class="k-value">{totals.scored ? pct(totals.tp, totals.scored) : '–'}</span>
				<span class="k-sub">{totals.scored ? `${totals.tp} of ${totals.scored} scored predictions (precision)` : 'No benchmark for this run'}</span>
			</li>
			<li>
				<span class="k-label">High confidence</span>
				<span class="k-value">{totals.rated ? totals.high : '–'}</span>
				<span class="k-sub">{totals.rated ? `of ${totals.rated} rated predictions` : 'Confidence not rated in this run'}</span>
			</li>
			<li>
				<span class="k-label">Severe or fatal</span>
				<span class="k-value o">{totals.serious}</span>
				<span class="k-sub">predicted events to watch</span>
			</li>
			<li>
				<span class="k-label">Proteins ruled out</span>
				<span class="k-value">{totals.triaged ? totals.unlikely : '–'}</span>
				<span class="k-sub">{totals.triaged ? `of ${totals.triaged} triaged as unlikely to be perturbed` : 'No protein triage in this run'}</span>
			</li>
		</ul>

		<section aria-labelledby="peptides-title">
			<h2 id="peptides-title" class="section-title">By peptide</h2>
			<div class="peptides">
				{#each peptides as s (s.entry.id)}
					<article class="pep">
						<header>
							<div>
								<h3>{s.entry.peptide}</h3>
								{#if s.targets.length}
									<p class="targets">Intended target: <span class="mono">{s.targets.map((t) => t.gene).join(', ')}</span></p>
								{/if}
							</div>
							<div class="pep-stats">
								<span><strong>{s.cards.length}</strong> AEs</span>
								{#if s.precision}<span><strong>{Math.round(s.precision.pct)}%</strong> matched label</span>{/if}
							</div>
						</header>

						<div class="bars">
							<StackBar
								label="Severity"
								segments={[
									{ label: 'Mild / moderate', value: s.severity.mild_moderate, color: 'var(--green)' },
									{ label: 'Severe', value: s.severity.severe, color: 'var(--orange)' },
									{ label: 'Fatal', value: s.severity.fatal, color: 'var(--red)' },
									{ label: 'Unknown', value: s.severity.unknown, color: 'var(--line-strong)' }
								]}
							/>
							{#if s.confidence.none < s.cards.length}
							<StackBar
								label="Confidence of prediction"
								segments={[
									{ label: 'High', value: s.confidence.high, color: 'var(--green)' },
									{ label: 'Medium', value: s.confidence.medium, color: 'var(--neutral-mark)' },
									{ label: 'Low', value: s.confidence.low, color: 'var(--orange)' },
									{ label: 'Not rated', value: s.confidence.none, color: 'var(--line-strong)' }
								]}
							/>
							{/if}
							{#if s.triage.none < s.proteins.length}
							<StackBar
								label="Protein triage"
								segments={[
									{ label: 'Likely', value: s.triage.likely, color: 'var(--green)' },
									{ label: 'Uncertain', value: s.triage.uncertain, color: 'var(--orange)' },
									{ label: 'Unlikely', value: s.triage.unlikely, color: 'var(--red)' },
									{ label: 'Not stated', value: s.triage.none, color: 'var(--line-strong)' }
								]}
							/>
							{/if}
							{#if s.confidence.none === s.cards.length || s.triage.none === s.proteins.length}
								<p class="muted small">
									{[
										s.confidence.none === s.cards.length ? 'Confidence' : null,
										s.triage.none === s.proteins.length ? 'protein triage' : null
									]
										.filter(Boolean)
										.join(' and ')
										.replace(/^p/, 'P')} not reported in this run.
								</p>
							{/if}
						</div>

						<div class="lists">
							<div>
								<h4>Top predictions</h4>
								<ol class="aes" class:no-conf={!s.headline.some((c) => c.confidence)}>
									{#each s.headline as c (c.prediction.id)}
										<li>
											<a href={explore(s.entry.peptide, c.prediction.id)} title={c.prediction.term}>{c.prediction.term}</a>
											<span class="freq">{c.prediction.frequency_text ?? '–'}</span>
											{#if s.headline.some((x) => x.confidence)}
												<span class="ind">
													{#if c.confidence}
														<Badge fill tone={confidenceTone(c.confidence)}>{CONFIDENCE_LABEL[c.confidence]}</Badge>
													{:else}<Badge fill>Not rated</Badge>{/if}
												</span>
											{/if}
											{@render labelTag(c.prediction.score_status)}
										</li>
									{/each}
								</ol>
							</div>
							<div>
								<h4>Severe or fatal</h4>
								{#if s.serious.length}
									<ul class="aes">
										{#each s.serious.slice(0, 5) as c (c.prediction.id)}
											<li>
												<a href={explore(s.entry.peptide, c.prediction.id)} title={c.prediction.term}>{c.prediction.term}</a>
												<span class="freq">{c.prediction.frequency_text ?? '–'}</span>
												<span class="ind">
													<Badge fill tone={severityTone(c.prediction.severity_normalized)}>
														{SEVERITY_LABEL[c.prediction.severity_normalized]}
													</Badge>
												</span>
												{@render labelTag(c.prediction.score_status)}
											</li>
										{/each}
										{#if s.serious.length > 5}<li class="more">+{s.serious.length - 5} more</li>{/if}
									</ul>
								{:else}
									<p class="muted">None predicted.</p>
								{/if}
							</div>
						</div>

						<a class="open" href={explore(s.entry.peptide)}>Open {s.entry.peptide} in the explorer →</a>
					</article>
				{/each}
			</div>
		</section>

		<section aria-labelledby="runs-title">
			<h2 id="runs-title" class="section-title">How the runs compare</h2>
			<div class="table-card">
				<table>
					<thead>
						<tr>
							<th scope="col">Run</th>
							<th scope="col" class="num">Predicted AEs</th>
							{#if anyScored}
								<th scope="col" class="num">Matched label</th>
								<th scope="col" class="wide">Precision</th>
							{/if}
							{#if anyConfidence}<th scope="col" class="num">High confidence</th>{/if}
							<th scope="col" class="num">Severe / fatal</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as r (r.run)}
							<tr class:current={r.run === run}>
								<th scope="row"><button onclick={() => (run = r.run)}>{runLabel(r.run)}</button></th>
								<td class="num">{r.predictions}</td>
								{#if anyScored}
									<td class="num">{r.scored ? `${r.tp} / ${r.scored}` : '–'}</td>
									<td class="wide">
										{#if r.scored}
											<span class="meter" title="{pct(r.tp, r.scored)} of scored predictions matched the label">
												<span style="width: {(100 * r.tp) / r.scored}%"></span>
											</span>
											<span class="meter-val">{pct(r.tp, r.scored)}</span>
										{:else}–{/if}
									</td>
								{/if}
								{#if anyConfidence}<td class="num">{r.withConfidence ? `${r.highConfidence} / ${r.withConfidence}` : '–'}</td>{/if}
								<td class="num">{r.serious}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="foot">
				Precision is the share of scored predictions that matched an AE on the drug label. Recall is not
				shown here because the snapshot does not carry the full label list. Select a run to update the page.
			</p>
		</section>

		<section class="glossary" aria-labelledby="glossary-title">
			<h2 id="glossary-title" class="section-title">How to read the ratings</h2>
			<dl>
				<div>
					<dt>Confidence of prediction</dt>
					<dd>How much the model trusts its own prediction (the AE, its frequency and severity together) to hold up against real outcomes. It is not how likely the event is; that is the frequency.</dd>
				</div>
				<div>
					<dt>Evidence strength</dt>
					<dd>How good the evidence linking the protein to the AE is in general: strong, moderate or weak.</dd>
				</div>
				<div>
					<dt>Protein triage</dt>
					<dd>Whether the peptide is likely to perturb each protein at all, weighing whether it can reach it (subcellular location), pharmacological precedent and housekeeping-artefact status. The intended target is exempt.</dd>
				</div>
			</dl>
		</section>
	{/if}
</main>

<style>
	.wrap {
		max-width: 1440px;
		margin: 0 auto;
		padding-inline: 24px;
	}
	main {
		padding-block: 40px 72px;
		display: flex;
		flex-direction: column;
		gap: 36px;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.8rem;
		color: var(--faint);
	}
	select {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: 8px;
		padding: 6px 10px;
		font: inherit;
		font-size: 0.9rem;
	}
	select:hover {
		border-color: var(--green);
	}
	.hero {
		max-width: 920px;
	}
	.eyebrow {
		margin: 0 0 8px;
		color: var(--orange);
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	h1 {
		margin: 0 0 12px;
		font-size: clamp(1.6rem, 3vw, 2.3rem);
		line-height: 1.15;
		text-wrap: balance;
	}
	.lead {
		margin: 0;
		font-size: 1.08rem;
		color: var(--muted);
		text-wrap: pretty;
	}
	.lead strong {
		color: var(--text);
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.kpis li {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-shadow: var(--card-shadow);
	}
	.k-label {
		color: var(--faint);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.k-value {
		font-size: 2.1rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
	}
	.k-sub {
		color: var(--muted);
		font-size: 0.82rem;
	}
	.section-title {
		margin: 0 0 14px;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.section-title::before {
		content: '';
		width: 4px;
		height: 1em;
		background: var(--orange);
		border-radius: 2px;
	}
	.peptides {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
		gap: 16px;
	}
	.pep {
		background: var(--surface);
		border: 1px solid var(--line);
		border-top: 3px solid var(--green);
		border-radius: var(--radius);
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		box-shadow: var(--card-shadow);
	}
	.pep header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	h3 {
		margin: 0;
		font-size: 1.35rem;
	}
	.targets {
		margin: 2px 0 0;
		color: var(--faint);
		font-size: 0.82rem;
	}
	.mono {
		font-family: var(--mono);
		color: var(--text);
	}
	.pep-stats {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		color: var(--muted);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.pep-stats strong {
		color: var(--text);
		font-size: 1rem;
	}
	.bars {
		display: grid;
		gap: 14px;
	}
	.lists {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
	}
	.small {
		font-size: 0.8rem;
	}
	h4 {
		margin: 0 0 8px;
		color: var(--faint);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.aes {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.88rem;
	}
	.aes li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 3.6em 6.4em 5.6em;
		align-items: center;
		gap: 10px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--line);
	}
	.aes li:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.aes.no-conf li {
		grid-template-columns: minmax(0, 1fr) 3.6em 5.6em;
	}
	.freq {
		text-align: right;
	}
	.ind {
		display: flex;
	}
	.aes li.more {
		display: block;
	}
	.aes a {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.aes a {
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	.aes a:hover {
		color: var(--green);
		text-decoration: underline;
	}
	.freq {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.tp.no {
		color: var(--faint);
		font-weight: 400;
	}
	.tp {
		text-align: right;
		color: var(--green);
		font-size: 0.75rem;
		font-weight: 600;
	}
	.more,
	.muted {
		color: var(--faint);
		margin: 0;
		font-size: 0.85rem;
	}
	.open {
		align-self: flex-start;
		font-weight: 600;
		font-size: 0.88rem;
		text-decoration: none;
	}
	.open:hover {
		text-decoration: underline;
	}
	.table-card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 6px 18px;
		overflow-x: auto;
		box-shadow: var(--card-shadow);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 10px 12px 10px 0;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
	}
	thead th {
		color: var(--faint);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	tbody tr:last-child th,
	tbody tr:last-child td {
		border-bottom: 0;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.wide {
		width: 34%;
		min-width: 180px;
	}
	tbody th button {
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		font-weight: 600;
		color: var(--text);
	}
	tbody th button:hover {
		color: var(--green);
	}
	tr.current th button {
		color: var(--green);
	}
	tr.current {
		background: var(--green-soft);
	}
	.meter {
		display: inline-block;
		vertical-align: middle;
		width: calc(100% - 48px);
		height: 8px;
		border-radius: 4px;
		background: var(--line);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		background: var(--green);
		border-radius: 4px;
	}
	.meter-val {
		display: inline-block;
		width: 40px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.foot {
		margin: 10px 0 0;
		color: var(--faint);
		font-size: 0.8rem;
	}
	.glossary dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
		margin: 0;
	}
	.glossary dl div {
		border-left: 2px solid var(--line-strong);
		padding: 2px 0 2px 14px;
	}
	dt {
		font-weight: 650;
		margin-bottom: 4px;
	}
	dd {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
	}
	.k-value.o {
		color: var(--orange);
	}
	.status {
		color: var(--muted);
		padding: 40px 0;
	}
	.status.error {
		color: var(--orange);
	}
	@media (max-width: 900px) {
		.wrap {
			padding-inline: 16px;
		}
		.lists {
			grid-template-columns: 1fr;
		}
	}
</style>
