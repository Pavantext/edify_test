import { createServiceClient } from '@/utils/supabase/service';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('organizations')
      .select('name')
      .ilike('name', name)
      .maybeSingle();

    if (error) {
      console.error('Error checking organization name:', error);
      return NextResponse.json(
        { error: 'Failed to check organization name' },
        { status: 500 }
      );
    }

    return NextResponse.json({ exists: !!data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 