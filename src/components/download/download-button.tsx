"use client";

import { Button } from "@/components/ui/button";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect } from 'react';

interface DownloadButtonProps {
    data: any[];
    type: 'csv' | 'pdf';
}

export function DownloadButton({ data, type }: DownloadButtonProps) {
    const handleCSVDownload = () => {

        if (!data || data.length === 0) {
            console.warn("No data to download.");
            return;
        }
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(obj =>
            Object.values(obj)
                .map(value => {
                    if (value instanceof Date) {
                        return value.toISOString();
                    }
                    return `"${value}"`
                })
                .join(',')
        )
        const csv = [headers, ...rows].join('\n')

        // Create and trigger download
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'users.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
    };

    const handlePDFDownload = () => {

        if (!data || data.length === 0) {
            console.warn("No data to download.");
            return;
        }

        const doc = new jsPDF();
        let isFirstPage = true;
        // Prepare data
        const headers = Object.keys(data[0]).map(h => h.toUpperCase());
        const rows = data.map(obj =>
            Object.values(obj).map(value =>
                value instanceof Date ? value.toISOString() : String(value)
            )
        );

        autoTable(doc, {
            head: [headers],
            body: rows,
            theme: 'grid',
            didDrawPage: (data) => {
                if (isFirstPage) {
                    // Add header only on first page
                    doc.setFontSize(14);
                    doc.text('Users List', 14, 16);
                    isFirstPage = false; // Set the flag to false after drawing on the first page
                }
            },

            styles: {
                fontSize: 8,
                cellPadding: 1.5
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255
            },
            margin: { top: 25 } // Extra space for header
        });

        // Add content
        // doc.setFontSize(12);
        // doc.text('Users List', 14, 15);

        // // Create table
        // doc.setFontSize(10);
        // let yPos = 25;

        // // Add headers
        // headers.forEach((header, i) => {
        //     doc.text(header, 14 + (i * 40), yPos);
        // });

        // // Add rows
        // rows.forEach((row) => {
        //     yPos += 10;
        //     row.forEach((cell, cellIndex) => {
        //         const text = cell instanceof Date ? cell.toISOString() : String(cell);
        //         doc.text(text, 14 + (cellIndex * 40), yPos);
        //     });
        // });

        // Save PDF
        doc.save('users.pdf');
    }

    const handleDownload = () => {
        if (type === 'csv') {
            handleCSVDownload();
        } else {
            handlePDFDownload();
        }
    };

    return (
        <Button onClick={handleDownload}>
            Download {type.toUpperCase()}
        </Button>
    );
}