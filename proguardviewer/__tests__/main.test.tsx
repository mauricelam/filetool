import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProguardViewer } from '../main';
import { vi } from 'vitest';

vi.mock('../proguard.ts');

import { MantineProvider } from '@mantine/core';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

test('renders the component', () => {
  render(
    <MantineProvider>
      <ProguardViewer />
    </MantineProvider>
  );
  expect(screen.getByText('Proguard Deobfuscator')).toBeInTheDocument();
});
