"use client";
import { useEffect, useState } from "react";
import HistoryGrid from "@/components/history-grid";

const HistoryPage = () => {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) return null;

    return (
        <div className="relative py-12 lg:py-18">
            <HistoryGrid />
        </div>
    );
};

export default HistoryPage;
