import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test.describe('HPROF enhanced features', () => {
    test('HPROF viewer should support drill-down and retained size calculation', async ({ page }) => {
        const hprofPath = 'hprof/example/test.hprof';
        if (!fs.existsSync(hprofPath)) {
            console.warn(`Skipping test: ${hprofPath} not found`);
            return;
        }

        await runHandlerTest(page, {
            handler: 'hprof',
            file: {
                name: 'test.hprof',
                content: fs.readFileSync(hprofPath),
            }
        });

        const iframe = page.frameLocator('#file-handler-iframe');

        // Go to Instance Counts tab
        await iframe.getByText('Instance Counts').click();

        // Click on a class to see instances
        await expect(iframe.locator('table').nth(1)).toBeVisible();

        const classRow = iframe.locator('tr.clickable-row').first();
        const className = await classRow.locator('td').first().textContent();
        await classRow.click();

        // Should see "Instances of ..."
        await expect(iframe.getByText(`Instances of ${className?.trim()}`)).toBeVisible();

        // Wait for instances table header to appear
        await expect(iframe.getByText('Instance ID')).toBeVisible();

        // Wait for at least one row with an ID (e.g. 0x...)
        const instanceIdLink = iframe.locator('td a, td p, td span').filter({ hasText: '0x' }).first();
        await expect(instanceIdLink).toBeVisible();
        const instanceId = await instanceIdLink.textContent();

        // Check if Retained Size calculation starts/completes in the table
        // (It should say "Calculating..." then show a number)
        // Note: In small tests it might be very fast.

        // Click on an instance ID
        await instanceIdLink.click();

        // Should see "Instance Detail:"
        await expect(iframe.getByText(`Instance Detail:`)).toBeVisible();
        await expect(iframe.getByText(`ID: ${instanceId?.trim()}`)).toBeVisible();

        // Retained size should be calculated automatically
        await expect(iframe.getByText('Retained Size:')).toBeVisible();
        // The button "Calculate" should not be there (or should disappear)
        await expect(iframe.getByRole('button', { name: 'Calculate' })).not.toBeVisible({ timeout: 10000 });

        // GC path should also be found automatically
        // Instead of waiting for a button click, we wait for the result to appear.
        // It should either show path steps or "Root:"
        await expect(iframe.getByText('Root: ')).toBeVisible({ timeout: 10000 });
    });

    test('HPROF viewer should show Sankey diagram', async ({ page }) => {
        const hprofPath = 'hprof/example/test.hprof';
        if (!fs.existsSync(hprofPath)) return;

        await runHandlerTest(page, {
            handler: 'hprof',
            file: {
                name: 'test.hprof',
                content: fs.readFileSync(hprofPath),
            }
        });

        const iframe = page.frameLocator('#file-handler-iframe');

        // Go to Memory Flow tab
        await iframe.getByRole('tab', { name: 'Memory Flow' }).click();

        // Should see the diagram
        const svg = iframe.locator('svg').filter({ has: iframe.locator('rect') });
        await expect(svg.last()).toBeVisible();

        // Wait for nodes (rects)
        await expect(iframe.locator('rect').first()).toBeAttached();
    });
});
