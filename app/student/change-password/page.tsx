'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StudentShell from '../StudentShell';

type LoggedInStudent = {
  id: string;
  name: string;
  username: string;
  classKey: string;
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
};

export default function StudentChangePasswordPage() {
  const router = useRouter();
  const [student, setStudent] = useState<LoggedInStudent | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const savedStudent = localStorage.getItem('loggedInStudent');

    if (!savedStudent) {
      router.push('/');
      return;
    }

    try {
      const parsed = JSON.parse(savedStudent) as LoggedInStudent;
      setStudent(parsed);
      setIsChecking(false);
    } catch (error) {
      console.error(error);
      localStorage.removeItem('loggedInStudent');
      router.push('/');
    }
  }, [router]);

  async function handleSave() {
    if (!student) return;

    setMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('모든 항목을 입력하세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 4) {
      setMessage('새 비밀번호는 4자 이상 입력하세요.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/change-student-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          currentPassword,
          newPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage('비밀번호가 변경되었습니다.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage(result.message ?? '비밀번호 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      setMessage('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  const labelStyle = {
    display: 'block',
    fontSize: '15px',
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
    marginBottom: '18px',
    backgroundColor: 'white',
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
        로그인 상태 확인 중...
      </main>
    );
  }

  return (
    <StudentShell
      title="비밀번호 변경"
      description={`${student?.name ?? ''} 학생 계정의 비밀번호를 변경합니다.`}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '28px',
          borderRadius: '18px',
          border: '1px solid #e2e8f0',
          width: '100%',
          maxWidth: '520px',
        }}
      >
        <label style={labelStyle}>현재 비밀번호</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>새 비밀번호</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>새 비밀번호 확인</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={handleSave}
          style={{
            padding: '13px 18px',
            backgroundColor: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            cursor: 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? '변경 중...' : '비밀번호 변경'}
        </button>

        {message && (
          <p
            style={{
              marginTop: '18px',
              marginBottom: 0,
              color: message.includes('변경되었습니다') ? '#0f766e' : '#b91c1c',
              fontWeight: 600,
              lineHeight: '1.6',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </StudentShell>
  );
}