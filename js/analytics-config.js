window.AnalyticsConfig = {
  enabled: true,
  endpoint: "/api/log-event",
  batchSize: 10,
  batchInterval: 5000, // 5 seconds
  trackInputs: true,
  trackErrors: true,
  trackPerformance: true,
  devMode: false, // Set to true for local development
};
