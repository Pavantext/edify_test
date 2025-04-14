"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "./data-table-column-header";

export type Violation = {
    id: string;
    username: string;
    tool: string;
    input: string;
    violations: string[];
    timestamp: string;
};

export const columns: ColumnDef<Violation>[] = [
    {
        accessorKey: "username",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Username" />
        ),
        cell: ({ row }) => <div>{row.getValue("username")}</div>,
    },
    {
        accessorKey: "tool",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Tool Type" />
        ),
        cell: ({ row }) => <div>{row.getValue("tool")}</div>,
    },
    {
        accessorKey: "input",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Input" />
        ),
        cell: ({ row }) => <div className="max-w-[200px]">{row.getValue("input")}</div>,
    },
    {
        accessorKey: "violations",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Violations" />
        ),
        cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
                {(row.getValue("violations") as string[]).map((violation, index) => (
                    <span
                        key={index}
                        className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800"
                    >
                        {violation}
                    </span>
                ))}
            </div>
        ),
        enableSorting: false,
    },
    {
        accessorKey: "timestamp",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => {
            const timestamp = row.getValue("timestamp") as string;
            const date = new Date(timestamp);
            return <div>{date.toLocaleString()}</div>;
        },
    },
];