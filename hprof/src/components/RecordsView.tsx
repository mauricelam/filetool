import React, { useMemo, useState, useEffect } from 'react';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef, type MRT_PaginationState } from 'mantine-react-table';
import { HprofParser, RecordInfo } from '../../hprof-wasm/pkg';

interface RecordsViewProps {
    parser: HprofParser;
    onRecordClick: (index: number) => void;
    selectedRecordIndex: number | null;
}

export function RecordsView({ parser, onRecordClick, selectedRecordIndex }: RecordsViewProps) {
    const [records, setRecords] = useState<RecordInfo[]>([]);
    const [totalRowCount, setTotalRowCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 20,
    });

    useEffect(() => {
        const fetchRecords = () => {
            setIsLoading(true);
            try {
                const res = parser.search_records(
                    globalFilter,
                    pagination.pageIndex * pagination.pageSize,
                    pagination.pageSize
                );
                setRecords(res.records);
                setTotalRowCount(res.total_count);
            } catch (err) {
                console.error("Failed to search records:", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (globalFilter === '') {
            fetchRecords();
            return;
        }

        const timeoutId = setTimeout(fetchRecords, 300); // Debounce search
        return () => clearTimeout(timeoutId);
    }, [parser, globalFilter, pagination.pageIndex, pagination.pageSize]);

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
        manualPagination: true,
        manualFiltering: true,
        rowCount: totalRowCount,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        state: {
            isLoading,
            globalFilter,
            pagination,
            showGlobalFilter: true,
        },
        enableRowSelection: false,
        enableColumnOrdering: true,
        enableGlobalFilter: true,
        initialState: { density: 'xs' },
        mantineTableBodyRowProps: ({ row }) => ({
            onClick: () => onRecordClick(row.original.index),
            style: { cursor: 'pointer', backgroundColor: selectedRecordIndex === row.original.index ? 'var(--mantine-color-blue-light)' : undefined },
            className: 'record-item',
        }),
    });

    return <MantineReactTable table={table} />;
}
