import { useState } from 'react';
import { Check } from 'lucide-react';
import { useOrganization } from '@clerk/nextjs';
import { SubscriptionModal } from '@/components/subscription-modal';

function PricingCard({
    name,
    price,
    interval,
    features,
    priceId,
    onSubscribe,
    isAdmin,
}: {
    name: string;
    price: number;
    interval: string;
    features: string[];
    priceId: string;
    onSubscribe: (priceId: string, memberCount: number) => void;
    isAdmin?: boolean;
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { organization } = useOrganization();
    const orgCount = organization?.membersCount || 0;

    // Determine if this plan should be disabled and what tooltip message to show.
    let disabled = false;
    let tooltipMessage = "";
    if (isAdmin) {
        if (orgCount > 20 && (name === "Small" || name === "Medium")) {
            disabled = true;
            tooltipMessage =
                "This plan is not available as your organisation has more than 20 members. Please choose the Large plan.";
        } else if (orgCount > 5 && name === "Small") {
            disabled = true;
            tooltipMessage =
                "This plan is not available as your organisation has more than 5 members. Please choose a higher tier.";
        }
    }

    const handleGetStarted = () => {
        if (disabled) return;
        if (isAdmin) {
            setIsModalOpen(true);
        } else {
            onSubscribe(priceId, 1);
        }
    };

    // Optionally display a user count range for team plans.
    let users = "";
    if (name === "Small") {
        users = "1-5";
    } else if (name === "Medium") {
        users = "6-20";
    } else if (name === "Large") {
        users = "20+";
    }

    return (
        <>
            <div className="group relative rounded-2xl transition-all duration-300">
                {/* Card Content */}
                <div className="h-full bg-white border-2 border-gray-100 rounded-2xl p-8 transition-all duration-300 ease-in-out hover:border-[#2c9692]/30 hover:shadow-[0_0_40px_8px_rgba(44,150,146,0.1)]">
                    {/* Popular Plan Marker (for Medium plan) */}
                    {name === "Medium" && (
                        <div className="absolute -top-4 left-0 right-0 mx-auto w-fit px-4 py-1 bg-[#2c9692] text-white text-sm font-medium rounded-full">
                            Popular Choice
                        </div>
                    )}

                    {/* Plan Name and Price */}
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
                        {users && (
                            <div className="inline-block px-3 py-1 bg-[#2c9692]/10 text-[#2c9692] text-sm rounded-full mb-4">
                                {users} Users
                            </div>
                        )}
                        <div className="flex items-baseline">
                            <span className="text-4xl font-bold text-gray-900">£{price / 100}</span>
                            <span className="text-gray-600 ml-2">
                                per {isAdmin && 'user /'} {interval}
                            </span>
                        </div>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-4 mb-8 flex-grow">
                        {features.map((feature, index) => (
                            <li key={index} className="flex items-start">
                                <div className="rounded-full p-1 bg-[#2c9692]/10 mr-3">
                                    <Check className="h-4 w-4 text-[#2c9692]" />
                                </div>
                                <span className="text-gray-600">{feature}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Subscribe Button with conditional disabling and tooltip */}
                    <button
                        onClick={handleGetStarted}
                        disabled={disabled}
                        title={disabled ? tooltipMessage : ""}
                        className={`w-full px-6 py-3 text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2c9692] focus:ring-offset-2 ${disabled
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-[#2c9692] hover:bg-[#238783] hover:shadow-lg hover:shadow-[#2c9692]/20"
                            }`}
                    >
                        Get Started
                    </button>
                </div>
            </div>

            {/* Modal is only rendered for admins */}
            {isAdmin && (
                <SubscriptionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    selectedPlan={{
                        name,
                        price,
                        interval,
                        price_id: priceId,
                    }}
                    onConfirm={onSubscribe}
                />
            )}
        </>
    );
}

export default PricingCard;