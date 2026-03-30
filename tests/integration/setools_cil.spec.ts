import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';

test('SETools handler supports CIL and Type Details', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    const cilContent = `
        (class file (read write))
        (classorder (file))
        (sid kernel)
        (sidorder (kernel))
        (sensitivity s0)
        (sensitivityorder (s0))
        (level low (s0))
        (levelrange low_low (low low))
        (user u)
        (userlevel u low)
        (userrange u low_low)
        (role r)
        (type t)
        (type t2)
        (userrole u r)
        (roletype r t)
        (roletype r t2)
        (sidcontext kernel (u r t low_low))

        (type type_a)
        (type type_b)
        (typeattribute attr_1)
        (typeattributeset attr_1 (type_a))
        (allow type_a type_b (file (read)))
        (allow attr_1 type_b (file (write)))
    `;

    const iframe = await runHandlerTest(page, {
        handler: 'setools',
        file: {
            content: Buffer.from(cilContent),
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
