import { exec } from "node:child_process";
import fs from "node:fs";

/**
 * Executes a shell command and returns its standard output.
 * Throws an error if the command fails.
 * @param {string} command The command to execute.
 * @returns {Promise<string>} A promise that resolves with the trimmed stdout.
 */
export function execCommand(command) {
  return new Promise(function (resolve, reject) {
    exec(command, function (error, stdout, stderr) {
      if (error) {
        reject(
          new Error(`Command '${command}' failed: ${stderr.trim() || error.message}`)
        );
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Checks if a given file path exists and points to a regular file.
 * @param {string} filePath The path to check.
 * @returns {boolean} `true` if the path exists and is a file, `false` otherwise.
 */
export function isFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (e) {
    // Handle cases like permission errors, broken symlinks gracefully
    return false;
  }
}

/**
 * Reads and parses a JSON file.
 * Throws an error if the file doesn't exist or contains invalid JSON.
 * @param {string} filePath The path to the JSON file.
 * @returns {any} The parsed JSON content.
 */
export function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Writes text to a file, prepending it to any existing content.
 * Creates parent directories if they don't exist.
 * @param {string} filePath The path to the file.
 * @param {string} content The text content to write.
 */
export function writeTextToFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

  fs.writeFileSync(filePath, `${content}\n${existing}`, "utf8");
}

export * from "./find-git";
