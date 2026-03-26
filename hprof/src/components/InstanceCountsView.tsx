import React, { useMemo } from 'react';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { InstanceCountEntry } from '../../hprof-wasm/pkg';

interface InstanceCountsViewProps {
    entries: InstanceCountEntry[];
    loading: boolean;
    onSelectClass: (id: string, name: string) => void;
}

export function InstanceCountsView({ entries, loading, onSelectClass }: InstanceCountsViewProps) {
    const columns = useMemo<MRT_ColumnDef<InstanceCountEntry>[]>(
        () => [
            {
                accessorKey: 'class_name',
                header: 'Class Name',
                size: 400,
            },
            {
                accessorKey: 'count',
                header: 'Count',
                Cell: ({ cell }) => cell.getValue<number>().toLocaleString(),
                size: 150,
            },
            {
                accessorKey: 'total_size',
                header: 'Total Size (bytes)',
                Cell: ({ cell }) => cell.getValue<number>().toLocaleString(),
                size: 200,
            },
        ],
        [],
    );

    const table = useMantineReactTable({
        columns,
        data: entries,
        state: { isLoading: loading },
        enableRowSelection: false,
        enableColumnOrdering: true,
        enableGlobalFilter: true,
        initialState: { density: 'xs', pagination: { pageSize: 50, pageIndex: 0 }, sorting: [{ id: 'total_size', desc: true }] },
        mantineTableBodyRowProps: ({ row }) => ({
            onClick: () => onSelectClass(row.original.class_id, row.original.class_name),
            style: { cursor: 'pointer' },
            className: 'clickable-row'
        }),
    });

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MantineReactTable table={table} />
        </div>
    );
}
