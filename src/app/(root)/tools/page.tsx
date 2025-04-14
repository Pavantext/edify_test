"use client";
import { useEffect, useState } from "react";
import ToolsGrid from "@/components/tools-grid";
import SubscriptionDialog from "@/components/SubscriptionDialog";
import { ReportButton } from "@/components/ReportButton";
import { v4 as uuidv4 } from "uuid";

const HomePage = () => {
  const [isClient, setIsClient] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Call the API to check premium and usage status.
    fetch("/api/check-premium")
      .then((res) => res.json())
      .then((data) => {
        // If not premium and usage limit exceeded, show the dialog.
        if (!data.premium && data.usageExceeded) {
          setShowSubscriptionDialog(true);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch premium info", err);
      });
  }, []);

  if (!isClient) return null;

  return (
    <div className="relative py-12 lg:py-24">
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className="absolute top-4 right-4">
        <ReportButton
          toolType="general"
          resultId={uuidv4()}
          position="fixed"
        />
      </div>
      <ToolsGrid />
    </div>
  );
};

export default HomePage;
