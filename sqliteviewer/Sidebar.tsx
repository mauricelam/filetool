import React from 'react';

type Props = {
    tables: string[];
    selectedTable: string | null;
    onSelect: (t: string) => void;
    style?: React.CSSProperties;
};

export const Sidebar: React.FC<Props> = ({ tables, selectedTable, onSelect, style }) => {
    return (
        <aside className="sqlite-sidebar" style={style}>
            <div className="sidebar-inner">
                <h3>Tables</h3>
                <ul className="table-list">
                    {tables.map(table => (
                        <li
                            key={table}
                            onClick={() => onSelect(table)}
                            className={"table-item" + (selectedTable === table ? ' selected' : '')}
                            title={table}
                        >
                            {table}
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
};
