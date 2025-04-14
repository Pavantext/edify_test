"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Building2 } from "lucide-react";
import { toast } from "sonner";
import { OrgNameInput } from "@/components/organization/org-name-input";

export default function UserTypePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [showOrgInput, setShowOrgInput] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const waitlistEmail = localStorage.getItem("waitlistEmail");
    if (!waitlistEmail) {
      router.push("/waitlist");
      return;
    }
    setEmail(waitlistEmail);
  }, [router]);

  const checkOrgName = async (name: string) => {
    try {
      const response = await fetch(`/api/organizations/check-name?name=${encodeURIComponent(name)}`);
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error("Error checking organization name:", error);
      return false;
    }
  };

  const handleUserType = async (type: string) => {
    if (type === "organization") {
      setShowOrgInput(true);
      return;
    }

    try {
      const response = await fetch("/api/waitlist/update-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          account_type: type,
          organization_name: null 
        }),
      });

      if (!response.ok) throw new Error("Failed to update user type");
      router.push("/waitlist-confirmation");
    } catch (error) {
      console.error("Error updating user type:", error);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const handleOrgSubmit = async () => {
    if (!orgName.trim()) return;

    try {
      setIsChecking(true);
      console.log('Checking org name:', orgName.trim());

      const checkResponse = await fetch(`/api/organizations/check-name?name=${encodeURIComponent(orgName.trim())}`);
      console.log('Check response status:', checkResponse.status);
      
      if (!checkResponse.ok) {
        const errorText = await checkResponse.text();
        console.error('Check name response error:', errorText);
        throw new Error('Failed to check organisation name');
      }

      const checkData = await checkResponse.json();
      console.log('Check response data:', checkData);

      if (checkData.exists) {
        toast.error("This organisation name is already taken");
        return;
      }

      console.log('Submitting org details:', {
        email,
        account_type: "organization",
        organization_name: orgName.trim()
      });

      const updateResponse = await fetch("/api/waitlist/update-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          account_type: "organization",
          organization_name: orgName.trim() 
        }),
      });

      console.log('Update response status:', updateResponse.status);

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Update type response error:', errorText);
        throw new Error("Failed to update user type");
      }

      const updateData = await updateResponse.json();
      console.log('Update response data:', updateData);

      router.push("/waitlist-confirmation");
    } catch (error) {
      console.error('Error in handleOrgSubmit:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  if (showOrgInput) {
    return (
      <OrgNameInput
        orgName={orgName}
        isChecking={isChecking}
        onOrgNameChange={setOrgName}
        onBack={() => setShowOrgInput(false)}
        onSubmit={handleOrgSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Choose Your Account Type</h1>
          <p className="mt-4 text-lg text-gray-600">
            Select the best option that matches your needs
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Individual Card */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-0 group-hover:opacity-75 transition duration-1000"></div>
            <div className="relative bg-white p-8 rounded-lg border border-gray-200 hover:border-transparent transition-all duration-300 space-y-6">
              <div className="flex items-center justify-between">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500">For Individuals</p>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-900">Individual</h3>
                <p className="mt-4 text-gray-600 leading-relaxed">
                  Perfect for freelancers, researchers, and individual professionals looking to enhance their workflow.
                </p>
              </div>

              <ul className="space-y-3">
                {['Personal workspace', 'Individual analytics', 'Basic support'].map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <svg className="w-4 h-4 mr-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleUserType("individual")}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-lg font-medium transition-all duration-300"
              >
                Select Individual Account
              </Button>
            </div>
          </div>

          {/* Organization Card */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-0 group-hover:opacity-75 transition duration-1000"></div>
            <div className="relative bg-white p-8 rounded-lg border border-gray-200 hover:border-transparent transition-all duration-300 space-y-6">
              <div className="flex items-center justify-between">
                <div className="bg-purple-50 p-3 rounded-lg">
                  <Building2 className="w-8 h-8 text-purple-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500">For Teams</p>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-900">Organisation</h3>
                <p className="mt-4 text-gray-600 leading-relaxed">
                  Designed for teams, companies, and organisations that need advanced collaboration features.
                </p>
              </div>

              <ul className="space-y-3">
                {['Team collaboration', 'Advanced analytics', 'Priority support'].map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <svg className="w-4 h-4 mr-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleUserType("organization")}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-lg font-medium transition-all duration-300"
              >
                Select Organisation Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 