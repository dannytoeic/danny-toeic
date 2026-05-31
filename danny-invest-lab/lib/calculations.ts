import type { Account, ActionLabel, AlertRule, BuyPlan, Holding, Settings } from "./types";

export const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export const percent = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

export const holdingValue = (holding: Holding) => holding.quantity * holding.currentPrice;

export const holdingProfit = (holding: Holding) =>
  (holding.currentPrice - holding.avgPrice) * holding.quantity;

export const holdingReturnRate = (holding: Holding) =>
  holding.avgPrice === 0 ? 0 : ((holding.currentPrice - holding.avgPrice) / holding.avgPrice) * 100;

export const weightOf = (value: number, base: number) => (base === 0 ? 0 : (value / base) * 100);

export const drawdownFromHigh = (price: number, high: number) =>
  high === 0 ? 0 : ((price - high) / high) * 100;

export const maPosition = (price: number, ma: number) => {
  if (price === 0 || ma === 0) return "미입력";
  const gap = ((price - ma) / ma) * 100;
  if (gap >= 2) return "위";
  if (gap <= -2) return "아래";
  return "근처";
};

export const defensiveCashTarget = (settings: Settings) =>
  settings.defensiveCashTargetType === "percentage"
    ? settings.totalCapital * (settings.defensiveCashTargetValue / 100)
    : settings.defensiveCashTargetValue;

export const accountInvestment = (account: Account, holdings: Holding[]) =>
  holdings
    .filter((holding) => holding.accountId === account.id)
    .reduce((sum, holding) => sum + holdingValue(holding), 0);

export const accountTotal = (account: Account, holdings: Holding[]) =>
  account.cashAmount + accountInvestment(account, holdings);

export function buildSummary(accounts: Account[], holdings: Holding[], settings: Settings) {
  const totalCash = accounts.reduce((sum, account) => sum + account.cashAmount, 0);
  const currentInvestment = holdings.reduce((sum, holding) => sum + holdingValue(holding), 0);
  const totalAssets = totalCash + currentInvestment;
  const cashTarget = defensiveCashTarget(settings);
  const investableCapital = Math.max(settings.totalCapital - cashTarget, 0);
  const additionalDeployable = investableCapital - currentInvestment;
  const semiconductorValue = holdings
    .filter((holding) => holding.assetClass === "반도체")
    .reduce((sum, holding) => sum + holdingValue(holding), 0);
  const usEtfValue = holdings
    .filter((holding) => holding.assetClass === "미국ETF")
    .reduce((sum, holding) => sum + holdingValue(holding), 0);
  const swingValue = holdings
    .filter((holding) => holding.assetClass === "스윙")
    .reduce((sum, holding) => sum + holdingValue(holding), 0);
  const cmaCash = accounts
    .filter((account) => account.accountType === "CMA")
    .reduce((sum, account) => sum + account.cashAmount, 0);
  const pensionAssets = accounts
    .filter((account) => account.accountType === "연금")
    .reduce((sum, account) => sum + accountTotal(account, holdings), 0);

  return {
    totalCash,
    currentInvestment,
    totalAssets,
    cashTarget,
    investableCapital,
    additionalDeployable,
    semiconductorValue,
    usEtfValue,
    swingValue,
    cmaCash,
    pensionAssets,
    targetAssetOneYear: settings.totalCapital * (settings.yearlyTargetRate / 100),
    targetProgress: weightOf(totalAssets, settings.totalCapital * (settings.yearlyTargetRate / 100)),
    cashWeight: weightOf(totalCash, totalAssets),
    semiconductorWeight: weightOf(semiconductorValue, totalAssets),
    usEtfWeight: weightOf(usEtfValue, totalAssets),
    swingWeight: weightOf(swingValue, totalAssets),
    cmaCashWeight: weightOf(cmaCash, totalAssets),
    pensionWeight: weightOf(pensionAssets, totalAssets),
    investmentWeight: weightOf(currentInvestment, totalAssets),
    investmentVsInvestableWeight: weightOf(currentInvestment, investableCapital),
    cashTargetGap: totalCash - cashTarget,
    cmaMinimumGap: cmaCash - settings.cmaMinimumCash,
    semiconductorMaxAmount: totalAssets * (settings.semiconductorMaxWeight / 100),
    usEtfTargetAmount: totalAssets * (settings.usEtfTargetWeight / 100),
  };
}

export function actionForHolding(holding: Holding, semiconductorWeight: number): ActionLabel {
  const drawdown3m = drawdownFromHigh(holding.currentPrice, holding.high3m);
  const nearOrAbove20 = ["위", "근처"].includes(maPosition(holding.currentPrice, holding.ma20));
  const nearOrBelow60 = ["근처", "아래"].includes(maPosition(holding.currentPrice, holding.ma60));

  if (holding.assetClass === "반도체" && semiconductorWeight >= 60) return "추가매수 금지";
  if (drawdown3m <= -15 || nearOrBelow60) return "하락전환 점검";
  if (drawdown3m <= -5 && drawdown3m >= -8 && nearOrAbove20) return "매수 검토";
  if (holding.assetClass === "미국ETF" && holding.dayChangeRate <= -2) return "매수 검토";
  if (drawdown3m > -3 && holdingReturnRate(holding) > 15) return "일부익절 검토";
  if (drawdown3m <= -8) return "보류";
  return "관망";
}

