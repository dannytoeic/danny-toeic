import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { isClassKey } from '../../../lib/operating-month';

const NOTICE_KEY = 'student_month_permissions';
type Permission = { username: string; classKeys: string[] };
type JsonRow = Record<string, unknown>;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const yearMonth = body?.yearMonth;
    if (typeof yearMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth) ||
        !Array.isArray(body.permissions) || body.permissions.length === 0 ||
        body.permissions.length > 500) {
      return NextResponse.json({ success: false, message: '저장할 월과 학생 권한을 확인해 주세요.' }, { status: 400 });
    }
    const permissions: Permission[] = [];
    const seen = new Set<string>();
    for (const item of body.permissions) {
      const username = typeof item?.username === 'string' ? item.username.trim() : '';
      if (!username || seen.has(username) || !Array.isArray(item.classKeys) || !item.classKeys.every(isClassKey)) {
        return NextResponse.json({ success: false, message: '학생 아이디 또는 반 권한이 올바르지 않습니다.' }, { status: 400 });
      }
      seen.add(username);
      permissions.push({ username, classKeys: [...new Set<string>(item.classKeys)] });
    }

    // 이 경로는 현재 Production의 JSON 저장소 전용입니다. 다른 저장소가 생기면
    // 로그인 조회 우선순위와 어긋나지 않도록 쓰기 전에 중단합니다.
    const probe = await supabaseAdmin.from('student_month_permissions').select('username').limit(1);
    if (!probe.error || !['PGRST205', '42P01'].includes(probe.error.code)) {
      return NextResponse.json({ success: false, message: '월별 권한 저장 구조를 확인해야 합니다. 저장하지 않았습니다.' }, { status: 409 });
    }
    const accounts = await supabaseAdmin.from('student_accounts')
      .select('username, student_id').in('username', permissions.map((item) => item.username));
    if (accounts.error) throw accounts.error;
    const owners = new Map((accounts.data ?? []).map((row) => [String(row.username), row.student_id]));
    if (permissions.some((item) => !owners.has(item.username))) {
      return NextResponse.json({ success: false, message: '학생 계정이 변경되었습니다. 목록을 다시 불러와 주세요.' }, { status: 409 });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await supabaseAdmin.from('site_notices')
        .select('content_text, updated_at').eq('notice_key', NOTICE_KEY).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data || typeof existing.data.content_text !== 'string' ||
          typeof existing.data.updated_at !== 'string' || !Number.isFinite(Date.parse(existing.data.updated_at))) {
        return NextResponse.json({ success: false, message: '기존 권한 원본이 없습니다. 저장하지 않았습니다.' }, { status: 409 });
      }
      let document: JsonRow;
      try {
        document = JSON.parse(existing.data.content_text);
        if (!document || Array.isArray(document) || !Array.isArray(document.rows) ||
            document.rows.some((row: unknown) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error();
      } catch {
        return NextResponse.json({ success: false, message: '기존 권한 JSON 형식을 확인해야 합니다. 저장하지 않았습니다.' }, { status: 409 });
      }
      // 다른 월과 요청하지 않은 학생의 레코드/추가 필드를 그대로 보존합니다.
      const rows = [...document.rows as JsonRow[]];
      for (const item of permissions) {
        const matches = rows.flatMap((row, index) =>
          String(row.username ?? '').trim() === item.username &&
          String(row.year_month ?? row.yearMonth ?? '').trim() === yearMonth ? [index] : []);
        if (matches.length > 1) {
          return NextResponse.json({ success: false, message: '중복된 월별 권한이 있습니다. 저장하지 않았습니다.' }, { status: 409 });
        }
        const replacement = {
          ...(matches.length ? rows[matches[0]] : {}),
          student_id: owners.get(item.username) || null,
          username: item.username, year_month: yearMonth, class_keys: item.classKeys,
        };
        if (matches.length) rows[matches[0]] = replacement;
        else rows.push(replacement);
      }
      // 단일 JSON이 크므로 본문 전체를 URL 필터로 보내지 않습니다.
      // 모든 기존 저장 경로가 갱신하는 updated_at을 조건으로 사용합니다.
      const updatedAt = new Date(Math.max(Date.now(), Date.parse(existing.data.updated_at) + 1)).toISOString();
      const content = JSON.stringify({ ...document, rows, updatedAt });
      // 원본이 읽은 뒤 바뀌었으면 0행 갱신 → 최신 JSON을 다시 읽어 병합합니다.
      const saved = await supabaseAdmin.from('site_notices')
        .update({ content_text: content, updated_at: updatedAt })
        .eq('notice_key', NOTICE_KEY).eq('updated_at', existing.data.updated_at)
        .select('notice_key');
      if (saved.error) throw saved.error;
      if (saved.data?.length === 1) {
        return NextResponse.json({ success: true, yearMonth, permissions });
      }
    }
    return NextResponse.json({ success: false, message: '다른 관리자의 변경과 충돌했습니다. 다시 저장해 주세요.' }, { status: 409 });
  } catch (error) {
    console.error('save-student-month-permissions error:', error);
    return NextResponse.json({ success: false, message: '월별 권한 저장에 실패했습니다.' }, { status: 500 });
  }
}
