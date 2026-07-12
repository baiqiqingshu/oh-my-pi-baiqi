import type { Api, Context, Model } from "../types";
import type { AssistantMessageEventStream } from "../utils/event-stream";
import { streamOpenAICompletions } from "./register-builtins";
import type { OpenAICompletionsOptions } from "./openai-completions";

const SYNTHETIC_NEW_BASE_URL = "https://api.synthetic.new/openai/v1";

export type SyntheticOptions = OpenAICompletionsOptions;

export function streamSynthetic(
	model: Model<"openai-completions">,
	context: Context,
	options?: SyntheticOptions,
): AssistantMessageEventStream {
	return streamOpenAICompletions({ ...model, baseUrl: SYNTHETIC_NEW_BASE_URL }, context, options ?? {});
}

export function isSyntheticModel(model: Model<Api>): model is Model<"openai-completions"> {
	return model.provider === "synthetic";
}
