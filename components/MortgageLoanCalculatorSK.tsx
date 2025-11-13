"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";

// Limity a predvyplnené sadzby
const LIMITS = {
  hypotekarny: {
    amount: { min: 5000, max: 600000, step: 1000 },
    years: { min: 1, max: 40, step: 1 },
  },
  nehypotekarny: {
    amount: { min: 500, max: 40000, step: 100 }, // max 40k
    years: { min: 1, max: 8, step: 1 },          // max 8 rokov
  },
} as const;

const DEMO_BANKS = {
  hypotekarny: [
    { id: "slsp", name: "Slovenská sporiteľňa", rate: 3.69 },
    { id: "vub", name: "VÚB", rate: 3.89 },
    { id: "tatrabanka", name: "Tatra banka", rate: 3.19 },
    { id: "csob", name: "ČSOB", rate: 3.5 },
    { id: "unicredit", name: "UniCredit Bank", rate: 3.49 },
    { id: "365", name: "365.bank", rate: 3.35 },
    { id: "mbank", name: "mBank", rate: 3.9 },
    { id: "prima", name: "Prima banka", rate: 3.4 },
  ],
  nehypotekarny: [
    { id: "slsp_nh", name: "Slovenská sporiteľňa", rate: 6.49 },
    { id: "vub_nh", name: "VÚB", rate: 6.3 },
    { id: "tb_nh", name: "Tatra banka", rate: 7.5 },
    { id: "csob_nh", name: "ČSOB", rate: 7.9 },
    { id: "unicredit_nh", name: "UniCredit Bank", rate: 5.99 },
    { id: "365_nh", name: "365.bank", rate: 6.0 },
    { id: "mbank_nh", name: "mBank", rate: 5.89 },
    { id: "prima_nh", name: "Prima banka", rate: 9.5 },
  ],
};

// Akciový trh – 10 najväčších + index. Hodnoty CAGR za 10Y sú ilustračné, uprav podľa potreby.
const ASSETS = [
  { id: "sp500", name: "S&P 500 (TR)", cagr: 10 },
  { id: "apple", name: "Apple", cagr: 24 },
  { id: "microsoft", name: "Microsoft", cagr: 23 },
  { id: "nvidia", name: "NVIDIA", cagr: 55 },
  { id: "alphabet", name: "Alphabet (Google)", cagr: 18 },
  { id: "amazon", name: "Amazon", cagr: 20 },
  { id: "meta", name: "Meta (Facebook)", cagr: 17 },
  { id: "tsmc", name: "TSMC", cagr: 19 },
  { id: "berkshire", name: "Berkshire Hathaway", cagr: 11 },
  { id: "tesla", name: "Tesla", cagr: 35 },
  { id: "saudi", name: "Saudi Aramco", cagr: 5 },
] as const;

function pctToMonthly(pct: number) {
  const r = (Number(pct) || 0) / 100;
  return r / 12;
}

function annuityPayment(P: number, nominalAnnualPct: number, months: number) {
  const i = pctToMonthly(nominalAnnualPct);
  if (months <= 0 || P <= 0) return 0;
  if (i === 0) return P / months;
  return (P * i) / (1 - Math.pow(1 + i, -months));
}

function realMonthlyRate(nominalAnnualPct: number, inflationAnnualPct: number) {
  const iN = pctToMonthly(nominalAnnualPct);
  const iF = pctToMonthly(inflationAnnualPct);
  return (1 + iN) / (1 + iF) - 1;
}

function presentValueOfAnnuity(payment: number, r: number, n: number) {
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return payment * n;
  return (payment * (1 - Math.pow(1 + r, -n))) / r;
}

