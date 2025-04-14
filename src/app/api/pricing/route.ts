import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { userId, orgId, orgRole } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const clerk = await clerkClient();

    try {
        const user = await clerk.users.getUser(userId);
        const emailAddress = user.emailAddresses[0].emailAddress;

        const isAdmin = orgRole === "org:admin";

        return NextResponse.json({ isAdmin, emailAddress, orgId, userId });
    } catch (error) {
        console.error("Error checking admin status:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}