export function activeAlerts(
  accounts: Account[],
  holdings: Holding[],
  settings: Settings,
  rules: AlertRule[],
) {
  const summary = buildSummary(accounts, holdings, settings);
  const alerts: Array<{ title: string; message: string; severity: AlertRule["severity"] }> = [];

  for (const rule of rules.filter((item) => item.enabled)) {
    const holding = holdings.find((item) => item.symbol === rule.symbol);
    if (rule.ruleType === "3개월 고점 대비 하락률" && holding) {
      const drawdown = drawdownFromHigh(holding.currentPrice, holding.high3m);
      if (drawdown <= rule.thresholdValue) {
        alerts.push({
          title: rule.name,
          message: `${rule.actionMessage}: 최근 3개월 고점 대비 ${percent(drawdown)}`,
          severity: rule.severity,
        });
      }
    }

    if (rule.symbol === "SEMICONDUCTOR" && summary.semiconductorWeight > rule.thresholdValue) {
      alerts.push({
        title: rule.name,
        message: `${rule.actionMessage}: 현재 ${percent(summary.semiconductorWeight)}`,
        severity: rule.severity,
      });
    }

    if (rule.symbol === "CASH" && summary.cashTargetGap < 0) {
      alerts.push({
        title: rule.name,
        message: `${rule.actionMessage}: 목표 대비 ${KRW.format(Math.abs(summary.cashTargetGap))} 부족`,
        severity: rule.severity,
      });
    }

    if (rule.ruleType === "일간 하락률" && holding && holding.dayChangeRate <= rule.thresholdValue) {
      alerts.push({
        title: rule.name,
        message: `${rule.actionMessage}: 전일 대비 ${percent(holding.dayChangeRate)}`,
        severity: rule.severity,
      });
    }
  }

  if (summary.cmaMinimumGap < 0) {
    alerts.push({
      title: "CMA 방어현금",
      message: `CMA 최소금액 대비 ${KRW.format(Math.abs(summary.cmaMinimumGap))} 부족`,
      severity: "danger",
    });
  }

  return alerts;
}

export function buyPlanRows(settings: Settings, buyPlan: BuyPlan, additionalDeployable: number) {
  const installments =
    buyPlan.mode === "2회 분할"
      ? 2
      : buyPlan.mode === "6개월 분할"
        ? 6
        : buyPlan.mode === "7개월 분할"
          ? 7
          : Math.max(buyPlan.customInstallments, 1);
  const deployable = Math.max(additionalDeployable, 0);
  const installmentAmount = deployable / installments;
  const plannedMonthly = settings.monthlyBuyAmount > 0 ? settings.monthlyBuyAmount : installmentAmount;
  const baseAmount = Math.min(installmentAmount || plannedMonthly, plannedMonthly);

  return [
    {
      name: "TIGER 미국S&P500",
      account: "한국투자증권 ISA",
      ratio: settings.sp500BuyRatio,
      amount: baseAmount * (settings.sp500BuyRatio / 100),
      note: "ISA에서 매수 권장. CMA 방어자금은 사용하지 말 것",
    },
    {
      name: "TIGER 미국나스닥100",
      account: "한국투자증권 ISA",
      ratio: settings.nasdaqBuyRatio,
      amount: baseAmount * (settings.nasdaqBuyRatio / 100),
      note: "환율 급등 시 매수금액 절반 축소 검토",
    },
  ];
}

export function buildAdvisoryPrompt(
  accounts: Account[],
  holdings: Holding[],
  settings: Settings,
  rules: AlertRule[],
) {
  const summary = buildSummary(accounts, holdings, settings);
  const alerts = activeAlerts(accounts, holdings, settings, rules);
  const best = [...holdings].sort((a, b) => b.dayChangeRate - a.dayChangeRate)[0];
  const worst = [...holdings].sort((a, b) => a.dayChangeRate - b.dayChangeRate)[0];
  const byType = (type: string) =>
    accounts
      .filter((account) => account.accountType === type)
      .reduce((sum, account) => sum + accountTotal(account, holdings), 0);

  return `[데니 투자연구소 자문 요청]

1. 현재 총자산: ${KRW.format(summary.totalAssets)}
2. 현재 현금: ${KRW.format(summary.totalCash)}
3. 계좌별 자산:
   - 위탁계좌: ${KRW.format(byType("위탁"))}
   - ISA: ${KRW.format(byType("ISA"))}
   - 연금계좌: ${KRW.format(byType("연금"))}
   - CMA: ${KRW.format(byType("CMA"))}
4. 반도체 비중: ${percent(summary.semiconductorWeight)}
5. 미국 ETF 비중: ${percent(summary.usEtfWeight)}
6. 스윙 비중: ${percent(summary.swingWeight)}
7. CMA 방어현금: ${KRW.format(summary.cmaCash)}
8. 오늘 가장 많이 오른 종목: ${best ? `${best.name} ${percent(best.dayChangeRate)}` : "미입력"}
9. 오늘 가장 많이 빠진 종목: ${worst ? `${worst.name} ${percent(worst.dayChangeRate)}` : "미입력"}
10. 최근 3개월 고점 대비 하락률:
${holdings.map((holding) => `   - ${holding.name}: ${percent(drawdownFromHigh(holding.currentPrice, holding.high3m))}`).join("\n")}
11. 현재 알림: ${alerts.length ? alerts.map((alert) => alert.message).join(" / ") : "없음"}
12. 내가 하고 싶은 행동:
13. 질문:
   오늘 매수 / 보류 / 관망 / 일부익절 중 무엇이 적절한가?`;
}
