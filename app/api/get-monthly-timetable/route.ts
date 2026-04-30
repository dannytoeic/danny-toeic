import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type TimetableRow = {
  time: string;
  class600MonWed: string;
  class600TueThu: string;
  class800MonWed: string;
  class800TueThu: string;
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

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('monthly_timetable')
      .select('year_month, title, rows, memo, is_current, created_at, updated_at')
      .eq('is_current', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('get-monthly-timetable current error:', error);

      return NextResponse.json(
        { success: false, message: '월간 시간표를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    if (data) {
      return NextResponse.json({
        success: true,
        item: mapRowToItem(data as MonthlyTimetableRow),
      });
    }

    const { data: fallbackRows, error: fallbackError } = await supabaseAdmin
      .from('monthly_timetable')
      .select('year_month, title, rows, memo, is_current, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (fallbackError) {
      console.error('get-monthly-timetable fallback error:', fallbackError);

      return NextResponse.json(
        { success: false, message: '월간 시간표를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(fallbackRows) || fallbackRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: '등록된 월간 시간표가 없습니다.',
      });
    }

    return NextResponse.json({
      success: true,
      item: mapRowToItem(fallbackRows[0] as MonthlyTimetableRow),
    });
  } catch (error) {
    console.error('get-monthly-timetable catch error:', error);

    return NextResponse.json(
      { success: false, message: '월간 시간표를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}