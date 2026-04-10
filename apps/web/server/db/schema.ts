import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export interface SavedPlayer {
	tag: string;
	scidInfo?: {
		avatar: string;
		handle?: string;
		scid: string;
	};
	name: string;
}

function generateUUID() {
	const hexDigits = "0123456789abcdef";
	let uuid = "";
	for (let i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) {
			uuid += "-";
		} else if (i === 14) {
			uuid += "4"; // The version number (4 for random UUIDs)
		} else if (i === 19) {
			uuid += hexDigits[(Math.random() * 16) | (0 & 0x3) | 0x8]; // The variant (10xx)
		} else {
			uuid += hexDigits[Math.floor(Math.random() * 16)];
		}
	}
	return uuid;
}

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	scid: text("scid"),
	tag: text("tag"),
	theme: text("theme").default("amber"),
	background: text("background").default("yellow-bg"),
	savedPlayers: text({ mode: "json" }).$type<SavedPlayer[]>().default([]),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", {
		mode: "timestamp",
	}),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", {
		mode: "timestamp",
	}),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const guide = sqliteTable("guides", {
	id: text("id")
		.primaryKey()
		.$default(() => generateUUID()),
	authorId: text("author_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	shortDescription: text("short_description").notNull(),
	isInDepth: integer("is_in_depth", { mode: "boolean" }).notNull(),
	editorHtml: text("editor_html").notNull(),
	brawlerId: text("brawler_id").notNull(),
	createdAt: text("created_at")
		.notNull()
		.default(sql`(current_timestamp)`),
	updatedAt: text("updated_at")
		.notNull()
		.default(sql`(current_timestamp)`),
});

export const userRelations = relations(user, ({ many }) => ({
	guides: many(guide),
}));

export const guideRelations = relations(guide, ({ one }) => ({
	user: one(user, {
		fields: [guide.authorId],
		references: [user.id],
	}),
}));

export type User = typeof user.$inferSelect;
export type Guide = typeof guide.$inferSelect;
