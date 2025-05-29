# Testing Guidelines for Default File Handler Feature

This document outlines the recommended tests for the default file handler functionality.

## 1. Unit Tests for `main/defaultHandlers.ts`

These tests should focus on the individual functions within `main/defaultHandlers.ts` and their interaction with `localStorage`.

### `getPreferences()`
- **Test Case:** `localStorage` is empty.
  - **Expected:** Returns an empty object (`{}`).
- **Test Case:** `localStorage` contains valid JSON for preferences.
  - **Expected:** Returns the correctly parsed preferences object.
- **Test Case:** `localStorage` contains invalid JSON.
  - **Expected:** Returns an empty object (`{}`) and does not throw an error.
- **Test Case:** `localStorage` contains a non-string value for the preferences key (if feasible to simulate).
  - **Expected:** Handles the situation gracefully, likely returning an empty object.

### `savePreferences()`
- **Test Case:** Saving a valid preferences object.
  - **Expected:** `localStorage` is updated with the correct JSON stringified representation of the object.
- **Test Case:** Attempting to save an object that could cause `JSON.stringify` to fail (e.g., containing circular references, though this is unlikely for the simple preference structure).
  - **Expected:** Errors are handled gracefully (e.g., logs an error, doesn't break the app).

### `setDefaultHandler(mimetype: string, filename: string, handlerId: string)`
- **Test Case:** Setting a default handler for a new mimetype.
  - **Expected:** The preference is correctly added to `localStorage` with the mimetype as the key.
- **Test Case:** Overriding an existing default handler for a mimetype.
  - **Expected:** The preference is correctly updated in `localStorage` for that mimetype.
- **(Future Enhancement):** Once logic for filename/pattern-based defaults is added, include tests for:
    - Setting a default by filename extension (e.g., ".log").
    - Setting a default by a more complex pattern.

### `getDefaultHandler(mimetype: string, filename: string): string | null`
- **Test Case:** No default handler is set for the given mimetype.
  - **Expected:** Returns `null`.
- **Test Case:** A default handler is set for the given mimetype.
  - **Expected:** Returns the correct `handlerId` (string).
- **(Future Enhancement):** Once logic for filename/pattern-based defaults is added, include tests for:
    - Retrieving a default by filename extension.
    - Correctly applying precedence if both a mimetype and a filename pattern match a file.

## 2. Integration/Behavioral Tests for `main/main.tsx` and `main/fileitem.tsx`

These tests simulate user interaction and verify the overall behavior of the feature. They would typically be written using tools like React Testing Library, Cypress, or Playwright.

### Scenario: File Opening without a Default Handler
1.  **Action:** User opens a file for which no default handler has been set (e.g., a `.txt` file for the first time).
2.  **Expected:**
    - The `FileItem` component displays buttons for all applicable handlers (e.g., "Open with Text Viewer", "Open with Hex Viewer").
    - Each handler button includes a "Set as default" option.

### Scenario: Setting a Default Handler
1.  **Action:** User opens a file (e.g., a `.txt` file).
2.  **Action:** User clicks the "Set as default" button associated with a specific handler (e.g., "Text Viewer").
3.  **Expected:**
    - The preference for "Text Viewer" being the default for the file's mimetype (e.g., "text/plain") is saved to `localStorage`.
    - User receives feedback (e.g., console message, alert, or button text change).

### Scenario: File Opening with a Default Handler
1.  **Setup:** A default handler (e.g., "Text Viewer" for "text/plain") has already been set.
2.  **Action:** User opens a file of that type (e.g., another `.txt` file).
3.  **Expected:**
    - The file is automatically opened using the default handler ("Text Viewer").
    - The `FileItem` component either does not display handler choice buttons, or indicates that the file was opened by the default handler.
    - The `iframe` source is correctly set to the default handler's path.

### Scenario: Invalid or Mismatched Default Handler
1.  **Setup:**
    - A default handler is stored in `localStorage` for a mimetype.
    - This handler ID is either:
        a. Not present in the current `HANDLERS` configuration in `handlers.ts`.
        b. Present, but its `mimetypes` configuration no longer matches the file.
2.  **Action:** User opens a file of that mimetype.
3.  **Expected:**
    - The system falls back to the behavior of no default being set.
    - All applicable handlers are displayed as buttons for the user to choose from.
    - A warning message is logged to the console indicating the issue with the stored default.

### Scenario: User Interface for "Set as Default"
1.  **Action:** User opens a file, and multiple handlers are available.
2.  **Expected:**
    - Each handler button in `FileItem` has an associated, clearly labeled "Set as default" option.
    - Clicking this option triggers the `setDefaultHandler` function with the correct parameters (mimetype, filename, handler ID).
