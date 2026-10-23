# Foresight

A one-page static site that shows the AE predictions for each run and peptide, together with the
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

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (branch `main`).
2. In the repository, go to Settings → Pages and set **Source** to **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml`. The workflow builds with
   `BASE_PATH=/<repo-name>` and publishes `build/`.

To build for Pages by hand: `BASE_PATH=/<repo-name> npm run build`, then serve `build/`.

## Layout

- `src/routes/+page.svelte`: the page. It has run and peptide pickers, the overall reasoning, and
  the AE cards grouped by SOC.
- `src/lib/components/`: `ReasoningBlock`, `AeCard`, `DetailPanel`, `Badge`.
- `src/lib/evidence.ts`: ranking and grouping. Cards sort by stated evidence strength (strong,
  moderate, weak, not stated), then explicit records before inferred ones, then frequency. SOC
  groups are ordered by their strongest card.
- Colours live in `src/app.css`: black, green `#2fd67b`, orange `#ff8a1f` and white.
