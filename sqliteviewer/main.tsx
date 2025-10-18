import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useTable } from 'react-table';

const SQLiteViewer: React.FC = () => {
    const requestFile = () => {
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' });
        }
    };
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [query, setQuery] = useState<string>('');
    const [results, setResults] = useState<any[]>([]);
    const [columns, setColumns] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        requestFile();
        workerRef.current = new Worker(new URL('./sqlite.worker.js', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { type, success, tables, results, columns, error } = e.data;

            switch (type) {
                case 'init':
                    if (!success) {
                        setError('Failed to initialize SQLite worker: ' + error);
                    }
                    break;
                case 'open':
                    if (success) {
                        workerRef.current?.postMessage({ type: 'getTables' });
                    } else {
                        setError('Failed to open database: ' + error);
                    }
                    break;
                case 'getTables':
                    setTables(tables.map(t => t[0]));
                    break;
                case 'exec':
                    if (error) {
                        setError(error);
                        setResults([]);
                        setColumns([]);
                    } else {
                        setResults(results);
                        setColumns(columns);
                        setError(null);
                    }
                    break;
            }
        };

        workerRef.current.postMessage({ type: 'init' });

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                workerRef.current?.postMessage({ type: 'open', file: e.data.file });
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        if (selectedTable) {
            const newQuery = `SELECT * FROM ${selectedTable}`;
            setQuery(newQuery);
            workerRef.current?.postMessage({ type: 'exec', sql: newQuery });
        }
    }, [selectedTable]);

    const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setQuery(e.target.value);
    };

    const handleRunQuery = () => {
        workerRef.current?.postMessage({ type: 'exec', sql: query });
    };

    const tableInstance = useTable({ columns, data: results });

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = tableInstance;

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            <div style={{ width: '200px', borderRight: '1px solid #ccc', padding: '10px' }}>
                <h3>Tables</h3>
                <ul>
                    {tables.map(table => (
                        <li key={table} onClick={() => setSelectedTable(table)} style={{ cursor: 'pointer', fontWeight: selectedTable === table ? 'bold' : 'normal' }}>
                            {table}
                        </li>
                    ))}
                </ul>
            </div>
            <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '10px' }}>
                    <textarea value={query} onChange={handleQueryChange} style={{ width: '100%', height: '100px', fontFamily: 'monospace' }} />
                    <button onClick={handleRunQuery}>Run Query</button>
                </div>
                {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <table {...getTableProps()} style={{ borderSpacing: 0, border: '1px solid black', width: '100%' }}>
                        <thead>
                            {headerGroups.map(headerGroup => (
                                <tr {...headerGroup.getHeaderGroupProps()}>
                                    {headerGroup.headers.map(column => (
                                        <th {...column.getHeaderProps()} style={{
                                            borderBottom: 'solid 3px red',
                                            background: 'aliceblue',
                                            color: 'black',
                                            fontWeight: 'bold',
                                        }}>
                                            {column.render('Header')}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody {...getTableBodyProps()}>
                            {rows.map(row => {
                                prepareRow(row);
                                return (
                                    <tr {...row.getRowProps()}>
                                        {row.cells.map(cell => (
                                            <td {...cell.getCellProps()} style={{
                                                padding: '10px',
                                                border: 'solid 1px gray',
                                                background: 'papayawhip',
                                            }}>
                                                {cell.render('Cell')}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<SQLiteViewer />);
} else {
    console.error("Could not find root element 'root'");
}