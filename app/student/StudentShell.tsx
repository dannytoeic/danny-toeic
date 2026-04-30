'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

type StudentShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function StudentShell({
  title,
  description,
  children,
}: StudentShellProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b0b0b',
        fontFamily: 'Arial, sans-serif',
        color: '#f5f5f5',
      }}
    >
      <div
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '28px 18px 56px',
        }}
      >
        <div
          style={{
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/student"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #2a2a2a',
              backgroundColor: '#111111',
              color: '#f8f8f8',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            ← 학생 메인으로
          </Link>
        </div>

        <section
          style={{
            backgroundColor: '#161616',
            border: '1px solid #2a2a2a',
            borderRadius: '18px',
            padding: '28px 24px',
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
            marginBottom: '22px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: '999px',
                backgroundColor: '#ffffff',
                color: '#121212',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                marginBottom: '16px',
              }}
            >
              Danny TOEIC Student Page
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: '52px',
                lineHeight: 1.08,
                color: '#ffffff',
                fontWeight: 800,
                letterSpacing: '-0.03em',
              }}
            >
              {title}
            </h1>

            {description ? (
              <p
                style={{
                  marginTop: '14px',
                  marginBottom: 0,
                  color: '#d4d4d4',
                  fontSize: '20px',
                  lineHeight: 1.7,
                  maxWidth: '760px',
                  whiteSpace: 'pre-line',
                  fontWeight: 600,
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gap: '20px',
          }}
        >
          {children}
        </section>
      </div>
    </main>
  );
}