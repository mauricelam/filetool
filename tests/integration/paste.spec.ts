import { test, expect } from '@playwright/test';

test.describe('Paste functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/filetool/');
        await page.waitForLoadState('networkidle');
        // Wait for the drop target to be ready
        const dropTarget = page.locator('#droptarget');
        await expect(dropTarget).toBeVisible();
    });

    test('should paste raw text correctly', async ({ page }) => {
        // Trigger paste event
        await page.evaluate(() => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', 'Hello world');
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        });

        // Verify modal is visible
        const modal = page.locator('.modal-content');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.preview-text')).toContainText('Hello world');

        // Change filename
        await modal.locator('#filename-input').fill('hello.txt');

        // Add file
        await modal.locator('button:has-text("Add File")').click();

        // Verify file is added
        await expect(page.locator('.filename')).toHaveText('hello.txt');

        // Select Text Viewer
        await page.locator('button:has-text("Text Viewer")').click();

        // Verify iframe content
        const iframe = page.frameLocator('#framecontainer iframe');
        await expect(iframe.locator('body')).toContainText('Hello world', { timeout: 15000 });
    });

    test('should paste hex text correctly', async ({ page }) => {
        // 'Hello' in hex is 48 65 6c 6c 6f
        const hexText = '48 65 6c 6c 6f';

        await page.evaluate((text) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }, hexText);

        const modal = page.locator('.modal-content');
        await modal.locator('label:has-text("Hex")').click();
        await modal.locator('#filename-input').fill('test.txt'); // Use .txt so it might auto-open text viewer or something easier
        await modal.locator('button:has-text("Add File")').click();

        await expect(page.locator('.filename')).toHaveText('test.txt');

        // Check if Text Viewer is available and click it
        await page.locator('button:has-text("Text Viewer")').click();

        // Hex was '48 65 6c 6c 6f' which is 'Hello'
        const iframe = page.frameLocator('#framecontainer iframe');
        await expect(iframe.locator('body')).toContainText('Hello', { timeout: 15000 });
    });

    test('should paste base64 text correctly', async ({ page }) => {
        // 'Hello' in base64 is SGVsbG8=
        const b64Text = 'SGVsbG8=';

        await page.evaluate((text) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }, b64Text);

        const modal = page.locator('.modal-content');
        await modal.locator('label:has-text("Base64")').click();
        await modal.locator('#filename-input').fill('b64.txt');
        await modal.locator('button:has-text("Add File")').click();

        await expect(page.locator('.filename')).toHaveText('b64.txt');

        // Select Text Viewer
        await page.locator('button:has-text("Text Viewer")').click();

        const iframe = page.frameLocator('#framecontainer iframe');
        await expect(iframe.locator('body')).toContainText('Hello', { timeout: 15000 });
    });

    test('should show error for invalid hex', async ({ page }) => {
        const invalidHex = '48 65 6c 6c 6'; // Odd length

        await page.evaluate((text) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }, invalidHex);

        const modal = page.locator('.modal-content');
        const hexOption = modal.locator('label:has-text("Hex")');
        await expect(hexOption).toHaveClass(/disabled/);
        await expect(hexOption.locator('input')).toBeDisabled();
    });

    test('should show error for invalid base64', async ({ page }) => {
        const invalidB64 = '!!!NotBase64!!!';

        await page.evaluate((text) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        }, invalidB64);

        const modal = page.locator('.modal-content');
        const b64Option = modal.locator('label:has-text("Base64")');
        await expect(b64Option).toHaveClass(/disabled/);
        await expect(b64Option.locator('input')).toBeDisabled();
    });

    test('should close on Esc key', async ({ page }) => {
        await page.evaluate(() => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', 'test');
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        });

        await expect(page.locator('.modal-content')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.modal-content')).not.toBeVisible();
    });

    test('should close on backdrop click', async ({ page }) => {
        await page.evaluate(() => {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', 'test');
            const event = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        });

        await expect(page.locator('.modal-content')).toBeVisible();
        // Click on the backdrop (the area outside the modal content)
        await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
        await expect(page.locator('.modal-content')).not.toBeVisible();
    });
});
