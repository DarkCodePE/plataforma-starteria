/**
 * Frozen KAN-114 evaluation expectations. This module is consumed only after
 * the adapter call and is never included in a model payload.
 */
export type Lens =
  | 'priority / allocation'
  | 'diagnosis'
  | 'evidence / learning'
  | 'sequencing'
  | 'dependencies'
  | 'governance'
  | 'capacity'
  | 'risk'
  | 'alignment'
  | 'system design';

export type ReviewExpectation = {
  fixture_id: string;
  expected_reasoning_family: string[];
  expected_lenses: Lens[];
  forbidden_lenses: Lens[];
  supported_facts: string[];
  forbidden_inference: string[];
  insight_expectation: {
    status: 'supported' | 'no_supported_insight';
    novelty_type: 'relationship_made_explicit' | 'tension_made_explicit' | 'decision_structure_clarified' | 'sequence_dependency_exposed' | 'no_supported_insight';
    characteristics: string[];
  };
  tension_expectation: { status: 'supported' | 'unresolved'; characteristics: string[] };
  decision_frame_expectation: { status: 'framed' | 'not_yet_identifiable'; characteristics: string[] };
  usable_now_expectation: string[];
  unknown_characteristics: Array<{
    uncertainty: string;
    why_it_matters: string;
    current_evidence: string;
    resolution_mode: string;
    related_decision: string;
    impact_dimensions: string[];
  }>;
  first_movement_characteristics: string[] | null;
  prohibited_outputs: string[];
};

