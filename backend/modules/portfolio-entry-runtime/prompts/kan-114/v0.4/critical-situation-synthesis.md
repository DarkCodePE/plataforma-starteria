# Critical Situation Synthesis — governed output contract

Return only one JSON object that conforms exactly to the supplied CriticalSituationSynthesis schema. Do not add Markdown, commentary, fields, or text outside the JSON object.

Use only the authorized snapshot in the request. Treat its source references and provenance as the complete available evidence for this synthesis. Do not use prior conversation, assumptions, external knowledge, web sources, connected systems, or organizational data. Do not invent facts, evidence, causality, authority, outcomes, constraints, or source references. When support is absent or insufficient, preserve uncertainty or leave the relevant optional content empty as the schema allows.

## Claims and provenance

Treat `claim_ref` as an exact JSON output path, never prose or a claim description. For example, paths have forms such as `situation_model.current_situation[0]`, `decision_frame.decision_to_prepare`, `usable_now[0]`, and `candidate_first_movement.movement`. Each provenance record's `claim_ref` must exactly match the path of the output claim it supports, including its field name and array index.

For every output claim at these paths, include at least one provenance record with that exact `claim_ref`:

- Optional `situation_model.desired_change` and `situation_model.decision_to_enable`; each item in `situation_model.current_situation[i]`, `situation_model.existing_work_or_assets[i]`, `situation_model.known_evidence[i]`, `situation_model.constraints[i]`, `situation_model.actors_and_authority[i]`, `situation_model.dependencies[i]`, `situation_model.uncertainties[i]`, `situation_model.time_pressure[i]`, and `situation_model.existing_alternatives[i]`.
- `situation_insight.statement` when it is non-null, and each `material_tensions[i].statement`.
- `decision_frame.decision_to_prepare` when non-null, `decision_frame.decision_authority`, and each item in `decision_frame.materially_distinct_paths[i]`, `decision_frame.distinguishing_conditions[i]`, `decision_frame.timing_or_constraints[i]`, and `decision_frame.unresolved_basis[i]`.
- Each `usable_now[i]` item and each `decision_changing_unknowns[i].uncertainty`.
- When `candidate_first_movement` is present, `candidate_first_movement.movement`, `candidate_first_movement.why_now`, `candidate_first_movement.what_it_may_clarify`, `candidate_first_movement.decision_supported`, and `candidate_first_movement.boundary`, plus each `candidate_first_movement.existing_assets_used[i]` item.

When a claim has support references, at least one provenance record for its exact claim path must include each of those references in `source_refs`. `provenance.source_refs` may contain only reference identifiers supplied in `authorized_snapshot.source_refs`; do not fabricate or infer source references. The values in `support`, `source_refs`, and `current_evidence` are reference identifiers, not paraphrased evidence text. Keep evidence text in its designated field only when the schema and authorized input provide it.

For each `usable_now[i]`, `usable_now[i].provenance_refs` may contain only IDs of provenance records whose `claim_ref` is exactly `usable_now[i]`. Do not link that item to a record for another output path.

Represent the epistemic role of claims as `FACT`, `INTERPRETATION`, `PROPOSAL`, or `UNKNOWN`. An `epistemic_role` describes the epistemic nature of a claim, not its origin or provenance. Keep these dimensions separate: preserve provenance `origin`, `review_disposition`, source references, and available dates; never replace them with `epistemic_role` or turn an inference or suggestion into a user-confirmed fact. A `FACT` must be directly grounded in a user declaration or a user-confirmed extracted value.

Use `epistemic_role = FACT` only when the claim is directly supported by authorized evidence. When the supporting authorized source item has `kind = user_message` and the claim preserves something directly stated by that source, its provenance record MUST use `origin = USER_DECLARED` and MUST contain that exact authorized source ref. Apply the same requirement when the supporting authorized source item has `kind = user_correction`: use `origin = USER_DECLARED` and include that exact authorized source ref. Preserve the snapshot's `review_disposition`; it may remain `UNREVIEWED` unless the authorized snapshot provides another disposition. Do not use `AI_INFERRED`, `AI_SUGGESTED`, or `EXTRACTED_FROM_USER_TEXT` for a FACT directly grounded in a raw `user_message` or `user_correction`.

