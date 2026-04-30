'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type LoggedInStudent = {
  id: string;
  name: string;
  username: string;
  classKey?: string;
  classKeys?: string[];
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
};

type NoticeItem = {
  id: string;
  title: string;
  content: string;
};

const classPageMap: Record<string, string> = {
  '600-monwed': '/student/class-600-monwed',
  '600-tuthu': '/student/class-600-tuthu',
  '800-monwed': '/student/class-800-monwed',
  '800-tuthu': '/student/class-800-tuthu',
};

const classLabelMap: Record<string, string> = {
  '600-monwed': '600 월수반',
  '600-tuthu': '600 화목반',
  '800-monwed': '800 월수반',
  '800-tuthu': '800 화목반',
};

function normalizeNoticeArray(raw: unknown): NoticeItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const obj = (item ?? {}) as Record<string, unknown>;

    return {
      id: String(obj.id ?? `notice-${index + 1}`),
      title: String(obj.title ?? '공지'),
      content: String(obj.content ?? obj.description ?? obj.body ?? obj.text ?? ''),
    };
  });
}

function pickNoticeList(result: unknown): NoticeItem[] {
  const obj = (result ?? {}) as Record<string, unknown>;
  const candidates = [obj.notices, obj.items, obj.data, obj.noticeList];

  for (const candidate of candidates) {
    const normalized = normalizeNoticeArray(candidate);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

async function safeFetchJson(url: string) {
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${url} 요청 실패 (${response.status})`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`${url} 가 JSON이 아니라 HTML/기타 형식으로 응답했습니다.`);
  }

  return JSON.parse(text);
}

function getStudentClassKeys(student: LoggedInStudent | null): string[] {
  if (!student) return [];

  if (Array.isArray(student.classKeys) && student.classKeys.length > 0) {
    return student.classKeys.filter(Boolean);
  }

  if (student.classKey) {
    return [student.classKey];
  }

  return [];
}

export default function StudentHomePage() {
  const router = useRouter();
  const [student, setStudent] = useState<LoggedInStudent | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [noticeMessage, setNoticeMessage] = useState('');

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

  const classKeys = useMemo(() => getStudentClassKeys(student), [student]);

  useEffect(() => {
    if (isChecking || !student) return;

    if (classKeys.length === 1) {
      const onlyClassKey = classKeys[0];
      const href = classPageMap[onlyClassKey];

      if (href) {
        router.replace(href);
      }
    }
  }, [isChecking, student, classKeys, router]);

  useEffect(() => {
    if (isChecking) return;

    async function loadNotices() {
      try {
        const result = await safeFetchJson('/api/get-notices');
        if (result?.success) {
          const list = pickNoticeList(result);
          if (list.length > 0) {
            setNotices(list);
            setNoticeMessage('');
            return;
          }
        }
      } catch (error) {
        console.error('notice fetch error:', error);
      }

      setNoticeMessage('등록된 전체공지가 없습니다.');
      setNotices([]);
    }

    loadNotices();
  }, [isChecking]);

  function handleLogout() {
    localStorage.removeItem('loggedInStudent');
    router.push('/');
  }

  if (isChecking) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          fontFamily: 'Arial, sans-serif',
          color: '#111827',
        }}
      >
        로그인 상태 확인 중...
      </main>
    );
  }

  if (classKeys.length === 1) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          fontFamily: 'Arial, sans-serif',
          color: '#111827',
        }}
      >
        내 반 페이지로 이동 중...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
        padding: '40px 24px 80px',
      }}
    >
      <div
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '18px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '38px', margin: 0 }}>수강생 페이지</h1>
            <p
              style={{
                marginTop: '12px',
                marginBottom: 0,
                fontSize: '16px',
                color: '#64748b',
                lineHeight: 1.7,
              }}
            >
              수강 중인 반을 선택해 주세요.
            </p>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: '10px 16px',
              backgroundColor: 'white',
              color: '#111827',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
        </div>

        <p
          style={{
            fontSize: '14px',
            color: '#94a3b8',
            marginTop: 0,
            marginBottom: '28px',
          }}
        >
          현재 로그인: {student?.name}
        </p>

        <div style={{ display: 'grid', gap: '20px' }}>
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            }}
          >
            <h2 style={{ fontSize: '24px', marginTop: 0, marginBottom: '14px' }}>
              전체공지
            </h2>

            {noticeMessage && (
              <p style={{ color: '#475569', fontWeight: 600, marginTop: 0 }}>
                {noticeMessage}
              </p>
            )}

            {notices.length > 0 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                {notices.map((notice) => (
                  <div
                    key={notice.id}
                    style={{
                      backgroundColor: '#fcfcfb',
                      border: '1px solid #ece7e1',
                      borderRadius: '16px',
                      padding: '18px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '17px',
                        fontWeight: 700,
                        color: '#111827',
                        marginBottom: '10px',
                      }}
                    >
                      {notice.title}
                    </div>
                    <div
                      style={{
                        color: '#475569',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-wrap',
                        fontSize: '15px',
                      }}
                    >
                      {notice.content || '내용이 없습니다.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            }}
          >
            <h2 style={{ fontSize: '24px', marginTop: 0, marginBottom: '14px' }}>
              내 수강반
            </h2>

            {classKeys.length === 0 ? (
              <p style={{ color: '#475569', margin: 0 }}>
                연결된 수강반 정보가 없습니다.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {classKeys.map((classKey) => {
                  const href = classPageMap[classKey];
                  const label = classLabelMap[classKey] ?? classKey;

                  return (
                    <button
                      key={classKey}
                      onClick={() => href && router.push(href)}
                      style={{
                        backgroundColor: '#111827',
                        padding: '20px 22px',
                        borderRadius: '16px',
                        color: 'white',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 700,
                          marginBottom: '8px',
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          color: 'rgba(255,255,255,0.88)',
                          fontSize: '15px',
                          lineHeight: 1.7,
                        }}
                      >
                        이 반의 전체공지, 하루치 수업 카드, 음원, 수업영상, 기타자료를 확인합니다.
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}