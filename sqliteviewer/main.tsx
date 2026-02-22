import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './styles.css';
import { useSqliteWorker } from './useSqliteWorker';
import { Sidebar } from './Sidebar';
import { QueryControls } from './QueryControls';
import { ResultsTable } from './ResultsTable';

const SQLiteViewer: React.FC = () => {
    const { tables, execResult, exec } = useSqliteWorker();

    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [query, setQuery] = useState<string>('');
    const [sidebarWidth, setSidebarWidth] = useState<number>(240);
    const [isResizing, setIsResizing] = useState<{ startX: number; startWidth: number } | null>(null);

    useEffect(() => {
        if (selectedTable) {
            const newQuery = `SELECT * FROM ${selectedTable}`;
            setQuery(newQuery);
            exec(newQuery);
        }
    }, [selectedTable, exec]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const deltaX = e.clientX - isResizing.startX;
            setSidebarWidth(Math.max(100, isResizing.startWidth + deltaX));
        };

        const handleMouseUp = () => {
            setIsResizing(null);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const memoizedSidebar = React.useMemo(() => (
        <Sidebar
            tables={tables}
            selectedTable={selectedTable}
            onSelect={setSelectedTable}
            style={{ width: `${sidebarWidth}px`, flex: `0 0 ${sidebarWidth}px`, maxWidth: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
        />
    ), [tables, selectedTable, setSelectedTable, sidebarWidth]);

    const memoizedMain = React.useMemo(() => (
        <main className="sqlite-main">
            <QueryControls query={query} onChange={setQuery} onRun={() => exec(query)} error={execResult.error} />
            <ResultsTable results={execResult.results} columns={execResult.columns} />
        </main>
    ), [query, setQuery, exec, execResult.error, execResult.results, execResult.columns]);

    return (
        <div className="sqlite-root" style={{ position: 'relative' }}>
            {isResizing && <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 100,
                cursor: 'col-resize',
                background: 'transparent'
            }} />}
            {memoizedSidebar}
            <div
                className="sidebar-resizer"
                onMouseDown={(e) => {
                    setIsResizing({
                        startX: e.clientX,
                        startWidth: sidebarWidth
                    });
                }}
            />
            {memoizedMain}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <MantineProvider>
            <SQLiteViewer />
        </MantineProvider>
    );
} else {
    console.error("Could not find root element 'root'");
}
