import path from "node:path";
import fs from "node:fs/promises";
import {
  capitalize,
  getCommitMetadataFiles,
  getLatestBumpCommitHash,
  getUpdateInfo,
  writeTextToFile,
} from "./utils";
import { $ } from "bun";
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
  conventionalCommitRegexes: {
    feat: /^feat(?:\((?!.*(?:dev|debug))[^)]*\))?:/,
    fix: /^fix(?:\((?!.*(?:dev|debug))[^)]*\))?:/,
  },
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

function formatModLink(metadata, useFileName = false) {
  const updateInfo = getUpdateInfo(metadata);
  const displayName = useFileName ? metadata.filename : metadata.name;
  return `* [${displayName}](https://curseforge.com/projects/${updateInfo["project-id"]})`;
}

function formatUpdateLink(id, oldMods, currentMods) {
  const newMod = currentMods[id];
  const oldMod = oldMods[id];

  const oldUpdate = getUpdateInfo(oldMod);
  const newUpdate = getUpdateInfo(newMod);

  return `* [${oldMod.filename}](https://curseforge.com/projects/${oldUpdate["project-id"]}/files/${oldUpdate["file-id"]}) -> [${newMod.filename}](https://curseforge.com/projects/${newUpdate["project-id"]}/files/${newUpdate["file-id"]})`;
}

// Helper to replace names and capitalize the message
function formatCommit(message) {
  for (const [gitName, displayName] of Object.entries(CONFIG.namesLookup)) {
    message = message.replace(gitName, displayName);
  }
  return `* ${capitalize(message.trim())}`;
}

// Generalized processor for any commit type
function extractCommitsByType(commits, regex) {
  return commits
    .filter(commit => regex.test(commit))
    .map(commit => formatCommit(commit.replace(regex, "")));
}

function processCommits(rawCommits) {
  const { feat, fix } = CONFIG.conventionalCommitRegexes;
  return {
    features: extractCommitsByType(rawCommits, feat),
    fixes: extractCommitsByType(rawCommits, fix),
  };
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

// Main function
async function generateChangelog() {
  if (!Bun.which("git")) {
    throw new Error("Git is required but was not found on the system.");
  }

  await initializeConfig();

  if (!(await fs.exists(CONFIG.gitRepoPath))) {
    throw new Error(`Repo path doesn't exist: ${CONFIG.gitRepoPath}`);
  }

  $.cwd(CONFIG.gitRepoPath);

  const [oldPackMetadata, oldMods] = await getCommitMetadataFiles(
    CONFIG.cutoffCommitHash,
    CONFIG.gitRepoPath
  );
  const [, currentMods] = await getCommitMetadataFiles(
    CONFIG.branchName,
    CONFIG.gitRepoPath
  );
  const { newMods, removedMods, updatedMods } = compareModCollections(
    oldMods,
    currentMods
  );

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
