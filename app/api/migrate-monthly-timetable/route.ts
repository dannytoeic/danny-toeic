import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type TimetableRow = {
  time?: string;
  class600MonWed?: string;
  class600TueThu?: string;
  class800MonWed?: string;
  class800TueThu?: string;
};

type TimetableItem = {
  yearMonth?: string;
  title?: string;
  rows?: TimetableRow[];
  memo?: string;
};

type LegacyTimetableFile = {
  currentKey?: string;
  items?: Record<string, TimetableItem>;
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

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'storage', 'monthly-timetable.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as LegacyTimetableFile;

    const currentKey = String(parsed?.currentKey ?? '').trim();
    const items =
      parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};

    const source =
      (currentKey && items[currentKey]) ||
      Object.values(items)[0] ||
      null;

    if (!source || typeof source !== 'object') {
      return NextResponse.json(
        { success: false, message: '이관할 월간 시간표 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const yearMonth = String(source.yearMonth ?? '').trim();

    if (!yearMonth) {
      return NextResponse.json(
        { success: false, message: '이관할 월간 시간표 데이터가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { error: resetError } = await supabaseAdmin
      .from('monthly_timetable')
      .update({ is_current: false })
      .neq('year_month', yearMonth);

    if (resetError) {
      console.error('migrate-monthly-timetable resetError:', resetError);

      return NextResponse.json(
        { success: false, message: '월간 시간표 이관 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from('monthly_timetable')
      .upsert(
        {
          year_month: yearMonth,
          title: String(source.title ?? '').trim(),
          rows: normalizeRows(source.rows),
          memo: String(source.memo ?? '').trim(),
          is_current: true,
        },
        { onConflict: 'year_month' }
      );

    if (upsertError) {
      console.error('migrate-monthly-timetable upsertError:', upsertError);

      return NextResponse.json(
        { success: false, message: '월간 시간표 이관 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${yearMonth} 월간 시간표를 Supabase로 이관했습니다.`,
    });
  } catch (error) {
    console.error('migrate-monthly-timetable catch error:', error);

    return NextResponse.json(
      { success: false, message: '월간 시간표 이관 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}