/**
 * Netlify Function to retrieve leaderboard from Supabase
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (for server-side operations)
 *
 * Query Parameters (optional):
 * - limit: Number of entries to return (default: 50, max: 100)
 * - offset: Number of entries to skip (default: 0)
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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Leaderboard Get] Missing Supabase credentials");
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

    // Parse query parameters
    const params = event.queryStringParameters || {};
    const limit = Math.min(
      Math.max(parseInt(params.limit || "50", 10), 1),
      100
    );
    const offset = Math.max(parseInt(params.offset || "0", 10), 0);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query leaderboard: sorted by ratio DESC, then by beatmatches DESC, then by created_at DESC
    const { data, error, count } = await supabase
      .from("leaderboard")
      .select("*", { count: "exact" })
      .order("ratio", { ascending: false })
      .order("beatmatches", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[Leaderboard Get] Supabase error:", error);
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

    // Calculate rank for each entry (based on offset)
    const leaderboard = (data || []).map((entry, index) => ({
      rank: offset + index + 1,
      playerName: entry.player_name,
      ratio: entry.ratio,
      beatmatches: entry.beatmatches,
      danceAttempts: entry.dance_attempts,
      perfectBeats: entry.perfect_beats,
      beatAttacks: entry.beat_attacks,
      damageDealt: entry.damage_dealt,
      airTimePercent: entry.air_time_percent,
      createdAt: entry.created_at,
    }));

    console.log(
      `[Leaderboard Get] Retrieved ${leaderboard.length} entries (total: ${
        count || 0
      })`
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: JSON.stringify({
        success: true,
        data: leaderboard,
        total: count || 0,
        limit,
        offset,
      }),
    };
  } catch (error) {
    console.error("[Leaderboard Get] Error:", {
      message: error.message,
      stack: error.stack,
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
