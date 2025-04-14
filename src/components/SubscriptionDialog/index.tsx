"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SubscriptionDialog = () => {
    return (
        <Dialog open>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Subscription Required</DialogTitle>
                    <DialogDescription>
                        You have reached your free prompt limit. Please subscribe to continue using our tools.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        onClick={() => (window.location.href = "/pricing")}
                        className="bg-[#2c9692] border-none hover:bg-[#238783] hover:shadow-lg hover:shadow-[#2c9692]/20"
                    >
                        Subscribe Now
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SubscriptionDialog;
