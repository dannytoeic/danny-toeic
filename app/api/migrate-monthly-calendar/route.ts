import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type SpecialDate = {
  day: number;
  label: string;
};

type CalendarItem = {
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

type LegacyCalendarFile = {
  currentKey?: string;
  items?: Record<string, CalendarItem>;
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

function toYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'storage', 'monthly-calendar.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as LegacyCalendarFile;

    const currentKey = String(parsed?.currentKey ?? '').trim();
    const items =
      parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};

    const source =
      (currentKey && items[currentKey]) ||
      Object.values(items)[0] ||
      null;

    if (!source || typeof source !== 'object') {
      return NextResponse.json(
        { success: false, message: '이관할 월간 캘린더 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const year = Number(source.year ?? 0);
    const month = Number(source.month ?? 0);
    const yearMonth = String(source.yearMonth ?? '').trim() || toYearMonth(year, month);

    if (!yearMonth || !Number.isFinite(year) || !Number.isFinite(month) || year <= 0 || month <= 0) {
      return NextResponse.json(
        { success: false, message: '이관할 월간 캘린더 데이터가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { error: resetError } = await supabaseAdmin
      .from('monthly_calendar')
      .update({ is_current: false })
      .neq('year_month', yearMonth);

    if (resetError) {
      console.error('migrate-monthly-calendar resetError:', resetError);

      return NextResponse.json(
        { success: false, message: '월간 캘린더 이관 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from('monthly_calendar')
      .upsert(
        {
          year_month: yearMonth,
          year,
          month,
          mon_wed_dates: normalizeNumberArray(source.monWedDates),
          tue_thu_dates: normalizeNumberArray(source.tueThuDates),
          special_dates: normalizeSpecialDates(source.specialDates),
          d1_special_dates: normalizeSpecialDates(source.d1SpecialDates),
          toeic_test_dates: normalizeNumberArray(source.toeicTestDates),
          memo: String(source.memo ?? '').trim(),
          is_current: true,
        },
        { onConflict: 'year_month' }
      );

    if (upsertError) {
      console.error('migrate-monthly-calendar upsertError:', upsertError);

      return NextResponse.json(
        { success: false, message: '월간 캘린더 이관 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${yearMonth} 월간 캘린더를 Supabase로 이관했습니다.`,
    });
  } catch (error) {
    console.error('migrate-monthly-calendar catch error:', error);

    return NextResponse.json(
      { success: false, message: '월간 캘린더 이관 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}