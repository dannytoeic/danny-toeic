'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLoggedInAdmin } from '../adminGuard';
import AdminShell from '../AdminShell';

const checklist = [
  '학생 로그인 정상 동작 확인',
  '관리자 로그인 정상 동작 확인',
  '관리자 보호 페이지 접근 제한 확인',
  '전체공지 저장 기능 확인',
  '한달일정 저장 기능 확인',
  '시간표 저장 기능 확인',
  '학생 계정 추가/삭제/수정 확인',
  '비밀번호 초기화 기능 확인',
  '학생 비밀번호 변경 기능 확인',
  '회원가입 신청/승인/거절 확인',
  '학생 열람 로그 기록 확인',
  '학생 반별 페이지 접근 제한 확인',
  '이미지 경로 및 표시 확인',
  '로컬스토리지 로그인/로그아웃 흐름 확인',
  '배포 전 관리자 비밀번호 변경 계획 세우기',
];

export default function AdminDeployCheckPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const admin = getLoggedInAdmin();

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    window.setTimeout(() => setIsChecking(false), 0);
  }, [router]);

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
      title="배포 전 점검 체크리스트"
      description="인터넷에 올리기 전에 확인할 항목들입니다."
    >
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '24px',
          maxWidth: '980px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: '12px',
          }}
        >
          {checklist.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <span
                style={{
                  minWidth: '28px',
                  height: '28px',
                  borderRadius: '999px',
                  backgroundColor: '#111827',
                  color: 'white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {index + 1}
              </span>

              <span style={{ fontSize: '15px', color: '#334155' }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
