import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title = String(body.title ?? '').trim();
    const contentText = String(body.contentText ?? '').trim();

    if (!title) {
      return NextResponse.json(
        { success: false, message: '공지 제목이 비어 있습니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from('site_notices').upsert(
      {
        notice_key: 'latest',
        title,
        content_text: contentText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'notice_key' }
    );

    if (error) {
      console.error('save-notice error:', error);
      return NextResponse.json(
        { success: false, message: '저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '공지사항이 저장되었습니다.',
    });
  } catch (error) {
    console.error('save-notice catch error:', error);

    return NextResponse.json(
      { success: false, message: '저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}