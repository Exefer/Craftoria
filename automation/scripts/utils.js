import { $ } from "bun";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Writes text to a file.
 * Creates parent directories if they don't exist.
 * @param {string} filePath The path to the file.
 * @param {string} content The text content to write.
 * @param {boolean} [prepend=false] Whether to prepend to existing content (default: false).
 */
export async function writeTextToFile(filePath, content, prepend = false) {
  const dir = path.dirname(filePath);
  if (!(await fs.exists(dir))) {
    await fs.mkdir(dir, { recursive: true });
  }
  const file = Bun.file(filePath);

  if (prepend && (await file.exists())) {
    file.write(`${content}\n${await file.text()}`);
  } else {
    file.write(content);
  }
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

export async function getModInfo(projectId) {
  const response = await fetch(`https://api.curse.tools/v1/cf/mods/${projectId}`, {
    redirect: "follow",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status !== 200) {
    if (response.status === 403) {
      console.error(`Failed to fetch mod info at ${response.url}: Bad CF Token`);
    } else {
      console.error(`Failed to fetch mod info at ${response.url}: ${response.status}`);
    }
    process.exit(1);
  }

  const { data } = await response.json();

  return data;
}

/** @param {string} str */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