export const CRITICAL_SITUATION_SYNTHESIS_REVIEW_MATRIX: readonly ReviewExpectation[] = [
  {
    fixture_id: 'CS-01',
    expected_reasoning_family: ['allocation and sequencing under lagging outcome evidence'],
    expected_lenses: ['priority / allocation', 'diagnosis', 'evidence / learning', 'capacity', 'sequencing'],
    forbidden_lenses: ['governance', 'dependencies', 'alignment', 'system design', 'risk'],
    supported_facts: ['Eight initiatives share limited analysis capacity.', 'Churn rose in two segments over two quarters and is observed with delay.', 'A quarterly portfolio review is ten weeks away.', 'No initiative is established as causing or reducing churn.'],
    forbidden_inference: ['Attribute churn causality or efficacy to an initiative.', 'Declare one segment more important.', 'Assume a budget change solves the issue.', 'Treat quarterly progress as causal churn impact.'],
    insight_expectation: { status: 'supported', novelty_type: 'relationship_made_explicit', characteristics: ['Relate lagging churn evidence, the review horizon, and shared analysis capacity; explain how they constrain sequencing.'] },
    tension_expectation: { status: 'supported', characteristics: ['Visible progress is needed before lagging churn outcomes can be observed while initiatives compete for limited analysis capacity.'] },
    decision_frame_expectation: { status: 'framed', characteristics: ['Prepare focus/sequencing and intermediate evidence for the review; preserve which prioritization choices remain open.'] },
    usable_now_expectation: ['Existing initiative inventory.', 'Existing churn series by segment and period.', 'The ten-week review horizon; do not invent an agenda.', 'Use intermediate signals only if they already exist.'],
    unknown_characteristics: [
      { uncertainty: 'Which initiatives already have relevant intermediate signals.', why_it_matters: 'Could change the focus for the upcoming review.', current_evidence: 'Initiative inventory and existing indicators, with no confirmed initiative-to-signal relationship.', resolution_mode: 'Reuse existing records and signals.', related_decision: 'Sequencing and focus.', impact_dimensions: ['situation_reading', 'decision_frame', 'first_movement'] },
      { uncertainty: 'Whether intermediate signals are available and whether they inform churn or only activity.', why_it_matters: 'Could change how progress is interpreted.', current_evidence: 'Lagging churn by segment and period; no intermediate signal is described.', resolution_mode: 'Inspect existing artifacts and reuse signals if present; otherwise request owner input about what has already been observed.', related_decision: 'What evidence to prepare.', impact_dimensions: ['situation_reading', 'material_risk', 'decision_frame'] },
      { uncertainty: 'How much analysis capacity is available without displacing critical work.', why_it_matters: 'Could change which sequence is viable.', current_evidence: 'Shared, limited capacity is declared; amount and availability are unknown.', resolution_mode: 'Ask the organizational capacity owner.', related_decision: 'Focus and sequencing.', impact_dimensions: ['decision_frame', 'ability_to_act_now', 'first_movement'] },
    ],
    first_movement_characteristics: ['Relate existing initiatives, segments, and already available signals before reallocating work.', 'State what this can clarify for the review and that it cannot prove causal impact.'],
    prohibited_outputs: ['Automatically propose new initiatives.', 'Definitive ranking or budget threshold.', 'Claim an initiative reduces churn.', 'Cancel/continue recommendations without analysis.', 'A complete experiment design.'],
  },
  {
    fixture_id: 'CS-02',
    expected_reasoning_family: ['progression mechanism and governance diagnosis'],
    expected_lenses: ['system design', 'governance', 'sequencing', 'diagnosis', 'evidence / learning'],
    forbidden_lenses: ['priority / allocation', 'dependencies', 'risk', 'alignment', 'capacity'],
    supported_facts: ['46 backlog ideas across three cohorts; six passed initial review.', 'Progression criteria are not documented.', 'Program staff and two sponsors give different explanations for stalled progress.', 'Committee minutes, cohort history, and partial ownership records exist.'],
    forbidden_inference: ['Assume a shared denominator for 46 and six.', 'Blame the committee, sponsors, owners, idea quality, or intent without evidence.', 'Conclude ideas are missing or the whole program needs redesign.'],
    insight_expectation: { status: 'supported', novelty_type: 'tension_made_explicit', characteristics: ['Relate progression reports, undocumented criteria, and divergent accounts without assigning a sole cause or comparing unsupported denominators.'] },
    tension_expectation: { status: 'supported', characteristics: ['Progression is reported, but criteria and the point of disagreement about where work stops are not established.'] },
    decision_frame_expectation: { status: 'framed', characteristics: ['Identify which progression/governance mechanism and decision owner to clarify before changing the program.'] },
    usable_now_expectation: ['Backlog, cohort history, committee minutes, states, and existing ownership records.', 'Review existing examples of work that progressed and did not progress.'],
    unknown_characteristics: [
      { uncertainty: 'At which transition cases stop progressing.', why_it_matters: 'Locates the mechanism that may need review.', current_evidence: 'Cohort history and committee minutes exist; case coverage is not specified.', resolution_mode: 'Reuse records and trace existing cases.', related_decision: 'Where to intervene in progression.', impact_dimensions: ['situation_reading', 'material_tension', 'first_movement'] },
      { uncertainty: 'Which conditions the committee actually applies.', why_it_matters: 'Could change how criteria and required evidence are understood.', current_evidence: 'Criteria are undocumented and minutes exist.', resolution_mode: 'Review minutes and ask the committee if the records do not suffice.', related_decision: 'Clarification or adjustment of governance.', impact_dimensions: ['decision_frame', 'material_tension', 'ability_to_act_now'] },
      { uncertainty: 'What evidence or documentation sponsors consider insufficient.', why_it_matters: 'Could change what part of the mechanism to clarify and avoid blaming the committee without evidence.', current_evidence: 'Two sponsor accounts and partial ownership records.', resolution_mode: 'Request organizational input from sponsors/owners and review existing cases and artifacts.', related_decision: 'Which information or transition to clarify.', impact_dimensions: ['situation_reading', 'decision_frame', 'first_movement'] },
      { uncertainty: 'Who has authority to change progression criteria.', why_it_matters: 'Determines who can enable a decision.', current_evidence: 'Committee and sponsors are mentioned, but authority is not stated.', resolution_mode: 'Request input from the relevant organizational owner.', related_decision: 'Responsible person and scope of any adjustment.', impact_dimensions: ['decision_frame', 'critical_dependency', 'ability_to_act_now'] },
    ],
    first_movement_characteristics: ['Trace a small set of existing cases through their decisions and artifacts.', 'Use the partial sample to locate a transition, not to generalize a full program design.'],
    prohibited_outputs: ['More ideas as the solution.', 'Conclude that idea quality or the committee is the cause.', 'Universal innovation methodology.', 'Redesign the whole program or recommend budget.'],
  },
  {
    fixture_id: 'CS-03',
    expected_reasoning_family: ['investment continuity under unmeasured outcome and renewal timing'],
    expected_lenses: ['evidence / learning', 'risk', 'governance', 'sequencing'],
    forbidden_lenses: ['priority / allocation', 'diagnosis', 'dependencies', 'alignment', 'system design', 'capacity'],
    supported_facts: ['Automation platform purchased nine months ago and used by two pilot teams.', 'Annual renewal is in seven weeks.', 'Expected outcome is reduced cycle time, with no confirmed baseline or agreed measure.', 'Contract, pilot usage records, and current process description exist.'],
    forbidden_inference: ['Renew because money was already spent.', 'Cancel because a baseline is missing.', 'Invent ROI, savings, usage level, failure, or organization-wide adoption.', 'Recommend renewal or cancellation automatically.'],
    insight_expectation: { status: 'supported', novelty_type: 'decision_structure_clarified', characteristics: ['Clarify how the approaching renewal and unmeasured expected outcome shape the evidence/conditions needed for continuity.'] },
    tension_expectation: { status: 'supported', characteristics: ['Renewal timing is close while the expected outcome has no confirmed baseline or agreed measure; timing does not prove value.'] },
    decision_frame_expectation: { status: 'framed', characteristics: ['Prepare evidence and conditions for renewal, renegotiation, bounded extension, or non-continuity as contextual options, not a recommendation.'] },
    usable_now_expectation: ['Existing contract, pilot usage records, current process for the two teams, and declared outcome.', 'Inspect contract terms rather than assuming useful flexibility exists.'],
    unknown_characteristics: [
      { uncertainty: 'What cycle-time change can be observed in the pilot teams.', why_it_matters: 'Could change continuity conditions without automatically proving causality.', current_evidence: 'Usage logs and current process exist; baseline is unconfirmed.', resolution_mode: 'Reuse existing records and compare them with the expected outcome definition.', related_decision: 'Evidence and conditions for renewal.', impact_dimensions: ['situation_reading', 'decision_frame', 'material_risk'] },
      { uncertainty: 'Whether the logs and measures cover the use relevant to a decision.', why_it_matters: 'Could change how much weight the evidence can carry.', current_evidence: 'Records from two pilot teams exist; their coverage is not described.', resolution_mode: 'Inspect existing evidence and request input from the pilot owner.', related_decision: 'Conditions or scope of continuity.', impact_dimensions: ['situation_reading', 'decision_frame', 'first_movement'] },
      { uncertainty: 'What renewal flexibility or conditions the contract provides.', why_it_matters: 'Could open or limit scope and timing options.', current_evidence: 'A contract exists; relevant terms have not been extracted.', resolution_mode: 'Review the contract and ask an authorized organizational owner if interpretation is needed.', related_decision: 'Renewal, renegotiation, or extension.', impact_dimensions: ['decision_frame', 'material_risk', 'ability_to_act_now'] },
      { uncertainty: 'Who can validate the outcome and measure for this decision.', why_it_matters: 'Defines which evidence is acceptable.', current_evidence: 'The expected outcome is stated; an accountable validator is not identified.', resolution_mode: 'Request input from the person with organizational authority.', related_decision: 'Evidentiary conditions for continuity.', impact_dimensions: ['decision_frame', 'critical_dependency', 'ability_to_act_now'] },
    ],
    first_movement_characteristics: ['Bring existing contract, usage records, and process description together before renewal.', 'Clarify what can be established and what remains unknown without promising retrospective causal measurement.'],
    prohibited_outputs: ['Renew due to sunk cost.', 'Cancel for lack of baseline.', 'Invent ROI or vendor evidence.', 'Assign budget.', 'Design a complete experiment.'],
  },
  {
    fixture_id: 'CS-04',
    expected_reasoning_family: ['separate independent preparation from permission-dependent validation'],
    expected_lenses: ['dependencies', 'governance', 'sequencing', 'evidence / learning'],
    forbidden_lenses: ['priority / allocation', 'alignment', 'system design', 'diagnosis', 'capacity', 'risk'],
    supported_facts: ['Real data access is controlled by another department and requires approval.', 'The request has been pending five weeks without a response date.', 'The claims flow is documented; fields can be mapped with synthetic samples.', 'Real-data validation depends on permission.', 'A tracked request and department contact exist.'],
    forbidden_inference: ['Assume the department is intentionally blocking.', 'Assume approval is certain or impossible.', 'Treat synthetic samples as real evidence.', 'Assume access is authorized.'],
    insight_expectation: { status: 'supported', novelty_type: 'sequence_dependency_exposed', characteristics: ['Expose which preparation can proceed independently and which validation remains conditional on permission.'] },
    tension_expectation: { status: 'supported', characteristics: ['Some preparation can proceed while validation on real data requires the external department’s permission.'] },
    decision_frame_expectation: { status: 'framed', characteristics: ['Prepare independent work, clarify who can authorize access, and sequence real-data validation only after permission.'] },
    usable_now_expectation: ['Documented claims flow, tracked access request, and department contact.', 'Synthetic samples may be used only if available; their availability is not asserted.'],
    unknown_characteristics: [
      { uncertainty: 'The request state, owner, and effective authority.', why_it_matters: 'Determines the next coordination point and dependency.', current_evidence: 'A tracked request and contact exist; the request has been pending for five weeks.', resolution_mode: 'Request organizational input from the department owner through the existing channel.', related_decision: 'Who can clarify or authorize access.', impact_dimensions: ['decision_frame', 'critical_dependency', 'ability_to_act_now'] },
      { uncertainty: 'Permission conditions and expected timing.', why_it_matters: 'Changes sequencing and the scope of dependent work.', current_evidence: 'No response date is available.', resolution_mode: 'Request authorized input from the access owner.', related_decision: 'When to prepare real-data validation.', impact_dimensions: ['decision_frame', 'critical_dependency', 'first_movement'] },
      { uncertainty: 'Whether mapping with synthetic samples will remain valid with real data.', why_it_matters: 'Could limit which preparation can be reused.', current_evidence: 'The flow and synthetic samples are described; no real-data validation has occurred.', resolution_mode: 'Technical review using data only after authorization.', related_decision: 'Which independent preparation to retain.', impact_dimensions: ['situation_reading', 'first_movement', 'ability_to_act_now'] },
    ],
    first_movement_characteristics: ['Use the existing request/contact to clarify owner, state, and next decision point.', 'Limit preparation to work that does not need protected data; name what cannot be learned without permission.'],
    prohibited_outputs: ['Bypass access controls.', 'Treat synthetic samples as real evidence.', 'Automatically escalate to a higher authority.', 'Stop all work without separating independent preparation.', 'Design final data analysis.'],
  },
  {
    fixture_id: 'CS-05',
    expected_reasoning_family: ['clarify an underspecified aspiration before portfolio diagnosis'],
    expected_lenses: ['evidence / learning'],
    forbidden_lenses: ['priority / allocation', 'dependencies', 'governance', 'capacity', 'risk', 'alignment', 'system design', 'sequencing', 'diagnosis'],
    supported_facts: ['The person wants to “innovate more”.', 'There are 23 active initiatives with names, owners, and current states.', 'No outcome, goal, obstacle, horizon, or progression evidence was supplied.'],
    forbidden_inference: ['Assume more ideas are needed.', 'Infer excess, redundancy, low quality, or low impact.', 'Infer capacity, governance, or alignment problems from the count.'],
    insight_expectation: { status: 'no_supported_insight', novelty_type: 'no_supported_insight', characteristics: ['The aspiration and inventory do not establish a material relationship or cause.'] },
    tension_expectation: { status: 'unresolved', characteristics: ['A broad aspiration and many initiatives do not by themselves show an operational conflict.'] },
    decision_frame_expectation: { status: 'not_yet_identifiable', characteristics: ['Clarify what result “more” means before naming a decision.'] },
    usable_now_expectation: ['Use the inventory and its names, owners, and states to clarify the aspiration.', 'Do not imply that the inventory includes outcomes or quality.'],
    unknown_characteristics: [
      { uncertainty: 'What concrete change or outcome “innovate more” means.', why_it_matters: 'Without it, no decision or justified portfolio movement can be identified.', current_evidence: 'The aspiration and an inventory of names, owners, and states; no outcome is supplied.', resolution_mode: 'Clarify context directly with the person.', related_decision: 'Not yet identifiable until the desired change is clear.', impact_dimensions: ['situation_reading', 'decision_frame', 'ability_to_act_now'] },
    ],
    first_movement_characteristics: ['Explore the existing inventory with the person to clarify the desired result before ideation.', 'Do not conclude which problem exists.'],
    prohibited_outputs: ['More ideation by default.', 'A governance bottleneck.', 'Quantity-versus-quality tension.', 'Prioritization, ranking, new program, or closed diagnosis.'],
  },
  {
    fixture_id: 'CS-06',
    expected_reasoning_family: ['insufficient basis and contextual clarification'],
    expected_lenses: ['evidence / learning'],
    forbidden_lenses: ['priority / allocation', 'diagnosis', 'dependencies', 'governance', 'capacity', 'risk', 'alignment', 'system design', 'sequencing'],
    supported_facts: ['The person perceives that something at work needs improvement.', 'The person reports that others call it strategic, without naming who or what they mean.'],
    forbidden_inference: ['Infer misalignment, poor strategy, low capacity, authority conflict, urgency, or a specific initiative.'],
    insight_expectation: { status: 'no_supported_insight', novelty_type: 'no_supported_insight', characteristics: ['Do not turn a persuasive paraphrase into an insight.'] },
    tension_expectation: { status: 'unresolved', characteristics: ['No supported pair of conditions establishes a material tension.'] },
    decision_frame_expectation: { status: 'not_yet_identifiable', characteristics: ['A single clarification about the concrete change or decision may establish whether a decision frame exists.'] },
    usable_now_expectation: ['No asset or work has demonstrated utility; the broad statement may be retained as context only.'],
    unknown_characteristics: [
      { uncertainty: 'What concrete result or situation the person wants to change, or what decision they need to prepare.', why_it_matters: 'Determines whether a useful reading or action can be framed.', current_evidence: 'The single broad statement, with no specific supporting context.', resolution_mode: 'Clarify context directly with the person.', related_decision: 'Not yet identifiable; the answer determines whether it can be framed.', impact_dimensions: ['situation_reading', 'decision_frame', 'ability_to_act_now'] },
    ],
    first_movement_characteristics: null,
    prohibited_outputs: ['Fabricated insight, tension, or recommendation.', 'Strategic diagnosis or generic framework.', 'Innovation plan or multiple questions.', 'False certainty from polished language.'],
  },
  {
    fixture_id: 'CS-07',
    expected_reasoning_family: ['external-evidence and authorized-review dependency'],
    expected_lenses: ['risk', 'evidence / learning', 'governance', 'dependencies', 'sequencing'],
    forbidden_lenses: ['priority / allocation', 'capacity', 'alignment', 'system design', 'diagnosis'],
    supported_facts: ['A financial-entity product team plans a feature launch in fourteen weeks.', 'A product brief and internal risk memo exist.', 'The memo requests regulatory review but identifies neither the applicable rule nor whether it covers the feature.', 'The Compliance owner has not replied; a launch date is planned.'],
    forbidden_inference: ['Name a regulation or claim compliance/non-compliance.', 'Conclude launch is illegal, safe, or impossible.', 'Treat the internal memo as external verification.', 'Claim an external source was consulted.'],
    insight_expectation: { status: 'supported', novelty_type: 'sequence_dependency_exposed', characteristics: ['Expose that planned timing/scope depends on unconfirmed applicability and authorized review, without claiming what a rule requires.'] },
    tension_expectation: { status: 'supported', characteristics: ['A planned launch date coexists with explicit uncertainty about applicability and regulatory review.'] },
    decision_frame_expectation: { status: 'framed', characteristics: ['Prepare date, scope, or sequence conditions subject to authoritative external evidence and Compliance authority.'] },
    usable_now_expectation: ['Existing brief, internal memo, planned launch date, and named Compliance owner.', 'These bound a validation request but do not substitute for external evidence.'],
    unknown_characteristics: [
      { uncertainty: 'Which official rule applies to the feature and how.', why_it_matters: 'Could change the decision frame and risk.', current_evidence: 'The internal memo requests review but identifies neither a rule nor its applicability.', resolution_mode: 'Obtain authoritative external evidence through Compliance or another authorized person.', related_decision: 'Date and scope conditions.', impact_dimensions: ['situation_reading', 'decision_frame', 'material_risk', 'starteria_continuation_shape'] },
      { uncertainty: 'What review or approval is required and how long it takes.', why_it_matters: 'Changes sequencing against the planned date.', current_evidence: 'The internal memo and planned date exist; requirements and timing are unspecified.', resolution_mode: 'Obtain authorized external evidence and Compliance input.', related_decision: 'Release sequence and conditions.', impact_dimensions: ['decision_frame', 'critical_dependency', 'material_risk', 'first_movement'] },
      { uncertainty: 'Who can confirm the interpretation and authorize release.', why_it_matters: 'Determines the critical dependency and ability to act.', current_evidence: 'A Compliance owner is identified but has not responded.', resolution_mode: 'Request input from the designated owner and applicable authority.', related_decision: 'Release decision, which remains conditional.', impact_dimensions: ['decision_frame', 'critical_dependency', 'ability_to_act_now'] },
    ],
    first_movement_characteristics: ['Prepare the existing brief and memo for an authorized Compliance owner to obtain/validate official evidence.', 'Name the date/scope decision that depends on validation.'],
    prohibited_outputs: ['Legal advice or regulatory conclusion.', 'Automatic web lookup.', 'Claim a source was consulted if it was not provided.', 'Authorize or prohibit launch.', 'Detailed experiment.'],
  },
  {
    fixture_id: 'CS-08',
    expected_reasoning_family: ['single-initiative evidence checkpoint'],
    expected_lenses: ['evidence / learning', 'sequencing'],
    forbidden_lenses: ['priority / allocation', 'diagnosis', 'dependencies', 'governance', 'capacity', 'risk', 'alignment', 'system design'],
    supported_facts: ['One initiative seeks to raise completed booking rate from 24% to 30% by quarter end.', 'An A/B test with two booking-screen variants is active and ends in two weeks.', 'A reviewer is identified.', 'No other initiatives or dependencies are mentioned.'],
    forbidden_inference: ['Predict a winning variant.', 'Claim the change caused conversion.', 'Assume the target is achievable.', 'Invent a portfolio, need for new research, or more initiatives.'],
    insight_expectation: { status: 'supported', novelty_type: 'decision_structure_clarified', characteristics: ['Clarify that an existing checkpoint can prepare a local decision without claiming the test result.'] },
    tension_expectation: { status: 'unresolved', characteristics: ['A target and active test do not alone establish a material tension.'] },
    decision_frame_expectation: { status: 'framed', characteristics: ['Prepare how to use the outcome at the existing checkpoint, with options conditional on results and test limits.'] },
    usable_now_expectation: ['Declared baseline/target, active test and variants, close date, and identified reviewer.', 'Use the planned result before proposing another study.'],
    unknown_characteristics: [
      { uncertainty: 'What completed-booking result the test will produce at close.', why_it_matters: 'Could change how a variant is used at the checkpoint.', current_evidence: 'An active test closes in two weeks; its result is pending.', resolution_mode: 'Observe and reuse the result at the planned checkpoint.', related_decision: 'Contextual variant decision.', impact_dimensions: ['decision_frame', 'first_movement', 'ability_to_act_now'] },
      { uncertainty: 'Whether the test measurement corresponds to the stated completed-booking outcome.', why_it_matters: 'If not, its result may not inform the decision sought.', current_evidence: 'The declared goal and two screen variants are known; the test metric is not described.', resolution_mode: 'Review the existing test metric with the responsible reviewer.', related_decision: 'How to interpret and use the checkpoint.', impact_dimensions: ['situation_reading', 'decision_frame', 'first_movement'] },
    ],
    first_movement_characteristics: ['Use the existing checkpoint to review the completed-booking metric and prepare a keep/adjust decision.', 'Do not initiate portfolio flow or design a new experiment.'],
    prohibited_outputs: ['Portfolio allocation, strategic alignment, budget, ranking, premature conclusion, unsupported causality, or full experiment plan.'],
  },
] as const;

