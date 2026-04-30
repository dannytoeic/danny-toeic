import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type TimetableRow = {
  time?: string;
  class600MonWed?: string;
  class600TueThu?: string;
  class800MonWed?: string;
  class800TueThu?: string;
};

type IncomingMonthlyTimetableItem = {
  yearMonth?: string;
  title?: string;
  rows?: TimetableRow[];
  memo?: string;
};

type MonthlyTimetableRow = {
  year_month: string;
  title: string | null;
  rows: TimetableRow[] | null;
  memo: string | null;
  is_current: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeRows(value: unknown): TimetableRow[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};

    return {
      time: String(row.time ?? ''),
      class600MonWed: String(row.class600MonWed ?? ''),
      class600TueThu: String(row.class600TueThu ?? ''),
      class800MonWed: String(row.class800MonWed ?? ''),
      class800TueThu: String(row.class800TueThu ?? ''),
    };
  });
}

function mapRowToItem(row: MonthlyTimetableRow) {
  return {
    yearMonth: row.year_month,
    title: row.title || '',
    rows: normalizeRows(row.rows),
    memo: row.memo || '',
    isCurrent: row.is_current,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item: IncomingMonthlyTimetableItem = body?.item ?? body ?? {};

    const yearMonth = String(item.yearMonth ?? '').trim();

    if (!yearMonth) {
      return NextResponse.json(
        { success: false, message: '시간표 저장에 필요한 연월 정보가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const rowToSave = {
      year_month: yearMonth,
      title: String(item.title ?? '').trim(),
      rows: normalizeRows(item.rows),
      memo: String(item.memo ?? '').trim(),
      is_current: true,
    };

    const { error: resetError } = await supabaseAdmin
      .from('monthly_timetable')
      .update({ is_current: false })
      .neq('year_month', yearMonth);

    if (resetError) {
      console.error('save-monthly-timetable resetError:', resetError);

      return NextResponse.json(
        { success: false, message: '월간 시간표 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from('monthly_timetable')
      .upsert(rowToSave, { onConflict: 'year_month' });

    if (upsertError) {
      console.error('save-monthly-timetable upsertError:', upsertError);

      return NextResponse.json(
        { success: false, message: '월간 시간표 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { data, error: selectError } = await supabaseAdmin
      .from('monthly_timetable')
      .select('year_month, title, rows, memo, is_current, created_at, updated_at')
      .eq('year_month', yearMonth)
      .maybeSingle();

    if (selectError || !data) {
      console.error('save-monthly-timetable selectError:', selectError);

      return NextResponse.json({
        success: true,
        message: '월간 시간표가 저장되었습니다.',
      });
    }

    return NextResponse.json({
      success: true,
      message: '월간 시간표가 저장되었습니다.',
      item: mapRowToItem(data as MonthlyTimetableRow),
    });
  } catch (error) {
    console.error('save-monthly-timetable catch error:', error);

    return NextResponse.json(
      { success: false, message: '월간 시간표 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}