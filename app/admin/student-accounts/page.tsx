'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '../AdminShell';
import { getLoggedInAdmin } from '../adminGuard';

type StudentAccountItem = {
  studentId: string;
  id: string;
  username?: string;
  name: string;
  password: string;
  classKey?: string;
  classKeys?: string[];
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
  createdAt?: string;
};

const CLASS_OPTIONS = [
  { key: '', label: '전체 반' },
  { key: '600-monwed', label: '600 월수반' },
  { key: '600-tuthu', label: '600 화목반' },
  { key: '800-monwed', label: '800 월수반' },
  { key: '800-tuthu', label: '800 화목반' },
];

const classLabelMap: Record<string, string> = {
  '600-monwed': '600 월수반',
  '600-tuthu': '600 화목반',
  '800-monwed': '800 월수반',
  '800-tuthu': '800 화목반',
};

function normalizeClassKeys(item: StudentAccountItem): string[] {
  if (Array.isArray(item.classKeys) && item.classKeys.length > 0) {
    return item.classKeys.filter(Boolean);
  }

  if (item.classKey) {
    return [item.classKey];
  }

  return [];
}

function getClassLabels(item: StudentAccountItem): string[] {
  return normalizeClassKeys(item).map((key) => classLabelMap[key] ?? key);
}

