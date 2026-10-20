from pathlib import Path

root = Path(__file__).resolve().parents[1]
tech = (root / "STARTERIA_UNIFIED_E2E_TECH_SPEC_v0.1.md").read_text(encoding="utf-8")
matrix = (root / "STARTERIA_E2E_TRACEABILITY_MATRIX_v0.1.md").read_text(encoding="utf-8")

tech_required = [
    "FROZEN_FOR_P6_IMPLEMENTATION", "## 2. AS-IS inventory and KEEP / ADAPT / REPAIR / NEW",
    "## 3. Canonical ownership and IDs", "## 4. State machines and conceptual commands",
    "## 5. Permissions matrix", "## 6. Persistence, migrations and idempotency",
    "## 7. API / read-model plan", "## 8. Event and read-model plan",
    "## 9. Test plan and phase gates", "## 10. ADR boundaries and implementation stop rules",
    "P5-AC01", "P5-AC12", "InitiativeConfirmationAuthority", "deny-by-default",
]
matrix_required = [f"TR-{n:02d}" for n in range(1, 26)] + [
    "P1’s T01–T25 retain their `BLOCKED` classifications", "No P2/P3 candidate rule is reclassified as Core authority"
]
missing_tech = [item for item in tech_required if item not in tech]
missing_matrix = [item for item in matrix_required if item not in matrix]
forbidden = ["Core v0.3 as authority", "INT-01 as authority", "SupportRequest table is approved"]
found_forbidden = [item for item in forbidden if item in tech or item in matrix]
print(f"missing_tech={missing_tech}")
print(f"missing_matrix={missing_matrix}")
print(f"found_forbidden={found_forbidden}")
if missing_tech or missing_matrix or found_forbidden:
    raise SystemExit(1)
