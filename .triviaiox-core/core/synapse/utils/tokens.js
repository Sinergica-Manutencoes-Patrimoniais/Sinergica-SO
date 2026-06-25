/**
 * Estimate the number of tokens from a string.
 *
 * Uses the proven heuristic: tokens ~ string.length / 4
 *
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

module.exports = { estimateTokens };
