import type { ModelManagerConfig, ProviderCatalogEntry, ProviderDescriptor } from "./descriptor-types";
import { ollamaModelManagerOptions, openaiModelManagerOptions, syntheticModelManagerOptions } from "./openai-compat";

export const CATALOG_PROVIDERS = [
	{
		id: "ollama",
		defaultModel: "qwen2.5-coder:7b",
		createModelManagerOptions: (config: ModelManagerConfig) => ollamaModelManagerOptions(config),
		allowUnauthenticated: true,
	},
	{
		id: "openai",
		defaultModel: "gpt-5.5",
		envVars: ["OPENAI_API_KEY"],
		createModelManagerOptions: (config: ModelManagerConfig) => openaiModelManagerOptions(config),
	},
	{
		id: "synthetic",
		defaultModel: "hf:zai-org/GLM-5.2",
		envVars: ["SYNTHETIC_API_KEY"],
		createModelManagerOptions: (config: ModelManagerConfig) => syntheticModelManagerOptions(config),
		dynamicModelsAuthoritative: true,
		catalogDiscovery: { label: "Synthetic" },
	},
] as const satisfies readonly ProviderCatalogEntry[];

export type KnownProvider = string;

const CATALOG_ENTRY_LIST: readonly ProviderCatalogEntry[] = CATALOG_PROVIDERS;

export const PROVIDER_DESCRIPTORS: readonly ProviderDescriptor[] = CATALOG_ENTRY_LIST.flatMap(provider => {
	if (!provider.createModelManagerOptions || provider.specialModelManager) return [];
	return [
		{
			providerId: provider.id,
			defaultModel: provider.defaultModel,
			createModelManagerOptions: provider.createModelManagerOptions,
			allowUnauthenticated: provider.allowUnauthenticated,
			dynamicModelsAuthoritative: provider.dynamicModelsAuthoritative,
			catalogDiscovery: provider.catalogDiscovery,
		},
	];
});

export const DEFAULT_MODEL_PER_PROVIDER: Record<KnownProvider, string> = Object.fromEntries(
	CATALOG_PROVIDERS.map(provider => [provider.id, provider.defaultModel] as [string, string]),
) as Record<KnownProvider, string>;

export function getCatalogProviderEntry(id: string): ProviderCatalogEntry | undefined {
	return CATALOG_PROVIDERS.find(provider => provider.id === id);
}
