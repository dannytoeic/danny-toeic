'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLoggedInAdmin } from '../adminGuard';
import AdminShell from '../AdminShell';
import StudentClassScheduleAdmin from './StudentClassScheduleAdmin';

type PromotionImage = {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  storagePath?: string;
};

type PromotionArea = {
  isEnabled: boolean;
  title: string;
  images: PromotionImage[];
};

function normalizePromotionImages(raw: unknown): PromotionImage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      const obj = (item ?? {}) as Record<string, unknown>;

      return {
        id: String(obj.id ?? `promotion-image-${index + 1}`),
        url: String(obj.url ?? ''),
        alt: String(obj.alt ?? ''),
        sortOrder: Number.isFinite(Number(obj.sortOrder)) ? Number(obj.sortOrder) : index + 1,
        storagePath: obj.storagePath ? String(obj.storagePath) : undefined,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
}

export default function AdminNoticesPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [promotionArea, setPromotionArea] = useState<PromotionArea>({
    isEnabled: false,
    title: '📢 7월 수강신청 안내',
    images: [],
  });
  const [promotionMessage, setPromotionMessage] = useState('');
  const [isPromotionSaving, setIsPromotionSaving] = useState(false);
  const [isPromotionUploading, setIsPromotionUploading] = useState(false);
  const promotionFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const admin = getLoggedInAdmin();

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    setIsChecking(false);
  }, [router]);

  useEffect(() => {
    if (isChecking) return;

    async function loadPromotionArea() {
      try {
        const response = await fetch('/api/promotion-area?admin=1');
        const result = await response.json();

        if (result.success && result.promotionArea) {
          setPromotionArea({
            isEnabled: Boolean(result.promotionArea.isEnabled),
            title: String(result.promotionArea.title ?? ''),
            images: normalizePromotionImages(result.promotionArea.images).slice(0, 1),
          });
        }
      } catch (error) {
        console.error('promotion area load error:', error);
        setPromotionMessage('홍보영역을 불러오지 못했습니다.');
      }
    }

    loadPromotionArea();
  }, [isChecking]);

  async function handleSave() {
    setIsSaving(true);
    setMessage('');

    try {
      const lines = contentText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const response = await fetch('/api/save-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: lines }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage('전체공지 내용이 저장되었습니다.');
      } else {
        setMessage(result.message ?? '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      setMessage('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  function updatePromotionImage(id: string, patch: Partial<PromotionImage>) {
    setPromotionArea((current) => ({
      ...current,
      images: current.images.map((image) => (image.id === id ? { ...image, ...patch } : image)),
    }));
  }

  function removePromotionImage() {
    setPromotionArea((current) => ({
      ...current,
      images: [],
    }));
  }

  async function handlePromotionUpload(file: File | null) {
    if (!file) return;
    setIsPromotionUploading(true);
    setPromotionMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload-main-pagoda-week-image', { method: 'POST', body: formData });
      const result = await response.json();
      if (result.success && result.image) {
        setPromotionArea((current) => ({ ...current, images: [{ ...result.image, sortOrder: 1 }] }));
        setPromotionMessage('이미지가 업로드되었습니다. 홍보영역 저장을 눌러 반영하세요.');
      } else {
        setPromotionMessage(result.message ?? '이미지 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('promotion image upload error:', error);
      setPromotionMessage('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsPromotionUploading(false);
      if (promotionFileInputRef.current) promotionFileInputRef.current.value = '';
    }
  }

  async function handlePromotionSave() {
    setIsPromotionSaving(true);
    setPromotionMessage('');

    try {
      const images = promotionArea.images.slice(0, 1)
        .map((image, index) => ({
          ...image,
          url: image.url.trim(),
          alt: image.alt.trim(),
          sortOrder: index + 1,
        }))
        .filter((image) => image.url);

      const response = await fetch('/api/promotion-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: promotionArea.isEnabled,
          title: promotionArea.title,
          images,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPromotionArea((current) => ({
          ...current,
          images,
        }));
        setPromotionMessage('홍보영역이 저장되었습니다.');
      } else {
        setPromotionMessage(result.message ?? '홍보영역 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      setPromotionMessage('홍보영역 저장 중 오류가 발생했습니다.');
    } finally {
      setIsPromotionSaving(false);
    }
  }

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    marginBottom: '8px',
    color: '#334155',
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '15px',
    boxSizing: 'border-box' as const,
    backgroundColor: '#ffffff',
    color: '#111827',
    caretColor: '#111827',
  };

  if (isChecking) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          fontFamily: 'Arial, sans-serif',
          color: '#111827',
        }}
      >
        관리자 로그인 상태 확인 중...
      </main>
    );
  }

  return (
    <AdminShell
      title="전체공지 관리"
      description="학생 첫 화면에 공통으로 보여줄 전체공지를 작성합니다."
    >
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '24px',
          maxWidth: '900px',
        }}
      >
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>공지 제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
            placeholder="예: 4월 수업 운영 공지"
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>공지 내용</label>
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="한 줄에 한 항목씩 입력하세요."
            style={{
              ...inputStyle,
              minHeight: '220px',
              resize: 'vertical' as const,
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            padding: '12px 20px',
            backgroundColor: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            cursor: 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>

        {message && (
          <p
            style={{
              marginTop: '16px',
              marginBottom: 0,
              color: message.includes('저장되었습니다') ? '#0f766e' : '#b91c1c',
              fontWeight: 600,
            }}
          >
            {message}
          </p>
        )}
      </div>

      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '24px',
          maxWidth: '900px',
          marginTop: '22px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
            flexWrap: 'wrap',
            marginBottom: '18px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#111827', lineHeight: 1.3 }}>
              홍보영역 관리
            </h2>
            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '14px' }}>
              학생 반별 페이지의 Danny Voca 버튼 아래에 표시됩니다.
            </p>
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              color: '#111827',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={promotionArea.isEnabled}
              onChange={(e) =>
                setPromotionArea((current) => ({
                  ...current,
                  isEnabled: e.target.checked,
                }))
              }
              style={{ width: '18px', height: '18px' }}
            />
            {promotionArea.isEnabled ? 'ON' : 'OFF'}
          </label>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>홍보영역 제목</label>
          <input
            value={promotionArea.title}
            onChange={(e) =>
              setPromotionArea((current) => ({
                ...current,
                title: e.target.value,
              }))
            }
            style={inputStyle}
            placeholder="📢 7월 수강신청 안내"
          />
        </div>

        <div style={{ display: 'grid', gap: '14px', marginBottom: '18px' }}>
          <strong style={{ color: '#111827' }}>파고다위크 이미지</strong>
          <input
            ref={promotionFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => handlePromotionUpload(event.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => promotionFileInputRef.current?.click()}
              disabled={isPromotionUploading}
              style={{ padding: '11px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#111827', fontWeight: 700, cursor: 'pointer' }}
            >
              {isPromotionUploading ? '업로드 중...' : promotionArea.images[0] ? '이미지 교체' : '이미지 업로드'}
            </button>
            {promotionArea.images[0] ? (
              <button type="button" onClick={removePromotionImage} style={{ padding: '11px 16px', borderRadius: '10px', border: '1px solid #fecaca', backgroundColor: '#fff1f2', color: '#be123c', fontWeight: 700, cursor: 'pointer' }}>이미지 삭제</button>
            ) : null}
          </div>
          {promotionArea.images[0] ? (
            <>
              <input value={promotionArea.images[0].alt} onChange={(e) => updatePromotionImage(promotionArea.images[0].id, { alt: e.target.value })} style={inputStyle} placeholder="파고다위크 이미지 설명" />
              <img src={promotionArea.images[0].url} alt={promotionArea.images[0].alt || '파고다위크 안내'} style={{ width: '100%', height: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
            </>
          ) : <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', textAlign: 'center' }}>등록된 파고다위크 이미지가 없습니다.</div>}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handlePromotionSave}
            disabled={isPromotionSaving}
            style={{
              padding: '12px 20px',
              backgroundColor: '#111827',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              cursor: 'pointer',
              opacity: isPromotionSaving ? 0.7 : 1,
            }}
          >
            {isPromotionSaving ? '저장 중...' : '홍보영역 저장'}
          </button>
        </div>

        {promotionMessage && (
          <p
            style={{
              marginTop: '16px',
              marginBottom: 0,
              color: promotionMessage.includes('저장되었습니다') ? '#0f766e' : '#b91c1c',
              fontWeight: 600,
            }}
          >
            {promotionMessage}
          </p>
        )}
      </div>

      <StudentClassScheduleAdmin />
    </AdminShell>
  );
}
