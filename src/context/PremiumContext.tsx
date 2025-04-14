"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";

interface PremiumStatus {
    premium: boolean;
    loading: boolean;
}

const PremiumContext = createContext<PremiumStatus>({ premium: false, loading: true });

interface PremiumProviderProps {
    children: ReactNode;
}

export const PremiumProvider: React.FC<PremiumProviderProps> = ({ children }) => {
    const [premiumStatus, setPremiumStatus] = useState<PremiumStatus>({ premium: false, loading: true });

    useEffect(() => {
        async function fetchPremiumStatus() {
            try {
                const res = await fetch("/api/check-premium", {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                });
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                const data = await res.json();
                setPremiumStatus({ premium: data.premium, loading: false });
            } catch (err) {
                console.error("Error fetching premium status:", err);
                setPremiumStatus({ premium: false, loading: false });
            }
        }
        fetchPremiumStatus();
    }, []);

    return (
        <PremiumContext.Provider value={premiumStatus} >
            {children}
        </PremiumContext.Provider>
    );
};

export const usePremium = () => useContext(PremiumContext);
