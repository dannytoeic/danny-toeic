'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '../AdminShell';
import { getLoggedInAdmin } from '../adminGuard';

type SignupRequestItem = {
  requestId?: string;
  name: string;
  username?: string;
  id?: string;
  password: string;
  classKey?: string;
  classKeys?: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const classLabelMap: Record<string, string> = {
  '600-monwed': '600 월수반',
  '600-tuthu': '600 화목반',
  '800-monwed': '800 월수반',
  '800-tuthu': '800 화목반',
};

function normalizeClassKeys(item: SignupRequestItem): string[] {
  if (Array.isArray(item.classKeys) && item.classKeys.length > 0) {
    return item.classKeys.filter(Boolean);
  }

  if (item.classKey) {
    return [item.classKey];
  }

  return [];
}

function getClassLabels(item: SignupRequestItem): string[] {
  return normalizeClassKeys(item).map((key) => classLabelMap[key] ?? key);
}

function formatDate(value: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function makeRowKey(prefix: string, item: SignupRequestItem, index: number) {
  return [
    prefix,
    item.requestId ?? 'no-request-id',
    item.username ?? item.id ?? 'no-id',
    item.createdAt ?? 'no-createdAt',
    item.status ?? 'no-status',
    index,
  ].join('__');
}

export default function SignupRequestsAdminPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<SignupRequestItem[]>([]);
  const [message, setMessage] = useState('');
  const [workingId, setWorkingId] = useState('');

  useEffect(() => {
    const admin = getLoggedInAdmin();

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    setIsChecking(false);
  }, [router]);

  async function loadItems() {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/get-signup-requests', {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '가입신청 목록을 불러오지 못했습니다.');
        setItems([]);
        return;
      }

      const nextItems = Array.isArray(result.items) ? result.items : [];
      setItems(nextItems);
    } catch (error) {
      console.error(error);
      setMessage('가입신청 목록을 불러오는 중 오류가 발생했습니다.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isChecking) return;
    loadItems();
  }, [isChecking]);

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === 'pending'),
    [items]
  );

  const processedItems = useMemo(
    () => items.filter((item) => item.status !== 'pending'),
    [items]
  );

  async function handleApprove(requestId: string) {
    setWorkingId(requestId);
    setMessage('');

    try {
      const response = await fetch('/api/approve-signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '승인 처리에 실패했습니다.');
        return;
      }

      setMessage('가입 신청이 승인되었습니다.');
      await loadItems();
    } catch (error) {
      console.error(error);
      setMessage('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setWorkingId('');
    }
  }

  async function handleReject(requestId: string) {
    setWorkingId(requestId);
    setMessage('');

    try {
      const response = await fetch('/api/reject-signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '거절 처리에 실패했습니다.');
        return;
      }

      setMessage('가입 신청이 거절되었습니다.');
      await loadItems();
    } catch (error) {
      console.error(error);
      setMessage('거절 처리 중 오류가 발생했습니다.');
    } finally {
      setWorkingId('');
    }
  }

  async function handleDelete(requestId: string) {
    const ok = window.confirm('이 가입신청을 목록에서 삭제하시겠습니까?');
    if (!ok) return;

    setWorkingId(requestId);
    setMessage('');

    try {
      const response = await fetch('/api/delete-signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '삭제 처리에 실패했습니다.');
        return;
      }

      setMessage('가입 신청이 삭제되었습니다.');
      await loadItems();
    } catch (error) {
      console.error(error);
      setMessage('삭제 처리 중 오류가 발생했습니다.');
    } finally {
      setWorkingId('');
    }
  }

  const pageWrapStyle: React.CSSProperties = {
    maxWidth: '1240px',
    display: 'grid',
    gap: '18px',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.04)',
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '16px',
    backgroundColor: '#ffffff',
  };

  const tagStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
  };

  const helperStyle: React.CSSProperties = {
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.55,
  };

  const normalButtonStyle: React.CSSProperties = {
    padding: '10px 13px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#111827',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '13px',
    boxShadow: '0 6px 16px rgba(17, 24, 39, 0.12)',
  };

  const dangerButtonStyle: React.CSSProperties = {
    padding: '10px 13px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    backgroundColor: '#ffffff',
    color: '#991b1b',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
  };

  if (isChecking || isLoading) {
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
        가입신청 목록 불러오는 중...
      </main>
    );
  }

  return (
    <AdminShell
      title="가입신청 관리"
      description="학생 회원가입 신청을 확인하고 승인 또는 거절합니다."
    >
      <div style={pageWrapStyle}>
        {message && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px 14px',
              color: '#475569',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {message}
          </div>
        )}

        <section style={panelStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#111827',
              }}
            >
              승인 대기
            </div>

            <div style={helperStyle}>현재 {pendingItems.length}건</div>
          </div>

          <div style={{ ...helperStyle, marginBottom: '14px' }}>
            신규 신청 계정을 확인하고 승인 또는 거절할 수 있습니다.
          </div>

          {pendingItems.length === 0 ? (
            <div style={helperStyle}>현재 승인 대기 중인 신청이 없습니다.</div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {pendingItems.map((item, index) => {
                const classLabels = getClassLabels(item);
                const rowKey = makeRowKey('pending', item, index);

                return (
                  <div key={rowKey} style={cardStyle}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '12px',
                        alignItems: 'center',
                        marginBottom: '14px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #eceff3',
                      }}
                    >
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <div
                          style={{
                            fontSize: '22px',
                            fontWeight: 800,
                            color: '#111827',
                          }}
                        >
                          {item.name}
                        </div>
                        <div style={helperStyle}>
                          신청일시: {formatDate(item.createdAt)}
                        </div>
                      </div>

                      <div style={tagStyle}>대기중</div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '140px minmax(0, 1fr)',
                        gap: '10px 16px',
                        alignItems: 'start',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                        아이디
                      </div>
                      <div style={{ color: '#111827', fontSize: '14px' }}>
                        {item.username ?? item.id ?? '-'}
                      </div>

                      <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                        신청 반
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {classLabels.length > 0 ? (
                          classLabels.map((label, labelIndex) => (
                            <span
                              key={`${rowKey}__label__${labelIndex}`}
                              style={tagStyle}
                            >
                              {label}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>반 정보 없음</span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        onClick={() => item.requestId && handleDelete(item.requestId)}
                        disabled={workingId === item.requestId || !item.requestId}
                        style={{
                          ...dangerButtonStyle,
                          opacity: workingId === item.requestId || !item.requestId ? 0.65 : 1,
                        }}
                      >
                        삭제
                      </button>

                      <button
                        onClick={() => item.requestId && handleReject(item.requestId)}
                        disabled={workingId === item.requestId || !item.requestId}
                        style={{
                          ...normalButtonStyle,
                          opacity: workingId === item.requestId || !item.requestId ? 0.65 : 1,
                        }}
                      >
                        거절
                      </button>

                      <button
                        onClick={() => item.requestId && handleApprove(item.requestId)}
                        disabled={workingId === item.requestId || !item.requestId}
                        style={{
                          ...primaryButtonStyle,
                          opacity: workingId === item.requestId || !item.requestId ? 0.65 : 1,
                        }}
                      >
                        승인
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#111827',
              }}
            >
              처리 완료
            </div>

            <div style={helperStyle}>현재 {processedItems.length}건</div>
          </div>

          <div style={{ ...helperStyle, marginBottom: '14px' }}>
            이미 승인되었거나 거절된 신청 내역입니다.
          </div>

          {processedItems.length === 0 ? (
            <div style={helperStyle}>아직 처리 완료된 신청이 없습니다.</div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {processedItems.map((item, index) => {
                const classLabels = getClassLabels(item);
                const rowKey = makeRowKey('processed', item, index);

                const statusLabel =
                  item.status === 'approved' ? '승인됨' : '거절됨';

                const statusStyle: React.CSSProperties =
                  item.status === 'approved'
                    ? {
                        ...tagStyle,
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                      }
                    : {
                        ...tagStyle,
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                      };

                return (
                  <div key={rowKey} style={cardStyle}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '12px',
                        alignItems: 'center',
                        marginBottom: '14px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #eceff3',
                      }}
                    >
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <div
                          style={{
                            fontSize: '22px',
                            fontWeight: 800,
                            color: '#111827',
                          }}
                        >
                          {item.name}
                        </div>
                        <div style={helperStyle}>
                          신청일시: {formatDate(item.createdAt)}
                        </div>
                      </div>

                      <div style={statusStyle}>{statusLabel}</div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '140px minmax(0, 1fr)',
                        gap: '10px 16px',
                        alignItems: 'start',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                        아이디
                      </div>
                      <div style={{ color: '#111827', fontSize: '14px' }}>
                        {item.username ?? item.id ?? '-'}
                      </div>

                      <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                        신청 반
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {classLabels.length > 0 ? (
                          classLabels.map((label, labelIndex) => (
                            <span
                              key={`${rowKey}__label__${labelIndex}`}
                              style={tagStyle}
                            >
                              {label}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>반 정보 없음</span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        onClick={() => item.requestId && handleDelete(item.requestId)}
                        disabled={workingId === item.requestId || !item.requestId}
                        style={{
                          ...dangerButtonStyle,
                          opacity: workingId === item.requestId || !item.requestId ? 0.65 : 1,
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}