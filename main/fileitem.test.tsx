import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileItem } from './fileitem'; // Assuming FileItem is exported from fileitem.tsx
// Removed FileOrFolder import as it's not exported from fileitem.tsx

// jest.mock calls for './icons/icons' and './icons/supportedExtensions' removed
// as FileItem.tsx does not import them. Icon path generation is internal.


describe('FileItem Component', () => {
  const mockFileProps = {
    name: 'testfile.txt',
    mimetype: 'text/plain',
    description: 'A test text file',
    matchedHandlers: [
      { name: 'Text Editor', handler: 'textEditor' },
      { name: 'Hex Viewer', handler: 'hexViewer' },
    ],
    onOpenHandler: jest.fn(),
    initialActiveHandler: 'textEditor',
  };

  it('should render a file item correctly with its details and handlers', () => {
    render(<FileItem {...mockFileProps} />);

    expect(screen.getByText('testfile.txt')).toBeInTheDocument();
    expect(screen.getByText('text/plain')).toBeInTheDocument();
    expect(screen.getByText('A test text file')).toBeInTheDocument();

    // Check for the icon based on actual getIcon logic
    const icon = screen.getByRole('img');
    // 'txt' is not in ICON_LOOKUP in FileItem.tsx, so it should use 'icons/default_file.svg'
    expect(icon).toHaveAttribute('src', 'icons/default_file.svg');

    // Check if handlers are rendered (buttons with handler names)
    expect(screen.getByText('Text Editor')).toBeInTheDocument();
    expect(screen.getByText('Hex Viewer')).toBeInTheDocument();
  });

  it('should call onOpenHandler when a handler button is clicked', () => {
    const handleOpen = jest.fn();
    render(<FileItem {...mockFileProps} onOpenHandler={handleOpen} />);

    const textEditorButton = screen.getByText('Text Editor');
    fireEvent.click(textEditorButton);

    expect(handleOpen).toHaveBeenCalledWith(
      mockFileProps.matchedHandlers[0].handler, // 'textEditor'
      mockFileProps.name,
      mockFileProps.mimetype
    );
  });

  // The original tests for isSelected, isEditing, onRename are commented out
  // as the current FileItemProps does not support these states/callbacks directly.
  // FileItem seems to be a display component for file type and its handlers,
  // not a tree item that manages selection/editing state.

  // it('should apply selected class when isSelected is true', () => { ... });
  // it('should call onClick when clicked', () => { ... }); // FileItem itself doesn't have a general onClick, but onOpenHandler
  // it('should show an input field when isEditing is true', () => { ... });
  // it('should call onRename with new name when input changes and blurs', () => { ... });
});
