import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';
import * as fs from 'fs';
import * as path from 'path';

test('SETools handler supports CIL and Type Details', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    const cilPath = path.join(__dirname, '../../setools/examples/test_with_comments.cil');
    const cilContent = fs.readFileSync(cilPath);

    const iframe = await runHandlerTest(page, {
        handler: 'setools',
        file: {
            content: cilContent,
            name: 'test.cil',
            type: 'text/plain'
        }
    });

    // Verify UI header
    await expect(iframe.locator('h2')).toContainText('SETools', { timeout: 30000 });

    // Verify rules in Allow tab
    await iframe.getByRole('tab', { name: /Allow \(/ }).click();
    await expect(iframe.locator('body')).toContainText('allow type_a type_b:file { read };');
    await expect(iframe.locator('body')).toContainText('allow attr_1 type_b:file { write };');

    // Go to Types tab and select type_a
    await iframe.getByRole('tab', { name: /Types \(/ }).click();
    await iframe.getByText('type_a', { exact: true }).click();

    // Verify Type Details tab appeared
    await expect(iframe.getByRole('tab', { name: /Type Details: type_a/ })).toBeVisible();
    await iframe.getByRole('tab', { name: /Type Details: type_a/ }).click();

    // Verify attributes and base rules
    await expect(iframe.locator('body')).toContainText('Attributes: attr_1');
    await expect(iframe.locator('body')).toContainText('allow type_a type_b:file { read };');
    // Transitive rule should NOT be visible yet
    await expect(iframe.locator('body')).not.toContainText('allow attr_1 type_b:file { write };');

    // Toggle Transitive
    await iframe.getByLabel('Transitive').check();
    // Transitive rule SHOULD be visible now
    await expect(iframe.locator('body')).toContainText('allow attr_1 type_b:file { write };');
});
