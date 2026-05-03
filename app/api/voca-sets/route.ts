import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import type { VocaSet } from '../../../lib/voca/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VOCA_NOTICE_KEY = 'danny-voca-sets';

function makeServerSetId(set: VocaSet) {
  const version = set.course === '600' ? '통합' : set.version;
  const versionKey = version === '통합' ? 'unified' : version;
  return `danny-voca-set-${set.course}-${set.track}-${versionKey}-${set.day.replace(/\s+/g, '')}`;
}

function makeServerDisplayTitle(set: VocaSet) {
  const version = set.course === '600' ? '통합' : set.version;
  return version === '통합'
    ? `${set.course}반 ${set.track} ${set.day}`
    : `${set.course}반 ${set.track} ${version} ${set.day}`;
}

function normalizeServerSet(set: VocaSet): VocaSet {
  const version = set.course === '600' ? '통합' : set.version;
  const normalized = {
    ...set,
    version,
  };

  return {
    ...normalized,
    id: makeServerSetId(normalized),
    title: makeServerDisplayTitle(normalized),
    displayTitle: makeServerDisplayTitle(normalized),
  };
}

function normalizeSets(raw: unknown): VocaSet[] {
  if (!Array.isArray(raw)) return [];

  const sets = raw.filter((item): item is VocaSet => {
    const set = item as Partial<VocaSet>;
    return Boolean(set?.id && set?.course && set?.track && set?.version && set?.day);
  });

  const byId = new Map<string, VocaSet>();
  for (const set of sets) {
    const normalized = normalizeServerSet(set);
    byId.set(normalized.id, normalized);
  }

  return Array.from(byId.values());
}

async function readSets() {
  const { data, error } = await supabaseAdmin
    .from('site_notices')
    .select('content_text')
    .eq('notice_key', VOCA_NOTICE_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.content_text) return [];

  try {
    return normalizeSets(JSON.parse(String(data.content_text)));
  } catch (error) {
    console.error('voca-sets JSON parse error:', error);
    return [];
  }
}

async function writeSets(sets: VocaSet[]) {
  const { error } = await supabaseAdmin.from('site_notices').upsert(
    {
      notice_key: VOCA_NOTICE_KEY,
      title: 'Danny Voca Sets',
      content_text: JSON.stringify(sets),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'notice_key' }
  );

  if (error) {
    throw error;
  }
}

export async function GET() {
  try {
    const sets = await readSets();
    return NextResponse.json({ success: true, sets });
  } catch (error) {
    console.error('get voca-sets error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load Danny Voca sets.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const set = body?.set as VocaSet | undefined;

    if (!set?.id) {
      return NextResponse.json(
        { success: false, message: 'Missing Danny Voca set.' },
        { status: 400 }
      );
    }

    const normalizedSet = normalizeServerSet(set);
    const currentSets = await readSets();
    const nextSets = [
      ...currentSets.filter((item) => normalizeServerSet(item).id !== normalizedSet.id),
      normalizedSet,
    ];
    await writeSets(nextSets);

    return NextResponse.json({
      success: true,
      set: normalizedSet,
      sets: nextSets,
      message: 'Danny Voca set saved.',
    });
  } catch (error) {
    console.error('save voca-set error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save Danny Voca set.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')?.trim() || '';

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Missing Danny Voca set id.' },
        { status: 400 }
      );
    }

    const currentSets = await readSets();
    const nextSets = currentSets.filter((set) => normalizeServerSet(set).id !== id);
    await writeSets(nextSets);

    return NextResponse.json({
      success: true,
      sets: nextSets,
      message: 'Danny Voca set deleted.',
    });
  } catch (error) {
    console.error('delete voca-set error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete Danny Voca set.' },
      { status: 500 }
    );
  }
}
