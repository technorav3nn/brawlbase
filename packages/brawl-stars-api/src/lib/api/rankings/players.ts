import type { $Fetch } from "ofetch";
import type { RankingsPlayer } from "../../types/players";
import type { CountryCodes } from "../../types/rankings";

export class PlayerRankingsEndpoint {
	public constructor(private readonly $fetch: $Fetch) {
		this.$fetch = $fetch;
	}

	public async getPlayersRanking(countryCode: CountryCodes, limit = 200) {
		const { items } = await this.$fetch<{ items: RankingsPlayer[] }>(`/rankings/${countryCode}/players`, {
			query: { limit },
		});
		return items;
	}
}
