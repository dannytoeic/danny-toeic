'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '../AdminShell';
import { getLoggedInAdmin } from '../adminGuard';
import VocaUploadPreview from '@/components/voca/VocaUploadPreview';

export default function DannyVocaAdminPage() {
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
        관리자 상태 확인 중...
      </main>
    );
  }

  return (
    <AdminShell
      title="Danny Voca 관리"
      description="Word 단어시험지를 업로드하고 단어형, 표현형, 정리형 카드로 변환합니다. 현재는 브라우저 시제품 저장 방식입니다."
    >
      <VocaUploadPreview />
    </AdminShell>
  );
}
