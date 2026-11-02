"""Synthetic predictor output in the 2026-11-02 prompt format, for testing the parser and previewing the site.
Not real model output."""
import pathlib, csv, sys
root = pathlib.Path(sys.argv[1])
run, pep = "demo_new_format", "Semaglutide"
d = root / "preds" / run / pep; d.mkdir(parents=True, exist_ok=True)

triage = """Step 1: Analyze each protein

Triage of the listed proteins (intended target: GLP1R, agonist).

**GLP1R** (intended target)
Subcellular location: Cell membrane; multi-pass membrane protein
Perturbation plausibility: likely perturbed: intended target, cell-surface receptor; exempt from triage.
KEGG: Insulin secretion, cAMP signaling pathway, Neuroactive ligand-receptor interaction.

**GIPR**
Subcellular location: Cell membrane; multi-pass membrane protein
Perturbation plausibility: likely perturbed: cell-surface class B GPCR, dual GLP-1/GIP agonists show cross-reactive pharmacology.
KEGG: Insulin secretion, cAMP signaling pathway.

**GCGR**
Subcellular location: Cell membrane
Perturbation plausibility: uncertain: cell-surface and structurally related, but nothing beyond the predicted interaction supports binding.
KEGG: Glucagon signaling pathway, cAMP signaling pathway.

**PTH1R**
Subcellular location: Cell membrane
Perturbation plausibility: uncertain: accessible, but no pharmacological precedent for GLP-1 analogues at this receptor.
KEGG: Parathyroid hormone synthesis, secretion and action.

**ACTB**
Subcellular location: Cytoplasm, cytoskeleton
Perturbation plausibility: unlikely perturbed: intracellular cytoskeletal protein, a common non-specific hit; a peptide cannot reach it.

**HIST1H4A**
Subcellular location: Nucleus; Chromosome
Perturbation plausibility: unlikely perturbed: nuclear histone, housekeeping artefact.
"""

def rec(ae, prots, plaus, rel, direction, chain, ev, strength, conf, rationale, step4=None):
    lines = [f"AE: {ae}", f"Protein(s): {prots}", f"Perturbation plausibility: {plaus}",
             f"Relationship type: {rel}", f"Direction of perturbation: {direction}",
             f"Mechanistic chain: {chain}", f"Supporting evidence: {ev}", f"Evidence strength: {strength}",
             f"Confidence of prediction: {conf}", f"Confidence rationale: {rationale}"]
    return "\n".join(lines)

R = [
 ("Nausea", "GLP1R", "likely perturbed: intended target, cell-surface receptor", "direct_target_effect", "agonism (given)",
  "GLP1R agonism in area postrema neurons → increased neuronal firing → activation of emetic centre → nausea",
  "Incidence tables of GLP-1 receptor agonist labels report nausea in 15-44% (PMID 33567185).", "strong", "high",
  "None uncertain: same-protein human trial data anchors both frequency and severity."),
 ("Vomiting", "GLP1R", "likely perturbed: intended target", "direct_target_effect", "agonism (given)",
  "GLP1R agonism in hindbrain → emetic reflex activation → vomiting",
  "Label incidence 9-24% (PMID 33567185).", "strong", "high", "None uncertain: quantitative human data on the same receptor."),
 ("Diarrhoea", "GLP1R", "likely perturbed: intended target", "direct_target_effect", "agonism (given)",
  "GLP1R agonism on enteric neurons → altered intestinal motility and secretion → diarrhoea",
  "Label incidence 8-30% (PMID 33567185).", "strong", "high", "None uncertain."),
 ("Constipation", "GLP1R", "likely perturbed: intended target", "direct_target_effect", "agonism (given)",
  "GLP1R agonism → delayed gastric emptying and reduced colonic transit → constipation",
  "Label incidence 5-24% (PMID 33567185).", "strong", "medium", "Frequency: the reported range is wide across formulations."),
 ("Decreased appetite", "GLP1R, GIPR", "GLP1R likely perturbed (intended target); GIPR likely perturbed (dual-agonist precedent)",
  "convergent_multi_protein_effect", "agonism (given for GLP1R, assumed for GIPR)",
  "GLP1R/GIPR agonism in hypothalamic arcuate neurons → POMC activation → satiety signalling → decreased appetite",
  "Weight-management trials report decreased appetite in 9% (PMID 34706925).", "strong", "high",
  "Convergent support from two receptors, each with independent human evidence."),
 ("Cholelithiasis", "GLP1R", "likely perturbed: intended target", "physiological_process_effect", "agonism (given)",
  "GLP1R agonism → reduced gallbladder motility plus rapid weight loss → bile stasis → gallstone formation",
  "Meta-analysis of GLP-1RA trials: relative risk 1.3 for gallbladder events (PMID 35226049).", "moderate", "medium",
  "Relationship: part of the effect is mediated by weight loss rather than the receptor itself."),
 ("Pancreatitis acute", "GLP1R", "likely perturbed: intended target", "direct_target_effect", "agonism (given)",
  "GLP1R agonism on pancreatic acinar cells → acinar hypertrophy → enzyme leakage → acute pancreatitis",
  "Signal in post-marketing reports; trials show no significant excess (PMID 30291106).", "weak", "low",
  "Relationship: human evidence conflicts; retained only under the severe/fatal exception."),
 ("Heart rate increased", "GLP1R", "likely perturbed: intended target", "direct_target_effect", "agonism (given)",
  "GLP1R agonism on sinoatrial node cells → increased cAMP → faster pacemaker depolarisation → heart rate increased",
  "Mean increase 2-4 bpm in trials (PMID 33567185).", "moderate", "medium",
  "Frequency: trials report mean change, not incidence of a clinically relevant increase."),
 ("Hypoglycaemia", "GLP1R, GCGR", "GLP1R likely perturbed; GCGR uncertain: nothing beyond the predicted interaction",
  "pathway_effect", "agonism at GLP1R (given); assumed antagonism at GCGR",
  "GLP1R agonism → glucose-dependent insulin release; if GCGR is blocked → reduced counter-regulation → hypoglycaemia",
  "Low risk in monotherapy; higher with sulfonylureas (PMID 33567185).", "moderate", "low",
  "Depends on GCGR, triaged as uncertain, and on an assumed direction that would reverse the effect."),
 ("Hypercalcaemia", "PTH1R", "uncertain: accessible, but no precedent for GLP-1 analogues at PTH1R",
  "off_target_effect", "assumed agonism",
  "PTH1R agonism in kidney and bone → increased calcium reabsorption and bone resorption → hypercalcaemia",
  "Teriparatide label reports transient hypercalcaemia (PMID 11346808); no data for this peptide class.", "weak", "low",
  "Relationship: depends on a protein triaged as uncertain and an assumed direction."),
 ("Injection site reaction", "GLP1R", "likely perturbed: intended target", "pharmacological_support", "not applicable",
  "Subcutaneous administration → local inflammatory response → injection site reaction",
  "Reported in 1-3% across injectable GLP-1RAs (PMID 33567185).", "moderate", "medium",
  "Relationship: route effect rather than a receptor mechanism."),
]
records = "\n\n".join(rec(*r) for r in R)
reasoning = ("=== Reasoning written in the response ===\n" + triage +
             "\nStep 2: Build explicit protein–AE relationships\n\n" + records +
             "\n\n=== Model thinking summary ===\n"
             "I anchored the analysis on GLP1R as the intended target and triaged the other proteins first. "
             "ACTB and the histone are intracellular housekeeping hits, so I predicted nothing from them. "
             "GCGR and PTH1R are reachable but have no precedent, so anything depending on them is low confidence.\n\n"
             "The GI class effects are well anchored to label incidence tables, so they carry high confidence. "
             "Pancreatitis is kept only because it is severe.\n")
