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
}

export const runHandlerTest = async (page: Page, { handler, file, additionalFiles }: HandlerTestOptions) => {
    await page.goto(`/filetool/tests/integration/driver.html?handler=${handler}`);
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });

    const processFile = (f: { content: any }) => {
        if (f.content instanceof Buffer) {
            f.content = Uint8Array.from(f.content);
        }
    };

    processFile(file);
    additionalFiles?.forEach(processFile);

    await page.evaluate(({ file, additionalFiles }) => {
        window.postMessage({
            action: 'setFile',
            file,
            additionalFiles
        }, '*');
    }, { file, additionalFiles });

    const iframeEl = await page.$('#file-handler-iframe');
    const iframe = iframeEl ? await iframeEl.contentFrame() : null;
    if (!iframe) {
        throw new Error('Could not find the iframe');
    }
    await iframe.waitForSelector('body', { state: 'visible', timeout: 10000 });
    return iframe;
};

export default {
    runHandlerTest
};
