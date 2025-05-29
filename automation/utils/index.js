import { $ } from "bun";
import fs from "node:fs/promises";

/**
 * Checks if a given file path exists and points to a regular file.
 * @param {string} filePath The path to check.
 * @returns {Promise<boolean>} `true` if the path exists and is a file, `false` otherwise.
 */
export async function isFile(filePath) {
  const file = Bun.file(filePath);
  return file.exists();
}

/**
 * Reads and parses a JSON file.
 * Throws an error if the file doesn't exist or contains invalid JSON.
 * @param {string} filePath The path to the JSON file.
 * @returns {Promise<any>} The parsed JSON content.
 */
export async function readJsonFile(filePath) {
  if (!(await fs.exists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

/**
 * Writes text to a file.
 * Creates parent directories if they don't exist.
 * @param {string} filePath The path to the file.
 * @param {string} content The text content to write.
 */
export async function writeTextToFile(filePath, content) {
  const dir = path.dirname(filePath);

  if (!(await fs.exists(dir))) {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(filePath, content, "utf8");
}

/**@param {string} str */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Gets the commit hash of the latest version bump.
 * @param {string} [branchName="HEAD"] - Branch to search.
 * @returns {Promise<string>} The commit hash.
 */
export async function getLatestBumpCommitHash(branchName = "HEAD") {
  const versionBumpRegex = /version bump \d+\.\d+(?:\.\d+)?$/;

  for await (const line of $`git log ${branchName} --oneline --pretty=format:"%h|%s"`.lines()) {
    const [commitHash, message] = line.split("|");
    if (versionBumpRegex.test(message)) {
      return commitHash;
    }
  }
}
