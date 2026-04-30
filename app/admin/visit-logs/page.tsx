'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLoggedInAdmin } from '../adminGuard';
import AdminShell from '../AdminShell';
import { studentAccounts } from '../../student/data/studentAccounts';

type VisitLog = {
  id: string;
  studentId: string;
  name: string;
  classKey: string;
  monthKey: string;
  pageKey: string;
  pageTitle: string;
  visitedAt: string;
};

type StudentAccount = {
  id: string;
  name: string;
  username: string;
  password: string;
  classKey: string;
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
};

type SummaryRow = StudentAccount & {
  visitCount: number;
  latestVisitedAt: string | null;
  latestPageTitle: string | null;
  hasHomeVisit: boolean;
  hasClassVisit: boolean;
};

const classLabelMap: Record<string, string> = {
  '600-monwed': '600 월수반',
  '600-tuthu': '600 화목반',
  '800-monwed': '800 월수반',
  '800-tuthu': '800 화목반',
};

function formatDate(value: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function AdminVisitLogsPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const [logs, setLogs] = useState<VisitLog[]>([]);
  const [message, setMessage] = useState('불러오는 중...');
  const [selectedClassKey, setSelectedClassKey] = useState('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState('all');

  useEffect(() => {
    const admin = getLoggedInAdmin();

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    setIsChecking(false);
  }, [router]);

  useEffect(() => {
    if (isChecking) return;

    async function fetchLogs() {
      try {
        const response = await fetch('/api/get-student-visit-logs');
        const result = await response.json();

        if (result.success) {
          setLogs(result.logs ?? []);
          setMessage('');
        } else {
          setMessage(result.message ?? '열람 로그를 불러오지 못했습니다.');
        }
      } catch (error) {
        console.error(error);
        setMessage('열람 로그를 불러오는 중 오류가 발생했습니다.');
      }
    }

    fetchLogs();
  }, [isChecking]);

  const allSummaryRows = useMemo<SummaryRow[]>(() => {
    return (studentAccounts as StudentAccount[]).map((student) => {
      const studentLogs = logs.filter((log) => log.studentId === student.id);

      const latestLog =
        studentLogs.length > 0
          ? [...studentLogs].sort(
              (a, b) =>
                new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()
            )[0]
          : null;

      const hasHomeVisit = studentLogs.some(
        (log) => log.pageKey === 'student-home'
      );

      const hasClassVisit = studentLogs.some(
        (log) => log.pageKey === `class-${student.classKey}`
      );

      return {
        ...student,
        visitCount: studentLogs.length,
        latestVisitedAt: latestLog?.visitedAt ?? null,
        latestPageTitle: latestLog?.pageTitle ?? null,
        hasHomeVisit,
        hasClassVisit,
      };
    });
  }, [logs]);

  const filteredSummaryRows = useMemo(() => {
    return allSummaryRows.filter((row) => {
      const classMatched =
        selectedClassKey === 'all' || row.classKey === selectedClassKey;
      const monthMatched =
        selectedMonthKey === 'all' || row.monthKey === selectedMonthKey;

      return classMatched && monthMatched;
    });
  }, [allSummaryRows, selectedClassKey, selectedMonthKey]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const classMatched =
        selectedClassKey === 'all' || log.classKey === selectedClassKey;
      const monthMatched =
        selectedMonthKey === 'all' || log.monthKey === selectedMonthKey;

      return classMatched && monthMatched;
    });
  }, [logs, selectedClassKey, selectedMonthKey]);

  const noVisitStudents = filteredSummaryRows.filter((row) => row.visitCount === 0);

  const noClassVisitStudents = filteredSummaryRows.filter(
    (row) => row.visitCount > 0 && !row.hasClassVisit
  );

  const staleStudents = filteredSummaryRows.filter((row) => {
    if (!row.latestVisitedAt) return false;

    const latestTime = new Date(row.latestVisitedAt).getTime();
    const nowTime = Date.now();
    const diffDays = (nowTime - latestTime) / (1000 * 60 * 60 * 24);

    return diffDays >= 3;
  });

  const classOptions = Array.from(
    new Set((studentAccounts as StudentAccount[]).map((student) => student.classKey))
  );

  const monthOptions = Array.from(
    new Set((studentAccounts as StudentAccount[]).map((student) => student.monthKey))
  );

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

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#111827',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 800,
    color: '#111827',
  };

  const helperStyle: React.CSSProperties = {
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.55,
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

  function renderSummaryCard(row: SummaryRow) {
    return (
      <div key={row.id} style={cardStyle}>
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
              {row.name}
            </div>
            <div style={helperStyle}>아이디: {row.username}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={tagStyle}>{classLabelMap[row.classKey] ?? row.classKey}</span>
            <span style={tagStyle}>{row.monthKey}</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '150px minmax(0, 1fr)',
            gap: '10px 16px',
            alignItems: 'start',
            marginBottom: '14px',
          }}
        >
          <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
            총 열람 수
          </div>
          <div style={{ color: '#111827', fontSize: '14px' }}>{row.visitCount}</div>

          <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
            마지막 열람 페이지
          </div>
          <div style={{ color: '#111827', fontSize: '14px' }}>
            {row.latestPageTitle ?? '아직 없음'}
          </div>

          <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
            마지막 열람 시각
          </div>
          <div style={{ color: '#111827', fontSize: '14px' }}>
            {row.latestVisitedAt ? formatDate(row.latestVisitedAt) : '아직 없음'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              ...tagStyle,
              backgroundColor: row.hasHomeVisit ? '#ecfdf5' : '#fef2f2',
              border: row.hasHomeVisit ? '1px solid #bbf7d0' : '1px solid #fecaca',
              color: row.hasHomeVisit ? '#166534' : '#991b1b',
            }}
          >
            학생 첫 화면: {row.hasHomeVisit ? '열람함' : '미열람'}
          </span>

          <span
            style={{
              ...tagStyle,
              backgroundColor: row.hasClassVisit ? '#eff6ff' : '#fff7ed',
              border: row.hasClassVisit ? '1px solid #bfdbfe' : '1px solid #fed7aa',
              color: row.hasClassVisit ? '#1d4ed8' : '#9a3412',
            }}
          >
            자기 반 페이지: {row.hasClassVisit ? '열람함' : '미열람'}
          </span>

          <span
            style={{
              ...tagStyle,
              backgroundColor: row.isActive ? '#f0fdf4' : '#f8fafc',
              border: row.isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              color: row.isActive ? '#166534' : '#64748b',
            }}
          >
            계정 상태: {row.isActive ? '활성' : '비활성'}
          </span>
        </div>
      </div>
    );
  }

  function renderEmptyBox(text: string, tone: 'green' | 'blue') {
    return (
      <div
        style={{
          borderRadius: '16px',
          padding: '16px 18px',
          backgroundColor: tone === 'green' ? '#f0fdf4' : '#eff6ff',
          border: tone === 'green' ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
          color: tone === 'green' ? '#166534' : '#1d4ed8',
          fontSize: '14px',
          fontWeight: 700,
        }}
      >
        {text}
      </div>
    );
  }

  if (isChecking) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
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
      title="학생 열람 로그"
      description="학생별 마지막 접속과 반 페이지 열람 여부를 확인합니다."
    >
      <div style={pageWrapStyle}>
        <section style={panelStyle}>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={helperStyle}>
              필터를 사용해 반별/월별 열람 상태를 빠르게 확인하세요.
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={selectedClassKey}
                onChange={(e) => setSelectedClassKey(e.target.value)}
                style={inputStyle}
              >
                <option value="all">전체 반</option>
                {classOptions.map((classKey) => (
                  <option key={classKey} value={classKey}>
                    {classLabelMap[classKey] ?? classKey}
                  </option>
                ))}
              </select>

              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                style={inputStyle}
              >
                <option value="all">전체 월</option>
                {monthOptions.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {monthKey}
                  </option>
                ))}
              </select>
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
            <div style={sectionTitleStyle}>아직 한 번도 접속하지 않은 학생</div>
            <div style={helperStyle}>현재 {noVisitStudents.length}명</div>
          </div>

          <div style={{ ...helperStyle, marginBottom: '14px' }}>
            필터 조건 안에서 아직 1회도 접속 기록이 없는 학생입니다.
          </div>

          {noVisitStudents.length === 0 ? (
            renderEmptyBox('조건에 해당하는 학생은 모두 최소 1회 이상 접속했습니다.', 'green')
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {noVisitStudents.map((row) => renderSummaryCard(row))}
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
            <div style={sectionTitleStyle}>학생 첫 화면만 보고 자기 반 페이지는 아직 안 본 학생</div>
            <div style={helperStyle}>현재 {noClassVisitStudents.length}명</div>
          </div>

          <div style={{ ...helperStyle, marginBottom: '14px' }}>
            첫 화면 열람은 했지만 자기 반 페이지까지는 아직 들어가지 않은 학생입니다.
          </div>

          {noClassVisitStudents.length === 0 ? (
            renderEmptyBox('조건에 해당하는 학생들은 모두 자기 반 페이지도 열람했습니다.', 'blue')
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {noClassVisitStudents.map((row) => renderSummaryCard(row))}
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
            <div style={sectionTitleStyle}>최근 접속이 오래된 학생 (3일 이상)</div>
            <div style={helperStyle}>현재 {staleStudents.length}명</div>
          </div>

          <div style={{ ...helperStyle, marginBottom: '14px' }}>
            마지막 접속 시각이 최근 3일 이상 지난 학생 목록입니다.
          </div>

          {staleStudents.length === 0 ? (
            renderEmptyBox('최근 3일 이상 접속이 끊긴 학생이 없습니다.', 'green')
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {staleStudents.map((row) => renderSummaryCard(row))}
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
            <div style={sectionTitleStyle}>학생별 전체 요약</div>
            <div style={helperStyle}>현재 {filteredSummaryRows.length}명</div>
          </div>

          <div style={{ ...helperStyle, marginBottom: '14px' }}>
            필터 조건에 해당하는 전체 학생의 열람 상태 요약입니다.
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {filteredSummaryRows.map((row) => renderSummaryCard(row))}
          </div>
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
            <div style={sectionTitleStyle}>전체 로그 원본</div>
            <div style={helperStyle}>현재 {filteredLogs.length}건</div>
          </div>

          <div style={{ ...helperStyle, marginBottom: '14px' }}>
            실제 학생 페이지 열람 기록 원본입니다.
          </div>

          {filteredLogs.length === 0 ? (
            <div style={helperStyle}>표시할 로그가 없습니다.</div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {filteredLogs.map((log) => (
                <div key={log.id} style={cardStyle}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      marginBottom: '12px',
                      paddingBottom: '10px',
                      borderBottom: '1px solid #eceff3',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: 800,
                        color: '#111827',
                      }}
                    >
                      {log.name}
                    </div>

                    <span style={tagStyle}>
                      {classLabelMap[log.classKey] ?? log.classKey}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px minmax(0, 1fr)',
                      gap: '10px 16px',
                      alignItems: 'start',
                    }}
                  >
                    <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                      학생 ID
                    </div>
                    <div style={{ color: '#111827', fontSize: '14px' }}>{log.studentId}</div>

                    <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                      월
                    </div>
                    <div style={{ color: '#111827', fontSize: '14px' }}>{log.monthKey}</div>

                    <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                      페이지
                    </div>
                    <div style={{ color: '#111827', fontSize: '14px' }}>
                      {log.pageTitle} ({log.pageKey})
                    </div>

                    <div style={{ color: '#64748b', fontWeight: 800, fontSize: '13px' }}>
                      열람 시각
                    </div>
                    <div style={{ color: '#111827', fontSize: '14px' }}>
                      {formatDate(log.visitedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}