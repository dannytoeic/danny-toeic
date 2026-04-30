import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestId = String(body?.requestId ?? '').trim();

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: 'requestId가 필요합니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('signup_requests')
      .delete()
      .eq('request_id', requestId);

    if (error) {
      console.error('delete-signup-request error:', error);

      return NextResponse.json(
        { success: false, message: '가입신청 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '가입신청이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('delete-signup-request POST catch error:', error);

    return NextResponse.json(
      { success: false, message: '가입신청 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}