"""Verify key exact quotations in the P2 human approval pack against source bytes."""

from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[3]
CORE = (ROOT / "doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md").read_text(encoding="utf-8-sig")
ACT = (ROOT / "docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md").read_text(encoding="utf-8-sig")
ADR5 = (ROOT / "doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md").read_text(encoding="utf-8-sig")


def zip_entry(zip_path: str, suffix: str) -> str:
    with ZipFile(ROOT / zip_path) as archive:
        name = next(name for name in archive.namelist() if name.endswith(suffix))
        return archive.read(name).decode("utf-8-sig")


PLF = zip_entry("docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip", "01_FREEZE_DECLARATION.md")
STF = zip_entry("docs/e2e/sources/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip", "STEPS_TARGET_DESIGN_FREEZE_v0.1.md")

checks = {
    "CORE": (
        CORE,
        [
            "Starteria no debe inferir silenciosamente el alineamiento estratégico.",
            "Cobertura no prueba impacto de negocio.",
            "Las iniciativas independientes o públicas pueden existir sin un Frente Estratégico o Reto corporativo.",
            "La autoridad debe asociarse a un tipo de decisión, no suponerse únicamente por acceso al sistema.",
            "No se sobrescribe silenciosamente la historia.",
            "conservar el contenido existente",
            "evitar obligar al usuario a rehacer trabajo válido solo para satisfacer una secuencia estética.",
            "Para promover un claim a **L5 REALIZED**, Starteria debe contar con un resultado observado en operación y una fuente trazable.",
            "Para promoverlo a **L6 ATTRIBUTED**, además debe existir un método de atribución defendible y el validador requerido.",
            "revalidar únicamente lo materialmente afectado",
            "El output de Step 4 no es por sí mismo la decisión organizacional.",
        ],
    ),
    "ACT": (
        ACT,
        [
            "Este contrato termina al registrarse exitosamente `Start`. No define la pantalla, Step, ruta ni comportamiento posterior.",
            "Un Challenge Assignment puede existir, aceptarse e iniciarse como handoff sin que exista todavía una Initiative.",
            "Portfolio consume estado/eventos posteriores. No controla DOM, rutas, componentes o StepState interno.",
        ],
    ),
    "ADR5": (
        ADR5,
        [
            "Accept` no crea Project/Initiative.",
            "La futura formulación/materialización de una Initiative pertenece al workstream downstream.",
            "Project` se mantiene como la identidad productiva actual de Initiative mientras no exista otro ADR que cambie esa decisión.",
        ],
    ),
    "PLF": (
        PLF,
        [
            "retos o líneas de trabajo solo si ayudan",
            "confirmar, posponer, dejar sin vínculo, comparar duplicidades",
        ],
    ),
    "STF": (
        STF,
        [
            "pendiente de aprobación de integración en el repositorio y de reconciliación con las autoridades superiores.",
            "Invitación → aceptar → overview → Start → Copilot ayuda a formular una iniciativa candidata; revisión del mandato → persona confirma creación → Step 0 para delimitar el trabajo inicial.",
            "No duplicar Initiative, no inventar porcentaje, no aprobar Steps retroactivamente.",
            "Crear iniciativa → Copilot ayuda a explorar y ordenar → usuario revisa lo entendido → confirma iniciativa → Step 0.",
        ],
    ),
}

missing = [(source, quote) for source, (text, quotes) in checks.items() for quote in quotes if quote not in text]
print(f"checked={sum(len(quotes) for _, quotes in checks.values())}")
print(f"missing={missing}")
raise SystemExit(1 if missing else 0)
