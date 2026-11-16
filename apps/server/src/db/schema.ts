import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, json, varchar, integer, primaryKey, uniqueIndex, index, check } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  nicknameDisplay: text('nickname_display').notNull(),
  nicknameKey: text('nickname_key').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('student'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check('users_role_check', sql`${table.role} IN ('student', 'admin')`),
  uniqueIndex('users_single_admin').on(sql`(true)`).where(sql`${table.role} = 'admin'`),
]);
export const sessions = pgTable('sessions', {
  sid: varchar('sid').primaryKey(),
  sess: json('sess').notNull(),
  expire: timestamp('expire', { precision: 6 }).notNull(),
}, table => [index('sessions_expire_idx').on(table.expire)]);
export const completions = pgTable('completions', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  curriculumVersion: text('curriculum_version').notNull(),
  levelId: text('level_id').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.userId, table.curriculumVersion, table.levelId] })]);
export const progress = pgTable('progress', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  curriculumVersion: text('curriculum_version').notNull(),
  currentLevelId: text('current_level_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const authLimits = pgTable('auth_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, table => [index('auth_limits_expires_idx').on(table.expiresAt)]);
