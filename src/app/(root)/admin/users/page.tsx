import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import RoleSelector from '@/components/RoleSelector';

export default async function UsersPage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/sign-in");
  }

  // Redirect if not admin
  if (user.publicMetadata?.role !== 'admin') {
    redirect("/");
  }

  const response = await fetch(
    'https://api.clerk.com/v1/users?limit=100',
    {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    }
  );
  const { users } = await response.json();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users Management</h1>
      <div className="grid gap-4">
        {users?.map((user: any) => (
          <div key={user.id} className="bg-white p-4 rounded-lg shadow-sm">
            <p>Name: {user.firstName} {user.lastName}</p>
            <p>Email: {user.emailAddresses[0]?.emailAddress}</p>
            <p>Created: {new Date(user.createdAt).toLocaleDateString()}</p>
            <p>Last Sign in: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : 'Never'}</p>
            <p>Status: {user.banned ? 'Banned' : (user.locked ? 'Locked' : 'Active')}</p>
            <div className="mt-2">
              <RoleSelector
                userId={user.id}
                currentRole={user.publicMetadata?.role as 'admin' | 'educator' || 'educator'}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}