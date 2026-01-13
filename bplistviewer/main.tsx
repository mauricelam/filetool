import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ReactJson from '@microlink/react-json-view';
import { Buffer } from 'buffer';
import { parseBuffer } from './parser';

const App = () => {
    const [data, setData] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        window.onmessage = async (e) => {
            if (e.data.action === 'respondFile') {
                try {
                    const file = e.data.file;
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const parsed = parseBuffer(buffer);
                    setData(parsed[0]);
                } catch (err) {
                    setData({ error: err.message });
                }
            }
        };
    }, []);

    return (
        <div>
            {data ? (
                <ReactJson src={data} name={false} />
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);
