import mammoth from 'mammoth';
import type { VocaCourse, VocaDay, VocaItem, VocaSet, VocaTrack, VocaVersion } from './types';

const PAREN_GROUP_PATTERN = /\(([^()]*)\)/g;
const TERM_WITH_PARENS_PATTERN = /^(.+?)\s*((?:\([^()]+\)\s*)+)$/;
const STRICT_POS_TOKENS = ['명', '동', '형', '부', '전', '접'];

function makeId(prefix: string, index: number) {
  return `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeLines(rawText: string) {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isLikelyPos(value: string) {
  const compact = value.replace(/\s/g, '');
  const posTokens = [
    '명',
    '형',
    '동',
    '부',
    '전',
    '접',
    '대',
    '감',
    '관',
    'n',
    'v',
    'adj',
    'adv',
    'prep',
    'conj',
  ];

  return posTokens.some((token) => compact.toLowerCase().includes(token));
}

function hasStrictPos(value: string) {
  const compact = value.replace(/\s/g, '');
  return STRICT_POS_TOKENS.some((token) => compact.includes(token));
}

function countEnglishWords(term: string) {
  const words = term.match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g) ?? [];
  return words.length;
}

function isDocumentHeader(line: string) {
  const normalized = line.replace(/\s+/g, ' ').trim();

  return (
    /^(?:[A-Z]\s+)?Day[_\s-]*\d+$/i.test(normalized) ||
    /^(?:[A-Z]\s+)?Day[_\s-]*\d+\s+\d+\s+[A-Z]\s*-\s*\d+$/i.test(normalized) ||
    /^\d+\s+[A-Z]\s*-\s*\d+$/i.test(normalized)
  );
}

function getParenGroups(value: string) {
  return Array.from(value.matchAll(PAREN_GROUP_PATTERN), (match) => match[1].trim()).filter(
    Boolean
  );
}

function isLikelyEnglishTerm(term: string) {
  const trimmed = term.trim();
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/^[\d(*]/.test(trimmed)) return false;
  if (/^[\d\s.[\]()[\]{}:;,\-]+$/.test(trimmed)) return false;
  if (/^\d+[.)]/.test(trimmed)) return false;
  return true;
}

function createTermItem(line: string, index: number): VocaItem | null {
  const match = line.match(TERM_WITH_PARENS_PATTERN);
  if (!match) return null;

  const term = match[1].trim();
  const parenGroups = getParenGroups(match[2]);

  if (!term || !isLikelyEnglishTerm(term) || parenGroups.length === 0) return null;

  const firstParen = parenGroups[0];
  const pos = firstParen && (hasStrictPos(firstParen) || isLikelyPos(firstParen))
    ? firstParen
    : undefined;
  const meaningGroups = pos ? parenGroups.slice(1) : parenGroups;
  const meaning = meaningGroups.join(' / ');

  if (!meaning) return null;

  const type = countEnglishWords(term) <= 1 ? 'word' : 'phrase';

  return {
    id: makeId(type, index),
    type,
    term,
    pos,
    meaning,
    rawText: line,
    speakable: true,
  };
}

function createBareNoteTermItem(line: string, noteTitle: string, index: number): VocaItem | null {
  const term = line.trim();
  const cleanTitle = noteTitle.replace(/^\*\s*/, '').trim();

  if (!cleanTitle.includes('상당')) return null;
  if (!/^[A-Za-z][A-Za-z-']*$/.test(term)) return null;

  return {
    id: makeId('word', index),
    type: 'word',
    term,
    meaning: cleanTitle,
    rawText: line,
    speakable: true,
  };
}

function isNoteExampleLine(noteTitle: string, termItem: VocaItem) {
  const titleWords =
    noteTitle
      .replace(/^\*\s*/, '')
      .match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g)
      ?.map((word) => word.toLowerCase()) ?? [];

  if (titleWords.length === 0 || !termItem.term) return false;

  const termWords =
    termItem.term
      .match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g)
      ?.map((word) => word.toLowerCase()) ?? [];

  return titleWords.some((word) => word.length >= 3 && termWords.includes(word));
}

function createNoteItem(titleLine: string, bodyLines: string[], index: number): VocaItem {
  const title = titleLine.replace(/^\*\s*/, '').trim() || '정리';
  const rawLines = [titleLine, ...bodyLines];

  return {
    id: makeId('note', index),
    type: 'note',
    title,
    lines: bodyLines,
    rawText: rawLines.join('\n'),
    speakable: false,
  };
}

export function parseRawVocaText(rawText: string): VocaItem[] {
  const lines = normalizeLines(rawText);
  const items: VocaItem[] = [];

  let noteTitle = '';
  let noteLines: string[] = [];

  function flushNote() {
    if (!noteTitle) return;
    items.push(createNoteItem(noteTitle, noteLines, items.length + 1));
    noteTitle = '';
    noteLines = [];
  }

  for (const line of lines) {
    if (isDocumentHeader(line)) {
      continue;
    }

    if (line.startsWith('*')) {
      flushNote();
      noteTitle = line;
      continue;
    }

    if (noteTitle) {
      const termItem = createTermItem(line, items.length + 1);
      if (termItem && !isNoteExampleLine(noteTitle, termItem)) {
        items.push(termItem);
        continue;
      }

      const bareTermItem = createBareNoteTermItem(line, noteTitle, items.length + 1);
      if (bareTermItem) {
        items.push(bareTermItem);
        continue;
      }

      noteLines.push(line);
      continue;
    }

    const termItem = createTermItem(line, items.length + 1);
    if (termItem) {
      items.push(termItem);
      continue;
    }

    items.push({
      id: makeId('misc', items.length + 1),
      type: 'misc',
      rawText: line,
      speakable: false,
    });
  }

  flushNote();
  return items;
}

export async function extractTextFromDocx(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export function createVocaSetFromRawText(params: {
  rawText: string;
  title?: string;
  course?: VocaCourse;
  track?: VocaTrack;
  book?: string;
  version?: VocaVersion;
  day?: VocaDay;
}): VocaSet {
  const course = params.course ?? '800';
  const track = params.track ?? 'A';
  const version = params.version ?? 'ver.1';
  const day = params.day ?? 'Day 1';
  const displayTitle = `${course}반 ${track} ${version} ${day}`;
  const title = params.title?.trim() || displayTitle;

  return {
    id: `danny-voca-set-${course}-${track}-${version}-${day.replace(/\s+/g, '')}`,
    title,
    displayTitle,
    course,
    track,
    book: params.book?.trim() || 'Word 단어시험지',
    version,
    day,
    items: parseRawVocaText(params.rawText),
  };
}