(d / f"{pep}_reasoning.txt").write_text(reasoning)
P = [("Nausea","20%","mild/moderate"),("Diarrhoea","12%","mild/moderate"),("Vomiting","10%","mild/moderate"),
     ("Decreased appetite","9%","mild/moderate"),("Constipation","8%","mild/moderate"),("Heart rate increased","3%","mild/moderate"),
     ("Injection site reaction","2%","mild/moderate"),("Cholelithiasis","1.5%","severe"),("Hypoglycaemia","2%","severe"),
     ("Pancreatitis acute","0.3%","severe"),("Hypercalcaemia","0.5%","mild/moderate")]
(d / f"{pep}.txt").write_text("\n".join(f"{t} | Frequency: {f} | Severity: {s}" for t, f, s in P) + "\nOverall severity: mild/moderate\n")
(d / f"{pep}_rag.json").write_text('{"context_source": "curated_cache", "results": []}')

SOC = {"Nausea":"Gastrointestinal disorders","Diarrhoea":"Gastrointestinal disorders","Vomiting":"Gastrointestinal disorders",
       "Constipation":"Gastrointestinal disorders","Pancreatitis acute":"Gastrointestinal disorders",
       "Decreased appetite":"Metabolism and nutrition disorders","Hypoglycaemia":"Metabolism and nutrition disorders",
       "Hypercalcaemia":"Metabolism and nutrition disorders","Heart rate increased":"Investigations",
       "Injection site reaction":"General disorders and administration site conditions","Cholelithiasis":"Hepatobiliary disorders"}
TP = {"Nausea","Diarrhoea","Vomiting","Constipation","Decreased appetite","Cholelithiasis","Heart rate increased","Injection site reaction"}
m = root / "metrics" / run; m.mkdir(parents=True, exist_ok=True)
with open(m / "ae_comparison.csv", "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["Peptide","Predicted_Original_Term","Predicted_SOC","Predicted_Preferred_Term","Predicted_Status","Ground_Truth_Preferred_Term"])
    for t, *_ in P: w.writerow([pep, t, SOC[t], t, "TP" if t in TP else "FP", t if t in TP else ""])
L = root / "lists"; L.mkdir(exist_ok=True)
rows = [("P43220","GLP1R","Glucagon-like peptide 1 receptor","Cell membrane; Multi-pass membrane protein","cell_surface","TRUE",39,0.41),
        ("P48546","GIPR","Gastric inhibitory polypeptide receptor","Cell membrane; Multi-pass membrane protein","cell_surface","FALSE",12,0.78),
        ("P47871","GCGR","Glucagon receptor","Cell membrane; Multi-pass membrane protein","cell_surface","FALSE",1,1.0),
        ("Q03431","PTH1R","Parathyroid hormone/parathyroid hormone-related peptide receptor","Cell membrane","cell_surface","FALSE",44,0.33),
        ("P60709","ACTB","Actin, cytoplasmic 1","Cytoplasm, cytoskeleton","intracellular","FALSE",2,0.97),
        ("P62805","HIST1H4A","Histone H4","Nucleus; Chromosome","intracellular","FALSE",5,0.9),
        ("P01275","GCG","Pro-glucagon","Secreted","secreted","FALSE",8,0.84)]
with open(L / "Semaglutide_top50.csv", "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["peptide","rank","protein","gene_name","protein_name","subcellular_location","location_class","is_target","normalized_score"])
    for a,g,n,loc,lc,t,r,s in rows: w.writerow(["Semaglutide",r,a,g,n,loc,lc,t,s])
