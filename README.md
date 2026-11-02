# Foresight

A static site that shows the AE predictions for each run and peptide, together with the
model's reasoning. It's built with SvelteKit 3 and Svelte 5 using `adapter-static`, so it can be
hosted on GitHub Pages.

## Run it locally

```
npm install
npm run dev          # http://localhost:5173
```

## Data

The site reads `static/data/ae_dashboard_snapshot.json`, a copy of the snapshot built by
`Benchmarks_22102026/dashboard_data/parse_ae_dashboard.py`. To refresh it after a new run:

```
# 1. rebuild the snapshot (SOC comes from the metrics folder)
cd ../Benchmarks_22102026/dashboard_data
python3 parse_ae_dashboard.py --predictions-root ../predictions_22102026 \
  --metrics-root ../metrics_22102026 --out ae_dashboard_snapshot.json

# 2. copy it into the site
cd ../../foresight_site
npm run sync-data    # or: npm run sync-data -- /path/to/ae_dashboard_snapshot.json
```

### New prediction fields (snapshot schema 2)

Rebuild the snapshot with the updated `parse_ae_dashboard.py` to fill in the new views:

```
python3 parse_ae_dashboard.py --predictions-root ../predictions_<date> --metrics-root ../metrics_<date> \
  --protein-lists /data/AE-toolkit/<shortlists folder> --out ae_dashboard_snapshot.json
```

- **Confidence of prediction** and its rationale come from the `Confidence of prediction:` /
  `Confidence rationale:` lines of the Step 2/4 records (or an optional `| Confidence: high` on a
  predictions line).
- **Perturbation plausibility** (likely / uncertain / unlikely) comes from the Step 1 triage and the
  records' `Perturbation plausibility:` lines.
- **Subcellular location**, `location_class`, intended target and rank come from the shortlist CSVs
  written by `extract_sublists.py` (`--protein-lists`, a file or folder; a sub-folder named after a run
  is used for that run). Without it, the site uses any `Subcellular location:` the reasoning restates.

Older snapshots still load: the site hides what they lack and says so.

To preview with a synthetic run in the new format:
`fixtures/build_demo_snapshot.sh path/to/parse_ae_dashboard.py` then
`npm run sync-data -- fixtures/demo_snapshot.json`. Don't deploy the demo snapshot.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (branch `main`).
2. In the repository, go to Settings → Pages and set **Source** to **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml`. The workflow builds with
   `BASE_PATH=/<repo-name>` and publishes `build/`.

To build for Pages by hand: `BASE_PATH=/<repo-name> npm run build`, then serve `build/`.

## Layout

- `src/routes/+page.svelte`: the executive summary (landing page). Headline numbers, one card per
  peptide (severity, confidence and triage mix, top predictions, severe/fatal events) and a run
  comparison table. `?run=` picks the run.
- `src/routes/explore/+page.svelte`: the explorer. Run and peptide pickers, the overall reasoning, the
  protein and triage table, and the AE cards grouped by SOC, sortable by evidence, confidence or
  frequency. `?run=&peptide=&ae=&sort=` reopens a view.
- `src/lib/components/`: `SiteHeader`, `ThemeToggle`, `ReasoningBlock`, `ProteinPanel`, `AeCard`,
  `DetailPanel`, `StackBar`, `Badge`.
- `src/lib/summary.ts`: the numbers behind the summary page.
- `src/lib/theme.svelte.ts`: light/dark mode. It follows the system setting until the toggle is used,
  then remembers the choice in `localStorage`; `src/app.html` applies it before first paint.
- `src/lib/evidence.ts`: ranking and grouping. Cards sort by stated evidence strength (strong,
  moderate, weak, not stated), then explicit records before inferred ones, then frequency. SOC
  groups are ordered by their strongest card.
- Colours live in `src/app.css` as tokens. Dark: black, green `#2fd67b`, orange `#ff8a1f`, white.
  Light (`[data-theme='light']`): off-white with green `#0f7f43` and orange `#b85300`, darkened so text
  keeps contrast on white.
