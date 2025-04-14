"use client";

import {
  UserButton,
  SignedIn,
  SignedOut,
  OrganizationSwitcher,
  useUser,
  useAuth,
} from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Ticket, Sparkles, Crown } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/route";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useEffect, useState } from "react";
import { usePremium } from "@/context/PremiumContext"; // Import the hook

export default function Navbar() {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  const { premium, loading } = usePremium(); // Get premium status from context
  const { orgRole } = useAuth();

  // Filter routes based on user role
  const filteredRoutes = routes.filter((route) => {
    const isAdmin = user?.publicMetadata?.role === "admin";
    const isOrgAdmin = orgRole === "org:admin";
    if (isAdmin) {
      return !route.hideFromAdmin;
    }
    if (!isOrgAdmin) return !route.isOrgAdmin;
    return !route.adminOnly;
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || loading) return null; // Wait until premium status is loaded

  // SubscribeButton component
  const SubscribeButton = ({ mobile = false }: { mobile?: boolean; }) => {
    if (premium) return null;
    return (
      <Link
        href="/pricing"
        onClick={mobile ? () => setIsOpen(false) : undefined}
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden rounded-md",
          "group transition-all duration-300",
          "before:absolute before:w-[200%] before:h-[200%] before:-left-[50%] before:-top-[50%] before:animate-[spin_4s_linear_infinite]",
          "before:bg-[conic-gradient(from_0deg,#ffffff40,#ffffff90,#ffffffdd,#ffffff40)]",
          mobile ? "mx-4 my-3" : ""
        )}
      >
        <div className="absolute inset-[2px] rounded-md bg-[#64c5b7] z-[1]" />
        <div className="relative px-9 py-5 flex items-center text-sm font-medium z-[2] w-[165px]">
          <span className="absolute left-0 block w-full h-0 transition-all bg-white opacity-100 group-hover:h-full top-1/2 group-hover:top-0 duration-300 ease-out -z-[1]" />
          <div className="flex items-center w-full relative">
            <span className="transition-all duration-300 absolute left-0 group-hover:opacity-0 group-hover:-translate-x-4">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="transition-all duration-300 absolute left-7 group-hover:left-0 group-hover:text-[#2c9692]">
              Subscribe
            </span>
            <span className="absolute right-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
              <svg
                className="w-4 h-4 text-[#2c9692] ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </span>
          </div>
        </div>
      </Link>
    );
  };

  // OrgSwitcher component
  const OrgSwitcher = () => {
    const isAdmin = user?.publicMetadata?.role === "admin";
    if (isAdmin) return null;
    return (
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl="/organization/:id"
        afterLeaveOrganizationUrl="/select-org"
        afterSelectOrganizationUrl="/organization/:id"
        appearance={{
          elements: {
            rootBox: "flex items-center",
            organizationSwitcherTrigger:
              "text-white hover:bg-white/10 rounded-md px-3 py-2",
          },
        }}
      />
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 border-b bg-[#64c5b7] text-white z-50">
      <div className="mx-auto w-full max-w-[1300px] px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/tools" className="flex-shrink-0">
            <Image
              src="/logo1.svg"
              alt="Logo"
              width={80}
              height={80}
              priority={true}
              className="rounded-sm"
            />
          </Link>
          <SignedIn>
            <div className="hidden lg:flex items-center justify-center flex-1 mx-8">
              {filteredRoutes.map((route) => {
                const Icon = route.icon;
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-white/10",
                      pathname === route.href && "bg-white/20"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{route.title}</span>
                  </Link>
                );
              })}
            </div>
          </SignedIn>
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link
                href="/sign-in"
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-[#2c9692] hover:bg-white/90 transition-colors"
              >
                Sign in
              </Link>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-4">
                <div className="hidden lg:flex items-center gap-4">
                  <Link
                    href="/tickets"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-white/10"
                  >
                    <Ticket className="h-4 w-4" />
                    <span>Tickets</span>
                  </Link>
                  <SubscribeButton />
                  <OrgSwitcher />
                </div>
                <div className="relative">
                  <UserButton
                    afterSignOutUrl="/sign-in"
                    appearance={{
                      elements: {
                        avatarBox: "h-8 w-8",
                      },
                    }}
                  />
                  {premium && (
                    <span className="absolute -top-2 -right-2 rounded-full bg-yellow-400 p-1">
                      <Crown className="h-3 w-3 text-white" />
                    </span>
                  )}
                </div>
              </div>
            </SignedIn>
            <SignedIn>
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[300px] bg-[#2c9692] text-white border-r-0">
                  <SheetHeader className="p-4 border-b border-white/10">
                    <VisuallyHidden>
                      <SheetTitle>Navigation</SheetTitle>
                      <SheetDescription>Access all sections of the application</SheetDescription>
                    </VisuallyHidden>
                    <div className="flex justify-center">
                      <Image
                        src="/logo1.svg"
                        alt="Logo"
                        width={80}
                        height={80}
                        priority={true}
                        className="rounded-sm"
                      />
                    </div>
                  </SheetHeader>
                  <div className="flex flex-col py-2">
                    <SubscribeButton mobile />
                    <Link
                      href="/tickets"
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/10",
                        pathname === "/tickets" && "bg-white/20"
                      )}
                    >
                      <Ticket className="h-4 w-4" />
                      <span>Tickets</span>
                    </Link>
                    {filteredRoutes.map((route) => {
                      const Icon = route.icon;
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/10",
                            pathname === route.href && "bg-white/20"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{route.title}</span>
                        </Link>
                      );
                    })}
                    <div className="px-4 py-2">
                      <OrgSwitcher />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
