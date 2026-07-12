/**
 * Network guard for air-gapped intranet deployment.
 *
 * Intercepts global fetch to ensure only whitelisted hosts are contacted.
 * Whitelist is derived from models.json baseUrl configs plus any explicit
 * allowedHosts in the config.
 *
 * This prevents accidental data leakage to external services.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, logger } from "@oh-my-pi/pi-utils";

// ---------------------------------------------------------------------------
// Whitelist management
// ---------------------------------------------------------------------------

const allowedHosts = new Set<string>();
let guardInstalled = false;

/**
 * Parse a URL and return its host (hostname:port or just hostname).
 */
function extractHost(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.host; // includes port if non-default
	} catch {
		return null;
	}
}

/**
 * Check if a host matches any entry in the whitelist.
 * Supports exact match and wildcard subdomain match.
 */
function isHostAllowed(host: string): boolean {
	if (allowedHosts.has(host)) return true;

	// Strip port for hostname-only comparison
	const hostname = host.split(":")[0];
	if (allowedHosts.has(hostname)) return true;

	// Allow localhost and private network ranges
	if (isPrivateNetwork(hostname)) return true;

	return false;
}

/**
 * Check if a hostname is a private/internal network address.
 */
function isPrivateNetwork(hostname: string): boolean {
	// localhost
	if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;

	// 10.x.x.x
	if (hostname.startsWith("10.")) return true;

	// 172.16.x.x - 172.31.x.x
	if (hostname.startsWith("172.")) {
		const second = Number.parseInt(hostname.split(".")[1], 10);
		if (second >= 16 && second <= 31) return true;
	}

	// 192.168.x.x
	if (hostname.startsWith("192.168.")) return true;

	// fd00::/8 (IPv6 private)
	if (hostname.startsWith("fd") || hostname.startsWith("fc")) return true;

	return false;
}

/**
 * Load allowed hosts from models.json configuration.
 */
function loadAllowedHostsFromConfig(): void {
	const agentDir = getAgentDir();

	// Try models.yml first, then models.json
	const paths = [path.join(agentDir, "models.yml"), path.join(agentDir, "models.json")];

	for (const configPath of paths) {
		try {
			if (!fs.existsSync(configPath)) continue;

			const content = fs.readFileSync(configPath, "utf-8").trim();
			let parsed: any;

			if (configPath.endsWith(".yml") || configPath.endsWith(".yaml")) {
				const { YAML } = require("bun");
				parsed = YAML.parse(content);
			} else {
				parsed = JSON.parse(content);
			}

			if (parsed?.providers) {
				for (const provider of Object.values(parsed.providers) as any[]) {
					if (provider?.baseUrl) {
						const host = extractHost(provider.baseUrl);
						if (host) {
							allowedHosts.add(host);
							// Also add just the hostname without port
							const hostname = host.split(":")[0];
							allowedHosts.add(hostname);
						}
					}
				}
			}

			// Support explicit allowedHosts field
			if (parsed?.allowedHosts && Array.isArray(parsed.allowedHosts)) {
				for (const host of parsed.allowedHosts) {
					if (typeof host === "string") {
						allowedHosts.add(host);
					}
				}
			}

			break; // Use first found config
		} catch (error) {
			logger.warn("network-guard: failed to load config", { path: configPath, error: String(error) });
		}
	}
}

/**
 * Install the network guard by patching global fetch.
 * Must be called early in the process lifecycle.
 */
export function installNetworkGuard(): void {
	if (guardInstalled) return;

	loadAllowedHostsFromConfig();

	const originalFetch = globalThis.fetch;

	globalThis.fetch = function guardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		let url: string;

		if (typeof input === "string") {
			url = input;
		} else if (input instanceof URL) {
			url = input.toString();
		} else if (input instanceof Request) {
			url = input.url;
		} else {
			url = String(input);
		}

		const host = extractHost(url);
		if (host && !isHostAllowed(host)) {
			const error = new Error(
				`[network-guard] 请求被阻止 / Request blocked: ${url}\n` +
					`  目标主机 "${host}" 不在白名单中。\n` +
					`  Host "${host}" is not in the allowlist.\n` +
					`  如需访问此地址，请在 models.json 中添加 "allowedHosts" 配置。`,
			);
			logger.warn("network-guard: blocked outbound request", { url, host });
			return Promise.reject(error);
		}

		return originalFetch.call(globalThis, input, init);
	} as typeof fetch;

	guardInstalled = true;
	logger.info("network-guard: installed", { allowedHosts: [...allowedHosts] });
}

/**
 * Add a host to the whitelist at runtime.
 */
export function addAllowedHost(host: string): void {
	allowedHosts.add(host);
}

/**
 * Get the current whitelist (for debugging).
 */
export function getAllowedHosts(): ReadonlySet<string> {
	return allowedHosts;
}