function fmtMoney(x: number) {
  if (!isFinite(x)) return "–";
  return x.toLocaleString("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function fmtPct(x: number) {
  return `${(Number(x) || 0).toLocaleString("sk-SK", { maximumFractionDigits: 2 })}%`;
}

function fvLumpSum(P: number, annualPct: number, years: number) {
  return P * Math.pow(1 + (annualPct || 0) / 100, years);
}

export default function MortgageLoanCalculatorSK() {
  const [tab, setTab] = useState("hypo");
  const [banks, setBanks] = useState(DEMO_BANKS);

  const [amount, setAmount] = useState(180000);
  const [years, setYears] = useState(30);
  const [inflationPct, setInflationPct] = useState(2.5);
  const [selectedBank, setSelectedBank] = useState("");
  const [customRate, setCustomRate] = useState(3.5);
  const [useCustomRate, setUseCustomRate] = useState(true);

  // Investičná sekcia
  const [assetId, setAssetId] = useState<typeof ASSETS[number]["id"]>("sp500");
  const defaultAsset = ASSETS.find(a => a.id === assetId)!;
  const [assetReturnPct, setAssetReturnPct] = useState<number>(defaultAsset.cagr);
  React.useEffect(() => {
    // pri zmene assetu zober default cagr
    setAssetReturnPct(ASSETS.find(a => a.id === assetId)?.cagr ?? 8);
  }, [assetId]);

  const loanType = tab === "hypo" ? "hypotekarny" : "nehypotekarny";
  const A_LIMIT = LIMITS[loanType].amount;
  const Y_LIMIT = LIMITS[loanType].years;

  // validácia podľa typu úveru
  const validatedAmount = Math.min(Math.max(amount, A_LIMIT.min), A_LIMIT.max);
  const validatedYears = Math.min(Math.max(years, Y_LIMIT.min), Y_LIMIT.max);

  const months = useMemo(() => Math.max(1, Math.round((Number(validatedYears) || 0) * 12)), [validatedYears]);

  const bankList = banks[loanType];
  const selectedBankObj = bankList.find((b) => b.id === selectedBank);

  const onSelectBank = (val: string) => {
    setSelectedBank(val);
    const r = bankList.find((b) => b.id === val)?.rate as number | undefined;
    if (typeof r === "number" && !isNaN(r)) {
      setUseCustomRate(false);
      setCustomRate(r);
    }
  };

  const effectiveRate = useCustomRate ? Number(customRate) || 0 : Number(selectedBankObj?.rate) || 0;

  const monthly = useMemo(() => annuityPayment(Number(validatedAmount) || 0, effectiveRate, months), [validatedAmount, effectiveRate, months]);
  const totalPaid = useMemo(() => monthly * months, [monthly, months]);
  const totalInterest = useMemo(() => totalPaid - (Number(validatedAmount) || 0), [totalPaid, validatedAmount]);

  const rRealMonthly = useMemo(() => realMonthlyRate(effectiveRate, Number(inflationPct) || 0), [effectiveRate, inflationPct]);
  const pvOfPayments = useMemo(() => presentValueOfAnnuity(monthly, rRealMonthly, months), [monthly, rRealMonthly, months]);
  const realOverpayment = useMemo(() => pvOfPayments - (Number(validatedAmount) || 0), [pvOfPayments, validatedAmount]);

  const handleBankRateChange = (id: string, val: string) => {
    setBanks((prev) => ({
      ...prev,
      [loanType]: prev[loanType].map((b) => (b.id === id ? { ...b, rate: Number(val) } : b)),
    }));
  };

  // Investičný výpočet – investujem celú istinu hneď na začiatku
  const investFV = useMemo(() => fvLumpSum(validatedAmount, assetReturnPct, validatedYears), [validatedAmount, assetReturnPct, validatedYears]);
  const investNet = useMemo(() => investFV - totalPaid, [investFV, totalPaid]);
  const breakEvenCAGR = useMemo(() => {
    if (validatedAmount > 0 && validatedYears > 0) {
      const r = Math.pow(totalPaid / validatedAmount, 1 / validatedYears) - 1;
      return r * 100;
    }
    return 0;
  }, [validatedAmount, validatedYears, totalPaid]);

  return (
    <div className="mx-auto max-w-5xl p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Kalkulátor hypotéky & úveru (SK)</h1>
        <div className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground max-w-xs sm:max-w-md">
          <Info className="h-4 w-4 mt-1 hidden sm:block" />
          <span>Vyber banku alebo používaj vlastnú sadzbu. Posuvníky sú rýchlejšie, polia sa pri kliku vyprázdnia.</span>
        </div>
      </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full text-xs sm:text-sm">
          <TabsTrigger value="hypo">Hypotekárny úver</TabsTrigger>
          <TabsTrigger value="nehypo">Nehypotekárny (spotrebný) úver</TabsTrigger>
        </TabsList>

        <TabsContent value="hypo">
          <CalculatorCard
            title="Hypotekárny úver"
            amount={validatedAmount}
            setAmount={setAmount}
            amountLimit={A_LIMIT}
            years={validatedYears}
            setYears={setYears}
            yearsLimit={Y_LIMIT}
            inflationPct={inflationPct}
            setInflationPct={setInflationPct}
            bankList={banks.hypotekarny}
            selectedBank={selectedBank}
            setSelectedBank={setSelectedBank}
            customRate={customRate}
            setCustomRate={setCustomRate}
            useCustomRate={useCustomRate}
            setUseCustomRate={setUseCustomRate}
            monthly={monthly}
            totalPaid={totalPaid}
            totalInterest={totalInterest}
            rRealMonthly={rRealMonthly}
            pvOfPayments={pvOfPayments}
            realOverpayment={realOverpayment}
            onBankRateChange={handleBankRateChange}
            onSelectBank={onSelectBank}
          />
        </TabsContent>

        <TabsContent value="nehypo">
          <CalculatorCard
            title="Nehypotekárny (spotrebný) úver"
            amount={validatedAmount}
            setAmount={setAmount}
            amountLimit={A_LIMIT}
            years={validatedYears}
            setYears={setYears}
            yearsLimit={Y_LIMIT}
            inflationPct={inflationPct}
            setInflationPct={setInflationPct}
            bankList={banks.nehypotekarny}
            selectedBank={selectedBank}
            setSelectedBank={setSelectedBank}
            customRate={customRate}
            setCustomRate={setCustomRate}
            useCustomRate={useCustomRate}
            setUseCustomRate={setUseCustomRate}
            monthly={monthly}
            totalPaid={totalPaid}
            totalInterest={totalInterest}
            rRealMonthly={rRealMonthly}
            pvOfPayments={pvOfPayments}
            realOverpayment={realOverpayment}
            onBankRateChange={handleBankRateChange}
            onSelectBank={onSelectBank}
          />
        </TabsContent>
      </Tabs>

      {/* Investičná sekcia */}
      <Card>
        <CardHeader>
          <CardTitle>Investičná hypotéza: investujem celú istinu do akcií</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Aktívum</Label>
              <Select value={assetId} onValueChange={(v) => setAssetId(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSETS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Očak. výnos p.a. (CAGR)</Label>
              <EditableNumber value={assetReturnPct} onChangeNumber={setAssetReturnPct} clearOnFocus />
            </div>

            <div className="grid gap-2">
              <Label>Break-even CAGR</Label>
              <div className="rounded-2xl bg-muted/30 p-3 text-lg font-semibold">{fmtPct(breakEvenCAGR)}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Stat label="Istina investovaná" value={fmtMoney(validatedAmount)} />
            <Stat label="FV investície po splatení" value={fmtMoney(investFV)} />
            <Stat label="Zaplatené na úvere" value={fmtMoney(totalPaid)} />
            <Stat label={investNet >= 0 ? "Čistý zisk" : "Čistá strata"} value={fmtMoney(investNet)} />
          </div>

          <div className="text-xs text-muted-foreground">
            * CAGR sú ilustračné a nie sú investičným odporúčaním. Úvahy nezohľadňujú dane, poplatky ani riziko volatility.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metodika pre infláciu</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Reálne hodnoty rátame pomocou Fisherovej aproximácie na mesačnej báze a diskontujeme PV splátok.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function CalculatorCard({
  title,
  amount,
  setAmount,
  amountLimit,
  years,
  setYears,
  yearsLimit,
  inflationPct,
  setInflationPct,
  bankList,
  selectedBank,
  setSelectedBank,
  customRate,
  setCustomRate,
  useCustomRate,
  setUseCustomRate,
  monthly,
  totalPaid,
  totalInterest,
  rRealMonthly,
  pvOfPayments,
  realOverpayment,
  onBankRateChange,
  onSelectBank,
}: {
  title: string;
  amount: number;
  setAmount: (n: number) => void;
  amountLimit: { min: number; max: number; step: number };
  years: number;
  setYears: (n: number) => void;
  yearsLimit: { min: number; max: number; step: number };
  inflationPct: number;
  setInflationPct: (n: number) => void;
  bankList: { id: string; name: string; rate: number }[];
  selectedBank: string;
  setSelectedBank: (v: string) => void;
  customRate: number;
  setCustomRate: (n: number) => void;
  useCustomRate: boolean;
  setUseCustomRate: (v: boolean) => void;
  monthly: number;
  totalPaid: number;
  totalInterest: number;
  rRealMonthly: number;
  pvOfPayments: number;
  realOverpayment: number;
  onBankRateChange: (id: string, val: string) => void;
  onSelectBank: (v: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          {/* Výška úveru – slider + input */}
          <div className="grid gap-2">
            <Label>Výška úveru</Label>
            <input
              type="range"
              className="w-full h-8 touch-none"
              min={amountLimit.min}
              max={amountLimit.max}
              step={amountLimit.step}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <EditableNumber
              value={amount}
              inputClassName="h-11 text-base"
              
              onChangeNumber={(v) => setAmount(Math.min(Math.max(v, amountLimit.min), amountLimit.max))}
              suffix=" €"
              clearOnFocus
            />
          </div>

          {/* Splatnosť v rokoch – slider + input */}
          <div className="grid gap-2">
            <Label>Splatnosť v rokoch</Label>
            <input
              type="range"
              className="w-full h-8 touch-none"
              min={yearsLimit.min}
              max={yearsLimit.max}
              step={yearsLimit.step}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
            <EditableNumber
              value={years}
              inputClassName="h-11 text-base"
              
              onChangeNumber={(v) => setYears(Math.min(Math.max(v, yearsLimit.min), yearsLimit.max))}
              clearOnFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Inflácia p.a. (%)</Label>
            <EditableNumber value={inflationPct} onChangeNumber={setInflationPct} clearOnFocus inputClassName="h-11 text-base" />
          </div>

          <div className="grid gap-2">
            <Label>Vyberte banku (voliteľné)</Label>
            <Select value={selectedBank} onValueChange={onSelectBank}>
              <SelectTrigger>
                <SelectValue placeholder="— Bez výberu —" />
              </SelectTrigger>
              <SelectContent>
                {bankList.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBank && (
            <div className="grid gap-2">
              <Label>Úrok banky p.a. (%) – {bankList.find((b) => b.id === selectedBank)?.name}</Label>
              <EditableNumber
                value={bankList.find((b) => b.id === selectedBank)?.rate ?? 0}
                onChangeNumber={(v) => onBankRateChange(selectedBank, String(v))}
                clearOnFocus
                inputClassName="h-11 text-base"
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border p-3">
            <div className="space-y-1">
              <Label>Vlastná sadzba p.a. (%)</Label>
              <EditableNumber value={customRate} onChangeNumber={setCustomRate} clearOnFocus inputClassName="h-11 text-base" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={useCustomRate} onCheckedChange={setUseCustomRate} id="customRateSwitch" />
              <Label htmlFor="customRateSwitch">Použiť vlastnú sadzbu</Label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">Výsledky (nominálne)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:gap-4">
              <Stat label="Mesačná splátka" value={fmtMoney(monthly)} />
              <Stat label="Nominálna sadzba" value={fmtPct(useCustomRate ? customRate : bankList.find(b=>b.id===selectedBank)?.rate || 0)} />
              <Stat label="Zaplatené spolu" value={fmtMoney(totalPaid)} />
              <Stat label="Preplatok (úroky)" value={fmtMoney(totalInterest)} />
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">Reálne (po započítaní inflácie)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:gap-4">
              <Stat label="Reálna mesačná miera" value={`${(rRealMonthly * 100).toFixed(3)}%/mes.`} />
              <Stat label="PV splátok (dnešné €)" value={fmtMoney(pvOfPayments)} />
              <Stat label="Reálny preplatok" value={fmtMoney(realOverpayment)} />
              <Stat label="Inflácia p.a." value={fmtPct(inflationPct)} />
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground">* Pri bezúčelovom úvere je výška limitovaná na 40 000 € a splatnosť na 8 rokov.</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Pomocný komponent na "user-friendly" čísla: vyprázdni pole pri focus, parsuje číslo pri zmene
function EditableNumber({ value, onChangeNumber, suffix, clearOnFocus = false, inputClassName = "" }: { value: number; onChangeNumber: (v: number) => void; suffix?: string; clearOnFocus?: boolean; inputClassName?: string; })) {
  const [txt, setTxt] = React.useState<string>(String(value));
  React.useEffect(() => {
    setTxt(String(value));
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <Input
        className={`${inputClassName} text-base sm:text-lg`}
        value={txt}
        onFocus={(e) => {
          if (clearOnFocus) {
            setTxt("");
          } else {
            (e.target as HTMLInputElement).select();
          }
        }}
        onChange={(e) => {
          const v = e.target.value;
          setTxt(v);
          const num = Number(v.replace(/\s+/g, "").replace(/€/g, "").replace(",", "."));
          if (!Number.isNaN(num)) onChangeNumber(num);
        }}
        onBlur={() => {
          const num = Number(txt.replace(/\s+/g, "").replace(/€/g, "").replace(",", "."));
          if (!Number.isNaN(num)) setTxt(suffix ? `${num.toLocaleString("sk-SK")}${suffix}` : String(num));
        }}
        placeholder={suffix ? `napr. 10 000${suffix}` : ""}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string; })) {
  return (
    <div className="rounded-2xl bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base sm:text-lg font-semibold">{value}</div>
    </div>
  );
}
