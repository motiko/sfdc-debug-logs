// Salesforce API version for every call the extension makes (the app and the
// content scripts). Keep in sync with API_VERSION in scripts/lib/sf-auth.mjs
// (used by the e2e flow).
export const API = '/services/data/v62.0'
// Bulk API 1.0, used by "Delete All" on the classic log list.
export const ASYNC_API = '/services/async/62.0'
