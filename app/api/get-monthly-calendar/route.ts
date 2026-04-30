import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type MonthlyCalendarRow = {
  year_month: string;
  year: number;
  month: number;
  mon_wed_dates: number[] | null;
  tue_thu_dates: number[] | null;
  special_dates: Array<{ day: number; label: string }> | null;
  d1_special_dates: Array<{ day: number; label: string }> | null;
  toeic_test_dates: number[] | null;
  memo: string | null;
  is_current: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

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

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('monthly_calendar')
      .select(
        'year_month, year, month, mon_wed_dates, tue_thu_dates, special_dates, d1_special_dates, toeic_test_dates, memo, is_current, created_at, updated_at'
      )
      .eq('is_current', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('get-monthly-calendar current error:', error);

      return NextResponse.json(
        { success: false, message: '월간 캘린더를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    if (data) {
      return NextResponse.json({
        success: true,
        item: mapRowToItem(data as MonthlyCalendarRow),
      });
    }

    const { data: fallbackRows, error: fallbackError } = await supabaseAdmin
      .from('monthly_calendar')
      .select(
        'year_month, year, month, mon_wed_dates, tue_thu_dates, special_dates, d1_special_dates, toeic_test_dates, memo, is_current, created_at, updated_at'
      )
      .order('updated_at', { ascending: false })
      .limit(1);

    if (fallbackError) {
      console.error('get-monthly-calendar fallback error:', fallbackError);

      return NextResponse.json(
        { success: false, message: '월간 캘린더를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(fallbackRows) || fallbackRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: '등록된 월간 캘린더가 없습니다.',
      });
    }

    return NextResponse.json({
      success: true,
      item: mapRowToItem(fallbackRows[0] as MonthlyCalendarRow),
    });
  } catch (error) {
    console.error('get-monthly-calendar catch error:', error);

    return NextResponse.json(
      { success: false, message: '월간 캘린더를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}