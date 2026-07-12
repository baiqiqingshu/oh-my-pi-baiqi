/**
 * The single Model constructor. Resolution order is a dependency chain, each
 * step materialized exactly once per spec:
 *
 *   1. compat   — URL/provider/id detection resolved into a complete record;
 *   2. thinking — derived from identity + resolved compat (or trusted verbatim
 *                 when the spec carries explicit metadata);
 *
 * Request handlers read fields — they never detect, parse ids, or allocate
 * compat per request.
 */
import { buildOpenAICompat, buildOpenAIResponsesCompat } from "./compat/openai";
import { resolveModelThinking } from "./model-thinking";
import type { Api, CompatOf, Model, ModelSpec } from "./types";
import { cleanModelName } from "./utils";

export function buildModel<TApi extends Api>(spec: ModelSpec<TApi>): Model<TApi> {
	const compat = buildCompat(spec) as CompatOf<TApi>;
	return {
		...spec,
		name: cleanModelName(spec.name),
		thinking: resolveModelThinking(spec, compat),
		compat,
		compatConfig: spec.compat,
	} as Model<TApi>;
}

export function buildCompat(spec: ModelSpec<Api>): CompatOf<Api> {
	switch (spec.api) {
		case "openai-completions":
			return buildOpenAICompat(spec as ModelSpec<"openai-completions">);
		case "openai-responses":
			return buildOpenAIResponsesCompat(spec as ModelSpec<"openai-responses">);
		default:
			return undefined as unknown as CompatOf<Api>;
	}
}
