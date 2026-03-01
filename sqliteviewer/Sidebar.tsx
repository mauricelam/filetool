import React from 'react';

type Props = {
    tables: string[];
    selectedTable: string | null;
    onSelect: (t: string) => void;
};

export const Sidebar: React.FC<Props> = ({ tables, selectedTable, onSelect }) => {
    return (
        <aside className="sqlite-sidebar">
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
