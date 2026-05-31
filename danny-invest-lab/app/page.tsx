"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  KRW,
  accountInvestment,
  accountTotal,
  actionForHolding,
  activeAlerts,
  buildAdvisoryPrompt,
  buildSummary,
  buyPlanRows,
  drawdownFromHigh,
  holdingProfit,
  holdingReturnRate,
  holdingValue,
  maPosition,
  percent,
  weightOf,
} from "@/lib/calculations";
import {
  defaultAccounts,
  defaultAlertRules,
  defaultBuyPlan,
  defaultHoldings,
  defaultSettings,
} from "@/lib/default-data";
import type { Account, AccountRole, AccountType, AssetClass, BuyPlanMode, Holding, Settings } from "@/lib/types";

type Tab = "대시보드" | "계좌" | "보유종목" | "매수계획" | "알림조건" | "오늘의판단" | "설정";
type DataMode = "실제 데이터 입력 모드" | "예시 데이터 모드";
type SavedState = {
  accounts: Account[];
  holdings: Holding[];
  settings: Settings;
  buyPlan: typeof defaultBuyPlan;
  dataMode: DataMode;
};

const storageKey = "danny-invest-lab-v2";
const tabs: Tab[] = ["대시보드", "계좌", "보유종목", "매수계획", "알림조건", "오늘의판단", "설정"];

function emptyAccounts(): Account[] {
  return [
    {
      id: "acct-brokerage",
      name: "한국투자증권 위탁계좌",
      brokerage: "한국투자증권",
      accountType: "위탁",
      role: "적극투자",
      cashAmount: 0,
      memo: "",
    },
    {
      id: "acct-isa",
      name: "한국투자증권 ISA",
      brokerage: "한국투자증권",
      accountType: "ISA",
      role: "절세형 ETF",
      cashAmount: 0,
      memo: "",
    },
    {
      id: "acct-pension",
      name: "한국투자증권 연금계좌",
      brokerage: "한국투자증권",
      accountType: "연금",
      role: "장기연금",
      cashAmount: 0,
      memo: "",
    },
    {
      id: "acct-cma",
      name: "한국투자증권 CMA",
      brokerage: "한국투자증권",
      accountType: "CMA",
      role: "방어현금",
      cashAmount: 0,
      memo: "",
    },
  ];
}

function emptyState(): SavedState {
  return {
    accounts: emptyAccounts(),
    holdings: [],
    settings: defaultSettings,
    buyPlan: defaultBuyPlan,
    dataMode: "실제 데이터 입력 모드",
  };
}

function exampleState(): SavedState {
  return {
    accounts: defaultAccounts,
    holdings: defaultHoldings,
    settings: defaultSettings,
    buyPlan: defaultBuyPlan,
    dataMode: "예시 데이터 모드",
  };
}

