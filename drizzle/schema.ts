import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Analysis sessions table - stores metadata about each pay equity analysis run
 */
export const analysisSessions = mysqlTable("analysis_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["uploading", "validating", "analyzing", "completed", "error"]).default("uploading").notNull(),
  totalRecords: int("total_records"),
  validRecords: int("valid_records"),
  excludedRecords: int("excluded_records"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AnalysisSession = typeof analysisSessions.$inferSelect;
export type InsertAnalysisSession = typeof analysisSessions.$inferInsert;

/**
 * Employee data table - stores imported compensation data for analysis
 * Data is temporary and should be deleted after analysis completion
 */
export const employeeData = mysqlTable("employee_data", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  employeeId: varchar("employee_id", { length: 255 }).notNull(),
  gender: varchar("gender", { length: 50 }).notNull(),
  race: varchar("race", { length: 50 }).notNull(),
  jobTitle: varchar("job_title", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  yearsExperience: int("years_experience").notNull(),
  yearsInRole: int("years_in_role").notNull(),
  performanceRating: varchar("performance_rating", { length: 50 }).notNull(),
  baseSalary: int("base_salary").notNull(),
  isExcluded: int("is_excluded").default(0).notNull(), // 0 = included, 1 = excluded
  exclusionReason: text("exclusion_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmployeeData = typeof employeeData.$inferSelect;
export type InsertEmployeeData = typeof employeeData.$inferInsert;

/**
 * Analysis results table - stores the statistical analysis output
 */
export const analysisResults = mysqlTable("analysis_results", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  equityScore: int("equity_score"),
  scoreInterpretation: varchar("score_interpretation", { length: 50 }),
  resultsJson: text("results_json").notNull(), // Full JSON of all statistical results
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = typeof analysisResults.$inferInsert;