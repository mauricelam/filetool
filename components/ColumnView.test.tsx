import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ColumnView } from './ColumnView'; // Assuming ColumnView is exported from ColumnView.tsx

describe('ColumnView Component', () => {
  const mockInitialContent = {
    'folder1': {
      'file1.txt': 'content1',
      'subfolder1': {
        'file2.txt': 'content2',
      },
    },
    'file3.txt': 'content3',
  };

  it('should render initial content correctly', () => {
    render(<ColumnView initialContent={mockInitialContent} onItemClick={() => {}} />);

    // Check if top-level items are rendered
    expect(screen.getByText('folder1')).toBeInTheDocument();
    expect(screen.getByText('file3.txt')).toBeInTheDocument();
  });

  it('should show items in next column when a folder is clicked', () => {
    const mockOnItemClick = jest.fn();
    render(<ColumnView initialContent={mockInitialContent} onItemClick={mockOnItemClick} />);

    const folderElement = screen.getByText('folder1');
    fireEvent.click(folderElement);

    // Check if items from folder1 are now visible
    // These assertions assume that clicking a folder makes its children appear *somewhere* in the document.
    // Depending on ColumnView's rendering logic, they might be in a new column identifiable by role or other attributes.
    expect(screen.getByText('file1.txt')).toBeInTheDocument();
    expect(screen.getByText('subfolder1')).toBeInTheDocument();

    // Check if onItemClick was called with correct parameters
    expect(mockOnItemClick).toHaveBeenCalledWith(0, 'folder1', mockInitialContent.folder1);
  });

  it('should render file actions when renderFileActions prop is provided', () => {
     const mockRenderFileActions = jest.fn((file, path) => <button>Action for {path.join('/')}</button>);
     // For this test, let's use a simple structure that only contains a file,
     // and assume renderFileActions is called for the selected/clicked file.
     const fileContentOnly = { 'file1.txt': new Uint8Array([1,2,3]) };
     render(
         <ColumnView
             initialContent={fileContentOnly}
             onItemClick={() => {}}
             renderFileActions={mockRenderFileActions}
         />
     );

     const fileElement = screen.getByText('file1.txt');
     // Simulate clicking the file to make it "active" or "selected",
     // which might be a condition for ColumnView to call renderFileActions.
     fireEvent.click(fileElement);

     // Verify renderFileActions was called.
     // The path argument passed to renderFileActions would be ['file1.txt']
     expect(mockRenderFileActions).toHaveBeenCalledWith(fileContentOnly['file1.txt'], ['file1.txt']);

     // Verify the button rendered by mockRenderFileActions is in the document.
     expect(screen.getByText('Action for file1.txt')).toBeInTheDocument();
  });

  // Add more tests:
  // - Clicking a file (and verifying onItemClick is called with file content)
  // - Navigating deep into folders and verifying column behavior
  // - Empty content (initialContent = {})
  // - Content with only files
  // - Content with only empty folders
});
