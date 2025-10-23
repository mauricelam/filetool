import React, { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef, ColumnSizingState } from '@tanstack/react-table';

type Props = {
    results: any[];
    columns: any[];
};

export const ResultsTable: React.FC<Props> = ({ results, columns }) => {
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

    const columnDefs = useMemo<ColumnDef<any, any>[]>(() => {
        return (columns || []).map((col: any) => {
            const header = col.name ?? col.label ?? col.displayName ?? col.Header ?? col.title ?? col.accessor ?? col.name;
            const accessor = col.name ?? col.accessor;
            return {
                id: String(accessor ?? header),
                header: String(header),
                accessorKey: accessor,
                size: col.width ? Number(col.width) : 120,
                minSize: col.minWidth ?? 50,
                maxSize: col.maxWidth ?? 800,
                enableResizing: true,
            } as ColumnDef<any, any>;
        });
    }, [columns]);

    const table = useReactTable({
        data: results,
        columns: columnDefs,
        getCoreRowModel: getCoreRowModel(),
        defaultColumn: { size: 120, minSize: 50 },
        onColumnSizingChange: setColumnSizing,
        state: { columnSizing },
        columnResizeMode: 'onChange',
        debugTable: false,
    });

    const headerGroups = table.getHeaderGroups();
    const rows = table.getRowModel().rows;

    const [wrappedCells, setWrappedCells] = React.useState<Set<string>>(new Set());

    const toggleCellWrap = (rowIndex: number, columnId: string) => {
        const key = `${rowIndex}:${columnId}`;
        setWrappedCells(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="results" role="region" aria-label="Query results">
            <div className="results-inner">
                <table className="results-table">
                <thead>
                    {headerGroups.map(headerGroup => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => {
                                const column = header.column;
                                const canResize = (column.getCanResize?.() ?? false);
                                return (
                                    <th
                                        key={column.id}
                                        id={`header-cell-${column.id}`}
                                        title={String(header.column.columnDef.header ?? column.id)}
                                        style={{ width: header.getSize() }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </div>
                                            {canResize ? (
                                                <div
                                                    onMouseDown={header.getResizeHandler()}
                                                    onTouchStart={header.getResizeHandler()}
                                                    className="resizer"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : null}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {rows.map((row, i) => {
                        return (
                            <tr key={row.id}>
                                {row.getVisibleCells().map(cell => {
                                    const colId = cell.column.id || String(((cell.column.columnDef as any).accessorKey) ?? cell.column.id ?? 'col');
                                    const cellKey = `${row.index}:${colId}`;
                                    const isWrapped = wrappedCells.has(cellKey);

                                    const className = isWrapped ? 'cell-wrap' : '';
                                    const title = typeof cell.getValue() === 'string' ? cell.getValue() as string : undefined;

                                    return (
                                        <td
                                            key={cell.id}
                                            className={className}
                                            title={title}
                                            onClick={(e) => { toggleCellWrap(row.index, String(colId)); e.stopPropagation(); }}
                                            style={{ width: headerGroups[0]?.headers.find(h => h.column.id === cell.column.id)?.getSize?.() ?? undefined }}
                                        >
                                            {(() => {
                                                const colDef: any = cell.column.columnDef;
                                                if (colDef.cell) {
                                                    return flexRender(colDef.cell, cell.getContext());
                                                }
                                                const val = cell.getValue();
                                                return typeof val === 'string' || typeof val === 'number' ? String(val) : JSON.stringify(val);
                                            })()}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>
        </div>
    );
};
