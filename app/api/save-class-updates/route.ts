import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

type ClassUpdateItem = {
  globalNoticeText?: string;
  cards?: unknown[];
};

type ClassUpdateMap = Record<string, ClassUpdateItem>;

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

const classKeys: ClassKey[] = [
  '600-monwed',
  '600-tuthu',
  '800-monwed',
  '800-tuthu',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const incoming: ClassUpdateMap =
      body?.items && typeof body.items === 'object'
        ? body.items
        : body?.classUpdates && typeof body.classUpdates === 'object'
        ? body.classUpdates
        : body && typeof body === 'object'
        ? body
        : {};

    const rows = classKeys.map((classKey) => {
      const source = incoming[classKey] ?? {};

      return {
        class_key: classKey,
        global_notice_text: String(source.globalNoticeText ?? '').trim(),
        cards: Array.isArray(source.cards) ? source.cards : [],
      };
    });

    const { error } = await supabaseAdmin
      .from('class_updates')
      .upsert(rows, { onConflict: 'class_key' });

    if (error) {
      console.error('save-class-updates error:', error);

      return NextResponse.json(
        { success: false, message: '반별 자료 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const result = buildDefaultResult();

    for (const row of rows) {
      result[row.class_key] = {
        globalNoticeText: row.global_notice_text,
        cards: Array.isArray(row.cards) ? row.cards : [],
      };
    }

    return NextResponse.json({
      success: true,
      message: '반별 자료가 저장되었습니다.',
      items: result,
      classUpdates: result,
    });
  } catch (error) {
    console.error('save-class-updates catch error:', error);

    return NextResponse.json(
      { success: false, message: '반별 자료 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}