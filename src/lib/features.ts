/**
 * Feature switches.
 *
 * The assistant answers through the Gemini API, which needs `GOOGLE_API_KEY` in
 * the deployment environment. Until that key exists the tab is hidden instead
 * of showing a chat that can only fail; flip this to `true` once the key is set
 * in the Keys tab.
 */
export const ASSISTANT_ENABLED = false;
