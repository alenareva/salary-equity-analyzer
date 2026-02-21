import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect a working Python executable.
 * Priority: PYTHON_PATH env var > python3 on PATH > python on PATH.
 */
function detectPython(): string {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }

  for (const candidate of ['python3', 'python']) {
    try {
      const resolved = execSync(`which ${candidate}`, { encoding: 'utf-8' }).trim();
      if (resolved) return resolved;
    } catch {
      // candidate not found, try next
    }
  }

  throw new Error(
    'No Python executable found. Set the PYTHON_PATH environment variable or ensure python3 is on PATH.'
  );
}

const PYTHON_BIN = detectPython();

/**
 * Call Python statistical engine with employee data
 */
export async function runStatisticalAnalysis(records: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'statistics_engine.py');
    const python = spawn(PYTHON_BIN, [pythonScript]);

    let outputData = '';
    let errorData = '';

    // Send input data to Python script
    python.stdin.write(JSON.stringify({ records }));
    python.stdin.end();

    // Collect output
    python.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    // Handle completion
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const results = JSON.parse(outputData);
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${error}`));
      }
    });

    // Handle errors
    python.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}
