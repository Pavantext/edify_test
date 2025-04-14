import { createServiceClient } from "@/utils/supabase/service";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const formData = await request.formData();
    const ticketDataStr = formData.get('data') as string;
    const ticketData = JSON.parse(ticketDataStr);
    const attachments = formData.getAll('attachments') as File[];

    // Validate required fields
    if (!ticketData.user_id || !ticketData.title || !ticketData.description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Handle attachments if present
    const attachmentUrls: string[] = [];
    if (attachments.length > 0) {
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('ticket-attachments')
          .upload(`${ticketData.user_id}/${fileName}`, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase
          .storage
          .from('ticket-attachments')
          .getPublicUrl(`${ticketData.user_id}/${fileName}`);

        attachmentUrls.push(publicUrl);
      }
    }

    // Insert ticket data with attachment URLs
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert([{
        ...ticketData,
        attachments: attachmentUrls.length > 0 ? attachmentUrls : null
      }])
      .select()
      .single();

    if (ticketError) throw ticketError;

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const isSupport = user.publicMetadata?.role === 'support';
    const isAdmin = user.publicMetadata?.role === 'admin';

    const supabase = createServiceClient();

    const query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    // Only filter by user_id if not a support user
    if (!isSupport && !isAdmin) {
      query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}