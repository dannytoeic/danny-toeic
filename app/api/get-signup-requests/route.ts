import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type SignupRequestRow = {
  request_id: string | null;
  username: string;
  password: string;
  name: string;
  contact: string | null;
  class_key: string | null;
  class_keys: string[] | null;
  status: string;
  created_at: string | null;
};

function normalizeClassKeys(row: {
  class_key?: string | null;
  class_keys?: string[] | null;
}): string[] {
  if (Array.isArray(row.class_keys) && row.class_keys.length > 0) {
    return row.class_keys.filter(Boolean);
  }

  if (row.class_key) {
    return [row.class_key];
  }

  return [];
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('signup_requests')
      .select(
        'request_id, username, password, name, contact, class_key, class_keys, status, created_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('get-signup-requests GET error:', error);

      return NextResponse.json(
        {
          success: false,
          message: '회원가입 신청 목록을 불러오지 못했습니다.',
          items: [],
        },
        { status: 500 }
      );
    }

    const items = Array.isArray(data)
      ? (data as SignupRequestRow[]).map((row) => {
          const classKeys = normalizeClassKeys(row);

          return {
            requestId: row.request_id || '',
            username: row.username,
            password: row.password,
            name: row.name,
            contact: row.contact || '',
            classKey: row.class_key || classKeys[0] || '',
            classKeys,
            status: row.status,
            createdAt: row.created_at || '',
          };
        })
      : [];

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('get-signup-requests GET catch error:', error);

    return NextResponse.json(
      {
        success: false,
        message: '회원가입 신청 목록을 불러오지 못했습니다.',
        items: [],
      },
      { status: 500 }
    );
  }
}