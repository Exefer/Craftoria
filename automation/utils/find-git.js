import path from "node:path";
import os from "node:os";
import { execCommand } from ".";

/**
 * Search strategy: Uses 'which' (Linux/macOS) or 'where' (Windows) command.
 * @returns {Promise<string|null>} Path to Git or null if not found.
 */
async function searchViaWhichWhere() {
  const cmd = os.platform() === "win32" ? "where git" : "which git";
  console.log(`Trying '${cmd}'...`);
  try {
    const stdout = await execCommand(cmd);
    // 'where' on Windows can return multiple paths; pick the first valid one.
    const potentialPaths = stdout
      .split("\n")
      .map(path => path.trim())
      .filter(Boolean);

    for (const path of potentialPaths) {
      if (isFile(path)) {
        console.log(`Found via '${cmd}': ${path}`);
        return path;
      }
    }
  } catch (error) {
    console.warn(`'${cmd}' failed: ${error.message.split("\n")[0]}`);
  }
  return null;
}

/**
 * Search strategy: Manually iterates through directories in the PATH environment variable.
 * @returns {Promise<string|null>} Path to Git or null if not found.
 */
async function searchViaPathEnv() {
  console.log("Searching PATH...");
  const pathEnv = process.env.PATH;
  if (!pathEnv) {
    console.warn("PATH environment variable not set.");
    return null;
  }

  const pathDirs = pathEnv.split(path.delimiter);
  const executableName = os.platform() === "win32" ? "git.exe" : "git";

  for (const dir of pathDirs) {
    const potentialGitPath = path.join(dir, executableName);
    if (isFile(potentialGitPath)) {
      console.log(`Found in PATH: ${potentialGitPath}`);
      return potentialGitPath;
    }
  }
  return null;
}

/**
 * Search strategy: Checks common default installation locations for Git.
 * @returns {Promise<string|null>} Path to Git or null if not found.
 */
async function searchViaCommonLocations() {
  console.log("Checking common locations...");
  const commonPaths =
    os.platform() === "win32"
      ? [
          "C:\\Program Files\\Git\\cmd\\git.exe",
          "C:\\Program Files\\Git\\bin\\git.exe",
          "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
          "C:\\Program Files (x86)\\Git\\bin\\git.exe",
          path.join(
            os.homedir(),
            "AppData",
            "Local",
            "Programs",
            "Git",
            "cmd",
            "git.exe"
          ),
          path.join(
            os.homedir(),
            "AppData",
            "Local",
            "Programs",
            "Git",
            "bin",
            "git.exe"
          ),
          "C:\\msysgit\\bin\\git.exe",
        ]
      : [
          // Linux and macOS
          "/usr/bin/git",
          "/usr/local/bin/git",
          "/opt/homebrew/bin/git",
          "/usr/local/git/bin/git",
          "/opt/local/bin/git",
          "/Applications/GitHub Desktop.app/Contents/Resources/app/git/bin/git",
        ];

  for (const path of commonPaths) {
    if (isFile(path)) {
      console.log(`Found at common location: ${path}`);
      return path;
    }
  }
  return null;
}

/**
 * Finds the path to the Git executable on the system.
 * Tries several methods in a defined order until Git is found.
 *
 * @returns {Promise<string|null>} A Promise that resolves with the Git executable path as a string, or null if Git is not found after all attempts.
 */
export async function findGitPath() {
  console.log("Searching for Git executable...");

  const strategies = [searchViaWhichWhere, searchViaPathEnv, searchViaCommonLocations];

  for (const strategy of strategies) {
    const gitPath = await strategy();
    if (gitPath) {
      console.log(`Git found: ${gitPath}`);
      return gitPath;
    }
  }

  console.log("Git not found on system.");
  return null;
}
