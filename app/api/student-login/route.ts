import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { OPERATING_YEAR_MONTH } from '../../../lib/operating-month';

type StudentAccountRow = {
  student_id: string | null;
  username: string;
  password: string;
  name: string;
  contact: string | null;
  class_key: string | null;
  class_keys: string[] | null;
  class_keys_by_month?: Record<string, string[]> | null;
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

function normalizeClassKeysByMonth(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>(
    (acc, [month, classKeys]) => {
      const yearMonth = String(month ?? '').trim();
      const keys = Array.isArray(classKeys)
        ? classKeys.map((item) => String(item).trim()).filter(Boolean)
        : [];

      if (yearMonth && keys.length > 0) {
        acc[yearMonth] = Array.from(new Set(keys));
      }

      return acc;
    },
    {}
  );
}

function resolveOperatingClassKeys(row: StudentAccountRow) {
  const classKeysByMonth = normalizeClassKeysByMonth(row.class_keys_by_month);
  const monthlyClassKeys = classKeysByMonth[OPERATING_YEAR_MONTH] ?? [];

  if (monthlyClassKeys.length > 0) {
    return { classKeys: monthlyClassKeys, classKeysByMonth };
  }

  const legacyClassKeys = normalizeClassKeys(row);
  if (row.month_key === OPERATING_YEAR_MONTH && legacyClassKeys.length > 0) {
    return {
      classKeys: legacyClassKeys,
      classKeysByMonth: {
        ...classKeysByMonth,
        [OPERATING_YEAR_MONTH]: legacyClassKeys,
      },
    };
  }

  return { classKeys: [], classKeysByMonth };
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

    let { data, error } = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, password, name, contact, class_key, class_keys, class_keys_by_month, month_key, expires_at, is_active'
      )
      .eq('username', username)
      .maybeSingle();

    if (error?.code === '42703' || String(error?.message ?? '').includes('class_keys_by_month')) {
      const legacyResult = await supabaseAdmin
        .from('student_accounts')
        .select(
          'student_id, username, password, name, contact, class_key, class_keys, month_key, expires_at, is_active'
        )
        .eq('username', username)
        .maybeSingle();

      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }

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

    const { classKeys, classKeysByMonth } = resolveOperatingClassKeys(row);

    return NextResponse.json({
      success: true,
      student: {
        id: row.username,
        name: row.name,
        username: row.username,
        classKey: row.class_key || classKeys[0] || '',
        classKeys,
        classKeysByMonth,
        monthKey: OPERATING_YEAR_MONTH,
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
