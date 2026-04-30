import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type SpecialDate = {
  day: number;
  label: string;
};

type IncomingMonthlyCalendarItem = {
  yearMonth?: string;
  year?: number;
  month?: number;
  monWedDates?: number[];
  tueThuDates?: number[];
  specialDates?: SpecialDate[];
  d1SpecialDates?: SpecialDate[];
  toeicTestDates?: number[];
  memo?: string;
};

type MonthlyCalendarRow = {
  year_month: string;
  year: number;
  month: number;
  mon_wed_dates: number[] | null;
  tue_thu_dates: number[] | null;
  special_dates: SpecialDate[] | null;
  d1_special_dates: SpecialDate[] | null;
  toeic_test_dates: number[] | null;
  memo: string | null;
  is_current: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function normalizeSpecialDates(value: unknown): SpecialDate[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const day = Number((item as { day?: unknown }).day);
      const label = String((item as { label?: unknown }).label ?? '').trim();

      if (!Number.isFinite(day) || !label) return null;

      return { day, label };
    })
    .filter((item): item is SpecialDate => item !== null);
}

function mapRowToItem(row: MonthlyCalendarRow) {
  return {
    yearMonth: row.year_month,
    year: row.year,
    month: row.month,
    monWedDates: Array.isArray(row.mon_wed_dates) ? row.mon_wed_dates : [],
    tueThuDates: Array.isArray(row.tue_thu_dates) ? row.tue_thu_dates : [],
    specialDates: Array.isArray(row.special_dates) ? row.special_dates : [],
    d1SpecialDates: Array.isArray(row.d1_special_dates) ? row.d1_special_dates : [],
    toeicTestDates: Array.isArray(row.toeic_test_dates) ? row.toeic_test_dates : [],
    memo: row.memo || '',
    isCurrent: row.is_current,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item: IncomingMonthlyCalendarItem = body?.item ?? body ?? {};

    const yearMonth = String(item.yearMonth ?? '').trim();
    const year = Number(item.year ?? 0);
    const month = Number(item.month ?? 0);

    if (!yearMonth || !Number.isFinite(year) || !Number.isFinite(month) || year <= 0 || month <= 0) {
      return NextResponse.json(
        { success: false, message: '캘린더 저장에 필요한 연월 정보가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const rowToSave = {
      year_month: yearMonth,
      year,
      month,
      mon_wed_dates: normalizeNumberArray(item.monWedDates),
      tue_thu_dates: normalizeNumberArray(item.tueThuDates),
      special_dates: normalizeSpecialDates(item.specialDates),
      d1_special_dates: normalizeSpecialDates(item.d1SpecialDates),
      toeic_test_dates: normalizeNumberArray(item.toeicTestDates),
      memo: String(item.memo ?? '').trim(),
      is_current: true,
    };

    const { error: resetError } = await supabaseAdmin
      .from('monthly_calendar')
      .update({ is_current: false })
      .neq('year_month', yearMonth);

    if (resetError) {
      console.error('save-monthly-calendar resetError:', resetError);

      return NextResponse.json(
        { success: false, message: '월간 캘린더 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from('monthly_calendar')
      .upsert(rowToSave, { onConflict: 'year_month' });

    if (upsertError) {
      console.error('save-monthly-calendar upsertError:', upsertError);

      return NextResponse.json(
        { success: false, message: '월간 캘린더 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { data, error: selectError } = await supabaseAdmin
      .from('monthly_calendar')
      .select(
        'year_month, year, month, mon_wed_dates, tue_thu_dates, special_dates, d1_special_dates, toeic_test_dates, memo, is_current, created_at, updated_at'
      )
      .eq('year_month', yearMonth)
      .maybeSingle();

    if (selectError || !data) {
      console.error('save-monthly-calendar selectError:', selectError);

      return NextResponse.json({
        success: true,
        message: '월간 캘린더가 저장되었습니다.',
      });
    }

    return NextResponse.json({
      success: true,
      message: '월간 캘린더가 저장되었습니다.',
      item: mapRowToItem(data as MonthlyCalendarRow),
    });
  } catch (error) {
    console.error('save-monthly-calendar catch error:', error);

    return NextResponse.json(
      { success: false, message: '월간 캘린더 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}