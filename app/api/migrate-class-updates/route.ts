import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

type ClassUpdateItem = {
  globalNoticeText?: string;
  cards?: unknown[];
};

type ClassUpdateMap = Record<string, ClassUpdateItem>;

const classKeys: ClassKey[] = [
  '600-monwed',
  '600-tuthu',
  '800-monwed',
  '800-tuthu',
];

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'storage', 'classUpdates.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as ClassUpdateMap;

    const rows = classKeys.map((classKey) => {
      const source = parsed?.[classKey] ?? {};

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
      console.error('migrate-class-updates error:', error);

      return NextResponse.json(
        { success: false, message: '반별 자료 이관 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '반별 자료를 Supabase로 이관했습니다.',
      count: rows.length,
    });
  } catch (error) {
    console.error('migrate-class-updates catch error:', error);

    return NextResponse.json(
      { success: false, message: '반별 자료 이관 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}