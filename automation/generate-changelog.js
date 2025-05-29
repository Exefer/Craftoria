import path from "node:path";
import fs from "node:fs/promises";
import { capitalize, isFile, readJsonFile, writeTextToFile } from "./utils";
import { $ } from "bun";
import packMetadata from "../pack.toml";

// Configuration
const CONFIG = {
  gitRepoPath: path.resolve(import.meta.dir, ".."),
  packVersion: packMetadata.version,
  oldPackVersion: "1.20.3",
  fileId: "/123456",
  branchName: "HEAD",
  cutoffCommitHash: null,
  saveToFile: true,
  useGithubInstance: true,
  oldInstancePath: path.resolve("<path_to_old_instance>"),
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

// File paths
const PATHS = {
  instance: path.join(CONFIG.gitRepoPath, "minecraftinstance.json"),
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

// Ensure Git is available
if (!Bun.which("git")) {
  console.error("Git is required but was not found on the system.");
  process.exit(1);
}

// Set working directory
$.cwd(CONFIG.gitRepoPath);

// If no cutoff commit hash is provided, find the latest version bump commit
if (!CONFIG.cutoffCommitHash) {
  const versionBumpRegex = /version bump \d+\.\d+(?:\.\d+)?$/;

  for await (const line of $`git log ${CONFIG.branchName} --oneline --pretty=format:"%h|%s"`.lines()) {
    const [commitHash, message] = line.split("|");

    if (versionBumpRegex.test(message)) {
      CONFIG.cutoffCommitHash = commitHash;
      break;
    }
  }
}

// Mod processing functions
const filterMods = instance =>
  (instance.installedAddons || [])
    .filter(addon => addon.gameID === 432)
    .reduce((map, addon) => ({ ...map, [addon.addonID]: addon }), {});

const formatLink = mod => `[${mod.name}](${mod.websiteUrl})`;

const formatModWithAuthor = mod =>
  `- [${mod.name}](${mod.websiteUrl}) - (by [${mod.primaryAuthor}](https://www.curseforge.com/members/${mod.primaryAuthor}/projects))`;

const formatUpdateLink = (id, newMods, oldMods) => {
  const newMod = newMods[id];
  const oldMod = oldMods[id];
  const newFile = newMod?.installedFile;
  const oldFile = oldMod?.installedFile;

  if (!newFile || !oldFile || newFile.id === oldFile.id) return null;

  return `- [${oldFile.fileName}](${oldMod.websiteUrl}/files/${oldFile.id}) -> [${newFile.fileName}](${newMod.websiteUrl}/files/${newFile.id})`;
};

// Git commit processing
function processCommits() {
  const features = [];
  const fixes = [];

  for (const message of commits) {
    if (CONFIG.keywords.filter.some(word => message.toLowerCase().includes(word)))
      continue;

    const processType = (keywords, prefix, list) => {
      const lowerMessage = message.toLowerCase();
      if (!keywords.some(word => lowerMessage.includes(word))) return;

      let cleanedMessage = message
        .replace(new RegExp(`^(${keywords.join("|")}):?`, "i"), "")
        .trim();

      // Replace git names with display names
      Object.entries(CONFIG.namesLookup).forEach(([gitName, displayName]) => {
        cleanedMessage = cleanedMessage.replace(new RegExp(gitName, "g"), displayName);
      });

      list.push(`${prefix} ${cleanedMessage}`);
    };

    processType(CONFIG.keywords.features, "-", features);
    processType(CONFIG.keywords.fixes, "- Fixed", fixes);
  }

  return { features, fixes };
}

// Instance fetching
async function getOldInstance() {
  if (CONFIG.useGithubInstance) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/TeamAOF/Craftoria/refs/heads/${CONFIG.branchName}/minecraftinstance.json`
      );
      if (response.ok) return response.json();
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      console.error("Failed to fetch old instance from GitHub:", error.message);
    }
  }

  if (!CONFIG.oldInstancePath || !(await isFile(CONFIG.oldInstancePath))) {
    throw new Error(
      "Old instance path is not specified or does not exist for local fallback."
    );
  }
  return readJsonFile(CONFIG.oldInstancePath);
}

// Content generation
function generateChangelogContent(features, fixes, addedMods, removedMods) {
  const mention = CONFIG.saveToFile ? "" : "<@&1252725960948711444>";
  const craftoriaEmoji = CONFIG.saveToFile ? "" : " <:craftoria:1276650441869885531>";
  const links = CONFIG.saveToFile
    ? ""
    : `\n\n### Links\n\n<:curseforge:1117579334031511634> **[Download](https://www.curseforge.com/minecraft/modpacks/craftoria/files${CONFIG.fileId})**\n📜 **[Changelog](https://github.com/TeamAOF/Craftoria/blob/main/changelogs/CHANGELOG.md)**\n`;

  const header = CONFIG.saveToFile
    ? `\n_Neoforge_ | _[Mod Updates](https://github.com/TeamAOF/Craftoria/blob/main/changelogs/changelog_mods_${CONFIG.packVersion}.md)_ | _[Modlist](https://github.com/TeamAOF/Craftoria/blob/main/changelogs/modlist_${CONFIG.packVersion}.md)_\n`
    : "";

  return `${mention}
#${CONFIG.saveToFile ? "" : craftoriaEmoji} Craftoria | v${
    CONFIG.packVersion
  }${craftoriaEmoji}
${header}
### Changes/Improvements ⭐

${features.length ? features.join("\n") : "- No new features"}

${[
  addedMods.length && `### Added Mods ✅\n\n${addedMods.join("\n")}`,
  removedMods.length && `### Removed Mods ❌\n\n${removedMods.join("\n")}`,
]
  .filter(Boolean)
  .join("\n")}

### Bug Fixes 🪲

${fixes.length ? fixes.join("\n") : "- No bug fixes"}${links}`;
}

async function generateModChangelog(
  newInstance,
  oldInstance,
  addedMods,
  removedMods,
  updatedMods
) {
  const getLoaderVersion = instance => instance.baseModLoader.name.split("-")[1];
  const getLoaderName = instance => {
    const [name] = instance.baseModLoader.name.split("-");
    return capitalize(name);
  };

  return `## Craftoria - ${CONFIG.oldPackVersion} -> ${CONFIG.packVersion}

### ${getLoaderName(newInstance)} - ${getLoaderVersion(
    oldInstance
  )} -> ${getLoaderVersion(newInstance)}

