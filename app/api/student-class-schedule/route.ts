import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALENDAR_KEY = 'student_class_calendar';
const TIMETABLE_KEY = 'student_class_timetable';

type SpecialDate = { day: number; label: string };

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))]
    .sort((a, b) => a - b);
}

function specialDates(value: unknown): SpecialDate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const day = Number(row.day);
      const label = String(row.label ?? '').trim();
      return Number.isInteger(day) && day >= 1 && day <= 31 && label ? { day, label } : null;
    })
    .filter((item): item is SpecialDate => item !== null);
}

function normalizeCalendar(value: unknown) {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const year = Number(item.year);
  const month = Number(item.month);
  return {
    yearMonth: String(item.yearMonth ?? '').trim(),
    year: Number.isInteger(year) ? year : 0,
    month: Number.isInteger(month) ? month : 0,
    monWedDates: numberArray(item.monWedDates),
    tueThuDates: numberArray(item.tueThuDates),
    sixHundredOnlyDates: numberArray(item.sixHundredOnlyDates),
    monthlyDennyDates: numberArray(item.monthlyDennyDates),
    specialDates: specialDates(item.specialDates),
    d1SpecialDates: specialDates(item.d1SpecialDates),
    toeicTestDates: numberArray(item.toeicTestDates),
    memo: String(item.memo ?? '').trim(),
  };
}

function normalizeTimetable(value: unknown) {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rows = Array.isArray(item.rows) ? item.rows : [];
  return {
    yearMonth: String(item.yearMonth ?? '').trim(),
    title: String(item.title ?? '').trim(),
    rows: rows.map((value) => {
      const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      return {
        time: String(row.time ?? '').trim(),
        class600MonWed: String(row.class600MonWed ?? '').trim(),
        class600TueThu: String(row.class600TueThu ?? '').trim(),
        class800MonWed: String(row.class800MonWed ?? '').trim(),
        class800TueThu: String(row.class800TueThu ?? '').trim(),
      };
    }),
    memo: String(item.memo ?? '').trim(),
  };
}

function parseJson(value: unknown) {
  try {
    return JSON.parse(String(value ?? '')) as unknown;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_notices')
      .select('notice_key, content_text')
      .in('notice_key', [CALENDAR_KEY, TIMETABLE_KEY]);

    if (error) {
      console.error('student-class-schedule GET error:', error);
      return NextResponse.json(
        { success: false, message: '반별 페이지 일정을 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const calendarRow = rows.find((row) => row.notice_key === CALENDAR_KEY);
    const timetableRow = rows.find((row) => row.notice_key === TIMETABLE_KEY);

    return NextResponse.json({
      success: true,
      calendar: calendarRow ? normalizeCalendar(parseJson(calendarRow.content_text)) : null,
      timetable: timetableRow ? normalizeTimetable(parseJson(timetableRow.content_text)) : null,
    });
  } catch (error) {
    console.error('student-class-schedule GET catch error:', error);
    return NextResponse.json(
      { success: false, message: '반별 페이지 일정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = String(body.type ?? '');
    const now = new Date().toISOString();

    if (type === 'calendar') {
      const calendar = normalizeCalendar(body.item);
      if (!calendar.yearMonth || calendar.year <= 0 || calendar.month < 1 || calendar.month > 12) {
        return NextResponse.json(
          { success: false, message: '캘린더 기준 연월을 확인해 주세요.' },
          { status: 400 }
        );
      }
      const { error } = await supabaseAdmin.from('site_notices').upsert(
        {
          notice_key: CALENDAR_KEY,
          title: '반별 페이지용 월간 캘린더',
          content_text: JSON.stringify(calendar),
          updated_at: now,
        },
        { onConflict: 'notice_key' }
      );
      if (error) throw error;
      return NextResponse.json({ success: true, calendar });
    }

    if (type === 'timetable') {
      const timetable = normalizeTimetable(body.item);
      if (!timetable.yearMonth) {
        return NextResponse.json(
          { success: false, message: '시간표 기준 월을 확인해 주세요.' },
          { status: 400 }
        );
      }
      const { error } = await supabaseAdmin.from('site_notices').upsert(
        {
          notice_key: TIMETABLE_KEY,
          title: '반별 페이지용 시간표',
          content_text: JSON.stringify(timetable),
          updated_at: now,
        },
        { onConflict: 'notice_key' }
      );
      if (error) throw error;
      return NextResponse.json({ success: true, timetable });
    }

    return NextResponse.json(
      { success: false, message: '저장 종류가 올바르지 않습니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('student-class-schedule POST error:', error);
    return NextResponse.json(
      { success: false, message: '반별 페이지 일정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
