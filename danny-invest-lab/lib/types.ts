export type AccountType = "위탁" | "ISA" | "연금" | "CMA" | "기타";

export type AccountRole =
  | "적극투자"
  | "절세형 ETF"
  | "장기연금"
  | "방어현금"
  | "기타";

export type AssetClass = "반도체" | "미국ETF" | "현금" | "스윙" | "기타";

export type ActionLabel =
  | "매수 검토"
  | "보류"
  | "관망"
  | "추가매수 금지"
  | "하락전환 점검"
  | "일부익절 검토";

export type Account = {
  id: string;
  name: string;
  brokerage: string;
  accountType: AccountType;
  role: AccountRole;
  cashAmount: number;
  memo: string;
};

export type Holding = {
  id: string;
  accountId: string;
  brokerage: string;
  accountName: string;
  accountType: AccountType;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  targetWeight: number;
  memo: string;
  high1m: number;
  high3m: number;
  high6m: number;
  ma20: number;
  ma60: number;
  dayChangeRate: number;
};

export type Settings = {
  totalCapital: number;
  defensiveCashTargetType: "percentage" | "fixed";
  defensiveCashTargetValue: number;
  semiconductorMaxWeight: number;
  usEtfTargetWeight: number;
  swingMaxWeight: number;
  yearlyTargetRate: number;
  monthlyBuyAmount: number;
  sp500BuyRatio: number;
  nasdaqBuyRatio: number;
  cmaMinimumCash: number;
};

export type BuyPlanMode = "2회 분할" | "6개월 분할" | "7개월 분할" | "직접 입력";

export type BuyPlan = {
  mode: BuyPlanMode;
  nextBuyDate: string;
  customInstallments: number;
  completedFirst: boolean;
  completedSecond: boolean;
};

export type AlertRule = {
  id: string;
  symbol: string;
  name: string;
  ruleType: string;
  thresholdValue: number;
  actionMessage: string;
  enabled: boolean;
  severity: "info" | "warning" | "danger";
};
