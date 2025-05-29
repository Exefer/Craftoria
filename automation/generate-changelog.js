import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { getLatestBumpCommitHash, writeTextToFile } from "./utils";
import { $, Glob } from "bun";
import packMetadata from "../pack.toml";

// Configuration
const CONFIG = {
  gitRepoPath: path.resolve(import.meta.dir, ".."),
  packVersion: null,
  oldPackVersion: null,
  fileId: "/123456",
  branchName: "HEAD",
  cutoffCommitHash: null,
  saveToFile: true,
  namesLookup: {
    WhitePhant0m: "Phantom",
    "Kazuhiko-Gushiken": "Inno",
    ImAK: "AK",
    "Dietrich Friday": "SubordinalBlue",
  },
  keywords: {
    features: ["add", "implement", "feature", "feat", "chapter"],
    fixes: ["fix", "bug", "resolve", "patch"],
    filter: ["vscode", "config", "sure", "revert", "lab", "dev", "nope", "nuh", "ugh"],
  },
};

// Initialize configuration
async function initializeConfig() {
  CONFIG.cutoffCommitHash ||= await getLatestBumpCommitHash(CONFIG.branchName);
  CONFIG.packVersion ||= packMetadata.version;

  const [oldPackMetadata] = await getCommitMetadataFiles(CONFIG.cutoffCommitHash);
  CONFIG.oldPackVersion ||= oldPackMetadata.version;

  if (CONFIG.oldPackVersion === CONFIG.packVersion) {
    throw new Error("You did not version bump the pack version!");
  }
}

