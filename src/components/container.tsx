import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className="mx-auto w-full max-w-[1300px] px-4">
      {children}
    </div>
  );
} 