### Added
${addedMods.length ? addedMods.join("\n") : "- No new mods"}

### Removed
${removedMods.length ? removedMods.join("\n") : "- No removed mods"}

### Updated
${updatedMods.length ? updatedMods.join("\n") : "- No updated mods"}`;
}

// Main function
async function generateChangelog() {
  const [newInstance, oldInstance] = await Promise.all([
    readJsonFile(PATHS.instance),
    getOldInstance(),
  ]);
  const [newMods, oldMods] = [filterMods(newInstance), filterMods(oldInstance)];
  const [newIds, oldIds] = [
    Object.keys(newMods).map(Number),
    Object.keys(oldMods).map(Number),
  ];
  const addedMods = newIds.filter(id => !oldIds.includes(id));
  const removedMods = oldIds.filter(id => !newIds.includes(id));
  const commonMods = newIds.filter(id => oldIds.includes(id));

  console.log(
    `Added: ${addedMods.length}, Removed: ${removedMods.length}, Common: ${commonMods.length}`
  );

  const addedLinks = addedMods.map(id => formatLink(newMods[id]));
  const removedLinks = removedMods.map(id => formatLink(oldMods[id]));
  const addedAuthors = addedMods.map(id => formatModWithAuthor(newMods[id]));
  const removedAuthors = removedMods.map(id => formatModWithAuthor(oldMods[id]));
  const updatedMods = commonMods
    .map(id => formatUpdateLink(id, newMods, oldMods))
    .filter(Boolean);

  if (!(await fs.exists(CONFIG.gitRepoPath)))
    throw new Error(`Repo path doesn't exist: ${CONFIG.gitRepoPath}`);

  const commits = (
    await $`git log ${CONFIG.cutoffCommitHash}..${CONFIG.branchName} --pretty=format:"%s \`%an\`"`.text()
  )
    .split("\n")
    .filter(Boolean);

  const { features, fixes } = processCommits(commits);

  const changelog = generateChangelogContent(features, fixes, addedLinks, removedLinks);
  const modlist = `# Craftoria - v${CONFIG.packVersion}\n\n${
    [...newIds].map(id => formatModWithAuthor(newMods[id])).join("\n") ||
    "- No mods found"
  }`;
  const modChangelog = generateModChangelog(
    newInstance,
    oldInstance,
    addedAuthors,
    removedAuthors,
    updatedMods
  );

  if (CONFIG.saveToFile) {
    await Promise.all([
      writeTextToFile(PATHS.changelog, changelog),
      writeTextToFile(PATHS.modlist, modlist),
      writeTextToFile(PATHS.modChangelog, modChangelog),
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
