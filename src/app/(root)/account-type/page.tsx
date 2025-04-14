"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { User, Building2 } from "lucide-react";

// Create a component that uses useSearchParams
function AccountTypeContent() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const waitlistEmail = localStorage.getItem("waitlistEmail");
    if (!waitlistEmail) {
      router.push("/waitlist");
      return;
    }
    setEmail(waitlistEmail);
  }, [router]);

  const handleUserType = async (type: string) => {
    try {
      const response = await fetch("/api/waitlist/update-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, account_type: type }),
      });

      if (!response.ok) throw new Error("Failed to update user type");

      router.push("/waitlist-confirmation");
    } catch (error) {
      console.error("Error updating user type:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="max-w-md w-full p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">Choose Account Type</h1>
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => handleUserType('individual')}
            className="p-4 border rounded-lg hover:bg-gray-50"
          >
            Individual Account
          </button>
          <button
            onClick={() => handleUserType('organization')}
            className="p-4 border rounded-lg hover:bg-gray-50"
          >
            Organisation Account
          </button>
        </div>
      </div>
    </div>
  );
}

// Wrap the main component with Suspense
export default function AccountTypePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AccountTypeContent />
    </Suspense>
  );
} 