import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { OPERATING_YEAR_MONTH, isClassKey } from './operating-month';
import { upsertStudentClassAccessRanges, type StudentClassAccessRange } from './student-class-access-ranges';
import type { StudentAccountDraft } from './student-account-save-plan';

// 기존 계정 관리 UI용 명시적 변경 저장. 월별 권한에는 접근하지 않습니다.
export async function saveStudentAccountDetails(body: {
  items?: StudentAccountDraft[];
  deletedUsernames?: string[];
  ranges?: StudentClassAccessRange[];
}) {
  const items = body.items;
  const deleted = body.deletedUsernames;
  const ranges = body.ranges;
  if (!Array.isArray(items) || !Array.isArray(deleted) || !Array.isArray(ranges) ||
      items.some((item) => !item || !String(item.username ?? item.id ?? '').trim() || !item.studentId) ||
      deleted.some((name) => typeof name !== 'string' || !name.trim()) ||
      ranges.some((range) => !range || !range.studentId || !range.yearMonth || !isClassKey(range.classKey))) {
    return NextResponse.json({ success: false, message: '계정 변경 내용을 확인해 주세요.' }, { status: 400 });
  }
  const usernames = items.map((item) => String(item.username ?? item.id).trim());
  if (new Set(usernames).size !== usernames.length || deleted.some((name) => usernames.includes(name))) {
    return NextResponse.json({ success: false, message: '중복된 학생 아이디를 확인해 주세요.' }, { status: 400 });
  }
  if (items.length) {
    const rows = items.map((item) => ({
      student_id: item.studentId.trim(), username: String(item.username ?? item.id).trim(),
      name: item.name.trim(), password: item.password.trim(), contact: item.contact?.trim() ?? '',
      class_key: item.classKey?.trim() ?? '',
      // 월별 체크박스에서 일반 반을 재계산하지 않습니다.
      class_keys: item.classKeys ?? [],
      month_key: item.monthKey.trim() || OPERATING_YEAR_MONTH,
      expires_at: item.expiresAt.trim() || null, is_active: Boolean(item.isActive),
      created_at: item.createdAt || new Date().toISOString(),
    }));
    const result = await supabaseAdmin.from('student_accounts').upsert(rows, { onConflict: 'username' });
    if (result.error) throw result.error;
  }
  // 화면에서 명시적으로 삭제/아이디 변경한 계정만 삭제합니다.
  // 요청 목록에서 빠졌다는 이유로 다른 계정을 삭제하지 않습니다.
  if (deleted.length) {
    const result = await supabaseAdmin.from('student_accounts').delete().in('username', deleted);
    if (result.error) throw result.error;
  }
  if (ranges.length) {
    const result = await upsertStudentClassAccessRanges(ranges);
    if (result.error || !result.available) {
      return NextResponse.json({ success: false, message: '계정 변경 후 접근 범위 저장에 실패했습니다. 다시 저장해 주세요.' }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true });
}
