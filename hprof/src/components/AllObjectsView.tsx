import React, { useMemo } from 'react';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';

interface AllObjectsViewProps {
    allInstances: string[];
    loading: boolean;
}

export function AllObjectsView({ allInstances, loading }: AllObjectsViewProps) {
    const data = useMemo(() => allInstances.map(i => ({ value: i })), [allInstances]);

    const columns = useMemo<MRT_ColumnDef<{ value: string }>[]>(
        () => [
            {
                accessorKey: 'value',
                header: 'Object',
                Cell: ({ cell }) => (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85em' }}>
                        {cell.getValue<string>()}
                    </pre>
                ),
            },
        ],
        [],
    );

    const table = useMantineReactTable({
        columns,
        data,
        state: { isLoading: loading },
        enableRowSelection: false,
        enableColumnOrdering: false,
        enableGlobalFilter: true,
        initialState: { density: 'xs', pagination: { pageSize: 50, pageIndex: 0 } },
    });

    return (
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            <h3>All Objects (Limit 1000)</h3>
            <MantineReactTable table={table} />
        </div>
    );
}