function createEmptyStudent(nextIndex: number): StudentAccountItem {
  return {
    studentId: `stu${String(nextIndex).padStart(3, '0')}`,
    id: '',
    username: '',
    name: '',
    password: '',
    classKey: '',
    classKeys: [],
    monthKey: '',
    expiresAt: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

function stableRowKey(item: StudentAccountItem, index: number) {
  return [
    item.studentId || 'no-studentId',
    item.id || 'no-id',
    item.createdAt || 'no-createdAt',
    index,
  ].join('__');
}

export default function StudentAccountsAdminPage() {
  const router = useRouter();

  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [items, setItems] = useState<StudentAccountItem[]>([]);
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

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
      const response = await fetch('/api/save-student-accounts', {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '학생 계정을 불러오지 못했습니다.');
        setItems([]);
        return;
      }

      const nextItems = Array.isArray(result.items) ? result.items : [];
      setItems(nextItems);
    } catch (error) {
      console.error(error);
      setMessage('학생 계정을 불러오는 중 오류가 발생했습니다.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isChecking) return;
    loadItems();
  }, [isChecking]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const query = search.trim().toLowerCase();
      const labels = getClassLabels(item);

      const matchesSearch =
        !query ||
        (item.name || '').toLowerCase().includes(query) ||
        (item.id || '').toLowerCase().includes(query) ||
        (item.studentId || '').toLowerCase().includes(query) ||
        (item.monthKey || '').toLowerCase().includes(query) ||
        labels.some((label) => label.toLowerCase().includes(query));

      const classKeys = normalizeClassKeys(item);
      const matchesClass = !classFilter || classKeys.includes(classFilter);

      const matchesMonth = !monthFilter || item.monthKey === monthFilter;

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? item.isActive
          : !item.isActive;

      return matchesSearch && matchesClass && matchesMonth && matchesStatus;
    });
  }, [items, search, classFilter, monthFilter, statusFilter]);

  function updateItem(index: number, patch: Partial<StudentAccountItem>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const next = { ...item, ...patch };

        if (patch.classKey !== undefined) {
          next.classKeys = patch.classKey ? [patch.classKey] : [];
        }

        if (patch.classKeys !== undefined) {
          next.classKey = patch.classKeys[0] || '';
        }

        return next;
      })
    );
  }

  function handleAddStudent() {
    setItems((prev) => [...prev, createEmptyStudent(prev.length + 1)]);
    setMessage('');
  }

  function handleDeleteStudent(index: number) {
    const ok = window.confirm('이 학생 계정을 삭제하시겠습니까?');
    if (!ok) return;

    setItems((prev) => prev.filter((_, i) => i !== index));
    setMessage('');
  }

  function handleResetPassword(index: number) {
    const ok = window.confirm('이 학생 계정의 비밀번호를 1234로 초기화하시겠습니까?');
    if (!ok) return;

    updateItem(index, { password: '1234' });
    setMessage('비밀번호가 1234로 초기화되었습니다. 저장하기를 눌러 반영해 주세요.');
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage('');

    try {
      const normalized = items.map((item, index) => {
        const classKeys = normalizeClassKeys(item);

        return {
          ...item,
          studentId:
            item.studentId?.trim() || `stu${String(index + 1).padStart(3, '0')}`,
          id: item.id?.trim() || item.username?.trim() || '',
          username: item.username?.trim() || item.id?.trim() || '',
          name: item.name?.trim() || '',
          password: item.password?.trim() || '',
          classKey: classKeys[0] || '',
          classKeys,
          monthKey: item.monthKey?.trim() || '',
          expiresAt: item.expiresAt?.trim() || '',
          isActive: Boolean(item.isActive),
          createdAt: item.createdAt?.trim() || new Date().toISOString(),
        };
      });

      const response = await fetch('/api/save-student-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: normalized }),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '학생 계정 저장에 실패했습니다.');
        return;
      }

      setItems(Array.isArray(result.items) ? result.items : normalized);
      setMessage('학생 계정이 저장되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('학생 계정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  const months = Array.from(
    new Set(items.map((item) => item.monthKey).filter(Boolean))
  ).sort();

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    boxSizing: 'border-box',
    color: '#111827',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    marginBottom: '6px',
    fontWeight: 800,
    color: '#111827',
    fontSize: '13px',
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
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    backgroundColor: '#ffffff',
    color: '#991b1b',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
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
        학생 계정 불러오는 중...
      </main>
    );
  }

  return (
    <AdminShell
      title="학생 계정 관리"
      description="학생 계정의 반, 월, 만료일, 활성 상태를 확인하고 수정합니다."
    >
      <div style={pageWrapStyle}>
        <section style={panelStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
              gap: '12px',
              marginBottom: '14px',
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 아이디, 학생ID, 반, 월 검색"
              style={inputStyle}
            />

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={inputStyle}
            >
              {CLASS_OPTIONS.map((option) => (
                <option key={option.key || 'all'} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">전체 월</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              }
              style={inputStyle}
            >
              <option value="all">전체 상태</option>
              <option value="active">활성만</option>
              <option value="inactive">비활성만</option>
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={helperStyle}>
              총 {items.length}명 / 현재 필터 결과 {filteredItems.length}명
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={handleAddStudent} style={normalButtonStyle}>
                학생 추가
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{ ...primaryButtonStyle, opacity: isSaving ? 0.72 : 1 }}
              >
                {isSaving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </section>

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

        {filteredItems.length === 0 ? (
          <section style={panelStyle}>표시할 학생 계정이 없습니다.</section>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {filteredItems.map((item, filteredIndex) => {
              const realIndex = items.findIndex(
                (source, sourceIndex) =>
                  stableRowKey(source, sourceIndex) === stableRowKey(item, filteredIndex)
              );

              const classLabels = getClassLabels(item);
              const isExpired =
                !!item.expiresAt &&
                new Date(item.expiresAt).getTime() < new Date().setHours(0, 0, 0, 0);

              return (
                <section key={stableRowKey(item, filteredIndex)} style={panelStyle}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #eceff3',
                    }}
                  >
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          color: '#111827',
                        }}
                      >
                        {item.name || '(이름 없음)'}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {classLabels.length > 0 ? (
                          classLabels.map((label, idx) => (
                            <span
                              key={`${stableRowKey(item, filteredIndex)}__class__${idx}`}
                              style={tagStyle}
                            >
                              {label}
                            </span>
                          ))
                        ) : (
                          <span style={{ ...tagStyle, color: '#94a3b8' }}>반 정보 없음</span>
                        )}

                        <span
                          style={{
                            ...tagStyle,
                            backgroundColor: item.isActive ? '#f0fdf4' : '#f8fafc',
                            border: item.isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            color: item.isActive ? '#166534' : '#64748b',
                          }}
                        >
                          {item.isActive ? '활성' : '비활성'}
                        </span>

                        {isExpired ? (
                          <span
                            style={{
                              ...tagStyle,
                              backgroundColor: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#991b1b',
                            }}
                          >
                            만료됨
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => realIndex >= 0 && handleResetPassword(realIndex)}
                        style={normalButtonStyle}
                      >
                        비밀번호 초기화
                      </button>

                      <button
                        onClick={() => realIndex >= 0 && handleDeleteStudent(realIndex)}
                        style={dangerButtonStyle}
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '14px 16px',
                    }}
                  >
                    <div>
                      <div style={labelStyle}>학생 이름</div>
                      <input
                        value={item.name}
                        onChange={(e) =>
                          realIndex >= 0 && updateItem(realIndex, { name: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div style={labelStyle}>아이디</div>
                      <input
                        value={item.id}
                        onChange={(e) =>
                          realIndex >= 0 &&
                          updateItem(realIndex, {
                            id: e.target.value,
                            username: e.target.value,
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div style={labelStyle}>비밀번호</div>
                      <input
                        value={item.password}
                        onChange={(e) =>
                          realIndex >= 0 && updateItem(realIndex, { password: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div style={labelStyle}>대표 반</div>
                      <select
                        value={item.classKey || ''}
                        onChange={(e) =>
                          realIndex >= 0 &&
                          updateItem(realIndex, {
                            classKey: e.target.value,
                            classKeys: e.target.value ? [e.target.value] : [],
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="">반 선택</option>
                        {CLASS_OPTIONS.slice(1).map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={labelStyle}>월</div>
                      <input
                        value={item.monthKey}
                        onChange={(e) =>
                          realIndex >= 0 && updateItem(realIndex, { monthKey: e.target.value })
                        }
                        placeholder="예: 2026-05"
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div style={labelStyle}>만료일</div>
                      <input
                        type="date"
                        value={item.expiresAt ? item.expiresAt.slice(0, 10) : ''}
                        onChange={(e) =>
                          realIndex >= 0 &&
                          updateItem(realIndex, {
                            expiresAt: e.target.value,
                          })
                        }
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <div style={labelStyle}>활성 여부</div>
                      <select
                        value={item.isActive ? 'active' : 'inactive'}
                        onChange={(e) =>
                          realIndex >= 0 &&
                          updateItem(realIndex, {
                            isActive: e.target.value === 'active',
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="active">활성</option>
                        <option value="inactive">비활성</option>
                      </select>
                    </div>

                    <div>
                      <div style={labelStyle}>학생 ID</div>
                      <input
                        value={item.studentId}
                        onChange={(e) =>
                          realIndex >= 0 && updateItem(realIndex, { studentId: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}