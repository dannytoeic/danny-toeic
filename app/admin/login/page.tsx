'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleLogin() {
    setMessage('');
    setIsLoading(true);

    const adminUsername = 'admin';
    const adminPassword = '1234';

    if (username.trim() !== adminUsername || password.trim() !== adminPassword) {
      setMessage('관리자 아이디 또는 비밀번호가 올바르지 않습니다.');
      setIsLoading(false);
      return;
    }

    localStorage.setItem(
      'loggedInAdmin',
      JSON.stringify({
        username: adminUsername,
        role: 'admin',
      })
    );

    router.push('/admin');
  }

  const cardStyle = {
    backgroundColor: 'white',
    padding: '28px',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    width: '100%',
    maxWidth: '460px',
  };

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
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
      }}
    >
      <div style={cardStyle}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
          관리자 로그인
        </h1>

        <p style={{ color: '#64748b', marginBottom: '24px' }}>
          관리자 계정으로 로그인하세요.
        </p>

        <label style={labelStyle}>아이디</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: '13px 18px',
            backgroundColor: '#111827',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            cursor: 'pointer',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? '확인 중...' : '로그인'}
        </button>

        {message && (
          <p
            style={{
              marginTop: '18px',
              marginBottom: 0,
              color: '#b91c1c',
              fontWeight: 600,
            }}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}