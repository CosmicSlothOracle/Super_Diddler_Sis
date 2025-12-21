const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

// Read environment variables with safe defaults
const WITH_STEAM = process.env.WITH_STEAM === "true";
const IS_ELECTRON = process.env.IS_ELECTRON === "true" || process.env.IS_ELECTRON === true;
const NODE_ENV = process.env.NODE_ENV || "production";

module.exports = {
  mode: NODE_ENV,
  // For web builds, we don't need to bundle since files are loaded via script tags
  // Entry is only used for Electron builds
  entry: IS_ELECTRON ? "./js/main.js" : "./js/main.js",
  target: IS_ELECTRON ? "electron-renderer" : "web",
  devtool:
    NODE_ENV === "development" ? "inline-source-map" : "source-map",
  devServer: {
    static: "./",
    port: 8080,
    hot: true,
    liveReload: true,
    watchFiles: ["**/*.js", "**/*.html", "**/*.css"],
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  // Ignore Electron modules for web builds
  externals: IS_ELECTRON ? {} : {
    "electron": "commonjs electron",
    "../electron-main/steam/steam-manager.js": "commonjs ../electron-main/steam/steam-manager.js",
  },
  resolve: {
    extensions: [".js", ".json"],
    fallback: {
      fs: false,
      path: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  optimization: {
    minimize: NODE_ENV !== "development", // Production: Minifizierung aktiv
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.WITH_STEAM": JSON.stringify(WITH_STEAM ? "true" : "false"),
      "process.env.IS_ELECTRON": JSON.stringify(IS_ELECTRON ? "true" : "false"),
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "assets"),
          to: path.resolve(__dirname, "dist", "assets"),
        },
        {
          from: path.resolve(__dirname, "data"),
          to: path.resolve(__dirname, "dist", "data"),
        },
        {
          from: path.resolve(__dirname, "js"),
          to: path.resolve(__dirname, "dist", "js"),
        },
        {
          from: path.resolve(__dirname, "levels"),
          to: path.resolve(__dirname, "dist", "levels"),
        },
        {
          from: path.resolve(__dirname, "index.html"),
          to: path.resolve(__dirname, "dist", "index.html"),
        },
        {
          from: path.resolve(__dirname, "manifest.json"),
          to: path.resolve(__dirname, "dist", "manifest.json"),
        },
        {
          from: path.resolve(__dirname, "sw.js"),
          to: path.resolve(__dirname, "dist", "sw.js"),
        },
      ],
    }),
  ],
};
