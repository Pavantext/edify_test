"use client";

import useSWR from "swr";
import { Suspense, useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ResponseModal from "@/components/ResponseModal";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface PeelGeneratorRecord {
    username: string;
    topic: string;
    subject: string;
    complexity: string;
    peel_content: any;
    tone: string;
    audience: string;
    word_count_range: any;
    feedback: any;
    created_at: string;
}

interface PeelGeneratorResponse {
    data: PeelGeneratorRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

const PAGE_SIZE = 10;

// Fetcher function for SWR
const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
};

const Page = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Read values from query parameters.
    const queryPage = Number(searchParams.get("page")) || 1;
    const querySearch = searchParams.get("search") || "";

    const [search, setSearch] = useState<string>(querySearch);
    const [debouncedSearch, setDebouncedSearch] = useState<string>(querySearch);

    // Debounce search input (500ms delay)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    // Construct API URL with query params
    const apiUrl = `/api/history/peel-generator?limit=${PAGE_SIZE}&offset=${(queryPage - 1) * PAGE_SIZE}&search=${encodeURIComponent(
        debouncedSearch
    )}`;

    // Fetch data using SWR
    const { data, error, isLoading } = useSWR<PeelGeneratorResponse>(apiUrl, fetcher, {
        refreshInterval: 5000, // Auto-refresh every 5 seconds
        revalidateOnFocus: true,
    });

    const history = data?.data || [];
    const totalPages = data?.totalPages || 1;

    // Function to update query parameters in the URL
    const updateQueryParams = (newPage: number, newSearch: string) => {
        const params = new URLSearchParams(searchParams.toString());
        newSearch ? params.set("search", newSearch) : params.delete("search");
        newPage > 1 ? params.set("page", newPage.toString()) : params.delete("page");
        router.replace(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="p-4 max-w-6xl mx-auto">
            {/* Search Input */}
            <div className="flex justify-between items-center mb-4">
                <Input
                    placeholder="Search by username..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            {isLoading ? (
                <div className="flex flex-col space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-md" />
                    ))}
                </div>
            ) : error ? (
                <p className="text-red-500">Error: {error.message}</p>
            ) : (
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead>Topic</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Complexity</TableHead>
                                <TableHead>Peel Content</TableHead>
                                <TableHead>Tone</TableHead>
                                <TableHead>Audience</TableHead>
                                <TableHead>Word Count Range</TableHead>
                                <TableHead>Feedback</TableHead>
                                <TableHead>Created At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.length > 0 ? (
                                history.map((record, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{record.username}</TableCell>
                                        <TableCell>
                                            <ResponseModal title="Topic" content={record.topic} />
                                        </TableCell>
                                        <TableCell>{record.subject}</TableCell>
                                        <TableCell>{record.complexity}</TableCell>
                                        <TableCell>
                                            <ResponseModal
                                                title="Peel Content"
                                                content={JSON.stringify(record.peel_content, null, 2)}
                                            />
                                        </TableCell>
                                        <TableCell>{record.tone}</TableCell>
                                        <TableCell>{record.audience}</TableCell>
                                        <TableCell>
                                            <ResponseModal
                                                title="Word Count Range"
                                                content={JSON.stringify(record.word_count_range, null, 2)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <ResponseModal
                                                title="Feedback"
                                                content={JSON.stringify(record.feedback, null, 2)}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-4">
                                        No history records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                    Page {queryPage} of {totalPages}
                </p>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const newPage = Math.max(queryPage - 1, 1);
                            updateQueryParams(newPage, search);
                        }}
                        disabled={queryPage === 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const newPage = Math.min(queryPage + 1, totalPages);
                            updateQueryParams(newPage, search);
                        }}
                        disabled={queryPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
};

const PageWrapper = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Page />
        </Suspense>
    );
};

export default PageWrapper;