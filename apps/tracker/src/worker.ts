import type { DurableObjectNamespace, ExportedHandler } from "@cloudflare/workers-types";
import { clickhouseTrackerConfig } from "./clickhouse-config.ts";
import type { CoordinatorEnvironment } from "./coordinator.ts";

export { CollectionCoordinator } from "./coordinator.ts";

interface Env extends CoordinatorEnvironment {
	COLLECTION_COORDINATOR: DurableObjectNamespace;
}

export default {
	async scheduled(_event, env) {
		if (!clickhouseTrackerConfig(env).enabled) return;
		const coordinator = env.COLLECTION_COORDINATOR.get(env.COLLECTION_COORDINATOR.idFromName("brawler-statistics-v1"));
		const response = await coordinator.fetch("https://coordinator.internal/poll", { method: "POST" });
		if (!response.ok) throw new Error("Statistics coordinator failed");
	},
	// Consume retired Queue deliveries without repeating API calls or database writes.
	async queue(batch) {
		batch.ackAll();
	},
} satisfies ExportedHandler<Env>;
