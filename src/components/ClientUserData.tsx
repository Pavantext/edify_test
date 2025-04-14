'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import React from 'react';

type UserRole = 'admin' | 'educator' | 'user';

export default function ClientUserData(): React.ReactElement {
  const { isLoaded: isUserLoaded, user } = useUser();
  const { isLoaded: isAuthLoaded, userId, sessionId } = useAuth();
  const userRole = (user?.publicMetadata?.role as UserRole) || 'user';

  if (!isUserLoaded || !isAuthLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Client-Side Data</h2>
      <div className="space-y-2">
        <p>Session ID: {sessionId}</p>
        <p>User ID: {userId}</p>
        <p>Email: {user?.primaryEmailAddress?.emailAddress}</p>
        <p>Full Name: {user?.fullName}</p>
        <p>Created: {user?.createdAt?.toLocaleDateString()}</p>
        <p className="font-semibold">Role: {userRole}</p>
      </div>
    </div>
  );
} 