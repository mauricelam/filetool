import { useEffect, useRef, useState } from 'react';

type ExecResult = {
    results: any[];
    columns: any[];
    error: string | null;
};

export function useSqliteWorker() {
    const workerRef = useRef<Worker | null>(null);
    const workerInitializedRef = useRef<boolean>(false);
    const pendingFileRef = useRef<File | null>(null);

    const [tables, setTables] = useState<string[]>([]);
    const [execResult, setExecResult] = useState<ExecResult>({ results: [], columns: [], error: null });

    useEffect(() => {
        const requestFile = () => {
            if (window.parent) {
                window.parent.postMessage({ action: 'requestFile' });
            }
        };

        requestFile();

        workerRef.current = new Worker(new URL('./sqlite.worker.js', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { type, success, tables, results, columns, error } = e.data;

            switch (type) {
                case 'init':
                    if (!success) {
                        setExecResult({ results: [], columns: [], error: 'Failed to initialize SQLite worker: ' + error });
                    } else {
                        workerInitializedRef.current = true;
                        if (pendingFileRef.current) {
                            workerRef.current?.postMessage({ type: 'open', file: pendingFileRef.current });
                            pendingFileRef.current = null;
                        }
                    }
                    break;
                case 'open':
                    if (success) {
                        workerRef.current?.postMessage({ type: 'getTables' });
                    } else {
                        setExecResult({ results: [], columns: [], error: 'Failed to open database: ' + error });
                    }
                    break;
                case 'getTables':
                    setTables((tables as any[]).map(t => t[0]));
                    break;
                case 'exec':
                    if (error) {
                        setExecResult({ results: [], columns: [], error });
                    } else {
                        setExecResult({ results: results ?? [], columns: columns ?? [], error: null });
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
                const file: File = e.data.file;
                if (workerInitializedRef.current) {
                    workerRef.current?.postMessage({ type: 'open', file });
                } else {
                    pendingFileRef.current = file;
                }
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const exec = (sql: string) => {
        workerRef.current?.postMessage({ type: 'exec', sql });
    };

    return { tables, execResult, exec };
}
