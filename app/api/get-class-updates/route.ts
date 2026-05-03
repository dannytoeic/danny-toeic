import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

type ClassUpdateResult = Record<
  ClassKey,
  {
    globalNoticeText: string;
    cards: unknown[];
  }
>;

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

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('class_updates')
      .select('class_key, global_notice_text, cards');

    if (error) {
      console.error('get-class-updates error:', error);

      return NextResponse.json(
        { success: false, message: '반별 자료를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const result = buildDefaultResult();

    if (Array.isArray(data)) {
      for (const rawRow of data) {
        const row = rawRow as {
          class_key?: string;
          global_notice_text?: string | null;
          cards?: unknown[] | null;
        };

        const classKey = String(row.class_key ?? '').trim();

        if (!isClassKey(classKey)) {
          continue;
        }

        result[classKey] = {
          globalNoticeText: row.global_notice_text || '',
          cards: Array.isArray(row.cards) ? row.cards : [],
        };
      }
    }

    return NextResponse.json({
      success: true,
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
