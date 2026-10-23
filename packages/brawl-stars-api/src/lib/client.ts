import { ofetch, type FetchContext, type $Fetch, type FetchResponse } from "ofetch";
import { BrawlersApi } from "./api/brawlers";
import { ClubsApi } from "./api/clubs";
import { EventsApi } from "./api/events";
import { PlayersApi } from "./api/players";
import { RankingsApi } from "./api/rankings";
import { API_BASE_URL } from "./constants";
import { SupercellAPIClientError } from "./errors";
import type { ApiJsonError } from "./types/api";

type FetchContextError = FetchContext<any> & {
	response: FetchResponse<ResponseType>;
};

export interface BrawlStarsClientOptions {
	baseURL?: string;
	timeout?: number;
	retry?: number;
}

export class BrawlStarsClient {
	private readonly $fetch: $Fetch;

	public brawlers: BrawlersApi;
	public players: PlayersApi;
	public events: EventsApi;
	public clubs: ClubsApi;
	public rankings: RankingsApi;

	public constructor(token: string, options: BrawlStarsClientOptions = {}) {
		this.$fetch = ofetch.create({
			...options,
			baseURL: options.baseURL ?? API_BASE_URL,
			headers: {
				Authorization: `Bearer ${token}`,
			},
			onResponse: this.onResponse.bind(this),
		});

		this.brawlers = new BrawlersApi(this.$fetch);
		this.players = new PlayersApi(this.$fetch);
		this.events = new EventsApi(this.$fetch);
		this.clubs = new ClubsApi(this.$fetch);
		this.rankings = new RankingsApi(this.$fetch);
	}

	private async onResponse({ response, error }: FetchContextError) {
		if (!response) {
			throw new SupercellAPIClientError(
				"The request failed due to an unknown error",
				error?.message ?? "Unknown message",
				500
			);
		}

		const { status: statusCode } = response;

		if (response.status === 503) {
			throw new SupercellAPIClientError(
				"Maintenance (Service Unavaliable)",
				"During maintenance breaks, the API is down.",
				statusCode
			);
		}

		if (response.status < 200 || statusCode >= 300) {
			const payload: unknown = response._data;
			const json: Partial<ApiJsonError> = payload && typeof payload === "object" ? payload : {};
			throw new SupercellAPIClientError(
				typeof json.message === "string" ? json.message : `API request failed (${statusCode})`,
				typeof json.reason === "string" ? json.reason : "unknown",
				statusCode
			);
		}
	}
}
