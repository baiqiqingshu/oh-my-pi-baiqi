/**
 * Setup wizard lazy loader - DISABLED for air-gapped intranet deployment.
 *
 * The provider setup wizard is not available in air-gapped mode.
 * Users must configure models.json directly.
 */

import type { InteractiveModeContext } from "../types";

export async function runProviderSetupWizard(_ctx: InteractiveModeContext): Promise<void> {
	console.error(
		"\n  Provider setup wizard is not available in air-gapped mode.\n" +
			"  Please configure models.json directly.\n" +
			"  运行 `omp --help` 获取更多信息。\n",
	);
}
