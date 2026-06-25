/**
 * TRIVIAIOX Directory Check
 *
 * Verifies .triviaiox/ directory structure and permissions.
 *
 * @module triviaiox-core/health-check/checks/project/triviaiox-directory
 * @version 1.0.0
 * @story HCS-2 - Health Check System Implementation
 */

const fs = require("fs").promises;
const path = require("path");
const { BaseCheck, CheckSeverity, CheckDomain } = require("../../base-check");

/**
 * Expected .triviaiox directory structure
 */
const EXPECTED_STRUCTURE = [
  { path: ".triviaiox", type: "directory", required: false },
  { path: ".triviaiox/config.yaml", type: "file", required: false },
  { path: ".triviaiox/reports", type: "directory", required: false },
  { path: ".triviaiox/backups", type: "directory", required: false },
];

/**
 * TRIVIAIOX directory structure check
 *
 * @class TriviaioxDirectoryCheck
 * @extends BaseCheck
 */
class TriviaioxDirectoryCheck extends BaseCheck {
  constructor() {
    super({
      id: "project.triviaiox-directory",
      name: "TRIVIAIOX Directory Structure",
      description: "Verifies .triviaiox/ directory structure",
      domain: CheckDomain.PROJECT,
      severity: CheckSeverity.MEDIUM,
      timeout: 2000,
      cacheable: true,
      healingTier: 1, // Can auto-create directories
      tags: ["triviaiox", "directory", "structure"],
    });
  }

  /**
   * Execute the check
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Check result
   */
  async execute(context) {
    const projectRoot = context.projectRoot || process.cwd();
    const triviaioxPath = path.join(projectRoot, ".triviaiox");
    const issues = [];
    const found = [];

    // Check if .triviaiox exists at all
    try {
      const stats = await fs.stat(triviaioxPath);
      if (!stats.isDirectory()) {
        return this.fail(".triviaiox exists but is not a directory", {
          recommendation: "Remove .triviaiox file and run health check again",
        });
      }
      found.push(".triviaiox");
    } catch {
      // .triviaiox doesn't exist - this is optional
      return this.pass(".triviaiox directory not present (optional)", {
        details: {
          message: ".triviaiox directory is created automatically when needed",
          healable: true,
        },
      });
    }

    // Check subdirectories
    for (const item of EXPECTED_STRUCTURE.filter((i) => i.path !== ".triviaiox")) {
      const fullPath = path.join(projectRoot, item.path);
      try {
        const stats = await fs.stat(fullPath);
        const typeMatch = item.type === "directory" ? stats.isDirectory() : stats.isFile();
        if (typeMatch) {
          found.push(item.path);
        } else {
          issues.push(`${item.path} exists but is wrong type`);
        }
      } catch {
        if (item.required) {
          issues.push(`Missing: ${item.path}`);
        }
      }
    }

    // Check write permissions
    try {
      const testFile = path.join(triviaioxPath, ".write-test");
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);
    } catch {
      issues.push(".triviaiox directory is not writable");
    }

    if (issues.length > 0) {
      return this.warning(`TRIVIAIOX directory has issues: ${issues.join(", ")}`, {
        recommendation: "Run health check with --fix to create missing directories",
        healable: true,
        healingTier: 1,
        details: { issues, found },
      });
    }

    return this.pass("TRIVIAIOX directory structure is valid", {
      details: { found },
    });
  }

  /**
   * Get healer for this check
   * @returns {Object} Healer configuration
   */
  getHealer() {
    return {
      name: "create-triviaiox-directories",
      action: "create-directories",
      successMessage: "Created missing TRIVIAIOX directories",
      fix: async (_result) => {
        const projectRoot = process.cwd();
        const dirs = [
          ".triviaiox",
          ".triviaiox/reports",
          ".triviaiox/backups",
          ".triviaiox/backups/health-check",
        ];

        for (const dir of dirs) {
          const fullPath = path.join(projectRoot, dir);
          await fs.mkdir(fullPath, { recursive: true });
        }

        return { success: true, message: "Created TRIVIAIOX directories" };
      },
    };
  }
}

module.exports = TriviaioxDirectoryCheck;
