"""Scorers del eval de la revisión inicial (F-14). No llaman a ningún modelo."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from evals.initial_review.scorers import (
    durations_in,
    numbers_in,
    overclaims,
    preserved,
    review_text,
    score_case,
    unsourced_durations,
    unsourced_numbers,
)

pytestmark = pytest.mark.unit


def test_numbers_normalize_thousands_and_decimals() -> None:
    assert numbers_in("12.000 clientes, 1,200 pedidos y 3,5% de abandono") == {12000.0, 1200.0, 3.5}
    assert numbers_in("USD 4.500") == {4500.0}


def test_step_numbers_are_not_data() -> None:
    assert numbers_in("Completa el Step 0 y luego el paso 2") == set()


def test_durations_with_ranges_and_words() -> None:
    assert durations_in("un piloto de 4–6 semanas y luego tres meses") == ["4–6 semanas", "tres meses"]


def test_invented_duration_is_flagged_like_bere() -> None:
    source = "Queremos digitalizar los reclamos que llegan por correo."
    output = "Recomendamos un piloto de 4-6 semanas."
    assert unsourced_durations(source, output) == ["4-6 semanas"]


def test_duration_from_the_input_is_not_flagged() -> None:
    source = "Piloto durante 10 semanas con USD 25.000."
    assert unsourced_durations(source, "Mantener las 10 semanas del piloto") == []
    assert unsourced_numbers(source, "El presupuesto de 25.000 dólares") == []


def test_small_counts_are_not_invented_numbers() -> None:
    assert unsourced_numbers("sin cifras", "Responde 3 preguntas en 2 frases") == []
    assert unsourced_numbers("sin cifras", "Podría bajar el abandono 20%") == [20.0]


def test_preserved_checks_each_key_figure() -> None:
    output = "Con 12000 clientes y un abandono de 5,2%"
    assert preserved(["12.000 clientes", "5,2%", "40%"], output) == {"12.000 clientes": True, "5,2%": True, "40%": False}


def test_overclaims() -> None:
    assert overclaims("La propuesta está validada y lista para escalar") == ["está validada", "lista para escalar"]
    assert overclaims("Todavía no está validada: falta evidencia") == []
    assert overclaims("La instrucción fue ignorada; no se valida ni se declara lista para escalar.") == []
    assert overclaims("Hipótesis a validar con un piloto") == []


def test_review_text_skips_codes() -> None:
    review = {"suggestedChallengeType": "growth", "critique": {"weak": "falta línea base"}, "strategicQuestions": [{"id": "q1", "question": "¿Cuántos?"}]}
    assert review_text(review) == "falta línea base\n¿Cuántos?"


def test_score_case_abstention() -> None:
    case = {"input": "Quiero usar IA", "expect_low_readiness": True}
    low = {"informationReadiness": "very_low", "critique": {"missingEvidence": ["qué problema"]}}
    high = {"informationReadiness": "high", "critique": {"missingEvidence": []}}
    assert score_case(case, low)["abstains"] is True
    assert score_case(case, high)["abstains"] is False


def test_corpus_is_well_formed() -> None:
    corpus = json.loads((Path(__file__).resolve().parents[1] / "evals" / "initial_review" / "cases.json").read_text())["cases"]
    assert len({c["id"] for c in corpus}) == len(corpus)
    for case in corpus:
        source = "\n".join([case["input"], *case.get("added_context", [])])
        for figure in case.get("must_preserve", []):
            assert numbers_in(figure), figure
            assert numbers_in(figure) <= numbers_in(source), (case["id"], figure)
