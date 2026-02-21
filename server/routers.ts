import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createAnalysisSession, getAnalysisSession, getEmployeeDataBySession, insertEmployeeData, updateAnalysisSessionStatus, updateEmployeeExclusion } from "./db";
import { createOAuth2Client, fetchSheetData, getAuthUrl, getSheetNames, getTokensFromCode, listUserSpreadsheets, mapToEmployeeSchema, parseEmployeeData, storeSessionTokens, getSessionTokens, clearSessionTokens } from "./googleSheets";
import { checkSampleSizes, validateEmployeeData } from "./validation";
import { runStatisticalAnalysis } from "./statisticsService";
import { getAnalysisResults, saveAnalysisResults } from "./db";
import { generatePayGapsCSV, generateAtRiskCSV, generateModelResultsCSV, generateFullResultsCSV, generatePDFReport } from "./exportService";

/**
 * Verify that the given session exists.
 * The nanoid session ID acts as an unguessable access token.
 */
async function verifySessionExists(sessionId: string) {
  const session = await getAnalysisSession(sessionId);
  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Session not found",
    });
  }
  return session;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  sheets: router({
    // Step 1: Create a new analysis session and get OAuth URL
    startImport: publicProcedure.mutation(async () => {
      const sessionId = nanoid();
      await createAnalysisSession(sessionId);

      const oauth2Client = createOAuth2Client();
      const authUrl = getAuthUrl(oauth2Client, sessionId);

      return { sessionId, authUrl };
    }),

    // Step 2: Exchange code for tokens and list available spreadsheets
    listSpreadsheets: publicProcedure
      .input(z.object({
        code: z.string(),
        sessionId: z.string(),
      }))
      .mutation(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const oauth2Client = createOAuth2Client();
        const tokens = await getTokensFromCode(oauth2Client, input.code);

        // Store tokens server-side, never expose to the client
        storeSessionTokens(input.sessionId, tokens);

        const spreadsheets = await listUserSpreadsheets(oauth2Client);
        return { spreadsheets };
      }),

    // Step 3: Get sheet names from a spreadsheet
    getSheets: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        spreadsheetId: z.string(),
      }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const tokens = getSessionTokens(input.sessionId);
        if (!tokens) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No Google tokens found for this session. Please re-authenticate." });
        }
        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials(tokens);

        const sheets = await getSheetNames(oauth2Client, input.spreadsheetId);
        return { sheets };
      }),

    // Step 4: Import data from selected sheet
    importData: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        spreadsheetId: z.string(),
        sheetName: z.string(),
        columnMapping: z.record(z.string(), z.string()),
      }))
      .mutation(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const tokens = getSessionTokens(input.sessionId);
        if (!tokens) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No Google tokens found for this session. Please re-authenticate." });
        }
        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials(tokens);

        // Fetch raw data
        const rawData = await fetchSheetData(oauth2Client, input.spreadsheetId, input.sheetName);
        const { data: parsedData } = parseEmployeeData(rawData);

        // Map to our schema
        const employeeRecords = mapToEmployeeSchema(parsedData, input.columnMapping);

        // Insert into database
        const dbRecords = employeeRecords.map(record => ({
          ...record,
          sessionId: input.sessionId,
        }));

        await insertEmployeeData(dbRecords);
        await updateAnalysisSessionStatus(input.sessionId, "validating", {
          totalRecords: employeeRecords.length,
        });

        // Tokens no longer needed after import
        clearSessionTokens(input.sessionId);

        return {
          success: true,
          recordCount: employeeRecords.length,
          previewData: employeeRecords.slice(0, 10),
        };
      }),

    // Get session status
    getSession: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const session = await verifySessionExists(input.sessionId);
        return session;
      }),

    // Upload CSV data
    uploadCSV: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        data: z.array(z.object({
          employeeId: z.string(),
          gender: z.string(),
          race: z.string(),
          jobTitle: z.string(),
          location: z.string(),
          yearsExperience: z.number(),
          yearsInRole: z.number(),
          performanceRating: z.string(),
          baseSalary: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const dbRecords = input.data.map(record => ({
          ...record,
          sessionId: input.sessionId,
        }));

        await insertEmployeeData(dbRecords);
        await updateAnalysisSessionStatus(input.sessionId, "validating", {
          totalRecords: input.data.length,
        });

        return {
          success: true,
          recordCount: input.data.length,
        };
      }),
  }),

  validation: router({
    // Validate employee data
    validate: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const records = await getEmployeeDataBySession(input.sessionId);
        const validation = validateEmployeeData(records);
        const sampleSizes = checkSampleSizes(records.filter(r => r.isExcluded === 0));

        return {
          ...validation,
          sampleSizeWarnings: sampleSizes.warnings,
        };
      }),

    // Exclude records with issues
    excludeRecords: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        recordIds: z.array(z.number()),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        for (const id of input.recordIds) {
          await updateEmployeeExclusion(id, true, input.reason);
        }

        // Update session counts
        const allRecords = await getEmployeeDataBySession(input.sessionId);
        const excludedCount = allRecords.filter(r => r.isExcluded === 1).length;
        const validCount = allRecords.length - excludedCount;

        await updateAnalysisSessionStatus(input.sessionId, "validating", {
          totalRecords: allRecords.length,
          validRecords: validCount,
          excludedRecords: excludedCount,
        });

        return { success: true, excludedCount, validCount };
      }),

    // Proceed to analysis after validation
    proceedToAnalysis: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        await updateAnalysisSessionStatus(input.sessionId, "analyzing");
        return { success: true };
      }),
  }),

  analysis: router({
    // Run statistical analysis
    run: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        // Get employee data (excluding excluded records)
        const records = await getEmployeeDataBySession(input.sessionId);
        const validRecords = records.filter(r => r.isExcluded === 0);

        if (validRecords.length === 0) {
          throw new Error('No valid records to analyze');
        }

        // Run Python statistical analysis
        const results = await runStatisticalAnalysis(validRecords);

        // Save results to database
        await saveAnalysisResults(input.sessionId, results);
        await updateAnalysisSessionStatus(input.sessionId, "completed");

        return results;
      }),

    // Get analysis results
    getResults: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const results = await getAnalysisResults(input.sessionId);
        if (!results) {
          throw new Error('Analysis results not found');
        }

        return JSON.parse(results.resultsJson);
      }),
  }),

  export: router({
    payGaps: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const results = await getAnalysisResults(input.sessionId);
        if (!results) throw new Error("Results not found");
        const parsedResults = JSON.parse(results.resultsJson);
        const csv = generatePayGapsCSV(parsedResults);
        return { csv, filename: `pay-gaps-${input.sessionId}.csv` };
      }),
    atRisk: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const results = await getAnalysisResults(input.sessionId);
        if (!results) throw new Error("Results not found");
        const parsedResults = JSON.parse(results.resultsJson);
        const csv = generateAtRiskCSV(parsedResults);
        return { csv, filename: `at-risk-${input.sessionId}.csv` };
      }),
    modelResults: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const results = await getAnalysisResults(input.sessionId);
        if (!results) throw new Error("Results not found");
        const parsedResults = JSON.parse(results.resultsJson);
        const csv = generateModelResultsCSV(parsedResults);
        return { csv, filename: `model-results-${input.sessionId}.csv` };
      }),
    fullResults: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const results = await getAnalysisResults(input.sessionId);
        if (!results) throw new Error("Results not found");
        const parsedResults = JSON.parse(results.resultsJson);
        const csv = generateFullResultsCSV(parsedResults);
        return { csv, filename: `full-results-${input.sessionId}.csv` };
      }),
    pdf: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        await verifySessionExists(input.sessionId);
        const results = await getAnalysisResults(input.sessionId);
        if (!results) throw new Error("Results not found");
        const parsedResults = JSON.parse(results.resultsJson);
        const pdfBuffer = await generatePDFReport(parsedResults);
        return {
          pdf: pdfBuffer.toString('base64'),
          filename: `report-${input.sessionId}.pdf`
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
