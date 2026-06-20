import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AREA_KEY = 'main_pagoda_week';
const FALLBACK_NOTICE_KEY = 'main_pagoda_week';

type MainPagodaWeekRow = {
  area_key: string;
  is_enabled: boolean | null;
  title: string | null;
  images: unknown;
  updated_at: string | null;
};

type FallbackPagodaWeekRow = {
  notice_key: string;
  title: string | null;
  content_text: string | null;
  updated_at: string | null;
};

type PagodaWeekImage = {
  id: string;
  url: string;
  alt: string;
  storagePath: string;
  sortOrder: number;
};

function normalizeImageUrl(value: unknown) {
  const url = String(value ?? '').trim();

  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://')) return url;

  return '';
}

function getErrorDetail(error: unknown) {
  const obj = (error ?? {}) as Record<string, unknown>;
  return {
    code: String(obj.code ?? ''),
    message: String(obj.message ?? ''),
    details: String(obj.details ?? ''),
    hint: String(obj.hint ?? ''),
  };
}

function isMissingPromotionAreaError(error: unknown) {
  const detail = getErrorDetail(error);

  return (
    detail.code === '42P01' ||
    detail.message.includes('promotion_area') ||
    detail.details.includes('promotion_area')
  );
}

function normalizeImages(value: unknown): PagodaWeekImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const url = normalizeImageUrl(obj.url);

      if (!url) return null;

      return {
        id: String(obj.id ?? `main-pagoda-week-${index + 1}`),
        url,
        alt: String(obj.alt ?? '파고다위크 안내'),
        storagePath: String(obj.storagePath ?? ''),
        sortOrder: Number.isFinite(Number(obj.sortOrder)) ? Number(obj.sortOrder) : index + 1,
      };
    })
    .filter((item): item is PagodaWeekImage => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 1)
    .map((item) => ({
      id: item.id,
      url: item.url,
      alt: item.alt,
      storagePath: item.storagePath,
      sortOrder: 1,
    }));
}

function toPayload(row: MainPagodaWeekRow | null, adminMode: boolean) {
  const images = normalizeImages(row?.images);
  const isEnabled = Boolean(row?.is_enabled);

  if (!adminMode && (!isEnabled || images.length === 0)) {
    return {
      isEnabled: false,
      title: '',
      image: null,
      updatedAt: row?.updated_at ?? null,
    };
  }

  return {
    isEnabled,
    title: String(row?.title ?? '파고다위크 안내'),
    image: images[0] ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function fallbackRowToPayload(row: FallbackPagodaWeekRow | null, adminMode: boolean) {
  let parsed: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(String(row?.content_text ?? '{}')) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const images = normalizeImages(parsed.image ? [parsed.image] : parsed.images);
  const isEnabled = Boolean(parsed.isEnabled);

  if (!adminMode && (!isEnabled || images.length === 0)) {
    return {
      isEnabled: false,
      title: '',
      image: null,
      updatedAt: row?.updated_at ?? null,
    };
  }

  return {
    isEnabled,
    title: String(row?.title ?? parsed.title ?? '파고다위크 안내'),
    image: images[0] ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

async function getFallbackPagodaWeekRow() {
  return supabaseAdmin
    .from('site_notices')
    .select('notice_key, title, content_text, updated_at')
    .eq('notice_key', FALLBACK_NOTICE_KEY)
    .maybeSingle();
}

function getUpdatedTime(value: string | null | undefined) {
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function getFallbackPagodaWeek(adminMode: boolean) {
  const { data, error } = await getFallbackPagodaWeekRow();

  if (error) {
    const detail = getErrorDetail(error);
    console.error('main-pagoda-week fallback GET error:', detail);
    return NextResponse.json(
      {
        success: false,
        message: `메인 파고다위크 이미지를 불러오지 못했습니다. (${detail.code || detail.message})`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    pagodaWeek: fallbackRowToPayload((data as FallbackPagodaWeekRow | null) ?? null, adminMode),
  });
}

async function saveFallbackPagodaWeek(
  isEnabled: boolean,
  title: string,
  image: PagodaWeekImage | null
) {
  const { error } = await supabaseAdmin.from('site_notices').upsert(
    {
      notice_key: FALLBACK_NOTICE_KEY,
      title,
      content_text: JSON.stringify({
        isEnabled,
        title,
        image,
        images: image ? [image] : [],
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'notice_key' }
  );

  if (error) {
    const detail = getErrorDetail(error);
    console.error('main-pagoda-week fallback POST error:', detail);
    return NextResponse.json(
      {
        success: false,
        message: `메인 파고다위크 이미지 저장 중 오류가 발생했습니다. (${detail.code || detail.message})`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    pagodaWeek: {
      isEnabled,
      title,
      image,
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
      .eq('area_key', AREA_KEY)
      .maybeSingle();

    if (error) {
      const detail = getErrorDetail(error);
      console.error('main-pagoda-week GET error:', detail);

      if (isMissingPromotionAreaError(error)) {
        return getFallbackPagodaWeek(adminMode);
      }

      return NextResponse.json(
        {
          success: false,
          message: `메인 파고다위크 이미지를 불러오지 못했습니다. (${detail.code || detail.message})`,
        },
        { status: 500 }
      );
    }

    const { data: fallbackData, error: fallbackError } = await getFallbackPagodaWeekRow();

    if (fallbackError) {
      const detail = getErrorDetail(fallbackError);
      console.error('main-pagoda-week fallback compare GET error:', detail);
    }

    const primaryRow = (data as MainPagodaWeekRow | null) ?? null;
    const fallbackRow = !fallbackError
      ? ((fallbackData as FallbackPagodaWeekRow | null) ?? null)
      : null;
    const shouldUseFallback =
      Boolean(fallbackRow) &&
      (!primaryRow ||
        getUpdatedTime(fallbackRow?.updated_at) > getUpdatedTime(primaryRow?.updated_at));

    return NextResponse.json({
      success: true,
      pagodaWeek: shouldUseFallback
        ? fallbackRowToPayload(fallbackRow, adminMode)
        : toPayload(primaryRow, adminMode),
    });
  } catch (error) {
    console.error('main-pagoda-week GET catch error:', error);
    return NextResponse.json(
      { success: false, message: '메인 파고다위크 이미지를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isEnabled = Boolean(body.isEnabled);
    const title = String(body.title ?? '파고다위크 안내').trim();
    const image = normalizeImages(body.image ? [body.image] : []);
    const imageToSave = image[0] ?? null;

    const { error } = await supabaseAdmin.from('promotion_area').upsert(
      {
        area_key: AREA_KEY,
        is_enabled: isEnabled,
        title,
        images: imageToSave ? [imageToSave] : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'area_key' }
    );

    if (error) {
      const detail = getErrorDetail(error);
      console.error('main-pagoda-week POST error:', detail);

      if (isMissingPromotionAreaError(error)) {
        return saveFallbackPagodaWeek(isEnabled, title, imageToSave);
      }

      return NextResponse.json(
        {
          success: false,
          message: `메인 파고다위크 이미지 저장 중 오류가 발생했습니다. (${detail.code || detail.message})`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pagodaWeek: {
        isEnabled,
        title,
        image: imageToSave,
      },
    });
  } catch (error) {
    console.error('main-pagoda-week POST catch error:', error);
    return NextResponse.json(
      { success: false, message: '메인 파고다위크 이미지 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
