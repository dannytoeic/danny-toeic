'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function AdminShell({ title, description, children }: Props) {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('loggedInAdmin');
    router.push('/admin/login');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '40px',
        backgroundColor: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '36px', margin: 0 }}>{title}</h1>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/admin"
            style={{
              padding: '10px 16px',
              backgroundColor: 'white',
              color: '#111827',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            관리자 홈
          </Link>

          <button
            onClick={handleLogout}
            style={{
              padding: '10px 16px',
              backgroundColor: 'white',
              color: '#111827',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {description && (
        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '28px' }}>
          {description}
        </p>
      )}

      {children}
    </main>
  );
}