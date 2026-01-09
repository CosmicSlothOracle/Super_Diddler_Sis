/**
 * Leaderboard Client for Netlify Functions
 * Handles submission and retrieval of leaderboard scores
 */

window.LeaderboardClient = (function () {
  // Determine the base URL for Netlify Functions
  // In production, this will be the Netlify site URL
  // In development, use localhost:8888 (Netlify Dev)
  function getBaseUrl() {
    if (typeof window !== "undefined" && window.location) {
      // Production: use current origin
      if (
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        return window.location.origin;
      }
      // Development: use Netlify Dev default port
      return "http://localhost:8888";
    }
    return "";
  }

  /**
   * Submit a score to the leaderboard
   * @param {Object} stats - Match statistics object
   * @param {string} stats.playerName - Player name (max 50 chars)
   * @param {number} stats.ratio - Dance-to-Beatmatch ratio (0-100)
   * @param {number} stats.beatmatches - Number of successful beatmatches (must be >= 10)
   * @param {number} stats.danceAttempts - Total dance attempts
   * @param {number} stats.perfectBeats - Number of perfect beats
   * @param {number} stats.beatAttacks - Number of beat-match attacks
   * @param {number} stats.damageDealt - Total damage dealt
   * @param {number} stats.airTimePercent - Percentage of air time
   * @returns {Promise<Object>} Response from server
   */
  async function submitScore(stats) {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(
        `${baseUrl}/.netlify/functions/leaderboard-submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerName: stats.playerName || "Anonymous",
            ratio: stats.ratio || 0,
            beatmatches: stats.beatmatches || 0,
            danceAttempts: stats.danceAttempts || 0,
            perfectBeats: stats.perfectBeats || 0,
            beatAttacks: stats.beatAttacks || 0,
            damageDealt: stats.damageDealt || 0,
            airTimePercent: stats.airTimePercent || 0,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("[Leaderboard] Score submitted successfully:", data);
      return data;
    } catch (error) {
      console.error("[Leaderboard] Error submitting score:", error);
      throw error;
    }
  }

  /**
   * Get leaderboard entries
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of entries to retrieve (default: 50, max: 100)
   * @param {number} options.offset - Number of entries to skip (default: 0)
   * @returns {Promise<Object>} Leaderboard data with entries and metadata
   */
  async function getLeaderboard(options = {}) {
    try {
      const baseUrl = getBaseUrl();
      const limit = Math.min(Math.max(options.limit || 50, 1), 100);
      const offset = Math.max(options.offset || 0, 0);

      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(
        `${baseUrl}/.netlify/functions/leaderboard-get?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`[Leaderboard] Retrieved ${data.data?.length || 0} entries`);
      return data;
    } catch (error) {
      console.error("[Leaderboard] Error retrieving leaderboard:", error);
      throw error;
    }
  }

  /**
   * Check if a player is eligible for leaderboard submission
   * @param {Object} stats - Match statistics
   * @returns {boolean} True if eligible (beatmatches >= 10)
   */
  function isEligible(stats) {
    return (stats?.beatmatches || 0) >= 10;
  }

  /**
   * Calculate Dance-to-Beatmatch ratio from match stats
   * @param {Object} stats - Match statistics
   * @returns {number} Ratio as percentage (0-100)
   */
  function calculateRatio(stats) {
    if (!stats || !stats.danceAttempts || stats.danceAttempts <= 0) {
      return 0;
    }
    return Math.round((stats.beatmatches / stats.danceAttempts) * 100);
  }

  /**
   * Prepare stats object for submission from game state matchStats
   * @param {Object} matchStats - Player match statistics array [p1Stats, p2Stats]
   * @param {number} playerIndex - Index of player (0 or 1)
   * @param {string} playerName - Player name
   * @returns {Object} Prepared stats object for submission
   */
  function prepareStatsForSubmission(matchStats, playerIndex, playerName) {
    const stats = matchStats[playerIndex] || {};
    const totalTicks = stats.totalTicks || 1; // Avoid division by zero
    const airTimePercent = ((stats.airTimeTicks || 0) / totalTicks) * 100;

    return {
      playerName: playerName || "Anonymous",
      ratio: calculateRatio(stats),
      beatmatches: stats.beatmatches || 0,
      danceAttempts: stats.danceAttempts || 0,
      perfectBeats: stats.perfectBeats || 0,
      beatAttacks: stats.beatAttacks || 0,
      damageDealt: stats.damageDealt || 0,
      airTimePercent: airTimePercent,
    };
  }

  return {
    submitScore,
    getLeaderboard,
    isEligible,
    calculateRatio,
    prepareStatsForSubmission,
  };
})();
