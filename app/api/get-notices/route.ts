import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NoticeItem = {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_notices')
      .select('notice_key, title, content_text, updated_at')
      .eq('notice_key', 'latest')
      .maybeSingle();

    if (error) {
      console.error('get-notice error:', error);
      return NextResponse.json(
        { success: false, message: '전체공지를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const notices: NoticeItem[] = data
      ? [
          {
            id: String(data.notice_key ?? 'latest'),
            title: String(data.title ?? ''),
            content: String(data.content_text ?? ''),
            createdAt: data.updated_at ? String(data.updated_at) : undefined,
          },
        ]
      : [];

    return NextResponse.json({
      success: true,
      notices,
    });
  } catch (error) {
    console.error('get-notice catch error:', error);

    return NextResponse.json(
      { success: false, message: '전체공지를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}