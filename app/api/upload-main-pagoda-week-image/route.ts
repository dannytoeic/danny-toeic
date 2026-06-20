import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'promotion-images';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extensionFor(file: File) {
  const nameExtension = file.name.split('.').pop()?.toLowerCase();

  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) {
    return nameExtension;
  }

  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';

  return 'png';
}

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);

  if (data) return null;

  const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_TYPES),
  });

  return error;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: '업로드할 이미지 파일을 선택해 주세요.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, message: 'jpg, png, webp, gif 이미지만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: '이미지 파일은 8MB 이하만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    const bucketError = await ensureBucket();

    if (bucketError) {
      console.error('upload-main-pagoda-week-image bucket error:', bucketError);
      return NextResponse.json(
        { success: false, message: '이미지 저장소를 준비하지 못했습니다.' },
        { status: 500 }
      );
    }

    const storagePath = `main-pagoda-week/${Date.now()}-${crypto.randomUUID()}.${extensionFor(
      file
    )}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('upload-main-pagoda-week-image upload error:', uploadError);
      return NextResponse.json(
        { success: false, message: '이미지 업로드에 실패했습니다.' },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      image: {
        id: `main-pagoda-week-${Date.now()}`,
        url: data.publicUrl,
        alt: '파고다위크 안내',
        storagePath,
        sortOrder: 1,
      },
    });
  } catch (error) {
    console.error('upload-main-pagoda-week-image catch error:', error);
    return NextResponse.json(
      { success: false, message: '이미지 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
