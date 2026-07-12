import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import { syntheticProvider } from "./synthetic";
import type { ProviderDefinition } from "./types";

const ALL = [openaiProvider, ollamaProvider, syntheticProvider] as const satisfies readonly ProviderDefinition[];

export const PROVIDER_REGISTRY: readonly ProviderDefinition[] = ALL;

export function getProviderDefinition(id: string): ProviderDefinition | undefined {
	return PROVIDER_REGISTRY.find(provider => provider.id === id);
}

export function getKnownProviderDefinitions(): readonly ProviderDefinition[] {
	return ALL;
}

export type OAuthProviderUnion = (typeof ALL)[number]["id"];
