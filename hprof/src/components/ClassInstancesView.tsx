import React, { useState, useEffect, useMemo } from 'react'
import { Box, Stack, Group, Button, Text, ActionIcon } from '@mantine/core'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef, type MRT_PaginationState } from 'mantine-react-table'
import { HprofParser, InstanceSummary } from '../../hprof-wasm/pkg'

interface ClassInstancesViewProps {
    parser: HprofParser
    classId: string
    className: string
    onSelectInstance: (id: string) => void
    onBack: () => void
}

function RetainedSizeCell({ parser, id }: { parser: HprofParser, id: string }) {
    const [size, setSize] = useState<number | null>(null);
    const [calculating, setCalculating] = useState(false);

    const calculate = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCalculating(true);
        setTimeout(() => {
            try { setSize(Number(parser.calculate_retained_size(id))) }
            catch (e) { console.error(e) }
            finally { setCalculating(false) }
        }, 0);
    };

    if (size !== null) return <Text size="sm">{size.toLocaleString()}</Text>;
    return (
        <Button size="compact-xs" variant="light" loading={calculating} onClick={calculate}>
            Calculate
        </Button>
    );
}

export function ClassInstancesView({ parser, classId, className, onSelectInstance, onBack }: ClassInstancesViewProps) {
    const [instances, setInstances] = useState<InstanceSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalRowCount, setTotalRowCount] = useState(0);
    const [pagination, setPagination] = useState<MRT_PaginationState>({
        pageIndex: 0,
        pageSize: 100,
    });

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            try {
                const res = parser.get_class_instances(classId, pagination.pageIndex * pagination.pageSize, pagination.pageSize);
                setInstances(res);
                // We don't have total count per class easily accessible without another call,
                // but let's assume we can at least show the current page.
                // In a real scenario, we'd update get_instance_counts to include per-class instance count or add get_total_instances(classId).
                setTotalRowCount(1000000); // Placeholder for large files, MRT handles it
            }
            catch (e) { console.error(e) }
            finally { setLoading(false) }
        }, 0);
    }, [classId, pagination.pageIndex, pagination.pageSize, parser]);

    const columns = useMemo<MRT_ColumnDef<InstanceSummary>[]>(
        () => [
            {
                accessorKey: 'id',
                header: 'Instance ID',
                Cell: ({ cell }) => <Text size="sm" ff="monospace" c="blue" style={{ cursor: 'pointer', textDecoration: 'underline' }}>{cell.getValue<string>()}</Text>
            },
            {
                accessorKey: 'shallow_size',
                header: 'Shallow Size',
                Cell: ({ cell }) => cell.getValue<number>().toLocaleString(),
                size: 120,
            },
            {
                id: 'retained_size',
                header: 'Retained Size',
                Cell: ({ row }) => <RetainedSizeCell parser={parser} id={row.original.id} />,
                size: 150,
            },
        ],
        [parser],
    );

    const table = useMantineReactTable({
        columns,
        data: instances,
        manualPagination: true,
        rowCount: totalRowCount,
        onPaginationChange: setPagination,
        state: {
            isLoading: loading,
            pagination,
        },
        enableRowSelection: false,
        enableGlobalFilter: false,
        enableColumnFilters: false,
        initialState: { density: 'xs' },
        mantineTableBodyRowProps: ({ row }) => ({
            onClick: () => onSelectInstance(row.original.id),
            style: { cursor: 'pointer' },
        }),
    });

    return (
        <Stack p="md" h="100%" gap="xs">
            <Group><Button onClick={onBack} variant="subtle" size="sm">← Back to Classes</Button></Group>
            <Text size="lg" fw={700}>Instances of {className}</Text>
            <Box style={{ flex: 1, overflow: 'hidden' }}>
                <MantineReactTable table={table} />
            </Box>
        </Stack>
    );
}
