import { writeFile } from 'fs/promises';
import path from 'path';

function toLines(value: unknown) {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const day = String(body.day ?? '').trim();
    const date = String(body.date ?? '').trim();
    const summary = String(body.summary ?? '').trim();

    const noticeLines = toLines(body.noticeText);
    const extraNotices = toLines(body.extraNoticesText);
    const classVideos = toLines(body.classVideosText);
    const explanationVideos = toLines(body.explanationVideosText);
    const classAudios = toLines(body.classAudiosText);
    const homeworkAudios = toLines(body.homeworkAudiosText);
    const memorizationAudios = toLines(body.memorizationAudiosText);

    if (!day || !date) {
      return Response.json(
        { success: false, message: 'Day 제목 또는 날짜가 비어 있습니다.' },
        { status: 400 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      'app',
      'student',
      'data',
      'class600TueThu.ts'
    );

    const fileContent = `export const class600TueThuData = {
  monthLabel: '4월 수강생',
  cards: [
    {
      day: ${JSON.stringify(day)},
      date: ${JSON.stringify(date)},
      summary: ${JSON.stringify(summary)},
      noticeLines: ${JSON.stringify(noticeLines, null, 2)},
      extraNotices: ${JSON.stringify(extraNotices, null, 2)},
      classVideos: ${JSON.stringify(classVideos, null, 2)},
      explanationVideos: ${JSON.stringify(explanationVideos, null, 2)},
      classAudios: ${JSON.stringify(classAudios, null, 2)},
      homeworkAudios: ${JSON.stringify(homeworkAudios, null, 2)},
      memorizationAudios: ${JSON.stringify(memorizationAudios, null, 2)},
    },
    {
      day: 'Day 3',
      date: '4월 10일',
      summary: 'RC 문장구조 + LC Part 2 + 실전 Day 3',
      noticeLines: [
        '1. 오늘 배운 문장구조 포인트를 다시 읽으세요.',
        '2. LC Part 2 표현은 음원과 함께 반복하세요.',
        '3. 실전 Day 3 해설영상으로 복습하세요.',
        '4. 문장암기 음원은 최소 2회 반복하세요.',
      ],
      extraNotices: [
        '보충공지: 오답노트는 다음 수업 전까지 작성하세요.',
        '관리반 공지: 오늘 관리반은 20분 진행됩니다.',
      ],
      classVideos: ['260410_600 RC', '260410_600 LC'],
      explanationVideos: ['실전 Day 3 해설영상', 'Danny쌤의 토익뽀개기!!'],
      classAudios: ['[P2]실전연습_how.mp3', '[P3]_03.mp3'],
      homeworkAudios: ['A2 Day 3.mp3', 'B2 Day 3.mp3'],
      memorizationAudios: [
        'A2 Day 3_0.9x.mp3',
        'A2 Day 3_0.85x.mp3',
        'A2 Day 3_1.1x.mp3',
        'A2 Day 3_1.15x.mp3',
      ],
    },
  ],
};
`;

    await writeFile(filePath, fileContent, 'utf-8');

    return Response.json({
      success: true,
      message: '600 화목반 첫 번째 Day 카드가 저장되었습니다.',
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { success: false, message: '저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}