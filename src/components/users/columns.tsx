"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "./data-table-column-header";
import { ViolationsModal } from "./violations-modal";
import { CustomUser } from "@/app/(root)/dashboard/page";

const violationTypes: Record<string, string> = {
    pii: "Personally Identifiable Information",
    cv: "Content Violation",
    bd: "Bias Detected",
    pid: "Prompt Injection Detected",
    fid: "Fraudulent Intent Detected",
    md: "Misinformation Detected",
    shd: "Self Harm Detected",
    ecd: "Extremist Content Detected",
    csv: "Child Safety Violation",
    amd: "Automation Misuse Detected",
};

export const columns: ColumnDef<CustomUser>[] = [
    {
        accessorKey: "username",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Username" />
        ),
        cell: ({ row }) => <div>{row.getValue("username")}</div>,
    },
    {
        accessorKey: "email",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => <div>{row.getValue("email")}</div>,
    },
    {
        accessorKey: "role",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => <div>{row.getValue("role")}</div>,
    },
    {
        accessorKey: "noOfPrompts",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="No. of Prompts" />
        ),
        cell: ({ row }) => <div>{row.getValue("noOfPrompts")}</div>,
    },
    {
        id: "violations",
        header: "Violations",
        cell: ({ row }) => {
            const [open, setOpen] = useState(false);

            const violations = Object.keys(violationTypes)
                .map((key) => ({
                    type: violationTypes[key],
                    count: (row.original as Record<string, any>)[key] || 0,
                }))
                .filter((violation) => violation.count > 0);

            return (
                <>
                    <Button onClick={() => setOpen(true)} size="sm">
                        View
                    </Button>
                    {open && (
                        <ViolationsModal
                            isOpen={open}
                            onClose={() => setOpen(false)}
                            violations={violations}
                        />
                    )}
                </>
            );
        },
    },
];
