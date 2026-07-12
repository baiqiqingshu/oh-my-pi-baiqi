import { afterEach, describe, expect, it, vi } from "bun:test";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import * as ai from "@oh-my-pi/pi-ai";
import { Effort, type Model } from "@oh-my-pi/pi-ai";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { classifyDifficulty, parseDifficultyLevel } from "@oh-my-pi/pi-coding-agent/auto-thinking/classifier";
import {
	AUTO_THINKING,
	clampAutoThinkingEffort,
	parseCliThinkingLevel,
	parseConfiguredThinkingLevel,
	parseEffort,
	parseThinkingLevel,
	resolveProvisionalAutoLevel,
} from "@oh-my-pi/pi-coding-agent/thinking";

describe("auto thinking classifier helpers", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses configured thinking without widening provider-facing thinking selectors", () => {
		expect(parseConfiguredThinkingLevel(AUTO_THINKING)).toBe(AUTO_THINKING);
		expect(parseConfiguredThinkingLevel(Effort.High)).toBe(Effort.High);
		expect(parseConfiguredThinkingLevel("bogus")).toBeUndefined();
		expect(parseThinkingLevel(AUTO_THINKING)).toBeUndefined();
		expect(parseThinkingLevel(ThinkingLevel.Off)).toBe(ThinkingLevel.Off);
	});

	it("parses CLI --thinking selectors while rejecting inherit", () => {
		expect(parseCliThinkingLevel(ThinkingLevel.Off)).toBe(ThinkingLevel.Off);
		expect(parseCliThinkingLevel(AUTO_THINKING)).toBe(AUTO_THINKING);
		expect(parseCliThinkingLevel("max")).toBe(ThinkingLevel.Max);
		expect(parseCliThinkingLevel(ThinkingLevel.Inherit)).toBeUndefined();
		expect(parseCliThinkingLevel("bogus")).toBeUndefined();
	});

	it("maps online 4-way classifier labels to effort levels", () => {
		expect(parseDifficultyLevel("x-high")).toBe(Effort.XHigh);
		expect(parseDifficultyLevel("The answer is HIGH.")).toBe(Effort.High);
		expect(parseDifficultyLevel("med")).toBe(Effort.Medium);
		expect(parseDifficultyLevel("low")).toBe(Effort.Low);
		expect(parseDifficultyLevel("unknown")).toBeUndefined();
	});

	it("uses a reasoning-safe online classifier budget when the catalog disables reasoning", async () => {
		const baseModel = getBundledModel("anthropic", "claude-sonnet-4-6");
		if (!baseModel) throw new Error("Expected bundled Claude Sonnet 4.6 model");
		const classifierModel = { ...baseModel, reasoning: false };
		const settings = {
			get() {
				return undefined;
			},
			getModelRole(role: string) {
				return role === "smol" ? `${classifierModel.provider}/${classifierModel.id}` : undefined;
			},
			getStorage() {
				return undefined;
			},
		} as never;
		const registry = {
			getAvailable: () => [classifierModel],
			getApiKey: async () => "test-key",
			resolver: () => async () => "test-key",
		} as never;
		const completeSimpleMock = vi.spyOn(ai, "completeSimple").mockResolvedValue({
			stopReason: "stop",
			content: [{ type: "text", text: "high" }],
		} as never);

		const effort = await classifyDifficulty("add validation around the retry path", {
			settings,
			registry,
			model: baseModel,
		});
		const options = completeSimpleMock.mock.calls[0]?.[2] as
			| { disableReasoning?: boolean; maxTokens?: number }
			| undefined;

		expect(effort).toBe(Effort.High);
		expect(options).toMatchObject({ disableReasoning: true, maxTokens: 1024 });
	});

	it("clamps auto effort to model support while never resolving below low", () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-6");
		if (!model) throw new Error("Expected bundled Claude Sonnet 4.6 model");

		expect(clampAutoThinkingEffort(model, Effort.XHigh)).toBe(Effort.High);
		expect(clampAutoThinkingEffort(model, Effort.Minimal)).toBe(Effort.Low);
	});

	it("clamps max down to the ladder ceiling on models without a max tier", () => {
		const xhighCeilingModel = buildModel({
			id: "mock-xhigh-ceiling",
			name: "Mock XHigh Ceiling",
			api: "openai-completions",
			provider: "mock",
			baseUrl: "https://example.com",
			reasoning: true,
			thinking: { mode: "effort", efforts: [Effort.Low, Effort.Medium, Effort.High, Effort.XHigh] },
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 4096,
		});

		expect(clampAutoThinkingEffort(xhighCeilingModel, Effort.Max)).toBe(Effort.XHigh);
	});

	it("returns undefined for reasoning models without controllable efforts (devin-agent shape)", () => {
		// Repro for https://github.com/can1357/oh-my-pi/issues/3356 — Devin
		// models report `reasoning: true` but expose no `thinking.efforts` (Cascade
		// selects effort by routing to sibling model ids). `auto` must not invent
		// a concrete effort here, or `requireSupportedEffort` throws in stream.ts.
		const devinModel = {
			id: "glm-5-2",
			name: "GLM-5.2",
			api: "devin-agent",
			provider: "devin",
			baseUrl: "https://server.codeium.com",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 4096,
		} as Model;

		expect(clampAutoThinkingEffort(devinModel, Effort.Low)).toBeUndefined();
		expect(clampAutoThinkingEffort(devinModel, Effort.XHigh)).toBeUndefined();
		expect(clampAutoThinkingEffort(devinModel, Effort.Max)).toBeUndefined();
		expect(resolveProvisionalAutoLevel(devinModel)).toBeUndefined();
	});

	it("parses max as a real thinking level", () => {
		expect(parseEffort("max")).toBe(Effort.Max);
		expect(parseThinkingLevel("max")).toBe(ThinkingLevel.Max);
		expect(parseConfiguredThinkingLevel("max")).toBe(ThinkingLevel.Max);
	});

	it("rejects inherited object keys as thinking selectors", () => {
		for (const selector of ["toString", "constructor", "__proto__"]) {
			expect(parseEffort(selector)).toBeUndefined();
			expect(parseThinkingLevel(selector)).toBeUndefined();
			expect(parseConfiguredThinkingLevel(selector)).toBeUndefined();
		}
	});
});
