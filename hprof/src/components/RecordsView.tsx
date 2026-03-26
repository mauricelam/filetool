import React, { useMemo } from 'react';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { HprofParser, RecordInfo } from '../../hprof-wasm/pkg';

interface RecordsViewProps {
    parser: HprofParser;
    onRecordClick: (index: number) => void;
    selectedRecordIndex: number | null;
}

export function RecordsView({ parser, onRecordClick, selectedRecordIndex }: RecordsViewProps) {
    const records = useMemo(() => {
        const total = parser.get_total_records();
        const res = parser.search_records('', 0, total);
        return res.records;
    }, [parser]);

    const columns = useMemo<MRT_ColumnDef<RecordInfo>[]>(
        () => [
            {
                accessorKey: 'tag',
                header: 'Tag',
            },
            {
                accessorKey: 'index',
                header: 'Index',
                size: 100,
            },
            {
                accessorKey: 'micros_since_header_ts',
                header: 'Time (+µs)',
                size: 150,
            },
        ],
        [],
    );

    const table = useMantineReactTable({
        columns,
        data: records,
        enableRowSelection: false,
        enableColumnOrdering: true,
        enableGlobalFilter: true,
        initialState: { density: 'xs', pagination: { pageSize: 20, pageIndex: 0 }, showGlobalFilter: true },
        mantineTableBodyRowProps: ({ row }) => ({
            onClick: () => onRecordClick(row.original.index),
            style: { cursor: 'pointer', backgroundColor: selectedRecordIndex === row.original.index ? 'var(--mantine-color-blue-light)' : undefined },
            className: 'record-item',
        }),
    });

    return <MantineReactTable table={table} />;
}
