// Re-export from canonical location
module.exports = require("../infrastructure/scripts/triviaiox-validator");

// CLI Interface - delegate to canonical location
if (require.main === module) {
  // Pass through to the original script
  require("../infrastructure/scripts/triviaiox-validator");
}
