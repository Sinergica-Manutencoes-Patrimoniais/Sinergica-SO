/**
 * TRIVIAIOX CLI Entry Point
 *
 * Main entry point for the TRIVIAIOX CLI with Commander.js integration.
 * Registers all subcommands including workers, agents, etc.
 *
 * @module cli
 * @version 1.0.0
 * @story 2.7 - Discovery CLI Search
 */

const { Command } = require("commander");
const path = require("path");
const fs = require("fs");

// Import command modules
const { createWorkersCommand } = require("./commands/workers");
const { createManifestCommand } = require("./commands/manifest");
const { createQaCommand } = require("./commands/qa");
const { createMcpCommand } = require("./commands/mcp");
const { createMigrateCommand } = require("./commands/migrate");
const { createGenerateCommand } = require("./commands/generate");
const { createMetricsCommand } = require("./commands/metrics");
const { createConfigCommand } = require("./commands/config");
const { createProCommand } = require("./commands/pro");

// Read package.json for version
const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
let packageVersion = "0.0.0";
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageVersion = packageJson.version;
} catch (error) {
  // Fallback version if package.json not found
}

/**
 * Create the main CLI program
 * @returns {Command} Commander program instance
 */
function createProgram() {
  const program = new Command();

  program
    .name("triviaiox")
    .version(packageVersion)
    .description("TRIVIAIOX-FullStack: AI-Orchestrated System for Full Stack Development")
    .addHelpText(
      "after",
      `
Commands:
  workers           Manage and discover workers
  manifest          Manage manifest files (validate, regenerate)
  qa                Quality Gate Manager (run, status)
  metrics           Quality Gate Metrics (record, show, seed, cleanup)
  config            Manage layered configuration (show, diff, migrate, validate)
  pro               TRIVIAIOX Pro license management (activate, status, deactivate, features)
  mcp               Manage global MCP configuration
  migrate           Migrate from v2.0 to v4.0.4 structure
  generate          Generate documents from templates (prd, adr, pmdr, etc.)
  install           Install TRIVIAIOX in current project
  init <name>       Create new TRIVIAIOX project
  info              Show system information
  doctor            Run system diagnostics

For command help:
  $ triviaiox <command> --help

Examples:
  $ triviaiox workers search "json transformation"
  $ triviaiox workers list --category=data
  $ triviaiox manifest validate
  $ triviaiox manifest regenerate
  $ triviaiox qa run
  $ triviaiox qa status
  $ triviaiox mcp setup --with-defaults
  $ triviaiox mcp link
  $ triviaiox mcp status
  $ triviaiox metrics show
  $ triviaiox metrics record --layer 1 --passed
  $ triviaiox metrics seed --days 30
  $ triviaiox migrate --dry-run
  $ triviaiox migrate --from=2.0 --to=2.1
  $ triviaiox generate pmdr --title "Feature X Decision"
  $ triviaiox generate adr --save
  $ triviaiox generate list
  $ triviaiox config show
  $ triviaiox config show --debug
  $ triviaiox config diff --levels L1,L2
  $ triviaiox config migrate --dry-run
  $ triviaiox config validate
  $ triviaiox config init-local
  $ triviaiox pro activate --key PRO-XXXX-XXXX-XXXX-XXXX
  $ triviaiox pro status
  $ triviaiox pro deactivate
  $ triviaiox pro features
  $ triviaiox pro validate
  $ triviaiox install
  $ triviaiox doctor
`,
    );

  // Add workers command
  program.addCommand(createWorkersCommand());

  // Add manifest command (Story 2.13)
  program.addCommand(createManifestCommand());

  // Add qa command (Story 2.10)
  program.addCommand(createQaCommand());

  // Add mcp command (Story 2.11)
  program.addCommand(createMcpCommand());

  // Add migrate command (Story 2.14)
  program.addCommand(createMigrateCommand());

  // Add generate command (Story 3.9)
  program.addCommand(createGenerateCommand());

  // Add metrics command (Story 3.11a)
  program.addCommand(createMetricsCommand());

  // Add config command (Story PRO-4)
  program.addCommand(createConfigCommand());

  // Add pro command (Story PRO-6)
  program.addCommand(createProCommand());

  return program;
}

/**
 * Run the CLI
 * @param {string[]} args - Command line arguments
 * @returns {Promise<void>}
 */
async function run(args = process.argv) {
  const program = createProgram();

  try {
    await program.parseAsync(args);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  createProgram,
  run,
};
