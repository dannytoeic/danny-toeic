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
      'class800MonWed.ts'
    );

    const fileContent = `export const class800MonWedData = {
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
      day: 'Day 3',
      date: '4월 8일',
      noticeLines: [
        '1. 다음 시간 풀어올 과제 리스닝 음원입니다.',
        '2. 문장암기 과제음원도 반복해주세요.',
        '3. 관리반 참여 학생은 오후 6시 40분까지 입실해주세요.',
      ],
      extraNotices: [
        '600반 관리반 참여 안내',
      ],
      classVideos: ['260408_800'],
      homeworkAudios: [
        'LC2-2_4.mp3',
        'LC2-2_4_1.1x.mp3',
        'LC2-2_4_1.15x.mp3',
        'LCC 1_2.mp3',
        'LCC 1_2_1.1x.mp3',
        'LCC 1_2_1.15x.mp3',
      ],
      memorizationAudios: ['A2 Day 3.mp3'],
    },
  ],
};
`;

    await writeFile(filePath, fileContent, 'utf-8');

    return Response.json({
      success: true,
      message: '800 월수반 첫 번째 Day 카드가 저장되었습니다.',
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { success: false, message: '저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}