"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MinusCircle, PlusCircle, Users } from 'lucide-react';
import { useOrganization } from '@clerk/nextjs';

interface Plan {
  name: string;
  price: number;
  interval: string;
  price_id: string;
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: Plan;
  onConfirm: (priceId: string, memberCount: number) => void;
}

export function SubscriptionModal({
  isOpen,
  onClose,
  selectedPlan,
  onConfirm,
}: SubscriptionModalProps) {
  const { organization } = useOrganization();
  const orgCount = organization?.membersCount || 1;

  // Define minimum allowed members based on plan type.
  const planMinCount =
    selectedPlan.name === "Medium" ? 6 :
      selectedPlan.name === "Large" ? 21 :
        1; // default for Small plan

  // Define maximum allowed members for each plan.
  const planMaxCount =
    selectedPlan.name === "Small" ? 5 :
      selectedPlan.name === "Medium" ? 20 :
        Infinity;

  // Initialize member count as the greater of org count or plan's minimum.
  const initialMemberCount = Math.max(orgCount, planMinCount);
  const [memberCount, setMemberCount] = useState<number>(initialMemberCount);

  // Reset member count when modal opens or when organization info changes.
  useEffect(() => {
    if (isOpen) {
      setMemberCount(Math.max(organization?.membersCount || 1, planMinCount));
    }
  }, [isOpen, organization, planMinCount]);

  useEffect(() => {
    setMemberCount(Math.max(organization?.membersCount || 1, planMinCount));
  }, [organization, planMinCount]);

  const totalPrice = (memberCount * selectedPlan.price) / 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Team Subscription
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Plan Details */}
          <div className="bg-[#2c9692]/5 rounded-lg p-6 border border-[#2c9692]/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedPlan.name} Plan
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedPlan.name === "Small"
                    ? "1-5 users"
                    : selectedPlan.name === "Medium"
                      ? "6-20 users"
                      : "20+ users"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#2c9692]">
                  £{selectedPlan.price / 100}
                </p>
                <p className="text-sm text-gray-600">
                  per user / {selectedPlan.interval}
                </p>
              </div>
            </div>
          </div>

          {/* Member Count Selector */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#2c9692]" />
                <span className="font-medium text-gray-900">Team Members</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMemberCount(Math.max(initialMemberCount, memberCount - 1))}
                  disabled={memberCount <= initialMemberCount}
                >
                  <MinusCircle className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-semibold">{memberCount}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (memberCount < planMaxCount) {
                      setMemberCount(memberCount + 1);
                    }
                  }}
                  disabled={memberCount >= planMaxCount}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Total Calculation */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">
                {selectedPlan.interval.charAt(0).toUpperCase() +
                  selectedPlan.interval.slice(1)}ly Total
              </span>
              <span className="font-semibold">£{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                £{selectedPlan.price / 100} × {memberCount} users
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-[#2c9692] text-white hover:bg-[#238783]"
              onClick={() => onConfirm(selectedPlan.price_id, memberCount)}
            >
              Confirm Subscription
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}