import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('PCAP Viewer should display packets and protocol details from a PCAP file', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/sample.pcap');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'pcap',
        file: {
            content: fileContent,
            name: 'sample.pcap',
            type: 'application/vnd.tcpdump.pcap'
        }
    });

    // Verify packet capture info and header are rendered
    await expect(iframe.locator('text="sample.pcap"')).toBeVisible({ timeout: 20000 });
    await expect(iframe.locator('text="192.168.1.100"').first()).toBeVisible();
    await expect(iframe.locator('text="8.8.8.8"').first()).toBeVisible();

    // Verify frame details protocol tree
    await expect(iframe.getByText('Frame Details', { exact: false })).toBeVisible();
    await expect(iframe.getByText('Internet Protocol Version 4').first()).toBeVisible();
});

test('PCAP Viewer should filter packets using display filters', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/sample.pcap');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'pcap',
        file: {
            content: fileContent,
            name: 'sample.pcap',
            type: 'application/vnd.tcpdump.pcap'
        }
    });

    await expect(iframe.locator('text="sample.pcap"')).toBeVisible({ timeout: 20000 });

    const filterInput = iframe.getByPlaceholder('e.g., tcp, dns, ip.addr == 192.168.1.1');
    await expect(filterInput).toBeVisible();

    // Type display filter "tcp" and apply
    await filterInput.fill('tcp');
    const applyBtn = iframe.locator('button:has-text("Apply")');
    await applyBtn.click();

    // Verify TCP packet is shown
    await expect(iframe.locator('text="93.184.216.34"')).toBeVisible();
});
