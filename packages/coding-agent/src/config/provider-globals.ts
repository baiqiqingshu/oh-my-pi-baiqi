import * as imageGen from "../tools/image-gen";

interface ProviderGlobalSettings {
	get(path: "providers.image"): unknown;
}

export function applyProviderGlobalsFromSettings(settings: ProviderGlobalSettings): void {
	const imageProvider = settings.get("providers.image");
	if (imageGen.isImageProviderPreference(imageProvider)) {
		imageGen.setPreferredImageProvider(imageProvider);
	}
}
