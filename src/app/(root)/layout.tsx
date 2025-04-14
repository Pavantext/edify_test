import Navbar from "@/components/Navbar";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Organization } from "@clerk/nextjs/server";

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full">
      {/* <header className="h-16 border-b bg-white flex items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-x-4">
            <OrganizationSwitcher 
              hidePersonal
              afterCreateOrganizationUrl="/organization/:id"
              afterLeaveOrganizationUrl="/select-org"
              afterSelectOrganizationUrl="/organization/:id"
              appearance={{
                elements: {
                  rootBox: {
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  },
                },
              }}
            />
          </div>
          <UserButton 
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: {
                  height: 40,
                  width: 40,
                },
              },
            }}
          />
        </div>
      </header> */}
      <Navbar />
      <main className="h-[calc(100%-4rem)]">
        {children}
      </main>
    </div>
  );
}