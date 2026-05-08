import { db, schema } from "@nuxthub/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha } from "better-auth/plugins";

function createAuth() {
	const {
		turnstile: { secretKey },
	} = useRuntimeConfig();
	return betterAuth({
		plugins: [
			captcha({
				provider: "cloudflare-turnstile",
				secretKey,
			}),
		],
		database: drizzleAdapter(db, { provider: "sqlite", schema }),
		emailAndPassword: { enabled: true },
		debug: import.meta.dev,
		user: {
			deleteUser: {
				enabled: true,
			},
			additionalFields: {
				scid: {
					type: "string",
					required: false,
					defaultValue: "",
				},
				tag: {
					type: "string",
					required: false,
				},
				theme: {
					type: "string",
					defaultValue: "amber",
					required: false,
				},
				background: {
					type: "string",
					defaultValue: "yellow-bg",
					required: false,
				},
				savedPlayers: { type: "string", defaultValue: "[]", required: false },
			},
		},
	});
}

let _auth: ReturnType<typeof createAuth>;
export function useServerAuth(): ReturnType<typeof createAuth> {
	if (!_auth) {
		_auth = createAuth();
	}

	return _auth;
}

export type ServerAuth = ReturnType<typeof createAuth>;
export type User = ServerAuth["$Infer"]["Session"]["user"];
