import { $ } from "bun";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Glob } from "bun";

/**
 * Writes text to a file.
 * Creates parent directories if they don't exist.
 * @param {string} filePath The path to the file.
 * @param {string} content The text content to write.
 * @param {boolean} [append=false] Whether to append to existing content (default: false).
 */
export async function writeTextToFile(filePath, content, append = false) {
  const dir = path.dirname(filePath);
  if (!(await fs.exists(dir))) {
    await fs.mkdir(dir, { recursive: true });
  }

  if (append) {
    const existing = (await fs.exists(filePath))
      ? await fs.readFile(filePath, "utf8")
      : "";
    await fs.writeFile(filePath, `${content}\n${existing}`, "utf8");
  } else {
    await fs.writeFile(filePath, content, "utf8");
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

/** @param {string} str */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getUpdateInfo(metadata) {
  const [updateKey] = Object.keys(metadata.update);
  return metadata.update[updateKey];
}

export async function getCommitMetadataFiles(commitHash, gitRepoPath) {
  const folderName = `craftoria-${commitHash}-${Date.now()}`;
  const folderPath = path.join(os.tmpdir(), folderName);
  const packwizGlob = new Glob("*.pw.toml");

  await $`git archive --format=tar --output=${folderPath}.tar ${commitHash} pack.toml mods/`.cwd(
    gitRepoPath
  );
  await $`mkdir ${folderPath}`;
  await $`tar -xf ${folderPath}.tar -C ${folderPath}`;

  const scannedFiles = await Array.fromAsync(
    packwizGlob.scan({ cwd: `${folderPath}/mods`, absolute: true })
  );

  const packMetadata = require(`${folderPath}/pack.toml`);
  const modsMetadata = Object.fromEntries(
    scannedFiles.map(filePath => {
      const metadata = require(filePath);
      const updateInfo = getUpdateInfo(metadata);
      const fileId = updateInfo["file-id"];
      return [fileId, metadata];
    })
  );

  await $`rm -rf ${folderPath}.tar ${folderPath}`;

  return [packMetadata, modsMetadata];
}
