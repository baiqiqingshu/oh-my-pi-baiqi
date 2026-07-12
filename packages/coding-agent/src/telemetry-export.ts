/**
 * OTLP trace export - DISABLED for air-gapped intranet deployment.
 *
 * All telemetry export functionality has been removed.
 * No data will be sent to any external endpoint.
 */

/**
 * Always returns false — telemetry export is permanently disabled.
 */
export function isTelemetryExportEnabled(): boolean {
	return false;
}

/**
 * No-op — telemetry export is permanently disabled.
 */
export async function initTelemetryExport(): Promise<void> {
	// Intentionally empty — no telemetry in air-gapped deployment
}

/**
 * No-op — telemetry export is permanently disabled.
 */
export async function flushTelemetryExport(): Promise<void> {
	// Intentionally empty — no telemetry in air-gapped deployment
}
