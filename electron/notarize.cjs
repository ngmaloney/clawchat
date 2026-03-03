"use strict";

const { notarize } = require("@electron/notarize");

/**
 * Notarize the macOS app after signing.
 * Requires env vars:
 *   APPLE_ID                  - your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD - app-specific password from appleid.apple.com
 *   APPLE_TEAM_ID             - 10-character team ID
 *
 * Skip notarization by setting SKIP_NOTARIZE=1 (e.g. for local dev builds).
 */
exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== "darwin") return;
  if (process.env.SKIP_NOTARIZE === "1") {
    console.log("Skipping notarization (SKIP_NOTARIZE=1)");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  return await notarize({
    tool: "notarytool",
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
