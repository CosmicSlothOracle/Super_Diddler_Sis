/**
 * Netlify Function to submit leaderboard scores to Supabase
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (for server-side operations)
 *
 * Request Body:
 * {
 *   "playerName": "PlayerName",
 *   "ratio": 85.5,
 *   "beatmatches": 17,
 *   "danceAttempts": 20,
 *   "perfectBeats": 15,
 *   "beatAttacks": 8,
 *   "damageDealt": 125.5,
 *   "airTimePercent": 35.2
 * }
 */

const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Leaderboard Submit] Missing Supabase credentials");
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Server configuration error",
          message: "Supabase credentials not configured",
        }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const {
      playerName,
      ratio,
      beatmatches,
      danceAttempts,
      perfectBeats,
      beatAttacks,
      damageDealt,
      airTimePercent,
    } = body;

    console.log("[Leaderboard Submit] Request body:", body);

    // Validate required fields
    if (
      !playerName ||
      typeof playerName !== "string" ||
      playerName.trim().length === 0
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Invalid request",
          message: "playerName is required and must be a non-empty string",
        }),
      };
    }

    // Validate beatmatches requirement (minimum 10)
    if (typeof beatmatches !== "number" || beatmatches < 10) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Invalid request",
          message:
            "Minimum 10 successful beatmatches required for leaderboard submission",
        }),
      };
    }

    // Validate ratio
    if (typeof ratio !== "number" || ratio < 0 || ratio > 100) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Invalid request",
          message: "ratio must be a number between 0 and 100",
        }),
      };
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sanitize player name (max 50 chars, trim whitespace)
    const sanitizedName = playerName.trim().substring(0, 50);

    // Prepare data for insertion
    const leaderboardEntry = {
      player_name: sanitizedName,
      ratio: Math.round(ratio * 100) / 100, // Round to 2 decimal places
      beatmatches: Math.round(beatmatches),
      dance_attempts: Math.round(danceAttempts || 0),
      perfect_beats: Math.round(perfectBeats || 0),
      beat_attacks: Math.round(beatAttacks || 0),
      damage_dealt: Math.round((damageDealt || 0) * 100) / 100,
      air_time_percent: Math.round((airTimePercent || 0) * 100) / 100,
      created_at: new Date().toISOString(),
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from("leaderboard")
      .insert([leaderboardEntry])
      .select();

    if (error) {
      console.error("[Leaderboard Submit] Supabase error:", error);
      console.error("[Leaderboard Submit] Failed entry:", leaderboardEntry);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Database error",
          message: error.message,
        }),
      };
    }

    console.log(
      `[Leaderboard Submit] Successfully submitted score for ${sanitizedName} (ratio: ${ratio}%)`
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: JSON.stringify({
        success: true,
        data: data[0],
        message: "Score submitted successfully",
      }),
    };
  } catch (error) {
    console.error("[Leaderboard Submit] Error:", {
      message: error.message,
      stack: error.stack,
      body: event.body?.substring(0, 500),
    });

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};
