/**
 * Setup wizard replacement for air-gapped intranet deployment.
 *
 * Instead of an interactive setup wizard with OAuth sign-in flows,
 * this module checks that a valid models.json config exists.
 * If not, it prints guidance and exits.
 *
 * [MODIFIED] Replaced interactive setup wizard with config file validation check.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir } from "@oh-my-pi/pi-utils";
import type { Settings } from "../../config/settings";
import { CURRENT_SETUP_VERSION } from "../setup-version";
import type { InteractiveModeContext } from "../types";

export { CURRENT_SETUP_VERSION };

// Re-export types for backward compatibility
export type SetupScene = {
	id: string;
	minVersion: number;
	shouldRun?: (ctx: InteractiveModeContext) => Promise<boolean>;
};
export type SetupSceneController = unknown;
export type SetupSceneHost = unknown;
export type SetupSceneResult = unknown;

export const ALL_SCENES: readonly SetupScene[] = [];

export interface SetupSceneSelectionOptions {
	resuming?: boolean;
	isTTY?: boolean;
	skipEnv?: string;
	setupWizardEnabled?: boolean;
	force?: boolean;
}

const EXAMPLE_CONFIG = `{
  "providers": {
    "my-intranet-llm": {
      "baseUrl": "http://192.168.1.100:8000/v1",
      "apiKey": "your-api-key-here",
      "api": "openai-completions",
      "auth": "apiKey",
      "models": [
        {
          "id": "qwen2.5-72b",
          "name": "Qwen2.5 72B",
          "contextWindow": 32768,
          "maxTokens": 8192
        }
      ]
    }
  }
}`;

/**
 * Check if models.json config exists and has at least one provider configured.
 * Returns true if config is valid, false otherwise.
 */
export function checkModelsConfig(): { valid: boolean; configPath: string; error?: string } {
	const agentDir = getAgentDir();
	const configPath = path.join(agentDir, "models.yml");
	const jsonConfigPath = path.join(agentDir, "models.json");

	// Check both yml and json formats
	let content: string | null = null;
	let usedPath = configPath;

	if (fs.existsSync(configPath)) {
		content = fs.readFileSync(configPath, "utf-8").trim();
		usedPath = configPath;
	} else if (fs.existsSync(jsonConfigPath)) {
		content = fs.readFileSync(jsonConfigPath, "utf-8").trim();
		usedPath = jsonConfigPath;
	}

	if (!content) {
		return { valid: false, configPath: jsonConfigPath, error: "config_not_found" };
	}

	try {
		let parsed: any;
		if (usedPath.endsWith(".yml") || usedPath.endsWith(".yaml")) {
			const { YAML } = require("bun");
			parsed = YAML.parse(content);
		} else {
			parsed = JSON.parse(content);
		}

		if (!parsed?.providers || Object.keys(parsed.providers).length === 0) {
			return { valid: false, configPath: usedPath, error: "no_providers" };
		}

		// Check at least one provider has a baseUrl
		const providers = parsed.providers;
		let hasValidProvider = false;
		for (const name of Object.keys(providers)) {
			if (providers[name]?.baseUrl) {
				hasValidProvider = true;
				break;
			}
		}

		if (!hasValidProvider) {
			return { valid: false, configPath: usedPath, error: "no_baseurl" };
		}

		return { valid: true, configPath: usedPath };
	} catch {
		return { valid: false, configPath: usedPath, error: "parse_error" };
	}
}

/**
 * Generate example config file if it doesn't exist.
 */
export function generateExampleConfig(): string {
	const agentDir = getAgentDir();
	const examplePath = path.join(agentDir, "models.json.example");

	if (!fs.existsSync(examplePath)) {
		fs.mkdirSync(agentDir, { recursive: true });
		fs.writeFileSync(examplePath, EXAMPLE_CONFIG, "utf-8");
	}

	return examplePath;
}

/**
 * Print guidance for users who haven't configured models.
 */
export function printConfigGuidance(error?: string): void {
	const agentDir = getAgentDir();
	const configPath = path.join(agentDir, "models.json");

	console.error("\n\x1b[1;31m╔══════════════════════════════════════════════════════╗\x1b[0m");
	console.error("\x1b[1;31m║  模型未配置 / Model Not Configured                   ║\x1b[0m");
	console.error("\x1b[1;31m╚══════════════════════════════════════════════════════╝\x1b[0m\n");

	if (error === "config_not_found") {
		console.error(`  配置文件不存在: ${configPath}`);
		console.error(`  Config file not found: ${configPath}\n`);
	} else if (error === "no_providers") {
		console.error(`  配置文件中未定义任何 provider。`);
		console.error(`  No providers defined in config file.\n`);
	} else if (error === "no_baseurl") {
		console.error(`  所有 provider 都缺少 baseUrl 配置。`);
		console.error(`  All providers are missing baseUrl configuration.\n`);
	} else if (error === "parse_error") {
		console.error(`  配置文件格式错误，请检查 JSON/YAML 语法。`);
		console.error(`  Config file has syntax errors.\n`);
	}

	const examplePath = generateExampleConfig();

	console.error("  \x1b[1;33m使用方法 / Usage:\x1b[0m\n");
	console.error(`  1. 复制示例配置文件:`);
	console.error(`     cp "${examplePath}" "${configPath}"\n`);
	console.error(`  2. 编辑配置，填入内网模型 API 地址和密钥:`);
	console.error(`     vi "${configPath}"\n`);
	console.error("  \x1b[1;36m配置示例 / Example:\x1b[0m\n");
	console.error(EXAMPLE_CONFIG);
	console.error("");
}

export async function selectSetupScenes(
	_storedVersion: number,
	_scenes: readonly SetupScene[],
	_ctx?: InteractiveModeContext,
	_options: SetupSceneSelectionOptions = {},
): Promise<SetupScene[]> {
	// Always return empty — no interactive setup wizard in air-gapped mode
	return [];
}

export async function markSetupWizardComplete(
	settings: Settings,
	version: number = CURRENT_SETUP_VERSION,
): Promise<void> {
	settings.set("setupVersion", version);
	await settings.flush();
}

export interface RunSetupWizardOptions {
	markComplete?: boolean;
	playWelcomeIntro?: boolean;
}

export async function runSetupWizard(
	ctx: InteractiveModeContext,
	_scenes: readonly SetupScene[] = ALL_SCENES,
	options: RunSetupWizardOptions = {},
): Promise<void> {
	// Replace interactive wizard with config check
	const result = checkModelsConfig();

	if (!result.valid) {
		printConfigGuidance(result.error);
		process.exit(1);
	}

	// Config is valid, mark setup as complete and continue
	if (options.markComplete !== false) {
		await markSetupWizardComplete(ctx.settings);
	}
}
