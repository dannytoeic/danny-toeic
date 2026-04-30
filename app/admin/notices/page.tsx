'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLoggedInAdmin } from '../adminGuard';
import AdminShell from '../AdminShell';

export default function AdminNoticesPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
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
    </AdminShell>
  );
}