export type TodayHomeworkTrack = 'A' | 'B';

export type TodayHomeworkCardType =
  | 'preposition'
  | 'meaning'
  | 'part-of-speech'
  | 'method'
  | 'condition'
  | 'general';

export type TodayHomeworkCard = {
  id: string;
  type: TodayHomeworkCardType;
  prompt: string;
  question: string;
  answer: string;
  note: string;
  speakText?: string;
};

export type TodayHomeworkSet = {
  id: string;
  level: '600';
  track: TodayHomeworkTrack;
  dayNumber: number;
  title: string;
  rawText: string;
  cards: TodayHomeworkCard[];
  isActive: boolean;
  updatedAt?: string;
};

const PREPOSITIONS = new Set(['to', 'in', 'of', 'with', 'for', 'on', 'at', 'from', 'about', 'into', 'by', 'as']);

function cardId(index: number) {
  return `today-homework-card-${Date.now()}-${index + 1}`;
}

function englishHead(value: string) {
  if (value.trim().startsWith('-')) return '';
  const match = value.match(/[A-Za-z][A-Za-z'-]{2,}/);
  const word = match?.[0] ?? '';
  return PREPOSITIONS.has(word.toLowerCase()) ? '' : word;
}

function cleanKoreanMeaning(value: string) {
  return value
    .replace(/^의미\s*:\s*/, '')
    .split(/\s*[,;]\s*/)
    .filter(Boolean)
    .join(' / ')
    .trim();
}

function makeCard(
  index: number,
  type: TodayHomeworkCardType,
  prompt: string,
  question: string,
  answer: string,
  note = ''
): TodayHomeworkCard {
  return {
    id: cardId(index),
    type,
    prompt: prompt.trim(),
    question: question.trim(),
    answer: answer.trim(),
    note: note.trim(),
    speakText: englishHead(prompt),
  };
}

export function parseTodayHomeworkText(rawText: string): TodayHomeworkCard[] {
  const lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/^(?:[•·▪◦]|\d+[.)])\s*/, ''));
  const cards: TodayHomeworkCard[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    if (/풀이.*순서|아래 순서로 풀이/.test(line)) {
      const steps: string[] = [];
      for (let next = index + 1; next < lines.length; next += 1) {
        const step = lines[next].replace(/^[-•·\d.)\s]+/, '').trim();
        if (!step) {
          if (steps.length) break;
          continue;
        }
        if (/:\s*\(|\([a-z]+\)/i.test(step)) break;
        steps.push(...step.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean));
        index = next;
        if (steps.length >= 6) break;
      }
      if (steps.length) {
        cards.push(makeCard(cards.length, 'method', '동사자리라면 풀이 순서는?', '', steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join('\n')));
        continue;
      }
    }

    const conditionMatch = line.match(/빈칸\s*뒤에\s*목적어가\s*(있으면|있다면|없으면|없다면)\s*([A-Za-z]+|V(?:ed|ing))/i);
    if (conditionMatch) {
      const hasObject = conditionMatch[1].startsWith('있');
      cards.push(makeCard(cards.length, 'condition', `빈칸이 동사자리가 아니다. 빈칸 뒤에 목적어가 ${hasObject ? '있다' : '없다'}.`, '정답 형태는?', conditionMatch[2]));
      continue;
    }

    const posMatch = line.match(/^(.+?)\s*:\s*\((명사|형용사|부사|동사)\)\s*$/);
    if (posMatch) {
      cards.push(makeCard(cards.length, 'part-of-speech', posMatch[1], '품사는?', posMatch[2]));
      continue;
    }

    const prepositionMatch = line.match(/^([A-Za-z][A-Za-z' -]*?)\s*\((to|in|of|with|for|on|at|from|about|into|by|as)\)\s*(?:의미\s*:\s*)?(.+)$/i);
    if (prepositionMatch) {
      const word = prepositionMatch[1].trim();
      const preposition = prepositionMatch[2].toLowerCase();
      const meaning = cleanKoreanMeaning(prepositionMatch[3]);
      const explicitlyAsksPreposition = /의미\s*:/.test(line);
      cards.push(
        explicitlyAsksPreposition
          ? makeCard(cards.length, 'preposition', word, '전치사는?', preposition, meaning)
          : makeCard(cards.length, 'meaning', `${word} ${preposition}`, '의미는?', meaning)
      );
      continue;
    }

    const meaningMatch = line.match(/^([A-Za-z][A-Za-z' -]*(?:\s+\([^)]+\))?)\s+([~가-힣].+)$/);
    if (meaningMatch) {
      cards.push(makeCard(cards.length, 'meaning', meaningMatch[1].replace(/[()]/g, '').replace(/\s+/g, ' '), '의미는?', cleanKoreanMeaning(meaningMatch[2])));
      continue;
    }

    const colonMatch = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (colonMatch) {
      cards.push(makeCard(cards.length, 'general', colonMatch[1], '정답은?', colonMatch[2]));
    }
  }

  return cards;
}

export function makeTodayHomeworkSetId(track: TodayHomeworkTrack, dayNumber: number) {
  return `today-homework-600-${track}-day${dayNumber}`;
}
