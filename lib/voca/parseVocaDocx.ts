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

function normalizeRawText(rawText: string) {
  return rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function splitVocaGroups(rawText: string) {
  return normalizeRawText(rawText)
    .split(/\n\s*\n+/)
    .map((group) =>
      group
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !isDocumentHeader(line))
        .join('\n')
        .trim()
    )
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
  const isVocaHeader =
    /Day[_\s]?\d+/i.test(normalized) && /실전\s*-\s*\d+(?:\.\d+)?/.test(normalized);

  return (
    isVocaHeader ||
    /^(?:[A-Z]\s+)?Day[_\s-]*\d+$/i.test(normalized) ||
    /^(?:[A-Z]\s+)?Day[_\s-]*\d+\s+\d+\s+[A-Z]\s*-\s*\d+$/i.test(normalized) ||
    /^\d+\s+[A-Z]\s*-\s*\d+$/i.test(normalized) ||
    /^[AB]\s+Day\s*-?\s*\d+$/i.test(normalized) ||
    /^[1-5]형식(?:\/[1-5]형식)?(?:\s*관련퀴즈)?$/i.test(normalized)
  );
}

function getParenGroups(value: string) {
  return Array.from(value.matchAll(PAREN_GROUP_PATTERN), (match) => match[1].trim()).filter(
    Boolean
  );
}

function blankParenAnswers(value: string) {
  const answers: string[] = [];
  const quizText = value.replace(/\(([^)]+)\)/g, (_match, answer: string) => {
    const cleaned = answer.trim();
    if (cleaned) answers.push(cleaned);
    return answer.includes('\n') ? answer.split('\n').map(() => '____').join('\n') : '____';
  });

  return {
    answers,
    quizText,
  };
}

function isLikelyEnglishTerm(term: string) {
  const trimmed = term.trim();
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/^[\d(*]/.test(trimmed)) return false;
  if (/^[\d\s.[\]()[\]{}:;,\-]+$/.test(trimmed)) return false;
  if (/^\d+[.)]/.test(trimmed)) return false;
  return true;
}

function stripNumberPrefix(line: string) {
  return line.replace(/^\s*\d+\s*[.)]\s*/, '').trim();
}

function isEnglishFocused(value: string) {
  const letters = value.match(/[A-Za-z]/g)?.length ?? 0;
  const korean = value.match(/[가-힣]/g)?.length ?? 0;
  return letters > 0 && letters >= korean;
}

function replaceParenAnswers(value: string) {
  const answers = getParenGroups(value);
  const prompt = value.replace(PAREN_GROUP_PATTERN, '____').replace(/\s+/g, ' ').trim();
  const answerText = value.replace(PAREN_GROUP_PATTERN, (_match, answer) => answer).trim();
  return { answers, prompt, answerText };
}

function makeDedupKey(item: VocaItem) {
  if (item.type === 'blank') {
    return `${item.type}|${item.prompt ?? ''}|${item.answer ?? ''}`.toLowerCase();
  }
  if (item.type === 'grammar') {
    return `${item.type}|${item.prompt ?? ''}|${(item.answers ?? []).join('/')}`.toLowerCase();
  }
  if (item.type === 'pattern' || item.type === 'word' || item.type === 'phrase') {
    return `${item.type}|${item.term ?? ''}|${item.meaning ?? ''}`.toLowerCase();
  }
  if (item.type === 'group') {
    return `${item.type}|${item.title ?? ''}|${(item.lines ?? []).join('/')}`.toLowerCase();
  }
  return `${item.type}|${item.rawText}`.toLowerCase();
}

function createBlankItem(line: string, index: number): VocaItem | null {
  const cleaned = stripNumberPrefix(line);
  const match = cleaned.match(/^(.+?)\s*:\s*((?:\([^()]+\)\s*(?:or|\/|,)?\s*)+)$/i);
  if (!match) return null;

  const prompt = match[1].trim();
  const answers = getParenGroups(match[2]);
  if (!prompt || answers.length === 0) return null;

  return {
    id: makeId('blank', index),
    type: 'blank',
    prompt: prompt.endsWith(':') ? prompt : `${prompt} :`,
    answer: answers.join(' / '),
    answers,
    rawText: line,
    speakable: isEnglishFocused(prompt),
  };
}

