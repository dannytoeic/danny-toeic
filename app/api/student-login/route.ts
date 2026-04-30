import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type StudentAccountRow = {
  student_id: string | null;
  username: string;
  password: string;
  name: string;
  contact: string | null;
  class_key: string | null;
  class_keys: string[] | null;
  month_key: string | null;
  expires_at: string | null;
  is_active: boolean;
};

function normalizeClassKeys(row: StudentAccountRow): string[] {
  if (Array.isArray(row.class_keys) && row.class_keys.length > 0) {
    return row.class_keys.filter(Boolean);
  }

  if (row.class_key) {
    return [row.class_key];
  }

  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '').trim();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: '아이디와 비밀번호를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, password, name, contact, class_key, class_keys, month_key, expires_at, is_active'
      )
      .eq('username', username)
      .maybeSingle();

    if (error) {
      console.error('student-login select error:', error);

      return NextResponse.json(
        { success: false, message: '학생 로그인 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const row = data as StudentAccountRow;

    if (row.password !== password) {
      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    if (!row.is_active) {
      return NextResponse.json(
        { success: false, message: '비활성화된 계정입니다.' },
        { status: 403 }
      );
    }

    const classKeys = normalizeClassKeys(row);

    return NextResponse.json({
      success: true,
      student: {
        id: row.username,
        name: row.name,
        username: row.username,
        classKey: row.class_key || classKeys[0] || '',
        classKeys,
        monthKey: row.month_key || '',
        expiresAt: row.expires_at || '',
        isActive: row.is_active,
      },
    });
  } catch (error) {
    console.error('student-login error:', error);

    return NextResponse.json(
      { success: false, message: '학생 로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}