/**
 * Application version information
 * These placeholders will be replaced during the build process
 * by the GitHub workflow in .github/workflows/deploy.yml
 */

export const APP_VERSION = "__APP_VERSION__";
export const APP_BRANCH = "__APP_BRANCH__";
export const BUILD_NUMBER = "__BUILD_NUMBER__";
export const BUILD_DATE = "__BUILD_DATE__";

// Export as default object for convenience
export default {
  version: APP_VERSION,
  branch: APP_BRANCH,
  buildNumber: BUILD_NUMBER,
  buildDate: BUILD_DATE,
};
