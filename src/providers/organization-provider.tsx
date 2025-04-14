"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

export function OrganizationContextProvider({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OrganizationSwitcher />
      {children}
    </>
  );
}