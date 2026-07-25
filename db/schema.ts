import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteUsers = sqliteTable("site_users", {
  email: text("email").primaryKey(),
  role: text("role", { enum: ["visitor", "admin"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
});

export const bibleTranslations = sqliteTable("bible_translations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  url: text("url").notNull(),
  iconKey: text("icon_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull(),
});

export const studyPassages = sqliteTable("study_passages", {
  id: text("id").primaryKey(),
  weekLabel: text("week_label").notNull(),
  scriptureLabel: text("scripture_label").notNull(),
  descriptionLabel: text("description_label").notNull(),
  displayOrder: integer("display_order").notNull(),
});
