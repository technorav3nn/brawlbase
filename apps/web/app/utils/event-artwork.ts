import artwork from "#shared/data/event-artwork.json";
import type { RotationEvent } from "#shared/types/events";

interface ModeArtwork {
	icon: string;
	banner?: string;
}

interface EnvironmentArtwork {
	banner: string;
	width?: number;
	height?: number;
}

const environments: Record<string, EnvironmentArtwork> = artwork.environments;
const modes: Record<string, ModeArtwork> = artwork.modes;
const banners: Record<string, EnvironmentArtwork> = Object.fromEntries(
	Object.values(environments).map((environment) => [environment.banner, environment])
);

export function eventArtwork(event: RotationEvent) {
	const mode = event.modeId ? modes[event.modeId] : undefined;
	const environment = event.environmentHash ? environments[event.environmentHash] : undefined;
	const banner = environment?.banner ?? mode?.banner;
	const dimensions = banner ? banners[banner] : undefined;
	const modeName = event.modeHash.toLowerCase();
	let background = "bg-primary";
	// Keep the game's mode colors consistent across light and dark themes.
	if (/showdown|survival/.test(modeName)) background = "bg-[#81d621]";
	else if (/gem.?grab/.test(modeName)) background = "bg-[#9a3df3]";
	else if (/heist/.test(modeName)) background = "bg-[#d65cd3]";
	else if (/duels/.test(modeName)) background = "bg-[#b8fb26]";
	else if (/basket/.test(modeName)) background = "bg-[#2fc4f9]";
	else if (/ball|hockey/.test(modeName)) background = "bg-[#8ca0e0]";
	else if (/knockout/.test(modeName)) background = "bg-[#f7831c]";
	else if (/bounty|brawl.?arena/.test(modeName)) background = "bg-[#24d6ff]";
	else if (/wipeout/.test(modeName)) background = "bg-[#00cfff]";
	else if (/hot.?zone/.test(modeName)) background = "bg-[#e33b50]";
	return {
		banner,
		width: dimensions?.width ?? 805,
		height: dimensions?.height ?? 169,
		icon: mode?.icon ?? event.modeIconUrl,
		background,
	};
}
