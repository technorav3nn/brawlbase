/** Rotation data shared by the event API and its presentation components. */
export interface RotationEvent {
	id: string;
	slotId: number;
	startTime: string;
	endTime: string;
	mapId: number;
	mapName: string;
	mapImageUrl?: string;
	modeId?: number;
	modeName: string;
	modeHash: string;
	modeIconUrl?: string;
	environmentHash?: string;
}

export interface EventRotation {
	active: RotationEvent[];
	upcoming: RotationEvent[];
}
