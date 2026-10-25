import { Page } from '@playwright/test';

export interface HandlerTestOptions {
    handler: string;
    file: {
        content: string | Buffer | Uint8Array;
        name: string;
        type: string;
    };
    additionalFiles?: Array<{
        content: string | Buffer | Uint8Array;
        name: string;
        type: string;
    }>;
    skipOffline?: boolean;
}

export const runHandlerTest = async (
    page: Page,
    { handler, file, additionalFiles, skipOffline = false }: HandlerTestOptions
) => {
    // 1. Register canaries for file name and content
    const monitor = (page as any)._networkMonitor;
    if (monitor?.addCanary) {
        monitor.addCanary(file.name, file.content);
        if (additionalFiles) {
            for (const f of additionalFiles) {
                monitor.addCanary(f.name, f.content);
            }
        }
    }

    await page.goto(`/filetool/tests/integration/driver.html?handler=${handler}`);
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });

    const iframeEl = await page.$('#file-handler-iframe');
    const iframe = iframeEl ? await iframeEl.contentFrame() : null;
    if (!iframe) {
        throw new Error('Could not find the iframe');
    }

    // Wait for iframe body to be ready before turning network offline
    await iframe.waitForSelector('body', { state: 'attached', timeout: 10000 });

    const processFile = (f: { content: any }) => {
        if (f.content instanceof Buffer) {
            f.content = Uint8Array.from(f.content);
        }
    };

    processFile(file);
    additionalFiles?.forEach(processFile);

    // 2. Turn off network before providing file unless explicitly skipped
    if (!skipOffline) {
        await page.context().setOffline(true);
    }

    await page.evaluate(({ file, additionalFiles }) => {
        window.postMessage({
            action: 'setFile',
            file,
            additionalFiles
        }, '*');
    }, { file, additionalFiles });

    await iframe.waitForSelector('body', { state: 'visible', timeout: 10000 });
    return iframe;
};

export default {
    runHandlerTest
};
