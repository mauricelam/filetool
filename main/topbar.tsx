import React, { useState, useEffect } from 'react';

export function TopBar({ files }: { files: File[] }) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (files.length > 0) {
            // Show the toggle button
        } else {
            setIsCollapsed(false);
        }
    }, [files]);

    useEffect(() => {
        if (isCollapsed) {
            document.body.classList.add('collapsed');
        } else {
            document.body.classList.remove('collapsed');
        }
    }, [isCollapsed]);

    const handleToggle = () => {
        setIsCollapsed(prev => !prev);
    };

    return (
        <nav>
            <div id="logo">
                <div id="title">FileTool</div>
                <div id="subtitle">Analyze files in your browser</div>
            </div>
            {files.length > 0 && (
                <div id="info-toggle" title="Toggle File Info" onClick={handleToggle} style={{ display: 'flex' }}>
                    {isCollapsed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#fff">
                            <path d="M480-615 720-375l-56 56-184-184-184 184-56-56 240-240Z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#fff">
                            <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z" />
                        </svg>
                    )}
                </div>
            )}
        </nav>
    );
}
