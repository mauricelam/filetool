import { test as baseTest, expect as baseExpect, Page } from '@playwright/test';

export interface RecordedRequest {
  url: string;
  method: string;
  isCrossOrigin: boolean;
  isNonGetHead: boolean;
  postData?: string | null;
}

export interface NetworkMonitor {
  recordedRequests: RecordedRequest[];
  canaryStrings: Set<string>;
  addCanary: (...strings: (string | Uint8Array | ArrayBuffer | undefined | null)[]) => void;
}

export const test = baseTest.extend<{ networkMonitor: NetworkMonitor }>({
  networkMonitor: [
    async ({ page, context, baseURL }, use) => {
      const recordedRequests: RecordedRequest[] = [];
      const canaryStrings = new Set<string>();

      const addCanary = (...items: (string | Uint8Array | ArrayBuffer | undefined | null)[]) => {
        for (const item of items) {
          if (!item) continue;
          if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed.length >= 3) {
              canaryStrings.add(trimmed);
            }
          } else if (item instanceof Uint8Array || item instanceof ArrayBuffer || Buffer.isBuffer(item)) {
            const buf = item instanceof Uint8Array ? item : new Uint8Array(item as ArrayBuffer);
            try {
              const decoded = new TextDecoder('utf-8', { fatal: false }).decode(buf);
              const lines = decoded.split(/[\r\n\0]+/);
              for (const line of lines) {
                const trimmed = line.trim();
                // Filter distinctive content strings (>= 8 printable chars, non-generic)
                if (
                  trimmed.length >= 8 &&
                  /^[a-zA-Z0-9_\-\.\:\/ ]+$/.test(trimmed) &&
                  !/^(http|https|html|doctype|application|content|version|encoding|xmlns|processor|process|android)/i.test(trimmed)
                ) {
                  canaryStrings.add(trimmed);
                }
              }
            } catch {
              // Ignore decoding errors
            }
          }
        }
      };

      const serverOrigin = baseURL ? new URL(baseURL).origin : 'http://localhost:8080';

      await context.route('**/*', async (route, request) => {
        const urlStr = request.url();
        const method = request.method().toUpperCase();

        let isSameOrigin = false;
        if (urlStr.startsWith('blob:') || urlStr.startsWith('data:')) {
          isSameOrigin = true;
        } else {
          try {
            const parsed = new URL(urlStr);
            if (parsed.origin === serverOrigin) {
              isSameOrigin = true;
            }
          } catch {
            // Invalid URL -> cross-origin
          }
        }

        const isCrossOrigin = !isSameOrigin;
        const isNonGetHead = method !== 'GET' && method !== 'HEAD';
        const postData = request.postData();

        recordedRequests.push({
          url: urlStr,
          method,
          isCrossOrigin,
          isNonGetHead,
          postData,
        });

        if (isCrossOrigin) {
          await route.abort();
        } else {
          await route.continue();
        }
      });

      const monitor: NetworkMonitor = {
        recordedRequests,
        canaryStrings,
        addCanary,
      };

      (page as any)._networkMonitor = monitor;

      try {
        await use(monitor);
      } finally {
        // Always reset offline status at teardown so context remains online for next tests
        await context.setOffline(false);
      }

      // Teardown checks:
      // 1. Cross-origin requests or non-GET/HEAD requests
      const illegalRequests = recordedRequests.filter(
        (r) => r.isCrossOrigin || r.isNonGetHead
      );

      if (illegalRequests.length > 0) {
        const details = illegalRequests
          .map(
            (r) =>
              `[${r.method}] ${r.url} (crossOrigin: ${r.isCrossOrigin}, nonGetHead: ${r.isNonGetHead})`
          )
          .join('\n');
        throw new Error(`Forbidden network requests detected during test:\n${details}`);
      }

      // 2. Canary string checks (file name or file content leaked in request URL or body)
      if (canaryStrings.size > 0 && recordedRequests.length > 0) {
        const leaks: string[] = [];
        for (const req of recordedRequests) {
          for (const canary of canaryStrings) {
            if (req.url.includes(canary)) {
              leaks.push(`Canary string "${canary}" leaked in request URL: [${req.method}] ${req.url}`);
            }
            if (req.postData && req.postData.includes(canary)) {
              leaks.push(`Canary string "${canary}" leaked in request body: [${req.method}] ${req.url}`);
            }
          }
        }
        if (leaks.length > 0) {
          throw new Error(`File canary leak detected:\n${leaks.join('\n')}`);
        }
      }
    },
    { auto: true, scope: 'test' },
  ],
});

export { expect } from '@playwright/test';
