// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
 * @returns {DefaultHandlerPreferences} The stored preferences, or an empty object if none are found or an error occurs.
 */
export function getPreferences(): DefaultHandlerPreferences {
  try {
    const prefsString = localStorage.getItem(DEFAULT_FILE_HANDLERS_KEY);
    if (prefsString) {
      return JSON.parse(prefsString) as DefaultHandlerPreferences;
    }
  } catch (error) {
    console.error("Error parsing default handler preferences:", error);
  }
  return {};
}

/**
 * Saves the default handler preferences to localStorage.
 *
 * @param {DefaultHandlerPreferences} prefs The preferences to save.
 */
export function savePreferences(prefs: DefaultHandlerPreferences): void {
  try {
    localStorage.setItem(DEFAULT_FILE_HANDLERS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error("Error saving default handler preferences:", error);
  }
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