function readSavedState(): SavedState {
  if (typeof window === "undefined") return emptyState();
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return {
      accounts: parsed.accounts?.length ? parsed.accounts : emptyAccounts(),
      holdings: parsed.holdings ?? [],
      settings: parsed.settings ?? defaultSettings,
      buyPlan: parsed.buyPlan ?? defaultBuyPlan,
      dataMode: parsed.dataMode ?? "실제 데이터 입력 모드",
    };
  } catch {
    return emptyState();
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("대시보드");
  const [accounts, setAccounts] = useState<Account[]>(emptyAccounts);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [buyPlan, setBuyPlan] = useState(defaultBuyPlan);
  const [dataMode, setDataMode] = useState<DataMode>("실제 데이터 입력 모드");
  const [rules, setRules] = useState(defaultAlertRules);
  const [advisoryText, setAdvisoryText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const saved = readSavedState();
    setAccounts(saved.accounts);
    setHoldings(saved.holdings);
    setSettings(saved.settings);
    setBuyPlan(saved.buyPlan);
    setDataMode(saved.dataMode);
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ accounts, holdings, settings, buyPlan, dataMode }));
  }, [accounts, holdings, settings, buyPlan, dataMode, hasLoaded]);

  const summary = useMemo(() => buildSummary(accounts, holdings, settings), [accounts, holdings, settings]);
  const alerts = useMemo(() => activeAlerts(accounts, holdings, settings, rules), [accounts, holdings, settings, rules]);
  const buyRows = useMemo(
    () => buyPlanRows(settings, buyPlan, summary.additionalDeployable),
    [settings, buyPlan, summary.additionalDeployable],
  );

  const saveNow = (message: string) => {
    window.localStorage.setItem(storageKey, JSON.stringify({ accounts, holdings, settings, buyPlan, dataMode }));
    setSaveMessage(message);
    window.setTimeout(() => setSaveMessage(""), 1800);
  };

  const loadExample = () => {
    const next = exampleState();
    setAccounts(next.accounts);
    setHoldings(next.holdings);
    setSettings(next.settings);
    setBuyPlan(next.buyPlan);
    setDataMode(next.dataMode);
    setSaveMessage("예시 데이터를 불러왔습니다.");
  };

  const resetAll = () => {
    if (!window.confirm("전체 데이터를 초기화하시겠습니까?")) return;
    const next = emptyState();
    setAccounts(next.accounts);
    setHoldings(next.holdings);
    setSettings(next.settings);
    setBuyPlan(next.buyPlan);
    setDataMode(next.dataMode);
    window.localStorage.removeItem(storageKey);
    setSaveMessage("전체 데이터를 초기화했습니다.");
  };

  const addAccount = () => {
    const id = `acct-${Date.now()}`;
    setAccounts([
      ...accounts,
      {
        id,
        name: "새 계좌",
        brokerage: "한국투자증권",
        accountType: "기타",
        role: "기타",
        cashAmount: 0,
        memo: "",
      },
    ]);
    setDataMode("실제 데이터 입력 모드");
  };

  const deleteAccount = (id: string) => {
    if (!window.confirm("이 계좌를 삭제하시겠습니까?")) return;
    setAccounts(accounts.filter((account) => account.id !== id));
    setHoldings(holdings.filter((holding) => holding.accountId !== id));
    setDataMode("실제 데이터 입력 모드");
  };

  const addHolding = () => {
    const account = accounts[0] ?? emptyAccounts()[0];
    setHoldings([
      ...holdings,
      {
        id: `holding-${Date.now()}`,
        accountId: account.id,
        brokerage: account.brokerage,
        accountName: account.name,
        accountType: account.accountType,
        symbol: "",
        name: "새 종목",
        assetClass: "기타",
        quantity: 0,
        avgPrice: 0,
        currentPrice: 0,
        targetWeight: 0,
        memo: "",
        high1m: 0,
        high3m: 0,
        high6m: 0,
        ma20: 0,
        ma60: 0,
        dayChangeRate: 0,
      },
    ]);
    setDataMode("실제 데이터 입력 모드");
  };

  const deleteHolding = (id: string) => {
    if (!window.confirm("이 종목을 삭제하시겠습니까?")) return;
    setHoldings(holdings.filter((holding) => holding.id !== id));
    setDataMode("실제 데이터 입력 모드");
  };

  const updateAccount = <K extends keyof Account>(id: string, key: K, value: Account[K]) => {
    setAccounts(accounts.map((account) => (account.id === id ? { ...account, [key]: value } : account)));
    setDataMode("실제 데이터 입력 모드");
  };

  const updateHolding = <K extends keyof Holding>(id: string, key: K, value: Holding[K]) => {
    setHoldings(
      holdings.map((holding) => {
        if (holding.id !== id) return holding;
        if (key !== "accountId") return { ...holding, [key]: value };
        const account = accounts.find((item) => item.id === value);
        return {
          ...holding,
          accountId: value as string,
          brokerage: account?.brokerage ?? holding.brokerage,
          accountName: account?.name ?? holding.accountName,
          accountType: account?.accountType ?? holding.accountType,
        };
      }),
    );
    setDataMode("실제 데이터 입력 모드");
  };

  const generateAdvisoryText = () => {
    setAdvisoryText(buildAdvisoryPrompt(accounts, holdings, settings, rules));
    setActiveTab("오늘의판단");
  };

  return (
    <main className="min-h-screen">
      <section className="border-b border-[#dfe5df] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[#256f5c]">10억 프로젝트 자문 시스템</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">데니 투자연구소</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#65706a]">
                사용자가 직접 입력한 투자금, 계좌별 현금, 보유종목, 현재가, 고점, 이동평균선을 기준으로 재계산합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border border-[#256f5c] px-4 py-3 text-sm font-bold text-[#256f5c]" onClick={loadExample}>
                예시 데이터 불러오기
              </button>
              <button className="rounded-lg border border-[#b42318] px-4 py-3 text-sm font-bold text-[#b42318]" onClick={resetAll}>
                전체 데이터 초기화
              </button>
              <button className="rounded-lg bg-[#256f5c] px-4 py-3 text-sm font-bold text-white" onClick={generateAdvisoryText}>
                ChatGPT 자문 요청문 생성
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e4f1eb] px-3 py-1 text-xs font-black text-[#256f5c]">{dataMode}</span>
            <span className="text-xs font-bold text-[#65706a]">입력값은 브라우저 localStorage에 저장됩니다.</span>
            {saveMessage && <span className="text-xs font-black text-[#256f5c]">{saveMessage}</span>}
          </div>
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${
                  activeTab === tab
                    ? "border-[#256f5c] bg-[#256f5c] text-white"
                    : "border-[#dfe5df] bg-white text-[#65706a]"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {activeTab === "대시보드" && (
          <Dashboard accounts={accounts} holdings={holdings} settings={settings} summary={summary} alerts={alerts} />
        )}
        {activeTab === "계좌" && (
          <Accounts
            accounts={accounts}
            holdings={holdings}
            updateAccount={updateAccount}
            addAccount={addAccount}
            deleteAccount={deleteAccount}
            saveNow={saveNow}
          />
        )}
        {activeTab === "보유종목" && (
          <Holdings
            accounts={accounts}
            holdings={holdings}
            summary={summary}
            updateHolding={updateHolding}
            addHolding={addHolding}
            deleteHolding={deleteHolding}
            saveNow={saveNow}
          />
        )}
        {activeTab === "매수계획" && (
          <BuyPlanView buyPlan={buyPlan} setBuyPlan={setBuyPlan} settings={settings} summary={summary} rows={buyRows} />
        )}
        {activeTab === "알림조건" && <AlertsView rules={rules} setRules={setRules} alerts={alerts} />}
        {activeTab === "오늘의판단" && (
          <Judgment alerts={alerts} holdings={holdings} summary={summary} advisoryText={advisoryText} />
        )}
        {activeTab === "설정" && (
          <SettingsView
            settings={settings}
            onSave={(next) => {
              setSettings(next);
              setDataMode("실제 데이터 입력 모드");
              saveNow("설정을 저장했습니다.");
            }}
          />
        )}
      </div>

      <footer className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="card p-4 text-sm text-[#65706a]">
          <p>이 앱은 자동매매 시스템이 아닙니다. 표시되는 내용은 투자 판단 보조용이며, 최종 매수·매도 결정은 사용자가 직접 수행합니다.</p>
          <p className="mt-2">수익을 보장하지 않습니다. 레버리지, 신용매수, 인버스 상품은 별도 경고 대상입니다.</p>
        </div>
      </footer>
    </main>
  );
}

function Dashboard({
  accounts,
  holdings,
  settings,
  summary,
  alerts,
}: {
  accounts: Account[];
  holdings: Holding[];
  settings: Settings;
  summary: ReturnType<typeof buildSummary>;
  alerts: ReturnType<typeof activeAlerts>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="총 운용 가능 자금" value={KRW.format(settings.totalCapital)} sub="설정 저장 시 즉시 반영" />
        <Metric title="방어 현금 목표" value={KRW.format(summary.cashTarget)} sub={`목표 대비 ${KRW.format(summary.cashTargetGap)}`} />
        <Metric title="실제 투자 가능 자금" value={KRW.format(summary.investableCapital)} sub="총 운용 가능 자금 - 방어현금" />
        <Metric title="추가 투입 가능 금액" value={KRW.format(summary.additionalDeployable)} sub="투자 가능 자금 - 현재 투자금" tone={summary.additionalDeployable < 0 ? "danger" : "normal"} />
        <Metric title="현재 투자금" value={KRW.format(summary.currentInvestment)} sub={`총자산 대비 ${percent(summary.investmentWeight)}`} />
        <Metric title="현재 현금" value={KRW.format(summary.totalCash)} sub={`총자산 대비 ${percent(summary.cashWeight)}`} />
        <Metric title="총 평가자산" value={KRW.format(summary.totalAssets)} sub="계좌 현금 + 보유종목 평가금액" />
        <Metric title="1년 목표 총자산" value={KRW.format(summary.targetAssetOneYear)} sub={`목표 달성률 ${percent(summary.targetProgress)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Ratio title="반도체 비중" value={summary.semiconductorWeight} danger={60} warning={55} />
        <Ratio title="미국 ETF 비중" value={summary.usEtfWeight} />
        <Ratio title="CMA 방어현금 비중" value={summary.cmaCashWeight} />
        <Ratio title="스윙 실험금 비중" value={summary.swingWeight} warning={5} />
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {accounts.map((account) => (
          <div key={account.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">{account.name}</p>
                <p className="mt-1 text-xs text-[#65706a]">{account.accountType} · {account.role}</p>
              </div>
              <span className="rounded-full bg-[#e4f1eb] px-2 py-1 text-xs font-bold text-[#256f5c]">{account.brokerage}</span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Line label="현금" value={KRW.format(account.cashAmount)} />
              <Line label="투자금" value={KRW.format(accountInvestment(account, holdings))} />
              <Line label="총 평가금액" value={KRW.format(accountTotal(account, holdings))} />
            </dl>
          </div>
        ))}
      </div>

      <div className={`card p-4 ${summary.cashTargetGap >= 0 ? "border-[#b7dfc8] bg-[#f6fff8]" : "border-[#fecdca] bg-[#fff9f8]"}`}>
        <h2 className="text-lg font-black">{summary.cashTargetGap >= 0 ? "방어현금 정상" : "방어현금 부족"}</h2>
        <p className="mt-1 text-sm text-[#65706a]">
          전체 현금 {KRW.format(summary.totalCash)} / 방어현금 목표 {KRW.format(summary.cashTarget)}
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="card border-[#fecdca] bg-[#fff9f8] p-4">
          <h2 className="text-lg font-black text-[#b42318]">현재 알림</h2>
          <div className="mt-3 grid gap-2">
            {alerts.map((alert, index) => (
              <p key={`${alert.title}-${index}`} className="rounded-lg bg-white p-3 text-sm font-bold">
                {alert.title}: {alert.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Accounts({
  accounts,
  holdings,
  updateAccount,
  addAccount,
  deleteAccount,
  saveNow,
}: {
  accounts: Account[];
  holdings: Holding[];
  updateAccount: <K extends keyof Account>(id: string, key: K, value: Account[K]) => void;
  addAccount: () => void;
  deleteAccount: (id: string) => void;
  saveNow: (message: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">계좌 입력/수정</h2>
        <button onClick={addAccount} className="rounded-lg bg-[#256f5c] px-4 py-2 text-sm font-bold text-white">계좌 추가</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {accounts.map((account) => (
          <div key={account.id} className="card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="계좌명" value={account.name} onChange={(value) => updateAccount(account.id, "name", value)} />
              <TextField label="증권사" value={account.brokerage} onChange={(value) => updateAccount(account.id, "brokerage", value)} />
              <SelectField label="계좌 종류" value={account.accountType} options={["위탁", "ISA", "연금", "CMA", "기타"]} onChange={(value) => updateAccount(account.id, "accountType", value as AccountType)} />
              <SelectField label="역할" value={account.role} options={["적극투자", "절세형 ETF", "장기연금", "방어현금", "기타"]} onChange={(value) => updateAccount(account.id, "role", value as AccountRole)} />
              <NumberField label="현금" value={account.cashAmount} onChange={(value) => updateAccount(account.id, "cashAmount", value)} />
              <ReadOnly label="계좌 총 평가금액" value={KRW.format(accountTotal(account, holdings))} />
            </div>
            <div className="mt-3">
              <TextArea label="메모" value={account.memo} onChange={(value) => updateAccount(account.id, "memo", value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-lg bg-[#256f5c] px-4 py-2 text-sm font-bold text-white" onClick={() => saveNow("계좌 수정 내용을 저장했습니다.")}>계좌 수정</button>
              <button className="rounded-lg border border-[#b42318] px-4 py-2 text-sm font-bold text-[#b42318]" onClick={() => deleteAccount(account.id)}>계좌 삭제</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Holdings({
  accounts,
  holdings,
  summary,
  updateHolding,
  addHolding,
  deleteHolding,
  saveNow,
}: {
  accounts: Account[];
  holdings: Holding[];
  summary: ReturnType<typeof buildSummary>;
  updateHolding: <K extends keyof Holding>(id: string, key: K, value: Holding[K]) => void;
  addHolding: () => void;
  deleteHolding: (id: string) => void;
  saveNow: (message: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">보유종목 입력/수정</h2>
        <button onClick={addHolding} className="rounded-lg bg-[#256f5c] px-4 py-2 text-sm font-bold text-white">종목 추가</button>
      </div>
      {holdings.length === 0 && (
        <div className="card p-5 text-sm text-[#65706a]">아직 입력한 종목이 없습니다. “종목 추가” 버튼으로 실제 보유종목을 입력하세요.</div>
      )}
      <div className="grid gap-4">
        {holdings.map((holding) => (
          <div key={holding.id} className="card p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <SelectField label="계좌 선택" value={holding.accountId} options={accounts.map((account) => account.id)} optionLabels={Object.fromEntries(accounts.map((account) => [account.id, account.name]))} onChange={(value) => updateHolding(holding.id, "accountId", value)} />
              <TextField label="종목명" value={holding.name} onChange={(value) => updateHolding(holding.id, "name", value)} />
              <TextField label="종목코드" value={holding.symbol} onChange={(value) => updateHolding(holding.id, "symbol", value)} />
              <SelectField label="자산군" value={holding.assetClass} options={["반도체", "미국ETF", "스윙", "기타"]} onChange={(value) => updateHolding(holding.id, "assetClass", value as AssetClass)} />
              <NumberField label="보유수량" value={holding.quantity} onChange={(value) => updateHolding(holding.id, "quantity", value)} />
              <NumberField label="평균단가" value={holding.avgPrice} onChange={(value) => updateHolding(holding.id, "avgPrice", value)} />
              <NumberField label="현재가" value={holding.currentPrice} onChange={(value) => updateHolding(holding.id, "currentPrice", value)} />
              <NumberField label="목표비중(%)" value={holding.targetWeight} onChange={(value) => updateHolding(holding.id, "targetWeight", value)} />
              <NumberField label="최근 1개월 고점" value={holding.high1m} onChange={(value) => updateHolding(holding.id, "high1m", value)} />
              <NumberField label="최근 3개월 고점" value={holding.high3m} onChange={(value) => updateHolding(holding.id, "high3m", value)} />
              <NumberField label="최근 6개월 고점" value={holding.high6m} onChange={(value) => updateHolding(holding.id, "high6m", value)} />
              <NumberField label="20일선" value={holding.ma20} onChange={(value) => updateHolding(holding.id, "ma20", value)} />
              <NumberField label="60일선" value={holding.ma60} onChange={(value) => updateHolding(holding.id, "ma60", value)} />
              <NumberField label="전일 대비(%)" value={holding.dayChangeRate} onChange={(value) => updateHolding(holding.id, "dayChangeRate", value)} />
              <ReadOnly label="평가금액" value={KRW.format(holdingValue(holding))} />
              <ReadOnly label="수익률" value={percent(holdingReturnRate(holding))} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Status label="평가손익" value={KRW.format(holdingProfit(holding))} />
              <Status label="전체 자산 대비 현재비중" value={percent(weightOf(holdingValue(holding), summary.totalAssets))} />
              <Status label="3개월 고점 대비 하락률" value={percent(drawdownFromHigh(holding.currentPrice, holding.high3m))} />
              <Status label="20일선 판단" value={maPosition(holding.currentPrice, holding.ma20)} />
              <Status label="60일선 판단" value={maPosition(holding.currentPrice, holding.ma60)} />
              <Status label="행동 라벨" value={actionForHolding(holding, summary.semiconductorWeight)} strong />
            </div>
            <div className="mt-3">
              <TextArea label="메모" value={holding.memo} onChange={(value) => updateHolding(holding.id, "memo", value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-lg bg-[#256f5c] px-4 py-2 text-sm font-bold text-white" onClick={() => saveNow("종목 수정 내용을 저장했습니다.")}>종목 수정</button>
              <button className="rounded-lg border border-[#b42318] px-4 py-2 text-sm font-bold text-[#b42318]" onClick={() => deleteHolding(holding.id)}>종목 삭제</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyPlanView({
  buyPlan,
  setBuyPlan,
  settings,
  summary,
  rows,
}: {
  buyPlan: typeof defaultBuyPlan;
  setBuyPlan: (plan: typeof defaultBuyPlan) => void;
  settings: Settings;
  summary: ReturnType<typeof buildSummary>;
  rows: ReturnType<typeof buyPlanRows>;
}) {
  const installments = buyPlan.mode === "2회 분할" ? 2 : buyPlan.mode === "6개월 분할" ? 6 : buyPlan.mode === "7개월 분할" ? 7 : buyPlan.customInstallments;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black">매수 계획</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric title="남은 추가 투입 가능금" value={KRW.format(summary.additionalDeployable)} sub="사용자 입력값 기준 자동 계산" />
        <Metric title="분할 횟수" value={`${installments}회`} sub={buyPlan.mode} />
        <Metric title="월 정기매수 금액" value={KRW.format(settings.monthlyBuyAmount)} sub={`S&P500 ${settings.sp500BuyRatio}% / 나스닥100 ${settings.nasdaqBuyRatio}%`} />
      </div>
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <SelectField label="분할 방식" value={buyPlan.mode} options={["2회 분할", "6개월 분할", "7개월 분할", "직접 입력"]} onChange={(value) => setBuyPlan({ ...buyPlan, mode: value as BuyPlanMode })} />
          <NumberField label="직접 입력 횟수" value={buyPlan.customInstallments} onChange={(value) => setBuyPlan({ ...buyPlan, customInstallments: value })} />
          <TextField label="다음 매수 예정일" value={buyPlan.nextBuyDate} onChange={(value) => setBuyPlan({ ...buyPlan, nextBuyDate: value })} />
          <ReadOnly label="매수 전 경고" value={summary.cashTargetGap < 0 ? "방어현금 복구 전까지 추가매수 금지" : "CMA 방어자금 사용 금지"} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <div key={row.name} className="rounded-lg border border-[#dfe5df] p-4">
              <p className="text-sm font-black">{row.account}</p>
              <h3 className="mt-1 text-lg font-black">{row.name}</h3>
              <p className="mt-2 text-2xl font-black text-[#256f5c]">{KRW.format(row.amount)}</p>
              <p className="mt-1 text-sm text-[#65706a]">기본 비율 {row.ratio}% · {row.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertsView({
  rules,
  setRules,
  alerts,
}: {
  rules: typeof defaultAlertRules;
  setRules: (rules: typeof defaultAlertRules) => void;
  alerts: ReturnType<typeof activeAlerts>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black">알림 조건</h2>
      <div className="grid gap-3">
        {rules.map((rule) => (
          <div key={rule.id} className="card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">{rule.name}</p>
                <p className="mt-1 text-sm text-[#65706a]">{rule.ruleType} · 기준 {rule.thresholdValue}</p>
                <p className="mt-1 text-sm font-bold">{rule.actionMessage}</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => setRules(rules.map((item) => (item.id === rule.id ? { ...item, enabled: event.target.checked } : item)))}
                />
                사용
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <h3 className="font-black">현재 발생 알림</h3>
        <div className="mt-3 grid gap-2">
          {alerts.length === 0 ? <p className="text-sm text-[#65706a]">현재 발생한 알림이 없습니다.</p> : alerts.map((alert, index) => <p key={index} className="rounded-lg bg-[#fff3df] p-3 text-sm font-bold">{alert.message}</p>)}
        </div>
      </div>
    </div>
  );
}

function Judgment({
  alerts,
  holdings,
  summary,
  advisoryText,
}: {
  alerts: ReturnType<typeof activeAlerts>;
  holdings: Holding[];
  summary: ReturnType<typeof buildSummary>;
  advisoryText: string;
}) {
  const mainRisk = alerts.find((alert) => alert.severity === "danger");
  const candidate = holdings.find((holding) => actionForHolding(holding, summary.semiconductorWeight) === "매수 검토");

  return (
    <div className="space-y-4">
      <div className={`card p-5 ${mainRisk ? "border-[#fecdca] bg-[#fff9f8]" : "bg-white"}`}>
        <p className="text-sm font-bold text-[#65706a]">오늘의 판단</p>
        <h2 className="mt-2 text-2xl font-black">
          {mainRisk ? "위험 경고가 우선입니다." : candidate ? `${candidate.name}이 매수 검토 후보입니다.` : "관망 또는 계획 유지 구간입니다."}
        </h2>
        <div className="mt-4 rounded-lg bg-[#f6f7f4] p-4 text-sm leading-7">
          {mainRisk ? (
            <p>행동: 추가매수 금지. 방어현금과 과도한 비중을 먼저 점검하십시오.</p>
          ) : candidate ? (
            <p>행동: 자동 주문이 아니라 수동 판단 후보입니다. 20일선 위치, 환율, 계좌별 현금을 장 마감 전 재확인하십시오.</p>
          ) : (
            <p>행동: 기존 보유분은 유지하고, 신규 매수는 계획된 정기매수 조건에서만 검토하십시오.</p>
          )}
          <p>다음 조건: 반도체 비중 60% 초과 시 추가매수 금지. CMA 방어현금 목표 미달 시 모든 신규매수를 보류합니다.</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {holdings.map((holding) => (
          <div key={holding.id} className="card p-4">
            <p className="text-sm text-[#65706a]">{holding.accountName}</p>
            <h3 className="mt-1 font-black">{holding.name}</h3>
            <p className="mt-2 text-2xl font-black text-[#256f5c]">{actionForHolding(holding, summary.semiconductorWeight)}</p>
            <p className="mt-2 text-sm text-[#65706a]">3개월 고점 대비 {percent(drawdownFromHigh(holding.currentPrice, holding.high3m))} · 20일선 {maPosition(holding.currentPrice, holding.ma20)} · 60일선 {maPosition(holding.currentPrice, holding.ma60)}</p>
          </div>
        ))}
      </div>

      {advisoryText && (
        <div className="card p-4">
          <h3 className="font-black">ChatGPT 자문 요청문</h3>
          <textarea className="field mt-3 min-h-80 font-mono text-sm" value={advisoryText} readOnly />
        </div>
      )}
    </div>
  );
}

function SettingsView({ settings, onSave }: { settings: Settings; onSave: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">설정 입력/수정</h2>
        <button className="rounded-lg bg-[#256f5c] px-4 py-2 text-sm font-bold text-white" onClick={() => onSave(draft)}>설정 저장</button>
      </div>
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="총 운용 가능 자금" value={draft.totalCapital} onChange={(value) => setDraft({ ...draft, totalCapital: value })} />
          <SelectField label="방어 현금 목표 방식" value={draft.defensiveCashTargetType} options={["percentage", "fixed"]} optionLabels={{ percentage: "비율 입력", fixed: "고정 금액 입력" }} onChange={(value) => setDraft({ ...draft, defensiveCashTargetType: value as "percentage" | "fixed" })} />
          <NumberField label="방어 현금 목표값" value={draft.defensiveCashTargetValue} onChange={(value) => setDraft({ ...draft, defensiveCashTargetValue: value })} />
          <NumberField label="1년 목표 수익률" value={draft.yearlyTargetRate} onChange={(value) => setDraft({ ...draft, yearlyTargetRate: value })} />
          <NumberField label="반도체 최대 비중" value={draft.semiconductorMaxWeight} onChange={(value) => setDraft({ ...draft, semiconductorMaxWeight: value })} />
          <NumberField label="미국 ETF 목표 비중" value={draft.usEtfTargetWeight} onChange={(value) => setDraft({ ...draft, usEtfTargetWeight: value })} />
          <NumberField label="스윙 최대 비중" value={draft.swingMaxWeight} onChange={(value) => setDraft({ ...draft, swingMaxWeight: value })} />
          <NumberField label="CMA 최소 현금" value={draft.cmaMinimumCash} onChange={(value) => setDraft({ ...draft, cmaMinimumCash: value })} />
          <NumberField label="월 매수 금액" value={draft.monthlyBuyAmount} onChange={(value) => setDraft({ ...draft, monthlyBuyAmount: value })} />
          <NumberField label="S&P500 매수 비율" value={draft.sp500BuyRatio} onChange={(value) => setDraft({ ...draft, sp500BuyRatio: value })} />
          <NumberField label="나스닥100 매수 비율" value={draft.nasdaqBuyRatio} onChange={(value) => setDraft({ ...draft, nasdaqBuyRatio: value })} />
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value, sub, tone = "normal" }: { title: string; value: string; sub: string; tone?: "normal" | "danger" }) {
  return (
    <div className={`card p-4 ${tone === "danger" ? "border-[#fecdca] bg-[#fff9f8]" : ""}`}>
      <p className="text-xs font-bold text-[#65706a]">{title}</p>
      <p className={`mt-2 text-xl font-black ${tone === "danger" ? "text-[#b42318]" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-[#65706a]">{sub}</p>
    </div>
  );
}

function Ratio({ title, value, warning, danger }: { title: string; value: number; warning?: number; danger?: number }) {
  const tone = danger !== undefined && value >= danger ? "bg-[#fee4e2] text-[#b42318]" : warning !== undefined && value >= warning ? "bg-[#fff3df] text-[#b54708]" : "bg-[#e4f1eb] text-[#256f5c]";
  return (
    <div className="card p-4">
      <p className="text-xs font-bold text-[#65706a]">{title}</p>
      <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xl font-black ${tone}`}>{percent(value)}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#65706a]">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function Status({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-[#f6f7f4] p-3">
      <p className="text-xs font-bold text-[#65706a]">{label}</p>
      <p className={`mt-1 ${strong ? "text-lg font-black text-[#256f5c]" : "font-bold"}`}>{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="field min-h-20" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="field bg-[#f6f7f4] font-bold">{value}</div>
    </div>
  );
}
