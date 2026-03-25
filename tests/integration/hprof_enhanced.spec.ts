import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';
import * as fs from 'fs';

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
        await expect(iframe.locator('table')).toBeVisible();

        const classRow = iframe.locator('tr.clickable-row').first();
        const className = await classRow.locator('td').first().textContent();
        await classRow.click();

        // Should see "Instances of ..."
        await expect(iframe.getByText(`Instances of ${className?.trim()}`)).toBeVisible();

        // Wait for instances to load
        await expect(iframe.locator('div.clickable-row').first()).toBeVisible();

        // Click on an instance
        const instanceRow = iframe.locator('div.clickable-row').first();
        const instanceId = await instanceRow.textContent();
        await instanceRow.click();

        // Should see "Instance Detail:"
        await expect(iframe.getByText(`Instance Detail:`)).toBeVisible();
        await expect(iframe.getByText(`ID: ${instanceId?.trim()}`)).toBeVisible();

        // Calculate retained size
        const calculateBtn = iframe.getByRole('button', { name: 'Calculate' });
        await calculateBtn.click();

        // Should show "Retained Size:" and some number
        await expect(iframe.getByText('Retained Size:')).toBeVisible();
        // Wait for calculation to finish and show the result instead of the button
        await expect(calculateBtn).not.toBeVisible();

        // Find GC path
        const gcBtn = iframe.getByRole('button', { name: 'Find shortest path to GC root' });
        await gcBtn.click();

        // It should either show path steps or "Root:"
        // We'll wait for the button to disappear which indicates completion
        await expect(gcBtn).not.toBeVisible();
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

        // Go to Sankey tab
        await iframe.getByText('Memory Flow (Sankey)').click();

        // Should see the diagram
        const svg = iframe.locator('svg');
        await expect(svg).toBeVisible();

        // Wait for nodes (rects)
        await expect(iframe.locator('rect').first()).toBeAttached();
    });
});
