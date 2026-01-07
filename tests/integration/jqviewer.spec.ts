import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';

const file = {
    content: JSON.stringify({
        "name": "John Doe",
        "age": 30,
        "address": {
            "street": "123 Main St",
            "city": "Anytown"
        },
        "pets": [
            { "name": "Fluffy", "type": "cat" },
            { "name": "Fido", "type": "dog" }
        ]
    }),
    name: 'test.json',
    type: 'application/json'
};

test('should correctly display the initial JSON content', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await expect(iframe.locator('body')).toContainText('John Doe');
    await expect(iframe.locator('body')).toContainText('Fluffy');
});

test('should filter with a basic jq query', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await iframe.locator('textarea').fill('.name');
    await expect(iframe.locator('body')).toContainText('John Doe');
    await expect(iframe.locator('body')).not.toContainText('Fluffy');
});

test('should filter with a more complex jq query', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await iframe.locator('textarea').fill('.pets[0].name');
    await expect(iframe.locator('body')).toContainText('Fluffy');
    await expect(iframe.locator('body')).not.toContainText('John Doe');
});

test('should display an error for an invalid jq query', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await iframe.locator('textarea').fill('.foo-bar');
    await expect(iframe.locator('body')).toContainText('error');
});
