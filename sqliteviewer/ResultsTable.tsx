import 'mantine-react-table/styles.css';
import React, { useMemo } from 'react';
import {
    MantineReactTable,
    useMantineReactTable,
    type MRT_ColumnDef,
} from 'mantine-react-table';

type Props = {
    results: any[];
    columns: any[];
};

export const ResultsTable: React.FC<Props> = ({ results, columns: rawColumns }) => {
    const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
        return (rawColumns || []).map((col: any) => {
            const header = col.name ?? col.label ?? col.displayName ?? col.Header ?? col.title ?? col.accessor ?? col.name;
            const accessor = col.name ?? col.accessor;
            return {
                id: String(accessor ?? header),
                header: String(header),
                accessorKey: accessor,
                size: col.width ? Number(col.width) : 120,
                minSize: col.minWidth ?? 50,
                maxSize: col.maxWidth ?? 800,
            } as MRT_ColumnDef<any>;
        });
    }, [rawColumns]);

    const table = useMantineReactTable({
        columns,
        data: results,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
    });

    return (
        <div className="results" role="region" aria-label="Query results">
            <MantineReactTable table={table} />
        </div>
    );
};
