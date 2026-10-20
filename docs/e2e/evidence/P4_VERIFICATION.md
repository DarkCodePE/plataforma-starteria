# P4 Verification Evidence

**Artifact:** `docs/e2e/STARTERIA_UNIFIED_E2E_TO_BE_v0.1.html`  
**Authority:** P2 frozen experience contract; P3 Reasoning/Card contracts; P4 QA checklist.

**TEST:** `rtk proxy python docs/e2e/evidence/p4_verify_prototype.py`; exit 0; output `html_parse=PASS`, `missing_required=[]`, `missing_routes=[]`. It validates the standalone HTML parser, mandatory simulation labels, all journey states and Route A/B/C/Step/Decision/return navigation targets.

**TEST:** `rtk proxy node -e ...new Function(script)...`; exit 0; output `prototype_javascript=PASS`. This validates that the embedded navigation script parses.

**Result interpretation:** PASS verifies the P4 prototype artifact only. It does not convert P1 runtime blockers into product PASS or assert that a deployed service supports these interactions.
