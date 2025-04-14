import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrganizationProfile } from "@/components/organization/organization-profile";
import { OrganizationMembers } from "@/components/organization/organization-members";
import { Button } from "@/components/ui/button";

export default async function OrganizationPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgId) {
    redirect("/select-org");
  }

  try {
    const clerk = await clerkClient();
    const [organization, memberList] = await Promise.all([
      clerk.organizations.getOrganization({ organizationId: orgId }),
      clerk.organizations.getOrganizationMembershipList({ organizationId: orgId })
    ]);

    if (!organization) {
      notFound();
    }

    return (
      <div className='max-w-6xl mx-auto p-6'>
        {/* Header */}
        <div className='flex items-center justify-between mb-8'>
          <div className='flex items-center gap-4'>
            <img
              src={organization.imageUrl || "/placeholder.png"}
              alt={organization.name}
              className='h-16 w-16 rounded-lg'
            />
            <div>
              <h1 className='text-2xl font-bold'>{organization.name}</h1>
              <p className='text-sm text-muted-foreground'>
                {memberList.data.length} members
              </p>
            </div>
          </div>
          <Button variant='outline'>Actions</Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue='profile' className='space-y-6'>
          <TabsList>
            <TabsTrigger value='profile'>Profile</TabsTrigger>
            <TabsTrigger value='members'>Members</TabsTrigger>
          </TabsList>

          <TabsContent value='profile'>
            <OrganizationProfile />
          </TabsContent>

          <TabsContent value='members'>
            <OrganizationMembers />
          </TabsContent>
        </Tabs>
      </div>
    );
  } catch (error) {
    console.error("Error fetching organization:", error);
    notFound();
  }
}