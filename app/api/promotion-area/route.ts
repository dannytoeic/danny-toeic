import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROMOTION_AREA_ID = 'student_home';
const FALLBACK_NOTICE_KEY = 'promotion_area';

type PromotionImage = {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
};

type PromotionAreaRow = {
  area_key: string;
  is_enabled: boolean | null;
  title: string | null;
  images: unknown;
  updated_at: string | null;
};

type FallbackPromotionRow = {
  notice_key: string;
  title: string | null;
  content_text: string | null;
  updated_at: string | null;
};

function isMissingTableError(error: unknown) {
  const obj = (error ?? {}) as Record<string, unknown>;
  const code = String(obj.code ?? '');
  const message = String(obj.message ?? '');

  return code === '42P01' || message.includes('promotion_area');
}

function normalizeImageUrl(value: unknown) {
  const url = String(value ?? '').trim();

  if (!url) return '';
  if (url.startsWith('/')) return url;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;

  return '';
}

function normalizeImages(value: unknown): PromotionImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const url = normalizeImageUrl(obj.url);

      if (!url) return null;

      return {
        id: String(obj.id ?? `promotion-image-${index + 1}`),
        url,
        alt: String(obj.alt ?? ''),
        sortOrder: Number.isFinite(Number(obj.sortOrder)) ? Number(obj.sortOrder) : index + 1,
      };
    })
    .filter((item): item is PromotionImage => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
}

function toPayload(row: PromotionAreaRow | null, adminMode: boolean) {
  const images = normalizeImages(row?.images);
  const isEnabled = Boolean(row?.is_enabled);

  if (!adminMode && (!isEnabled || images.length === 0)) {
    return {
      isEnabled: false,
      title: '',
      images: [],
      updatedAt: row?.updated_at ?? null,
    };
  }

  return {
    isEnabled,
    title: String(row?.title ?? ''),
    images,
    updatedAt: row?.updated_at ?? null,
  };
}

function fallbackRowToPayload(row: FallbackPromotionRow | null, adminMode: boolean) {
  let parsed: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(String(row?.content_text ?? '{}')) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const images = normalizeImages(parsed.images);
  const isEnabled = Boolean(parsed.isEnabled);

  if (!adminMode && (!isEnabled || images.length === 0)) {
    return {
      isEnabled: false,
      title: '',
      images: [],
      updatedAt: row?.updated_at ?? null,
    };
  }

  return {
    isEnabled,
    title: String(row?.title ?? parsed.title ?? ''),
    images,
    updatedAt: row?.updated_at ?? null,
  };
}

async function getFallbackPromotionArea(adminMode: boolean) {
  const { data, error } = await supabaseAdmin
    .from('site_notices')
    .select('notice_key, title, content_text, updated_at')
    .eq('notice_key', FALLBACK_NOTICE_KEY)
    .maybeSingle();

  if (error) {
    console.error('promotion-area fallback GET error:', error);
    return NextResponse.json(
      { success: false, message: '홍보영역을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    promotionArea: fallbackRowToPayload((data as FallbackPromotionRow | null) ?? null, adminMode),
  });
}

async function saveFallbackPromotionArea(
  isEnabled: boolean,
  title: string,
  images: PromotionImage[]
) {
  const { error } = await supabaseAdmin.from('site_notices').upsert(
    {
      notice_key: FALLBACK_NOTICE_KEY,
      title,
      content_text: JSON.stringify({
        isEnabled,
        title,
        images,
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'notice_key' }
  );

  if (error) {
    console.error('promotion-area fallback POST error:', error);
    return NextResponse.json(
      { success: false, message: '홍보영역 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    promotionArea: {
      isEnabled,
      title,
      images,
    },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const adminMode = url.searchParams.get('admin') === '1';

    const { data, error } = await supabaseAdmin
      .from('promotion_area')
      .select('area_key, is_enabled, title, images, updated_at')
      .eq('area_key', PROMOTION_AREA_ID)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return getFallbackPromotionArea(adminMode);
      }

      console.error('promotion-area GET error:', error);
      return NextResponse.json(
        { success: false, message: '홍보영역을 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      promotionArea: toPayload((data as PromotionAreaRow | null) ?? null, adminMode),
    });
  } catch (error) {
    console.error('promotion-area GET catch error:', error);

    return NextResponse.json(
      { success: false, message: '홍보영역을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isEnabled = Boolean(body.isEnabled);
    const title = String(body.title ?? '').trim();
    const images = normalizeImages(body.images);

    const { error } = await supabaseAdmin.from('promotion_area').upsert(
      {
        area_key: PROMOTION_AREA_ID,
        is_enabled: isEnabled,
        title,
        images,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'area_key' }
    );

    if (error) {
      console.error('promotion-area POST error:', error);

      if (isMissingTableError(error)) {
        return saveFallbackPromotionArea(isEnabled, title, images);
      }

      return NextResponse.json(
        { success: false, message: '홍보영역 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      promotionArea: {
        isEnabled,
        title,
        images,
      },
    });
  } catch (error) {
    console.error('promotion-area POST catch error:', error);

    return NextResponse.json(
      { success: false, message: '홍보영역 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
