'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLoggedInAdmin } from '../adminGuard';
import AdminShell from '../AdminShell';

export default function AdminSchedulePage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const [description, setDescription] = useState('');
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const admin = getLoggedInAdmin();

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    setIsChecking(false);
  }, [router]);

  async function handleSave() {
    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, imageSrc, imageAlt }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage('한달일정 정보가 저장되었습니다.');
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
      title="한달일정 관리"
      description="학생 첫 화면에 보일 한달일정 설명과 이미지 정보를 입력합니다."
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
          <label style={labelStyle}>설명</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
            placeholder="예: 4월 한달일정입니다."
          />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>이미지 경로</label>
          <input
            value={imageSrc}
            onChange={(e) => setImageSrc(e.target.value)}
            style={inputStyle}
            placeholder="예: /schedule/april.png"
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>이미지 설명(alt)</label>
          <input
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            style={inputStyle}
            placeholder="예: 4월 한달일정 이미지"
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
    </AdminShell>
  );
}