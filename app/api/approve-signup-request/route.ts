import { NextRequest, NextResponse } from 'next/server';
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

type ExistingStudentRow = {
  student_id: string | null;
  username: string;
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

function makeStudentId(index: number) {
  return `stu${String(index).padStart(3, '0')}`;
}

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

    const { data, error } = await supabaseAdmin
      .from('signup_requests')
      .select(
        'request_id, username, password, name, contact, class_key, class_keys, status, created_at'
      )
      .eq('request_id', requestId)
      .maybeSingle();

    if (error) {
      console.error('approve-signup-request select error:', error);

      return NextResponse.json(
        { success: false, message: '회원가입 신청 승인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: '회원가입 신청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const row = data as SignupRequestRow;
    const classKeys = normalizeClassKeys(row);

    const { data: existingStudents, error: existingStudentsError } = await supabaseAdmin
      .from('student_accounts')
      .select('student_id, username');

    if (existingStudentsError) {
      console.error(
        'approve-signup-request existingStudentsError:',
        existingStudentsError
      );

      return NextResponse.json(
        { success: false, message: '학생 계정 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const students = Array.isArray(existingStudents)
      ? (existingStudents as ExistingStudentRow[])
      : [];

    const usedStudentIds = new Set(
      students
        .map((student) => String(student.student_id ?? '').trim())
        .filter(Boolean)
    );

    const existingStudent = students.find(
      (student) => String(student.username) === row.username
    );

    let studentId = '';

    if (existingStudent?.student_id) {
      studentId = existingStudent.student_id;
    } else {
      let nextNumber = 1;
      while (usedStudentIds.has(makeStudentId(nextNumber))) {
        nextNumber += 1;
      }
      studentId = makeStudentId(nextNumber);
    }

    const { error: upsertStudentError } = await supabaseAdmin
      .from('student_accounts')
      .upsert(
        {
          student_id: studentId,
          username: row.username,
          password: row.password,
          name: row.name,
          contact: row.contact || '',
          class_key: row.class_key || classKeys[0] || '',
          class_keys: classKeys,
          month_key: '',
          expires_at: null,
          is_active: true,
          created_at: row.created_at || new Date().toISOString(),
        },
        { onConflict: 'username' }
      );

    if (upsertStudentError) {
      console.error(
        'approve-signup-request upsertStudentError:',
        upsertStudentError
      );

      return NextResponse.json(
        { success: false, message: '학생 계정 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const { error: updateRequestError } = await supabaseAdmin
      .from('signup_requests')
      .update({ status: 'approved' })
      .eq('request_id', requestId);

    if (updateRequestError) {
      console.error(
        'approve-signup-request updateRequestError:',
        updateRequestError
      );

      return NextResponse.json(
        { success: false, message: '회원가입 신청 상태 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '회원가입 신청이 승인되었습니다.',
    });
  } catch (error) {
    console.error('approve-signup-request POST catch error:', error);

    return NextResponse.json(
      { success: false, message: '회원가입 신청 승인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}