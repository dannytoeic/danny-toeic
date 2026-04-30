export type DailyLessonCard = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  noticeText: string;
  audioTitlesText: string;
  audioUrlsText: string;
  videoTitlesText: string;
  videoUrlsText: string;
  extraMaterialTitlesText: string;
  extraMaterialUrlsText: string;
  memoText: string;
  createdAt: string;
};

export type ClassPageData = {
  globalNoticeText: string;
  cards: DailyLessonCard[];
};

export type ClassUpdatesMap = Record<string, ClassPageData>;

export const emptyClassUpdates: ClassUpdatesMap = {
  '600-monwed': {
    globalNoticeText: '',
    cards: [],
  },
  '600-tuthu': {
    globalNoticeText: '',
    cards: [],
  },
  '800-monwed': {
    globalNoticeText: '',
    cards: [],
  },
  '800-tuthu': {
    globalNoticeText: '',
    cards: [],
  },
};