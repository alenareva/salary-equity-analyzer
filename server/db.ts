import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, analysisSessions, employeeData, analysisResults, InsertEmployeeData } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ---------------------------------------------------------------------------
// In-memory fallback stores for when no DATABASE_URL is configured.
// This lets the full flow work locally and in demo mode without MySQL.
// ---------------------------------------------------------------------------

interface MemSession {
  id: number;
  userId: number | null;
  sessionId: string;
  status: "uploading" | "validating" | "analyzing" | "completed" | "error";
  totalRecords: number | null;
  validRecords: number | null;
  excludedRecords: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MemEmployee {
  id: number;
  sessionId: string;
  employeeId: string;
  gender: string;
  race: string;
  jobTitle: string;
  location: string;
  yearsExperience: number;
  yearsInRole: number;
  performanceRating: string;
  baseSalary: number;
  isExcluded: number;
  exclusionReason: string | null;
  createdAt: Date;
}

interface MemResult {
  id: number;
  sessionId: string;
  equityScore: number | null;
  scoreInterpretation: string | null;
  resultsJson: string;
  createdAt: Date;
}

const mem = {
  sessions: [] as MemSession[],
  employees: [] as MemEmployee[],
  results: [] as MemResult[],
  nextSessionId: 1,
  nextEmployeeId: 1,
  nextResultId: 1,
};

// ---------------------------------------------------------------------------
// User helpers (DB-only, not needed for the analysis flow)
// ---------------------------------------------------------------------------

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ---------------------------------------------------------------------------
// Analysis session helpers
// ---------------------------------------------------------------------------

export async function createAnalysisSession(sessionId: string, userId?: number) {
  const db = await getDb();
  if (db) {
    await db.insert(analysisSessions).values({
      userId: userId ?? null,
      sessionId,
      status: "uploading",
    });
    return;
  }

  // In-memory fallback
  const now = new Date();
  mem.sessions.push({
    id: mem.nextSessionId++,
    userId: userId ?? null,
    sessionId,
    status: "uploading",
    totalRecords: null,
    validRecords: null,
    excludedRecords: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getAnalysisSession(sessionId: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(analysisSessions).where(eq(analysisSessions.sessionId, sessionId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  return mem.sessions.find(s => s.sessionId === sessionId);
}

export async function updateAnalysisSessionStatus(
  sessionId: string,
  status: "uploading" | "validating" | "analyzing" | "completed" | "error",
  counts?: { totalRecords?: number; validRecords?: number; excludedRecords?: number }
) {
  const db = await getDb();
  if (db) {
    const updateData: any = { status };
    if (counts?.totalRecords !== undefined) updateData.totalRecords = counts.totalRecords;
    if (counts?.validRecords !== undefined) updateData.validRecords = counts.validRecords;
    if (counts?.excludedRecords !== undefined) updateData.excludedRecords = counts.excludedRecords;
    await db.update(analysisSessions).set(updateData).where(eq(analysisSessions.sessionId, sessionId));
    return;
  }

  // In-memory fallback
  const session = mem.sessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.status = status;
    session.updatedAt = new Date();
    if (counts?.totalRecords !== undefined) session.totalRecords = counts.totalRecords;
    if (counts?.validRecords !== undefined) session.validRecords = counts.validRecords;
    if (counts?.excludedRecords !== undefined) session.excludedRecords = counts.excludedRecords;
  }
}

// ---------------------------------------------------------------------------
// Employee data helpers
// ---------------------------------------------------------------------------

export async function insertEmployeeData(data: InsertEmployeeData[]) {
  if (data.length === 0) return;

  const db = await getDb();
  if (db) {
    await db.insert(employeeData).values(data);
    return;
  }

  // In-memory fallback
  const now = new Date();
  for (const record of data) {
    mem.employees.push({
      id: mem.nextEmployeeId++,
      sessionId: record.sessionId,
      employeeId: record.employeeId,
      gender: record.gender,
      race: record.race,
      jobTitle: record.jobTitle,
      location: record.location,
      yearsExperience: record.yearsExperience,
      yearsInRole: record.yearsInRole,
      performanceRating: record.performanceRating,
      baseSalary: record.baseSalary,
      isExcluded: 0,
      exclusionReason: null,
      createdAt: now,
    });
  }
}

export async function getEmployeeDataBySession(sessionId: string) {
  const db = await getDb();
  if (db) {
    return await db.select().from(employeeData).where(eq(employeeData.sessionId, sessionId));
  }

  return mem.employees.filter(e => e.sessionId === sessionId);
}

export async function updateEmployeeExclusion(id: number, isExcluded: boolean, reason?: string) {
  const db = await getDb();
  if (db) {
    await db.update(employeeData).set({
      isExcluded: isExcluded ? 1 : 0,
      exclusionReason: reason || null,
    }).where(eq(employeeData.id, id));
    return;
  }

  // In-memory fallback
  const record = mem.employees.find(e => e.id === id);
  if (record) {
    record.isExcluded = isExcluded ? 1 : 0;
    record.exclusionReason = reason || null;
  }
}

// ---------------------------------------------------------------------------
// Analysis results helpers
// ---------------------------------------------------------------------------

export async function saveAnalysisResults(sessionId: string, results: any) {
  const db = await getDb();
  if (db) {
    await db.insert(analysisResults).values({
      sessionId,
      equityScore: results.equity_score,
      scoreInterpretation: results.interpretation,
      resultsJson: JSON.stringify(results),
    });
    return;
  }

  // In-memory fallback
  mem.results.push({
    id: mem.nextResultId++,
    sessionId,
    equityScore: results.equity_score,
    scoreInterpretation: results.interpretation,
    resultsJson: JSON.stringify(results),
    createdAt: new Date(),
  });
}

export async function getAnalysisResults(sessionId: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(analysisResults).where(eq(analysisResults.sessionId, sessionId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  return mem.results.find(r => r.sessionId === sessionId);
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

export async function deleteSessionData(sessionId: string) {
  const db = await getDb();
  if (db) {
    await db.delete(employeeData).where(eq(employeeData.sessionId, sessionId));
    await db.delete(analysisResults).where(eq(analysisResults.sessionId, sessionId));
    await db.delete(analysisSessions).where(eq(analysisSessions.sessionId, sessionId));
    return;
  }

  // In-memory fallback
  mem.employees = mem.employees.filter(e => e.sessionId !== sessionId);
  mem.results = mem.results.filter(r => r.sessionId !== sessionId);
  mem.sessions = mem.sessions.filter(s => s.sessionId !== sessionId);
}
