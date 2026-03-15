import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('DEX Viewer Layout', () => {
    test('should search for API usages and navigate in tabbed sidebar', async ({ page }) => {
        test.setTimeout(180000);
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');

        const fileContent = fs.readFileSync(dexPath);
        const contentArray = Array.from(new Uint8Array(fileContent));

        await page.goto('http://localhost:8080/filetool/tests/integration/driver.html?handler=dexviewer');

        await page.evaluate(({ contentArray, name }) => {
            window.postMessage({
                action: 'setFile',
                file: {
                    content: new Uint8Array(contentArray),
                    name: name,
                    type: 'application/octet-stream'
                }
            }, '*');
        }, { contentArray, name: 'classes.dex' });

        const iframe = page.frameLocator('#file-handler-iframe');
        await expect(iframe.locator('.package-tree')).toBeVisible({ timeout: 60000 });

        // Switch to API Search tab
        await iframe.locator('.tab-button:has-text("API Search")').click();

        // Search in sidebar
        const searchInput = iframe.locator('.sidebar .search-input');
        await searchInput.fill('Object');
        await iframe.locator('.sidebar .search-button').click();

        const firstResult = iframe.locator('.usage-item').first();
        await expect(firstResult).toBeVisible({ timeout: 60000 });

        const resultCount = await iframe.locator('.usage-item').count();
        console.log(`Found ${resultCount} results for 'Object'`);
        expect(resultCount).toBeGreaterThan(0);

        await firstResult.click();

        // Target method should be expanded in the content area
        await expect(iframe.locator('.content-area .method.expanded')).toBeVisible({ timeout: 30000 });

        // Header should be sticky
        await expect(iframe.locator('.content-area .class-header')).toBeVisible();
    });

    test('should resize sidebar', async ({ page }) => {
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');
        const fileContent = fs.readFileSync(dexPath);
        const contentArray = Array.from(new Uint8Array(fileContent));

        await page.goto('http://localhost:8080/filetool/tests/integration/driver.html?handler=dexviewer');

        await page.evaluate(({ contentArray, name }) => {
            window.postMessage({
                action: 'setFile',
                file: {
                    content: new Uint8Array(contentArray),
                    name: name,
                    type: 'application/octet-stream'
                }
            }, '*');
        }, { contentArray, name: 'classes.dex' });

        const iframe = page.frameLocator('#file-handler-iframe');
        await expect(iframe.locator('.sidebar')).toBeVisible({ timeout: 60000 });

        const sidebar = iframe.locator('.sidebar');
        const resizer = iframe.locator('.resizer');

        const initialBox = await sidebar.boundingBox();
        if (!initialBox) throw new Error('Could not get initial bounding box');

        const resizerBox = await resizer.boundingBox();
        if (!resizerBox) throw new Error('Could not get resizer bounding box');

        // Drag resizer
        await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + resizerBox.height / 2);
        await page.mouse.down();
        // Move in steps to ensure events are captured
        await page.mouse.move(resizerBox.x + resizerBox.width / 2 + 150, resizerBox.y + resizerBox.height / 2, { steps: 20 });
        await page.mouse.up();

        // Give it a moment to update
        await page.waitForTimeout(500);

        const finalBox = await sidebar.boundingBox();
        if (!finalBox) throw new Error('Could not get final bounding box');

        expect(finalBox.width).toBeGreaterThan(initialBox.width + 50);
    });

    test('should collapse sidebar', async ({ page }) => {
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');
        const fileContent = fs.readFileSync(dexPath);
        const contentArray = Array.from(new Uint8Array(fileContent));

        await page.goto('http://localhost:8080/filetool/tests/integration/driver.html?handler=dexviewer');

        await page.evaluate(({ contentArray, name }) => {
            window.postMessage({
                action: 'setFile',
                file: {
                    content: new Uint8Array(contentArray),
                    name: name,
                    type: 'application/octet-stream'
                }
            }, '*');
        }, { contentArray, name: 'classes.dex' });

        const iframe = page.frameLocator('#file-handler-iframe');
        await expect(iframe.locator('.sidebar')).toBeVisible({ timeout: 60000 });

        const toggle = iframe.locator('.sidebar-toggle');
        await toggle.click();

        const sidebar = iframe.locator('.sidebar');
        // Wait for transition to complete
        await expect(sidebar).toHaveCSS('width', '0px', { timeout: 10000 });

        const box = await sidebar.boundingBox();
        if (!box) throw new Error('Could not get bounding box');
        expect(box.width).toBe(0);
    });

    test('should show class and method on separate lines in search results', async ({ page }) => {
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');
        const fileContent = fs.readFileSync(dexPath);
        const contentArray = Array.from(new Uint8Array(fileContent));

        await page.goto('http://localhost:8080/filetool/tests/integration/driver.html?handler=dexviewer');

        await page.evaluate(({ contentArray, name }) => {
            window.postMessage({
                action: 'setFile',
                file: {
                    content: new Uint8Array(contentArray),
                    name: name,
                    type: 'application/octet-stream'
                }
            }, '*');
        }, { contentArray, name: 'classes.dex' });

        const iframe = page.frameLocator('#file-handler-iframe');
        await iframe.locator('.tab-button:has-text("API Search")').click();
        await iframe.locator('.sidebar .search-input').fill('Object');
        await iframe.locator('.sidebar .search-button').click();

        const location = iframe.locator('.usage-location').first();
        await expect(location).toBeVisible({ timeout: 60000 });

        // Check that it's using flex column
        await expect(location).toHaveCSS('display', 'flex');
        await expect(location).toHaveCSS('flex-direction', 'column');

        const className = location.locator('.type-name');
        const methodName = location.locator('.method-name');
        await expect(className).toBeVisible();
        await expect(methodName).toBeVisible();
    });
});
