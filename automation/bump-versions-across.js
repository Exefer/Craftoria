import { file } from "bun";
import packMetadata from "../pack.toml";
import { getLatestBumpCommitHash, getCommitMetadataFiles } from "./utils";
import path from "node:path";
import fs from "node:fs/promises";

const CONFIG = {
  gitRepoPath: path.resolve(import.meta.dir, ".."),
  branchName: "HEAD",
  packVersion: null,
  oldPackVersion: null,
  cutoffCommitHash: null,
};

async function initializeConfig() {
  CONFIG.cutoffCommitHash ||= await getLatestBumpCommitHash(CONFIG.branchName);
  CONFIG.packVersion ||= packMetadata.version;

  const [oldPackMetadata] = await getCommitMetadataFiles(
    CONFIG.cutoffCommitHash,
    CONFIG.gitRepoPath
  );
  CONFIG.oldPackVersion ||= oldPackMetadata.version;

  if (CONFIG.oldPackVersion === CONFIG.packVersion) {
    throw new Error("You did not version bump the pack version!");
  }
}

async function replaceInPowershellSettings() {
  const powershellSettings = file(path.join(import.meta.dir, "settings.ps1"));
  const previousText = await powershellSettings.text();

  const newText = previousText
    .replace(
      /\$MODPACK_VERSION\s*=\s*".*?"/,
      `$MODPACK_VERSION = "${CONFIG.packVersion}"`
    )
    .replace(
      /\$LAST_MODPACK_VERSION\s*=\s*".*?"/,
      `$LAST_MODPACK_VERSION = "${CONFIG.oldPackVersion}"`
    );

  await powershellSettings.write(newText);
}

async function main() {
  if (!Bun.which("git")) {
    throw new Error("Git is required but was not found on the system.");
  }

  await initializeConfig();

  if (!(await fs.exists(CONFIG.gitRepoPath))) {
    throw new Error(`Repo path doesn't exist: ${CONFIG.gitRepoPath}`);
  }

  await Promise.all([replaceInPowershellSettings()]);

  console.log("Done!");
}

main().catch(error => {
  console.error("An error occured:", error);
  process.exit(1);
});
