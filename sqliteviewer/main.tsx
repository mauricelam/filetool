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

    useEffect(() => {
        if (selectedTable) {
            const newQuery = `SELECT * FROM ${selectedTable}`;
            setQuery(newQuery);
            exec(newQuery);
        }
    }, [selectedTable, exec]);

    return (
        <div className="sqlite-root">
            <Sidebar tables={tables} selectedTable={selectedTable} onSelect={setSelectedTable} />
            <main className="sqlite-main">
                <QueryControls query={query} onChange={setQuery} onRun={() => exec(query)} error={execResult.error} />
                <ResultsTable results={execResult.results} columns={execResult.columns} />
            </main>
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
