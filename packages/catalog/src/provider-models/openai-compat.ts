import type { ModelManagerOptions } from "../model-manager";
import type { FetchImpl } from "../types";

export interface OpenAIModelManagerConfig {
	apiKey?: string;
	baseUrl?: string;
	fetch?: FetchImpl;
}

export function openaiModelManagerOptions(_config?: OpenAIModelManagerConfig): ModelManagerOptions<"openai-responses"> {
	return { providerId: "openai" };
}

export interface OllamaModelManagerConfig {
	apiKey?: string;
	baseUrl?: string;
	fetch?: FetchImpl;
}

export function ollamaModelManagerOptions(_config?: OllamaModelManagerConfig): ModelManagerOptions<"ollama-chat"> {
	return { providerId: "ollama" };
}

export interface SyntheticModelManagerConfig {
	apiKey?: string;
	baseUrl?: string;
	fetch?: FetchImpl;
}

export function syntheticModelManagerOptions(
	_config?: SyntheticModelManagerConfig,
): ModelManagerOptions<"openai-completions"> {
	return { providerId: "synthetic" };
}