Use `origin = EXTRACTED_FROM_USER_TEXT` only when the authorized snapshot itself contains a provisional extracted value whose provenance says `EXTRACTED_FROM_USER_TEXT`. Do not use this origin merely because the model paraphrased, summarized, selected, or reformulated content from a user message. A direct `user_message` remains `USER_DECLARED` evidence.

When a claim introduces a relationship, consequence, synthesis, diagnostic reading, decision structure, tension interpretation, or sequence dependency that the user did not directly state, use `epistemic_role = INTERPRETATION` and `origin = AI_INFERRED`. The claim may cite authorized source refs that support the interpretation. Grounding an interpretation in evidence does not make it a FACT.

For a proposed first movement or another proposal claim, use `epistemic_role = PROPOSAL` and `origin = AI_SUGGESTED`. Preserve the authorized source refs used to ground the proposal.

## Material tension provenance path

The root collection `material_tensions[i]` is the provenance-bearing source of truth. The `situation_model.material_tensions` collection must be deeply identical to the root collection, but it is only a projection. Generate provenance for `material_tensions[i].statement`. Do NOT generate a separate provenance record for `situation_model.material_tensions[i].statement`.

## Synthesis boundaries

Produce a situation insight only when it expresses a useful, supported relationship, tension, decision structure, or sequence dependency. If the snapshot does not support one, return `status: "no_supported_insight"`, `novelty_type: "no_supported_insight"`, `statement: null`, and an empty support list. Do not present a polished paraphrase as an insight.

Include a material tension with `status: "supported"` only when the snapshot contains enough valid source references to support the conditions and their material relationship. A high count, missing evidence, a proposed solution, or an unknown alone does not establish a tension. If a material candidate cannot be supported, use `status: "unresolved"` with empty support, or omit it when there is no material candidate to record. Keep `situation_model.material_tensions` identical to the root `material_tensions` collection.

## Material insight and tension thresholds

Missing information, ambiguity, lack of evidence, lack of goals, or absence of documented criteria do not by themselves constitute a supported insight or material tension. These are limits on what can be concluded, not findings. A supported situation insight requires a supported relationship between conditions that changes how the situation or decision should be understood.

Qualifying relationship patterns include timing combined with lagging evidence that constrains interpretation; usable work combined with a blocked dependency that exposes sequence; an approaching commitment combined with missing outcome evidence that changes the decision basis; or conflicting supported accounts that expose a mechanism requiring clarification. Treat these as general reasoning patterns, not as required output forms.

The following do not qualify by themselves: not enough information, an unclear goal, many initiatives, unknown authority, or no evidence yet. When only such missingness or an unsupported condition is present, prefer `situation_insight.status = "no_supported_insight"`, with `novelty_type = "no_supported_insight"`, `statement = null`, and an empty support list. Use `material_tensions = []` unless an independently supported material relationship exists. Do not manufacture value by turning absence into a polished insight.

A supported material tension requires at least two supported conditions whose coexistence creates a meaningful constraint, conflict, tradeoff, or sequencing problem for a decision. A broad goal, missing information, a large inventory, unknown authority, or evidence not yet supplied does not by itself establish that relationship. If no supported conflict, tradeoff, constraint, or dependency exists, prefer no tension.

## Decision identifiability and existing checkpoints

A decision can be identifiable even when its answer is unknown, evidence is pending, authority is not yet confirmed, conditions remain unresolved, or the decision depends on an upcoming checkpoint. `status = "framed"` means Starteria can name the choice or commitment to prepare; it does not mean Starteria knows the correct answer.

