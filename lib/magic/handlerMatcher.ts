import { HANDLERS as DefaultHandlers, matchMimetype as defaultMatchMimetype } from '../../main/handlers'; // Assuming HANDLERS and matchMimetype might be defaults

// The File interface is a global type in browser-like environments and TypeScript's lib.dom.d.ts
// No specific import needed unless in a strictly Node.js environment without DOM types.

interface HandlerRule {
    mime?: string | RegExp;
    filename?: string | RegExp;
    description?: string | RegExp;
}

type MimeMatch = HandlerRule | string | RegExp;

interface Handler {
    name: string;
    handler: string; // This is the viewer path, e.g., "textviewer"
    mimetypes: MimeMatch[];
    [key: string]: any; // Allow other properties
}

interface DetermineHandlersResult {
    bestMatch?: Handler;
    allMatches: Handler[];
}

/**
 * Iterates through available handlers to find all that match the given file.
 * The first handler in the `availableHandlers` list that matches is considered the "best" match.
 *
 * @param file The File object to find handlers for.
 * @param availableHandlers An array of handler objects (e.g., the HANDLERS constant).
 * @param matcherFn The function used to check if a handler's rule matches the file (e.g., matchMimetype).
 * @returns An object containing `bestMatch` (the first handler that matched) and `allMatches`.
 */
export const determineHandlers = (
    file: File,
    availableHandlers: Handler[],
    matcherFn: (mimeMatch: MimeMatch, mime: string, filename: string, description?: string | null) => boolean
): DetermineHandlersResult => {
    let bestMatch: Handler | undefined = undefined;
    const allMatches: Handler[] = [];
    const matchedHandlerNames = new Set<string>(); // To avoid adding the same handler multiple times if it has multiple matching rules

    if (!file) {
        return { bestMatch, allMatches };
    }

    for (const handler of availableHandlers) {
        for (const mimeMatchRule of handler.mimetypes) {
            if (matcherFn(mimeMatchRule, file.type, file.name, null)) {
                // This handler matches.
                if (!matchedHandlerNames.has(handler.name)) {
                    allMatches.push(handler);
                    matchedHandlerNames.add(handler.name);
                    if (bestMatch === undefined) {
                        bestMatch = handler;
                    }
                }
                // Since HANDLERS are ordered by priority, the first handler object encountered that has ANY matching rule is the best.
                // We don't need to check other rules for THIS handler if one already matched for determining 'bestMatch'.
                // However, for 'allMatches', we should continue if we want to find all rules for this handler,
                // but the current logic of adding handler to allMatches once and using Set prevents duplicates.
                // The prompt implies "first handler *in the HANDLERS list*" so breaking here is correct for 'bestMatch'.
                // And for 'allMatches', once a handler is added, we don't need to add it again.
                break; // Found a matching rule for this handler, move to the next handler.
            }
        }
    }

    return { bestMatch, allMatches };
};

// Example usage (not part of the library file, just for illustration):
/*
const exampleFile = new File(["content"], "example.txt", { type: "text/plain" });
const result = determineHandlers(exampleFile, DefaultHandlers, defaultMatchMimetype);
console.log("Best Match:", result.bestMatch);
console.log("All Matches:", result.allMatches);
*/
