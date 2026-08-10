import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { OPERATING_YEAR_MONTH, normalizeYearMonth } from '../../../lib/operating-month';

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

const DEFAULT_YEAR_MONTH = OPERATING_YEAR_MONTH;

type ClassUpdateItem = {
  globalNoticeText?: string;
  cards?: unknown[];
};

const classKeys: ClassKey[] = [
  '600-monwed',
  '600-tuthu',
  '800-monwed',
  '800-tuthu',
];

function isClassKey(value: unknown): value is ClassKey {
  return typeof value === 'string' && classKeys.includes(value as ClassKey);
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeJson(item)])
    );
  }

  return value;
}

function isSemanticallyEqual(left: unknown, right: unknown) {
  return JSON.stringify(canonicalizeJson(left)) === JSON.stringify(canonicalizeJson(right));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yearMonth = normalizeYearMonth(body?.yearMonth ?? body?.monthKey);
    const classKey = body?.classKey;

    if (!isClassKey(classKey)) {
      return NextResponse.json(
        { success: false, message: 'A valid classKey is required.' },
        { status: 400 }
      );
    }

    const source: ClassUpdateItem =
      body?.item && typeof body.item === 'object' ? body.item : {};
    const row = {
      year_month: yearMonth,
      class_key: classKey,
      global_notice_text: String(source.globalNoticeText ?? '').trim(),
      cards: Array.isArray(source.cards) ? source.cards : [],
    };

    const { data: savedRow, error } = await supabaseAdmin
      .from('class_updates')
      .upsert(row, { onConflict: 'year_month,class_key' })
      .select('year_month, class_key, global_notice_text, cards')
      .maybeSingle();

    if (error || !savedRow) {
      console.error('save-class-updates error:', error);

      return NextResponse.json(
        { success: false, message: '반별 자료 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { data: verifiedRow, error: verifyError } = await supabaseAdmin
      .from('class_updates')
      .select('year_month, class_key, global_notice_text, cards')
      .eq('year_month', yearMonth)
      .eq('class_key', classKey)
      .maybeSingle();

    if (
      verifyError ||
      !verifiedRow ||
      verifiedRow.year_month !== yearMonth ||
      verifiedRow.class_key !== classKey ||
      verifiedRow.global_notice_text !== row.global_notice_text ||
      !isSemanticallyEqual(verifiedRow.cards ?? [], row.cards)
    ) {
      console.error('save-class-updates verification error:', verifyError);
      return NextResponse.json(
        { success: false, message: 'Saved class data could not be verified.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '반별 자료가 저장되었습니다.',
      yearMonth,
      classKey,
      affectedRows: 1,
      item: {
        globalNoticeText: verifiedRow.global_notice_text || '',
        cards: Array.isArray(verifiedRow.cards) ? verifiedRow.cards : [],
      },
    });
  } catch (error) {
    console.error('save-class-updates catch error:', error);

    return NextResponse.json(
      { success: false, message: '반별 자료 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
