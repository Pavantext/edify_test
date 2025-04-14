"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Call our own API endpoint
      const response = await fetch("/api/clerk/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join waitlist");
      }

      localStorage.setItem("waitlistEmail", email);
      toast.success("Successfully joined the waitlist!");
      router.push("/user-type");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join waitlist");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo1.svg"
              alt="Logo"
              width={100}
              height={100}
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Join Our Waitlist</h1>
          <p className="mt-2 text-gray-600">
            Be among the first to experience our platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#64c5b7] focus:border-transparent"
          />
          <Button 
            type="submit" 
            className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-3 rounded-md transition-colors"
            disabled={isLoading}
          >
            {isLoading ? "Joining..." : "Join Waitlist"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Already have an account?{" "}
            <button
              onClick={() => router.push("/sign-in")}
              className="text-black hover:text-gray-800 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Early Access</h3>
              <p className="text-sm text-gray-600">Be among the first to try our platform</p>
            </div>
          </div>

          <div className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Priority Support</h3>
              <p className="text-sm text-gray-600">Get dedicated support during beta phase</p>
            </div>
          </div>

          <div className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Limited Time Offer</h3>
              <p className="text-sm text-gray-600">Special benefits for early adopters</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 