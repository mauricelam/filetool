import { test as base, expect, Page } from '@playwright/test';

export interface RecordedRequest {
  method: string;
  url: string;
  isCrossOrigin: boolean;
  postData: string | null;
}

const activeCanaryStrings = new Set<string>();

/**
 * Registers one or more canary strings to verify that no network request URL
 * or request body contains the registered values.
 */
export function registerCanary(...strings: Array<string | null | undefined>): void {
  for (const s of strings) {
    if (s && typeof s === 'string' && s.trim().length >= 3) {
      activeCanaryStrings.add(s.trim());
    }
  }
}

/**
 * Helper to clear registered canaries between tests.
 */
export function clearCanaries(): void {
  activeCanaryStrings.clear();
}

/**
 * Determines whether a URL is same-origin with the test server, blob:, or data:.
 */
function isAllowedOrigin(urlStr: string, page?: Page): boolean {
  if (urlStr.startsWith('blob:') || urlStr.startsWith('data:')) {
    return true;
  }
  try {
    const parsed = new URL(urlStr);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      if (parsed.port === '8080' || parsed.port === '') {
        return true;
      }
    }
    if (page) {
      const pageUrl = page.url();
      if (pageUrl && pageUrl !== 'about:blank') {
        const pageParsed = new URL(pageUrl);
        if (parsed.origin === pageParsed.origin) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export const test = base.extend<{ networkMonitor: void }>({
  networkMonitor: [
    async ({ context, page }, use) => {
      clearCanaries();
      const recordedRequests: RecordedRequest[] = [];

      await context.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url();
        const method = req.method().toUpperCase();
        const sameOrigin = isAllowedOrigin(url, page);
        const postData = req.postData();

        recordedRequests.push({
          method,
          url,
          isCrossOrigin: !sameOrigin,
          postData,
        });

        if (sameOrigin) {
          await route.continue();
        } else {
          await route.abort();
        }
      });

      try {
        await use();
      } finally {
        // Ensure browser context is restored to online mode for subsequent tests
        await context.setOffline(false).catch(() => {});
      }

      // Teardown checks

      // 1. Cross-origin requests check
      const crossOriginRequests = recordedRequests.filter((r) => r.isCrossOrigin);
      if (crossOriginRequests.length > 0) {
        const details = crossOriginRequests.map((r) => `${r.method} ${r.url}`).join(', ');
        expect(
          crossOriginRequests.length,
          `Test made ${crossOriginRequests.length} cross-origin request(s): ${details}`
        ).toBe(0);
      }

      // 2. Non-GET/HEAD method check
      const nonGetHeadRequests = recordedRequests.filter(
        (r) => r.method !== 'GET' && r.method !== 'HEAD'
      );
      if (nonGetHeadRequests.length > 0) {
        const details = nonGetHeadRequests.map((r) => `${r.method} ${r.url}`).join(', ');
        expect(
          nonGetHeadRequests.length,
          `Test made ${nonGetHeadRequests.length} non-GET/HEAD request(s): ${details}`
        ).toBe(0);
      }

      // 3. Canary check
      for (const req of recordedRequests) {
        for (const canary of activeCanaryStrings) {
          if (req.url.includes(canary)) {
            throw new Error(
              `Recorded request URL contains file name or canary string "${canary}": ${req.method} ${req.url}`
            );
          }
          if (req.postData && req.postData.includes(canary)) {
            throw new Error(
              `Recorded request body contains file name or canary string "${canary}": ${req.method} ${req.url}`
            );
          }
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
