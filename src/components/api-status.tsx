"use client";

import { useEffect, useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function APIStatus() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAPIStatus() {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          const data = await response.json();
          setError(data.error);
        }
      } catch (err) {
        setError("Unable to connect to API services");
      }
    }

    checkAPIStatus();
  }, []);

  if (!error) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>API Configuration Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
} 