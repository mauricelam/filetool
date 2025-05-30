/**
 * @fileoverview Manages default file handlers for different mime types.
 */

/**
 * Key for storing default file handler preferences in localStorage.
 */
export const DEFAULT_FILE_HANDLERS_KEY = "DEFAULT_FILE_HANDLERS";

/**
 * Represents the structure of default handler preferences.
 * Keys are mimetypes or filename patterns, and values are handler IDs.
 * @interface
 */
export interface DefaultHandlerPreferences {
  [key: string]: string;
}

/**
 * Retrieves the default handler preferences from localStorage.
 *
 * @returns {DefaultHandlerPreferences} The stored preferences, or an empty object if none are found.
 * @throws {Error} If `JSON.parse` fails due to invalid JSON in localStorage.
 */
export function getPreferences(): DefaultHandlerPreferences {
  const storedPrefs = localStorage.getItem(DEFAULT_FILE_HANDLERS_KEY);
  if (storedPrefs === null) { // Check explicitly for null
    return {};
  }
  // Let JSON.parse throw if storedPrefs is invalid JSON
  return JSON.parse(storedPrefs) as DefaultHandlerPreferences;
}

/**
 * Saves the default handler preferences to localStorage.
 *
 * @param {DefaultHandlerPreferences} prefs The preferences to save.
 * @throws {Error} If `JSON.stringify` fails (e.g., circular references).
 */
export function savePreferences(prefs: DefaultHandlerPreferences): void {
  // Let JSON.stringify throw if prefs is not serializable
  const stringifiedPrefs = JSON.stringify(prefs);
  localStorage.setItem(DEFAULT_FILE_HANDLERS_KEY, stringifiedPrefs);
}

/**
 * Gets the default handler ID for a given mimetype.
 *
 * @param {string} mimetype The mimetype to look up.
 * @param {string} filename The name of the file (currently unused, reserved for future enhancements).
 * @returns {string | null} The handler ID, or null if no default is set for the mimetype.
 */
export function getDefaultHandler(mimetype: string, filename: string): string | null {
  const prefs = getPreferences();
  return prefs[mimetype] || null;
}

/**
 * Sets the default handler ID for a given mimetype.
 *
 * @param {string} mimetype The mimetype to set the default for.
 * @param {string} filename The name of the file (currently unused, reserved for future enhancements).
 * @param {string} handlerId The ID of the handler to set as default.
 */
export function setDefaultHandler(mimetype: string, filename: string, handlerId: string): void {
  const prefs = getPreferences();
  prefs[mimetype] = handlerId;
  savePreferences(prefs);
}