export const SEMANTIC_REVIEW_DIMENSIONS = [
  'fidelity',
  'insight',
  'decision_relevance',
  'actionability',
  'grounding',
  'uncertainty_discipline',
  'boundary_discipline',
] as const;

export type SemanticReviewDimension = typeof SEMANTIC_REVIEW_DIMENSIONS[number];

export const ADAPTABILITY_COMPARISON_PAIRS = [
  { pair_id: 'CS-01-vs-CS-05', fixture_ids: ['CS-01', 'CS-05'], contrast: 'Many initiatives with supported lagging-evidence/capacity tradeoffs versus an undefined aspiration and inventory without outcome evidence.' },
  { pair_id: 'CS-02-vs-CS-05', fixture_ids: ['CS-02', 'CS-05'], contrast: 'Documented cohorts, progression history, minutes, and divergent accounts versus no progression evidence or identified bottleneck.' },
  { pair_id: 'CS-03-vs-CS-07', fixture_ids: ['CS-03', 'CS-07'], contrast: 'Internal investment continuity and outcome evidence versus external regulatory evidence and authorized Compliance review.' },
  { pair_id: 'CS-04-vs-CS-07', fixture_ids: ['CS-04', 'CS-07'], contrast: 'Permission-dependent data validation with independent preparation versus launch conditions dependent on authoritative external review.' },
  { pair_id: 'CS-08-vs-multi-initiative', fixture_ids: ['CS-08', 'CS-01', 'CS-02', 'CS-05'], contrast: 'One initiative with an active checkpoint versus distinct multi-initiative allocation, governance, and aspiration cases.' },
] as const;