function createPatternItem(line: string, index: number): VocaItem | null {
  const cleaned = stripNumberPrefix(line);
  const parenGroups = getParenGroups(cleaned);
  if (!cleaned.includes('의미') && parenGroups.length >= 2 && isLikelyPos(parenGroups[0])) {
    return null;
  }

  const meaningMatch =
    cleaned.match(/^(.+?)\s*의미\s*:\s*\(([^()]+)\)\s*$/) ??
    cleaned.match(/^([A-Za-z][A-Za-z\s'/-]+(?:\s+\([^()]+\))?)\s+[^()]*\(([^()]+)\)\s*$/);

  if (!meaningMatch) return null;

  const term = meaningMatch[1].trim();
  const meaning = meaningMatch[2].trim();

  if (!term || !meaning || !/[A-Za-z]/.test(term)) return null;

  return {
    id: makeId('pattern', index),
    type: 'pattern',
    term,
    meaning,
    rawText: line,
    speakable: true,
  };
}

function createGrammarItem(lines: string[], index: number): VocaItem | null {
  const rawText = lines.join('\n');
  const cleaned = stripNumberPrefix(rawText).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const { answers, prompt, answerText } = replaceParenAnswers(cleaned);

  if (answers.length === 0) return null;
  if (/^[A-Za-z\s'/-]+$/.test(cleaned)) return null;

  return {
    id: makeId('grammar', index),
    type: 'grammar',
    prompt,
    answers,
    answerText,
    rawText,
    speakable: false,
  };
}

function isGroupLine(line: string) {
  const cleaned = stripNumberPrefix(line);
  return /^\([^()]+\)(?:\s*\+\s*\([^()]+\))*$/.test(cleaned) ||
    /^\([^()]+\)\s*(?:\+|\/|\s)[A-Za-z가-힣()/+\s,-]+$/.test(cleaned);
}

function cleanGroupLine(line: string) {
  return stripNumberPrefix(line)
    .replace(/\(([^()]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function createGroupItem(titleLine: string, bodyLines: string[], index: number): VocaItem | null {
  if (bodyLines.length === 0) return null;

  const title = stripNumberPrefix(titleLine);
  const lines = bodyLines.map(cleanGroupLine).filter(Boolean);
  if (!title || lines.length === 0) return null;

  return {
    id: makeId('group', index),
    type: 'group',
    title,
    lines,
    rawText: [titleLine, ...bodyLines].join('\n'),
    speakable: false,
  };
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
  const groups = splitVocaGroups(rawText);
  if (groups.length > 0) {
    return groups.map((group, index) => {
      const { answers, quizText } = blankParenAnswers(group);
      const firstLine = group.split('\n')[0] ?? group;
      const speakable = isEnglishFocused(firstLine);

      return {
        id: makeId('vocabGroup', index + 1),
        type: 'group',
        originalText: group,
        quizText,
        answers,
        title: firstLine,
        lines: group.split('\n'),
        rawText: group,
        speakable,
      };
    });
  }

  const lines = normalizeLines(rawText);
  const items: VocaItem[] = [];
  const seen = new Set<string>();

  let noteTitle = '';
  let noteLines: string[] = [];

  function pushItem(item: VocaItem) {
    const key = makeDedupKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  }

  function flushNote() {
    if (!noteTitle) return;
    if (noteLines.length > 0) {
      pushItem(createNoteItem(noteTitle, noteLines, items.length + 1));
    }
    noteTitle = '';
    noteLines = [];
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (isDocumentHeader(line)) {
      continue;
    }

    if (line.startsWith('*')) {
      flushNote();
      noteTitle = line;
      continue;
    }

    if (noteTitle) {
      const patternItem = createPatternItem(line, items.length + 1);
      if (patternItem) {
        pushItem(patternItem);
        continue;
      }

      const blankItem = createBlankItem(line, items.length + 1);
      if (blankItem) {
        pushItem(blankItem);
        continue;
      }

      const termItem = createTermItem(line, items.length + 1);
      if (termItem && !isNoteExampleLine(noteTitle, termItem)) {
        pushItem(termItem);
        continue;
      }

      const bareTermItem = createBareNoteTermItem(line, noteTitle, items.length + 1);
      if (bareTermItem) {
        pushItem(bareTermItem);
        continue;
      }

      const grammarItem = createGrammarItem([line], items.length + 1);
      if (grammarItem && getParenGroups(line).length >= 2) {
        pushItem(grammarItem);
        continue;
      }

      noteLines.push(line);
      continue;
    }

    const groupLines: string[] = [];
    let groupCursor = lineIndex + 1;
    while (groupCursor < lines.length && isGroupLine(lines[groupCursor])) {
      groupLines.push(lines[groupCursor]);
      groupCursor += 1;
    }
    if (groupLines.length > 0 && !isDocumentHeader(line)) {
      const groupItem = createGroupItem(line, groupLines, items.length + 1);
      if (groupItem) {
        pushItem(groupItem);
        lineIndex = groupCursor - 1;
        continue;
      }
    }

    const patternItem = createPatternItem(line, items.length + 1);
    if (patternItem) {
      pushItem(patternItem);
      continue;
    }

    const blankItem = createBlankItem(line, items.length + 1);
    if (blankItem) {
      pushItem(blankItem);
      continue;
    }

    const termItem = createTermItem(line, items.length + 1);
    if (termItem) {
      pushItem(termItem);
      continue;
    }

    const grammarLines = [line];
    let grammarCursor = lineIndex + 1;
    while (
      getParenGroups(grammarLines.join('\n')).length > 0 &&
      grammarCursor < lines.length &&
      !isDocumentHeader(lines[grammarCursor]) &&
      !lines[grammarCursor].startsWith('*') &&
      !/^\d+\s*[.)]\s*/.test(lines[grammarCursor]) &&
      !createTermItem(lines[grammarCursor], items.length + 1) &&
      !createPatternItem(lines[grammarCursor], items.length + 1) &&
      !createBlankItem(lines[grammarCursor], items.length + 1)
    ) {
      if (getParenGroups(lines[grammarCursor]).length === 0 && isEnglishFocused(lines[grammarCursor])) {
        break;
      }
      grammarLines.push(lines[grammarCursor]);
      grammarCursor += 1;
    }

    const grammarItem = createGrammarItem(grammarLines, items.length + 1);
    if (grammarItem) {
      pushItem(grammarItem);
      lineIndex = grammarCursor - 1;
      continue;
    }

    pushItem({
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
  const version = course === '600' ? '통합' : params.version ?? 'ver.3';
  const day = params.day ?? 'Day 1';
  const displayTitle =
    version === '통합' ? `${course}반 ${track} ${day}` : `${course}반 ${track} ${version} ${day}`;
  const title = params.title?.trim() || displayTitle;
  const versionKey = version === '통합' ? 'unified' : version;
  const itemVersionKey = version === '통합' ? 'unified' : version.replace(/\./g, '');
  const dayNumber = day.replace(/\D/g, '') || '1';
  const items = parseRawVocaText(params.rawText).map((item, index) => ({
    ...item,
    id: `${course}-${track}-${itemVersionKey}-day${dayNumber}-${String(index + 1).padStart(3, '0')}`,
  }));

  return {
    id: `danny-voca-set-${course}-${track}-${versionKey}-${day.replace(/\s+/g, '')}`,
    title,
    displayTitle,
    course,
    track,
    book: params.book?.trim() || 'Word 단어시험지',
    version,
    day,
    items,
  };
}
