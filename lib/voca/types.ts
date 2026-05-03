export type VocaItemType =
  | 'word'
  | 'phrase'
  | 'note'
  | 'misc'
  | 'blank'
  | 'grammar'
  | 'pattern'
  | 'group';
export type VocaCourse = '600' | '800';
export type VocaTrack = 'A' | 'B';
export type VocaVersion = '통합' | 'ver.1' | 'ver.2' | 'ver.3';
export type VocaDay =
  | 'Day 1'
  | 'Day 2'
  | 'Day 3'
  | 'Day 4'
  | 'Day 5'
  | 'Day 6'
  | 'Day 7'
  | 'Day 8'
  | 'Day 9'
  | 'Day 10';

export type VocaItem = {
  id: string;
  type: VocaItemType;
  term?: string;
  prompt?: string;
  pos?: string;
  meaning?: string;
  answer?: string;
  answers?: string[];
  answerText?: string;
  title?: string;
  lines?: string[];
  rawText: string;
  speakable: boolean;
};

export type VocaSet = {
  id: string;
  title: string;
  displayTitle?: string;
  course: VocaCourse;
  track: VocaTrack;
  book: string;
  version: VocaVersion;
  day: VocaDay;
  items: VocaItem[];
};

export type VocaKnowledgeStatus = 'confusing' | 'unknown' | 'known';

export type VocaProgressMap = Record<string, VocaKnowledgeStatus>;
