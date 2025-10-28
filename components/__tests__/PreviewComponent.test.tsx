import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PreviewComponent } from '../PreviewComponent';
import * as fileTypeDetector from '../../file-type-detector';

jest.mock('../../file-type-detector');

const mockFileTypeDetector = fileTypeDetector as jest.Mocked<typeof fileTypeDetector>;

describe('PreviewComponent', () => {
    it('should render a loading message initially', () => {
        const file = {
            _name: 'test.txt',
            extract: () => Promise.resolve(new File(['hello'], 'test.txt', { type: 'text/plain' })),
        };
        render(<PreviewComponent file={file} />);
        expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    });

    it('should render an iframe with the correct src when a handler is found', async () => {
        const file = {
            _name: 'test.txt',
            extract: () => Promise.resolve(new File(['hello'], 'test.txt', { type: 'text/plain' })),
        };
        mockFileTypeDetector.getHandlerForFile.mockResolvedValue('textviewer');
        render(<PreviewComponent file={file} />);
        await waitFor(async () => {
            const iframe = await screen.findByRole('iframe');
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute('src', '/textviewer/index.html');
        });
    });

    it('should not render an iframe when no handler is found', async () => {
        const file = {
            _name: 'test.unknown',
            extract: () => Promise.resolve(new File(['hello'], 'test.unknown')),
        };
        mockFileTypeDetector.getHandlerForFile.mockResolvedValue(null);
        render(<PreviewComponent file={file} />);
        await waitFor(() => {
            expect(screen.queryByRole('iframe')).not.toBeInTheDocument();
        });
    });
});
