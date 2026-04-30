import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type IncomingSignupRequestItem = {
  requestId?: string;
  username?: string;
  id?: string;
  password?: string;
  name?: string;
  contact?: string;
  classKey?: string;
  classKeys?: string[];
  status?: string;
  createdAt?: string;
};

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

function normalizeClassKeys(item: {
  classKey?: string | null;
  classKeys?: string[] | null;
}): string[] {
  if (Array.isArray(item.classKeys) && item.classKeys.length > 0) {
    return item.classKeys.filter(Boolean);
  }

  if (item.classKey) {
    return [item.classKey];
  }

  return [];
}

function mapRowToItem(row: SignupRequestRow) {
  const classKeys = normalizeClassKeys({
    classKey: row.class_key,
    classKeys: row.class_keys,
  });

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
      console.error('save-signup-requests GET error:', error);

      return NextResponse.json(
        { success: false, message: '회원가입 신청 목록을 불러오지 못했습니다.', items: [] },
        { status: 500 }
      );
    }

    const items = Array.isArray(data)
      ? (data as SignupRequestRow[]).map(mapRowToItem)
      : [];

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('save-signup-requests GET catch error:', error);

    return NextResponse.json(
      { success: false, message: '회원가입 신청 목록을 불러오지 못했습니다.', items: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const incomingItems: IncomingSignupRequestItem[] = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body)
      ? body
      : body && typeof body === 'object'
      ? [body]
      : [];

    if (incomingItems.length === 0) {
      return NextResponse.json(
        { success: false, message: '저장할 회원가입 신청 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const normalizedRows = incomingItems.reduce<
      Array<{
        request_id: string;
        username: string;
        password: string;
        name: string;
        contact: string;
        class_key: string;
        class_keys: string[];
        status: string;
        created_at: string;
      }>
    >((acc, item, index) => {
      const username = String(item.username ?? item.id ?? '').trim();
      const password = String(item.password ?? '').trim();
      const name = String(item.name ?? '').trim();
      const contact = String(item.contact ?? '').trim();

      const classKeys = normalizeClassKeys({
        classKey: item.classKey,
        classKeys: item.classKeys ?? [],
      });

      if (!username || !password || !name || classKeys.length === 0) {
        return acc;
      }

      const requestId =
        String(item.requestId ?? '').trim() ||
        `req_${Date.now()}_${String(index + 1).padStart(2, '0')}`;

      acc.push({
        request_id: requestId,
        username,
        password,
        name,
        contact,
        class_key: classKeys[0] || '',
        class_keys: classKeys,
        status: String(item.status ?? 'pending').trim() || 'pending',
        created_at: String(item.createdAt ?? '').trim() || new Date().toISOString(),
      });

      return acc;
    }, []);

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { success: false, message: '필수값이 비어 있어 저장할 수 없습니다.' },
        { status: 400 }
      );
    }

    const usernames = normalizedRows.map((row) => row.username);

    const { data: existingRequests, error: existingRequestsError } = await supabaseAdmin
      .from('signup_requests')
      .select('username, status')
      .in('username', usernames);

    if (existingRequestsError) {
      console.error('save-signup-requests existingRequestsError:', existingRequestsError);

      return NextResponse.json(
        { success: false, message: '회원가입 신청 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const blockedUsernames = new Set(
      Array.isArray(existingRequests)
        ? existingRequests
            .filter((row) => row.status === 'pending' || row.status === 'approved')
            .map((row) => String(row.username))
        : []
    );

    const { data: existingStudents, error: existingStudentsError } = await supabaseAdmin
      .from('student_accounts')
      .select('username')
      .in('username', usernames);

    if (existingStudentsError) {
      console.error('save-signup-requests existingStudentsError:', existingStudentsError);

      return NextResponse.json(
        { success: false, message: '회원가입 신청 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const existingStudentUsernames = new Set(
      Array.isArray(existingStudents)
        ? existingStudents.map((row) => String(row.username))
        : []
    );

    const rowsToInsert = normalizedRows.filter(
      (row) =>
        !blockedUsernames.has(row.username) &&
        !existingStudentUsernames.has(row.username)
    );

    if (rowsToInsert.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '이미 대기 중이거나 승인된 신청이 있거나, 이미 등록된 계정입니다.',
        },
        { status: 409 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from('signup_requests')
      .insert(rowsToInsert);

    if (insertError) {
      console.error('save-signup-requests insertError:', insertError);

      return NextResponse.json(
        { success: false, message: '회원가입 신청 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const { data: finalRows, error: finalError } = await supabaseAdmin
      .from('signup_requests')
      .select(
        'request_id, username, password, name, contact, class_key, class_keys, status, created_at'
      )
      .order('created_at', { ascending: false });

    if (finalError) {
      console.error('save-signup-requests finalError:', finalError);

      return NextResponse.json({
        success: true,
        message: `${rowsToInsert.length}개의 회원가입 신청이 저장되었습니다.`,
      });
    }

    const items = Array.isArray(finalRows)
      ? (finalRows as SignupRequestRow[]).map(mapRowToItem)
      : [];

    return NextResponse.json({
      success: true,
      message: `${rowsToInsert.length}개의 회원가입 신청이 저장되었습니다.`,
      items,
    });
  } catch (error) {
    console.error('save-signup-requests POST catch error:', error);

    return NextResponse.json(
      { success: false, message: '회원가입 신청 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}