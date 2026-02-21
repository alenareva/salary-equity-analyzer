import { google, Auth } from 'googleapis';

type OAuth2Client = Auth.OAuth2Client;

// These will be provided by the user through environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/sheets/callback';

/**
 * Server-side store for Google OAuth tokens, keyed by analysis session ID.
 * Tokens are stored in memory and cleaned up after use.
 */
const sessionTokens = new Map<string, Auth.Credentials>();

export function storeSessionTokens(sessionId: string, tokens: Auth.Credentials) {
  sessionTokens.set(sessionId, tokens);
}

export function getSessionTokens(sessionId: string): Auth.Credentials | undefined {
  return sessionTokens.get(sessionId);
}

export function clearSessionTokens(sessionId: string) {
  sessionTokens.delete(sessionId);
}

/**
 * Create OAuth2 client for Google Sheets API
 */
export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate authorization URL for Google OAuth
 */
export function getAuthUrl(oauth2Client: OAuth2Client, state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    state, // Pass session ID as state for security
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(oauth2Client: OAuth2Client, code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

/**
 * List all spreadsheets accessible to the user
 */
export async function listUserSpreadsheets(oauth2Client: OAuth2Client) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name, modifiedTime)',
    pageSize: 50,
    orderBy: 'modifiedTime desc',
  });

  return response.data.files || [];
}

/**
 * Get sheet names (tabs) from a spreadsheet
 */
export async function getSheetNames(oauth2Client: OAuth2Client, spreadsheetId: string) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  return response.data.sheets?.map(sheet => ({
    title: sheet.properties?.title || '',
    sheetId: sheet.properties?.sheetId || 0,
  })) || [];
}

/**
 * Fetch data from a specific sheet
 */
export async function fetchSheetData(
  oauth2Client: OAuth2Client,
  spreadsheetId: string,
  sheetName: string
): Promise<any[][]> {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`, // Fetch columns A through Z
  });

  return response.data.values || [];
}

/**
 * Parse sheet data into structured employee records
 * Expects first row to be headers
 */
export function parseEmployeeData(rawData: any[][]): {
  headers: string[];
  data: Record<string, any>[];
} {
  if (rawData.length === 0) {
    return { headers: [], data: [] };
  }

  const headers = rawData[0].map((h: any) => String(h).trim().toLowerCase());
  const data: Record<string, any>[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue; // Skip empty rows

    const record: Record<string, any> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] !== undefined ? row[index] : null;
    });

    data.push(record);
  }

  return { headers, data };
}

/**
 * Map parsed data to our employee data schema
 */
export function mapToEmployeeSchema(
  parsedData: Record<string, any>[],
  columnMapping: Record<string, string>
): Array<{
  employeeId: string;
  gender: string;
  race: string;
  jobTitle: string;
  location: string;
  yearsExperience: number;
  yearsInRole: number;
  performanceRating: string;
  baseSalary: number;
}> {
  return parsedData.map(row => ({
    employeeId: String(row[columnMapping.employee_id] || ''),
    gender: String(row[columnMapping.gender] || ''),
    race: String(row[columnMapping.race] || ''),
    jobTitle: String(row[columnMapping.job_title] || ''),
    location: String(row[columnMapping.location] || ''),
    yearsExperience: parseInt(row[columnMapping.years_experience]) || 0,
    yearsInRole: parseInt(row[columnMapping.years_in_role]) || 0,
    performanceRating: String(row[columnMapping.performance_rating] || ''),
    baseSalary: parseInt(row[columnMapping.base_salary]) || 0,
  }));
}
