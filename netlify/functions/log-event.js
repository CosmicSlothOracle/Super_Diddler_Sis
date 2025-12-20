/**
 * Netlify Function to receive and log analytics events
 *
 * IMPORTANT: Netlify Functions run in a serverless environment with a read-only
 * filesystem (except /tmp). We cannot write to local files.
 *
 * Instead, we log events using console.log(), which automatically appears in:
 * - Netlify Dashboard > Functions > log-event > Logs
 * - Netlify CLI: netlify functions:log
 *
 * For production, consider integrating with external log services:
 * - Logtail, LogRocket, Sentry, or custom backend API
 */

exports.handler = async (event, context) => {
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

  try {
    const body = JSON.parse(event.body || "{}");
    const events = body.events || [];

    if (!Array.isArray(events) || events.length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "No events provided" }),
      };
    }

    // Validate events
    const validEvents = events.filter((evt) => {
      return (
        evt &&
        typeof evt === "object" &&
        evt.timestamp &&
        evt.eventType &&
        evt.userId &&
        evt.sessionId
      );
    });

    // Log each event to Netlify Function Logs
    // These logs appear in: Netlify Dashboard > Functions > log-event > Logs
    for (const evt of validEvents) {
      // Format: JSON string for easy parsing/export later
      console.log(
        JSON.stringify({
          type: "analytics_event",
          timestamp: evt.timestamp,
          eventType: evt.eventType,
          userId: evt.userId,
          sessionId: evt.sessionId,
          data: evt.data,
          // Additional metadata
          receivedAt: new Date().toISOString(),
          ip:
            event.headers?.["x-forwarded-for"] ||
            event.headers?.["client-ip"] ||
            "unknown",
          userAgent: event.headers?.["user-agent"] || "unknown",
        })
      );
    }

    // Also log summary for quick overview
    const eventTypes = {};
    validEvents.forEach((evt) => {
      eventTypes[evt.eventType] = (eventTypes[evt.eventType] || 0) + 1;
    });
    console.log(
      `[Analytics Summary] Received ${validEvents.length} events:`,
      JSON.stringify(eventTypes)
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
        eventsReceived: events.length,
        eventsLogged: validEvents.length,
      }),
    };
  } catch (error) {
    // Log errors to Netlify Function Logs
    console.error("[Analytics Error]", {
      message: error.message,
      stack: error.stack,
      body: event.body?.substring(0, 500), // First 500 chars for debugging
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
