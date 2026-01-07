import { Page } from '@playwright/test';

export interface HandlerTestOptions {
    handler: string;
    file: {
        content: Buffer;
        name: string;
        type: string;
    };
}

export const runHandlerTest = async (page: Page, { handler, file }: HandlerTestOptions) => {
    await page.goto(`/tests/integration/driver.html?handler=${handler}`);
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });

    await page.evaluate((file) => {
        window.postMessage({
            action: 'setFile',
            file: file
        }, '*');
    }, {
        name: file.name,
        type: file.type,
        content: file.content.toString('base64'),
        encoding: 'base64'
    });

    const iframeEl = await page.$('#file-handler-iframe');
    const iframe = iframeEl ? await iframeEl.contentFrame() : null;
    if (!iframe) {
        throw new Error('Could not find the iframe');
    }
    await iframe.waitForSelector('body', { state: 'visible', timeout: 10000 });
    return iframe;
};