// Extract mod metadata from commit
async function getCommitMetadataFiles(commitHash) {
  const folderName = `craftoria-${commitHash}-${Date.now()}`;
  const folderPath = path.join(os.tmpdir(), folderName);
  const packwizGlob = new Glob("*.pw.toml");

  await $`git archive --format=tar --output=${folderPath}.tar ${commitHash} pack.toml mods/`;
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

// Compare mod collections and categorize changes
function compareModCollections(oldMods, currentMods) {
  const newMods = {};
  const removedMods = {};
  const updatedMods = {};

  for (const [projectId, metadata] of Object.entries(currentMods)) {
    if (!(projectId in oldMods)) {
      newMods[projectId] = metadata;
    } else if (metadata.download.hash !== oldMods[projectId].download.hash) {
      updatedMods[projectId] = metadata;
    }
  }

  for (const [projectId, metadata] of Object.entries(oldMods)) {
    if (!(projectId in currentMods)) {
      removedMods[projectId] = metadata;
    }
  }

  return { newMods, removedMods, updatedMods };
}

// Helper to get first update info from metadata
function getUpdateInfo(metadata) {
  const updateKey = Object.keys(metadata.update)[0];
  return metadata.update[updateKey];
}

// Format mod link for display
function formatModLink(metadata, useFileName = false) {
  const updateInfo = getUpdateInfo(metadata);
  const displayName = useFileName ? metadata.filename : metadata.name;
  return `* [${displayName}](https://curseforge.com/projects/${updateInfo["project-id"]})`;
}

// Format update link showing old -> new
function formatUpdateLink(id, oldMods, currentMods) {
  const newMod = currentMods[id];
  const oldMod = oldMods[id];

  const oldUpdate = getUpdateInfo(oldMod);
  const newUpdate = getUpdateInfo(newMod);

  return `* [${oldMod.filename}](https://curseforge.com/projects/${oldUpdate["project-id"]}/files/${oldUpdate["file-id"]}) -> [${newMod.filename}](https://curseforge.com/projects/${newUpdate["project-id"]}/files/${newUpdate["file-id"]})`;
}

// Process git commits into features and fixes
function processCommits(rawCommits) {
  const features = [];
  const fixes = [];

  for (const message of rawCommits) {
    const lowerMessage = message.toLowerCase();
    if (CONFIG.keywords.filter.some(word => lowerMessage.includes(word))) continue;

    // Process features
    if (CONFIG.keywords.features.some(word => lowerMessage.includes(word))) {
      let cleanedMessage = message
        .replace(new RegExp(`^(${CONFIG.keywords.features.join("|")}):?`, "i"), "")
        .trim();

      Object.entries(CONFIG.namesLookup).forEach(([gitName, displayName]) => {
        cleanedMessage = cleanedMessage.replace(new RegExp(gitName, "g"), displayName);
      });

      features.push(`* ${cleanedMessage}`);
    }

    // Process fixes
    if (CONFIG.keywords.fixes.some(word => lowerMessage.includes(word))) {
      let cleanedMessage = message
        .replace(new RegExp(`^(${CONFIG.keywords.fixes.join("|")}):?`, "i"), "")
        .trim();

      Object.entries(CONFIG.namesLookup).forEach(([gitName, displayName]) => {
        cleanedMessage = cleanedMessage.replace(new RegExp(gitName, "g"), displayName);
      });

      fixes.push(`* Fixed ${cleanedMessage}`);
    }
  }

  return { features, fixes };
}

// Generate main changelog content
function generateChangelogContent(features, fixes, addedMods, removedMods) {
  const mention = CONFIG.saveToFile ? "" : "<@&1252725960948711444>\n";
  const craftoriaEmoji = CONFIG.saveToFile ? "" : " <:craftoria:1276650441869885531>";
  const links = CONFIG.saveToFile
    ? ""
    : `\n\n### Links\n\n<:curseforge:1117579334031511634> **[Download](https://www.curseforge.com/minecraft/modpacks/craftoria/files${CONFIG.fileId})**\n📜 **[Changelog](https://github.com/TeamAOF/Craftoria/blob/main/changelogs/CHANGELOG.md)**`;
  const header = CONFIG.saveToFile
    ? `\n_Neoforge_ ${packMetadata.versions.neoforge} | _[Mod Updates](https://github.com/TeamAOF/Craftoria/blob/main/changelogs/changelog_mods_${CONFIG.packVersion}.md)_ | _[Modlist](https://github.com/TeamAOF/Craftoria/blob/main/changelogs/modlist_${CONFIG.packVersion}.md)_`
    : "";

  const sections = [
    `${mention}#${CONFIG.saveToFile ? "" : craftoriaEmoji} Craftoria | v${
      CONFIG.packVersion
    }${craftoriaEmoji}\n${header}`,
    features.length && `\n\n### Changes/Improvements ⭐\n\n${features.join("\n")}`,
    addedMods.length && `\n\n### Added Mods ✅\n\n${addedMods.join("\n")}`,
    removedMods.length && `\n\n### Removed Mods ❌\n\n${removedMods.join("\n")}`,
    fixes.length && `\n\n### Bug Fixes 🪲\n\n${fixes.join("\n")}`,
    `${links}\n---`,
  ].filter(Boolean);

  return sections.join("");
}

// Generate mod changelog content
function generateModChangelog(addedMods, removedMods, changedMods, oldPackMetadata) {
  const sections = [
    `## Craftoria - ${CONFIG.oldPackVersion} -> ${CONFIG.packVersion}`,
    packMetadata.versions.neoforge !== oldPackMetadata.versions.neoforge &&
      `### NeoForge - ${oldPackMetadata.versions.neoforge} -> ${packMetadata.versions.neoforge}`,
    addedMods.length && `### Added\n${addedMods.join("\n")}`,
    removedMods.length && `### Removed\n${removedMods.join("\n")}`,
    changedMods.length && `### Changed\n${changedMods.join("\n")}`,
  ].filter(Boolean);

  return sections.join("\n\n");
}

// Main changelog generation function
async function generateChangelog() {
  if (!Bun.which("git")) {
    throw new Error("Git is required but was not found on the system.");
  }
  $.cwd(CONFIG.gitRepoPath);

  await initializeConfig();

  if (!(await fs.exists(CONFIG.gitRepoPath))) {
    throw new Error(`Repo path doesn't exist: ${CONFIG.gitRepoPath}`);
  }

  const [oldPackMetadata, oldMods] = await getCommitMetadataFiles(
    CONFIG.cutoffCommitHash
  );
  const [, currentMods] = await getCommitMetadataFiles(CONFIG.branchName);
  const { newMods, removedMods, updatedMods } = compareModCollections(
    oldMods,
    currentMods
  );

  // Format mod links
  const addedLinks = Object.values(newMods).map(formatModLink);
  const removedLinks = Object.values(removedMods).map(formatModLink);
  const changedLinks = Object.keys(updatedMods).map(id =>
    formatUpdateLink(id, oldMods, currentMods)
  );

  const rawCommits = (
    await $`git log ${CONFIG.cutoffCommitHash}..${CONFIG.branchName} --pretty=format:"%s \`%an\`"`.text()
  )
    .split("\n")
    .filter(Boolean);

  const { features, fixes } = processCommits(rawCommits);

  const changelog = generateChangelogContent(features, fixes, addedLinks, removedLinks);
  const modlist = `# Craftoria - v${CONFIG.packVersion}\n\n${Object.values(currentMods)
    .sort((a, b) => a.filename.localeCompare(b.filename))
    .map(metadata => formatModLink(metadata, true))
    .join("\n")}`;
  const modChangelog = generateModChangelog(
    addedLinks,
    removedLinks,
    changedLinks,
    oldPackMetadata
  );

  // Output results
  if (CONFIG.saveToFile) {
    const paths = {
      changelog: path.join(CONFIG.gitRepoPath, "changelogs", "CHANGELOG.md"),
      modlist: path.join(
        CONFIG.gitRepoPath,
        "changelogs",
        `modlist_${CONFIG.packVersion}.md`
      ),
      modChangelog: path.join(
        CONFIG.gitRepoPath,
        "changelogs",
        `changelog_mods_${CONFIG.packVersion}.md`
      ),
    };

    await Promise.all([
      writeTextToFile(paths.changelog, changelog, true),
      writeTextToFile(paths.modlist, modlist),
      writeTextToFile(paths.modChangelog, modChangelog),
    ]);
    console.log("Changelogs saved to files.");
  } else {
    console.log(changelog, "\n---\n", modlist, "\n---\n", modChangelog);
  }
}

generateChangelog().catch(error => {
  console.error("An error occurred during changelog generation:", error);
  process.exit(1);
});
