import React from 'react';

type Props = {
    query: string;
    onChange: (v: string) => void;
    onRun: () => void;
    error: string | null;
};

export const QueryControls: React.FC<Props> = ({ query, onChange, onRun, error }) => {
    return (
        <div className="controls">
            <textarea
                value={query}
                onChange={(e) => onChange(e.target.value)}
                className="query-textarea"
                aria-label="SQL query"
            />
            <div className="controls-row">
                <button className="run-button" onClick={onRun}>Run Query</button>
                {error && <div className="error">{error}</div>}
            </div>
        </div>
    );
};
