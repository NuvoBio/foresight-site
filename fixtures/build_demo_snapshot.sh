#!/usr/bin/env bash
# Builds fixtures/demo_snapshot.json: the real snapshot plus one SYNTHETIC run ("demo_new_format") written in the
# 2026-11-02 prompt format, so the confidence / location / triage views can be previewed before real runs exist.
# Usage: fixtures/build_demo_snapshot.sh path/to/parse_ae_dashboard.py [path/to/real_snapshot.json]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
parser="$1"; real="${2:-$here/../static/data/ae_dashboard_snapshot.json}"
tmp="$(mktemp -d)"
python3 "$here/make_fixture.py" "$tmp"
python3 "$parser" --predictions-root "$tmp/preds" --metrics-root "$tmp/metrics" --protein-lists "$tmp/lists" \
  --out "$tmp/demo.json" --label "Synthetic demo"
python3 - "$real" "$tmp/demo.json" "$here/demo_snapshot.json" <<'PY'
import json, sys
real, demo = (json.load(open(p)) for p in sys.argv[1:3])
real["entries"] += demo["entries"]
real["runs"] += [r for r in demo["runs"] if r not in real["runs"]]
real["label"] += " + synthetic demo run"
json.dump(real, open(sys.argv[3], "w"), ensure_ascii=False)
print("wrote", sys.argv[3])
PY
