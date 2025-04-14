"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Violation {
    type: string;
    count: number;
}

interface ViolationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    violations: Violation[];
}

export function ViolationsModal({ isOpen, onClose, violations }: ViolationsModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Violations</DialogTitle>
                    <DialogDescription>List of all violations and their counts.</DialogDescription>
                </DialogHeader>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Violation Type</TableHead>
                            <TableHead>Count</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {violations.map((violation, index) => (
                            <TableRow key={index}>
                                <TableCell>{violation.type}</TableCell>
                                <TableCell>{violation.count}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    );
}