Use `status = "framed"` when the authorized snapshot supports an explicit upcoming decision or commitment, such as a renewal, review, release, approval, continuation, adoption, sequencing choice, or checkpoint. It may also be framed when materially distinct next paths can be named conditionally. Use `status = "not_yet_identifiable"` only when the snapshot does not yet allow a meaningful choice, commitment, or decision object to be named. Unknown authority alone does not make a decision unidentifiable. Pending evidence alone does not make a decision unidentifiable.

When work is already underway and a meaningful checkpoint exists, use that checkpoint before proposing new work. Frame the decision it is intended to inform when the snapshot supports it; do not require the checkpoint result to be known before framing the decision. Do not design a new experiment unless the existing checkpoint cannot inform the decision sought.

When some work can proceed independently while another part is blocked, make the sequence explicit. Distinguish what can proceed now from what requires permission, evidence, or another actor. If this creates a meaningful choice about continuation or sequencing, the decision may be framed even when the dependency owner is unknown. Do not confuse unknown authority with an unknown decision.

## Minimal reasoning lens selection

Use the smallest sufficient set of reasoning lenses. Select a lens only when it materially changes at least one of the situation reading, insight, tension, decision frame, decision-changing unknowns, or first movement. Do not select a lens merely because it is adjacent to the topic.

- **Priority / allocation:** select only for a real allocation or focus tradeoff between competing work, resources, or alternatives. Multiple initiatives alone do not trigger it.
- **Governance:** select only when authority, decision rights, progression rules, approval, or ownership materially changes the situation or next action. Unknown authority alone does not trigger it.
- **Risk:** select only when an identified uncertainty or condition materially changes exposure, decision conditions, or downside. Uncertainty alone does not trigger it.
- **Alignment:** select only for a supported mismatch between goals, actors, interpretations, or decision criteria.
- **Diagnosis:** select only when understanding the mechanism, cause, or location of a problem materially matters.
- **Dependencies:** select only when another actor, system, or condition gates or materially constrains progress.
- **System design:** select only when the operating mechanism or structure itself is under review.

Record only selected families in `reasoning_metadata.selected_lenses`; use an empty array when no lens materially changes the synthesis.

Keep `situation_model.desired_change` distinct from `decision_frame`: the former describes a sought change or outcome; the latter prepares an identifiable decision. Do not invent a decision or authority. Use `not_yet_identifiable` when the decision cannot yet be named. Preserve an authorized `decision_to_enable` as supplied; do not silently replace it.

Populate `usable_now` only from assets, work, evidence, context, or constraints present in the authorized snapshot. Cite the supplied source references and explain how each item can help. Review existing work and assets before proposing any new activity. Do not imply that Starteria independently verified user-provided material.

Include only decision-changing unknowns: resolving each one could materially change the situation reading, decision frame, tension, first movement, dependency, risk, ability to act, or later continuation shape. For each unknown, identify the uncertainty, what decision or movement it could change in `why_it_matters`, available evidence, a suitable resolution mode, and only applicable impact dimensions from `situation_reading`, `decision_frame`, `material_tension`, `first_movement`, `critical_dependency`, `material_risk`, `ability_to_act_now`, and `starteria_continuation_shape`. Do not add gaps merely because more information could be useful. Return `uncertainty_statement = null`; keep governed unknowns in `decision_changing_unknowns`.

Return `candidate_first_movement: null` when the snapshot does not support a contextual and proportionate first movement. Otherwise provide a proposal grounded in existing assets where possible, why it is appropriate now, what it may clarify, the decision it supports, and what remains unresolved or unauthorized. Do not prescribe detailed execution.

These are governed reasoning results, not a request for private reasoning. Do not reveal chain-of-thought, hidden deliberation, internal scratch work, or step-by-step private analysis. Return only the concise, schema-defined results and their supported explanations.

Do not create canonical entities or canonicalize the snapshot. Do not generate a Starteria Path, design a complete experiment, assign budgets or scores, set numerical thresholds, activate work, or decide on the user's behalf. Do not include question planning, stopping decisions, handoff content, session state, authentication, or conversion output.
