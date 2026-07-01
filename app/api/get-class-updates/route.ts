import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { OPERATING_YEAR_MONTH, SUPPORTED_CLASS_UPDATE_MONTHS, normalizeYearMonth } from '../../../lib/operating-month';

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

const DEFAULT_YEAR_MONTH = OPERATING_YEAR_MONTH;

type ClassUpdateResult = Record<
  ClassKey,
  {
    globalNoticeText: string;
    cards: unknown[];
  }
>;

type MonthlyClassUpdateResult = Record<string, ClassUpdateResult>;

function buildDefaultResult(): ClassUpdateResult {
  return {
    '600-monwed': { globalNoticeText: '', cards: [] },
    '600-tuthu': { globalNoticeText: '', cards: [] },
    '800-monwed': { globalNoticeText: '', cards: [] },
    '800-tuthu': { globalNoticeText: '', cards: [] },
  };
}

function isClassKey(value: string): value is ClassKey {
  return (
    value === '600-monwed' ||
    value === '600-tuthu' ||
    value === '800-monwed' ||
    value === '800-tuthu'
  );
}

function isMissingYearMonthError(error: unknown) {
  const item = error as { code?: string; message?: string } | null;
  return item?.code === '42703' || String(item?.message ?? '').includes('year_month');
}

export async function GET(request: NextRequest) {
  try {
    const requestedYearMonth = normalizeYearMonth(
      request.nextUrl.searchParams.get('yearMonth')
    );

    let { data, error } = await supabaseAdmin
      .from('class_updates')
      .select('year_month, class_key, global_notice_text, cards')
      .order('year_month', { ascending: false })
      .order('class_key', { ascending: true });

    if (error) {
      if (isMissingYearMonthError(error)) {
        if (requestedYearMonth !== '2026-05') {
          const empty = buildDefaultResult();
          return NextResponse.json({
            success: true,
            yearMonth: requestedYearMonth,
            operatingYearMonth: DEFAULT_YEAR_MONTH,
            months: SUPPORTED_CLASS_UPDATE_MONTHS,
            monthItems: {
              [requestedYearMonth]: empty,
            },
            items: empty,
            classUpdates: empty,
          });
        }

        const legacyResult = await supabaseAdmin
          .from('class_updates')
          .select('class_key, global_notice_text, cards');

        data = legacyResult.data as typeof data;
        error = legacyResult.error;
      }
    }

    if (error) {
      console.error('get-class-updates error:', error);

      return NextResponse.json(
        { success: false, message: '반별 자료를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const result = buildDefaultResult();
    const monthItems: MonthlyClassUpdateResult = {};

    if (Array.isArray(data)) {
      for (const rawRow of data) {
        const row = rawRow as {
          class_key?: string;
          year_month?: string | null;
          global_notice_text?: string | null;
          cards?: unknown[] | null;
        };

        const classKey = String(row.class_key ?? '').trim();
        const yearMonth = String(row.year_month ?? '').trim() || '2026-05';

        if (!isClassKey(classKey)) {
          continue;
        }

        if (!monthItems[yearMonth]) {
          monthItems[yearMonth] = buildDefaultResult();
        }

        monthItems[yearMonth][classKey] = {
          globalNoticeText: row.global_notice_text || '',
          cards: Array.isArray(row.cards) ? row.cards : [],
        };
      }
    }

    const months = Array.from(
      new Set([...SUPPORTED_CLASS_UPDATE_MONTHS, ...Object.keys(monthItems)])
    ).sort().reverse();
    const selectedYearMonth = requestedYearMonth;
    const selectedItems =
      monthItems[selectedYearMonth] ??
      monthItems[DEFAULT_YEAR_MONTH] ??
      monthItems[months[0]] ??
      result;

    for (const classKey of Object.keys(selectedItems) as ClassKey[]) {
      result[classKey] = selectedItems[classKey];
    }

    return NextResponse.json({
      success: true,
      yearMonth: selectedYearMonth,
      operatingYearMonth: DEFAULT_YEAR_MONTH,
      months,
      monthItems,
      items: result,
      classUpdates: result,
    });
  } catch (error) {
    console.error('get-class-updates catch error:', error);

    return NextResponse.json(
      { success: false, message: '반별 자료를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
