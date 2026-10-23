import type { EventRotation, RotationEvent } from "#shared/types/events";

const getEventCatalog = defineCachedFunction(
	async () => {
		const api = useBrawlApi();
		const [maps, modes] = await Promise.all([api.maps.getAllMaps(), api.gamemodes.getAllGamemodes()]);
		return { maps: maps.list, modes: modes.list };
	},
	{ name: "event-catalog", maxAge: 60 * 60 * 24 }
);

export default defineCachedEventHandler(
	async (): Promise<EventRotation> => {
		try {
			// BrawlAPI serves a static catalog; live rotation comes from the official API.
			const [rotation, catalog] = await Promise.all([
				useBrawlStarsApi().events.getEventRotation(),
				getEventCatalog().catch(() => ({ maps: [], modes: [] })),
			]);
			const entries: RotationEvent[] = rotation.map((entry) => {
				const map = catalog.maps.find((map) => map.id === entry.event.id);
				const mode = catalog.modes.find((mode) => mode.scHash === entry.event.mode);
				return {
					id: `${entry.slotId}-${entry.event.id}-${entry.startTime.toISOString()}`,
					slotId: entry.slotId,
					startTime: entry.startTime.toISOString(),
					endTime: entry.endTime.toISOString(),
					mapId: entry.event.id,
					mapName: entry.event.map,
					mapImageUrl: map?.imageUrl,
					modeId: mode?.id ?? map?.gameMode.id,
					modeName: mode?.name ?? map?.gameMode.name ?? entry.event.mode.replace(/([a-z])([A-Z])/g, "$1 $2"),
					modeHash: mode?.hash ?? entry.event.mode,
					modeIconUrl: mode?.imageUrl ?? map?.gameMode.imageUrl,
					environmentHash: map?.environment.hash,
				};
			});
			const now = Date.now();
			return {
				active: entries.filter((entry) => Date.parse(entry.startTime) <= now && Date.parse(entry.endTime) > now),
				upcoming: entries.filter((entry) => Date.parse(entry.startTime) > now),
			};
		} catch {
			throw createError({ statusCode: 503, statusMessage: "Event rotation is temporarily unavailable" });
		}
	},
	{ maxAge: 60, swr: false }
);
