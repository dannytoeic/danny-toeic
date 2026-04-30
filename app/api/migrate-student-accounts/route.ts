import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type StudentAccountItem = {
  studentId?: string;
  id?: string;
  username?: string;
  name?: string;
  password?: string;
  contact?: string;
  classKey?: string;
  classKeys?: string[];
  monthKey?: string;
  expiresAt?: string;
  isActive?: boolean;
  createdAt?: string;
};

type ExistingStudentRow = {
  student_id: string | null;
  username: string;
};

type NormalizedStudentRow = {
  student_id: string;
  username: string;
  password: string;
  name: string;
  contact: string;
  class_key: string;
  class_keys: string[];
  month_key: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

function normalizeClassKeys(item: StudentAccountItem): string[] {
  if (Array.isArray(item.classKeys) && item.classKeys.length > 0) {
    return item.classKeys.filter(Boolean);
  }

  if (item.classKey) {
    return [item.classKey];
  }

  return [];
}

function makeStudentId(index: number) {
  return `stu${String(index).padStart(3, '0')}`;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'storage', 'student-accounts.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    const items: StudentAccountItem[] = Array.isArray(parsed) ? parsed : [];

    if (items.length === 0) {
      return NextResponse.json({
        success: false,
        message: '옮길 학생 계정 데이터가 없습니다.',
      });
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('student_accounts')
      .select('student_id, username');

    if (existingError) {
      console.error('migrate-student-accounts existing select error:', existingError);

      return NextResponse.json(
        { success: false, message: '학생 계정 이관 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const existing = Array.isArray(existingRows)
      ? (existingRows as ExistingStudentRow[])
      : [];

    const usernameToStudentId = new Map<string, string>();
    const usedStudentIds = new Set<string>();

    for (const row of existing) {
      if (row.username && row.student_id) {
        usernameToStudentId.set(row.username, row.student_id);
      }
      if (row.student_id) {
        usedStudentIds.add(row.student_id);
      }
    }

    let nextStudentNumber = 1;

    function getNextAvailableStudentId() {
      while (usedStudentIds.has(makeStudentId(nextStudentNumber))) {
        nextStudentNumber += 1;
      }

      const newId = makeStudentId(nextStudentNumber);
      usedStudentIds.add(newId);
      nextStudentNumber += 1;
      return newId;
    }

    const rows: NormalizedStudentRow[] = [];

    for (const item of items) {
      const classKeys = normalizeClassKeys(item);
      const username = String(item.username ?? item.id ?? '').trim();

      if (!username) {
        continue;
      }

      let studentId = '';

      const existingStudentIdForUsername = usernameToStudentId.get(username);

      if (existingStudentIdForUsername) {
        studentId = existingStudentIdForUsername;
      } else {
        const requestedStudentId = String(item.studentId ?? '').trim();

        if (requestedStudentId && !usedStudentIds.has(requestedStudentId)) {
          studentId = requestedStudentId;
          usedStudentIds.add(requestedStudentId);
        } else {
          studentId = getNextAvailableStudentId();
        }
      }

      rows.push({
        student_id: studentId,
        username,
        password: String(item.password ?? '').trim(),
        name: String(item.name ?? '').trim(),
        contact: String(item.contact ?? '').trim(),
        class_key: classKeys[0] || '',
        class_keys: classKeys,
        month_key: String(item.monthKey ?? '').trim(),
        expires_at: String(item.expiresAt ?? '').trim() || null,
        is_active: Boolean(item.isActive),
        created_at: String(item.createdAt ?? '').trim() || new Date().toISOString(),
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: '옮길 학생 계정 데이터가 없습니다.',
      });
    }

    const { error } = await supabaseAdmin
      .from('student_accounts')
      .upsert(rows, { onConflict: 'username' });

    if (error) {
      console.error('migrate-student-accounts upsert error:', error);

      return NextResponse.json(
        { success: false, message: '학생 계정 이관 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${rows.length}개의 학생 계정을 Supabase로 옮겼습니다.`,
      count: rows.length,
    });
  } catch (error) {
    console.error('migrate-student-accounts error:', error);

    return NextResponse.json(
      { success: false, message: '학생 계정 이관 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}