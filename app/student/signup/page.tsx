'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

const CLASS_OPTIONS = [
  { key: '600-monwed', label: '600 월수반' },
  { key: '600-tuthu', label: '600 화목반' },
  { key: '800-monwed', label: '800 월수반' },
  { key: '800-tuthu', label: '800 화목반' },
];

export default function StudentSignupPage() {
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClassKeys, setSelectedClassKeys] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleClassKey(classKey: string) {
    setSelectedClassKeys((prev) =>
      prev.includes(classKey)
        ? prev.filter((key) => key !== classKey)
        : [...prev, classKey]
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');

    const trimmedName = name.trim();
    const trimmedId = loginId.trim();
    const trimmedPassword = password.trim();

    if (!trimmedName || !trimmedId || !trimmedPassword || selectedClassKeys.length === 0) {
      setMessage('이름, 아이디, 비밀번호, 반 선택은 모두 필요합니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/save-signup-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          id: trimmedId,
          password: trimmedPassword,
          classKey: selectedClassKeys[0],
          classKeys: selectedClassKeys,
          status: 'pending',
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '회원가입 신청 중 오류가 발생했습니다.');
        return;
      }

      setMessage('회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.');
      setName('');
      setLoginId('');
      setPassword('');
      setSelectedClassKeys([]);
    } catch (error) {
      console.error(error);
      setMessage('회원가입 신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          display: 'grid',
          gap: '20px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '34px', color: '#111827' }}>회원가입 신청</h1>
          <p
            style={{
              marginTop: '10px',
              marginBottom: 0,
              color: '#64748b',
              lineHeight: 1.7,
            }}
          >
            이름, 아이디, 비밀번호와 수강 반만 입력해 주세요.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            display: 'grid',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 700 }}>이름</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 700 }}>아이디</div>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="로그인에 사용할 아이디"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <div style={{ marginBottom: '8px', fontWeight: 700 }}>비밀번호</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <div style={{ marginBottom: '10px', fontWeight: 700 }}>수강 반</div>
            <div
              style={{
                display: 'grid',
                gap: '10px',
              }}
            >
              {CLASS_OPTIONS.map((option) => {
                const checked = selectedClassKeys.includes(option.key);

                return (
                  <label
                    key={option.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      backgroundColor: checked ? '#f8fafc' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleClassKey(option.key)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#111827',
              color: 'white',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? '신청 중...' : '회원가입 신청'}
          </button>

          {message && (
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '14px 16px',
                backgroundColor: '#f8fafc',
                color: '#475569',
                fontWeight: 700,
                lineHeight: 1.6,
              }}
            >
              {message}
            </div>
          )}
        </form>

        <div style={{ textAlign: 'center' }}>
          <Link
            href="/"
            style={{
              color: '#64748b',
              textDecoration: 'none',
              borderBottom: '1px solid #cbd5e1',
              paddingBottom: '1px',
            }}
          >
            첫 화면으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}