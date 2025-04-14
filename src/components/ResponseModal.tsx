import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ResponseModalProps {
    title: string;
    content: string | null;
}

const ResponseModal: React.FC<ResponseModalProps> = ({ title, content }) => {
    const [open, setOpen] = useState<boolean>(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="hover:bg-black hover:text-white">
                    View
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>{title || "Null"}</DialogTitle>
                <div className="p-4 bg-gray-100 rounded-md max-h-[400px] overflow-y-auto">
                    <pre>{content || "Null"}</pre>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ResponseModal;