import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SearchTab, AnalysisTab, HashingTab } from './main';

// Polyfill TextEncoder/Decoder for jsdom
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock Canvas getContext
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    createImageData: jest.fn().mockReturnValue({ data: new Uint8Array(400) }),
    putImageData: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
}) as any;

describe('SearchTab', () => {
  const mockOnSearch = jest.fn();
  const mockOnJumpToOffset = jest.fn();
  const buffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0x57, 0x6F, 0x72, 0x6C, 0x64]); // "Hello World"

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs a hex search correctly', () => {
    render(
      <SearchTab
        buffer={buffer}
        results={[]}
        currentIndex={null}
        matchLength={0}
        onSearch={mockOnSearch}
        onJumpToOffset={mockOnJumpToOffset}
      />
    );

    const input = screen.getByPlaceholderText('Search query...');
    fireEvent.change(input, { target: { value: '48 65' } });
    fireEvent.click(screen.getByText('Find'));

    expect(mockOnSearch).toHaveBeenCalledWith([0], 0, 2);
    expect(mockOnJumpToOffset).toHaveBeenCalledWith(0);
  });

  it('performs a UTF-8 search correctly', () => {
    render(
      <SearchTab
        buffer={buffer}
        results={[]}
        currentIndex={null}
        matchLength={0}
        onSearch={mockOnSearch}
        onJumpToOffset={mockOnJumpToOffset}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'utf8' } });
    fireEvent.change(screen.getByPlaceholderText('Search query...'), { target: { value: 'World' } });
    fireEvent.click(screen.getByText('Find'));

    expect(mockOnSearch).toHaveBeenCalledWith([6], 0, 5);
    expect(mockOnJumpToOffset).toHaveBeenCalledWith(6);
  });

  it('handles navigation between results', () => {
    const results = [0, 6];
    render(
      <SearchTab
        buffer={buffer}
        results={results}
        currentIndex={0}
        matchLength={5}
        onSearch={mockOnSearch}
        onJumpToOffset={mockOnJumpToOffset}
      />
    );

    fireEvent.click(screen.getByText('Next'));
    expect(mockOnSearch).toHaveBeenCalledWith(results, 1, 5);
    expect(mockOnJumpToOffset).toHaveBeenCalledWith(6);

    fireEvent.click(screen.getByText('Prev'));
    expect(mockOnSearch).toHaveBeenCalledWith(results, 1, 5); // currentIndex was 0, so (0-1+2)%2 = 1
    expect(mockOnJumpToOffset).toHaveBeenCalledWith(6);
  });
});

describe('HashingTab', () => {
  const buffer = new Uint8Array([0, 1, 2, 3]);

  it('renders target information correctly', () => {
    render(<HashingTab buffer={buffer} selection={null} />);
    expect(screen.getByText('Full File')).toBeInTheDocument();

    render(<HashingTab buffer={buffer} selection={[0, 1]} />);
    expect(screen.getByText('Selection (0x0 - 0x1)')).toBeInTheDocument();
  });

  it('computes Web Crypto hashes', async () => {
    // Mock crypto.subtle.digest
    const mockDigest = jest.fn().mockResolvedValue(new Uint8Array([0xAA, 0xBB]).buffer);
    Object.defineProperty(global, 'crypto', {
      value: { subtle: { digest: mockDigest } },
      configurable: true
    });

    // Mock selection to avoid waiting for MD5 WASM which is hard to mock dynamically in HashingTab
    render(<HashingTab buffer={buffer} selection={[0, 3]} />);

    const button = screen.getByText('Compute Hashes');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('SHA-256')).toBeInTheDocument();
      expect(screen.getAllByText('aabb').length).toBeGreaterThan(0);
    });
  });
});

describe('AnalysisTab', () => {
  const buffer = new Uint8Array(1024).fill(0xAA);

  it('renders canvases', () => {
    const { container } = render(<AnalysisTab buffer={buffer} onJumpToOffset={jest.fn()} />);
    expect(container.querySelectorAll('canvas').length).toBe(2);
    expect(screen.getByText('Byte Map')).toBeInTheDocument();
    expect(screen.getByText('Entropy Graph')).toBeInTheDocument();
  });
});
