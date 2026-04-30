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

    const noticeLines = toLines(body.noticeText);
    const extraNotices = toLines(body.extraNoticesText);
    const classVideos = toLines(body.classVideosText);
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
      'class800TueThu.ts'
    );

    const fileContent = `export const class800TueThuData = {
  monthLabel: '4월 수강생',
  cards: [
    {
      day: ${JSON.stringify(day)},
      date: ${JSON.stringify(date)},
      noticeLines: ${JSON.stringify(noticeLines, null, 2)},
      extraNotices: ${JSON.stringify(extraNotices, null, 2)},
      classVideos: ${JSON.stringify(classVideos, null, 2)},
      homeworkAudios: ${JSON.stringify(homeworkAudios, null, 2)},
      memorizationAudios: ${JSON.stringify(memorizationAudios, null, 2)},
    },
    {
      day: 'Day 2',
      date: '4월 7일',
      noticeLines: [
        '1. 오늘 배운 표현을 다시 확인하세요.',
        '2. 다음 시간 풀어올 음원을 본인 속도에 맞춰 반복하세요.',
        '3. 문장암기 과제음원도 최소 2회 들어보세요.',
      ],
      extraNotices: [
        '화목반 추가 공지: 과제는 다음 수업 전까지 꼭 완료해주세요.',
      ],
      classVideos: ['260407_800'],
      homeworkAudios: [
        'B2_Day3_2.mp3',
        'B2_Day3_2_1.1x.mp3',
        'B2_Day3_2_1.15x.mp3',
        'B2_Day3_4.mp3',
        'B2_Day3_4_1.1x.mp3',
        'B2_Day3_4_1.15x.mp3',
      ],
      memorizationAudios: ['B2 Day 2.mp3'],
    },
  ],
};
`;

    await writeFile(filePath, fileContent, 'utf-8');

    return Response.json({
      success: true,
      message: '800 화목반 첫 번째 Day 카드가 저장되었습니다.',
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { success: false, message: '저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}