
// components/DashboardCharts.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, TrendViewMode, DrillDownState, FilterState } from '../types';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend, ReferenceLine, 
  ComposedChart
} from 'recharts';
import { 
  Maximize2, X, TrendingUp, Scale, 
  ArrowUpRight, ArrowDownRight, Minus, 
  Wallet, Receipt, Landmark, Zap
} from 'lucide-react';

interface Props {
  allTransactions: Transaction[];
  filters: FilterState;
  drillDown: DrillDownState;
  onDrillDown: (field: keyof DrillDownState, value: any) => void;
}

const CATEGORY_COLORS = [
  '#F44336', '#2196F3', '#4CAF50', '#FF9800', '#FFEB3B', 
  '#CDDC39', '#7986CB', '#E91E63', '#00BCD4', '#9C27B0'
];


const YEAR_COLORS = [
  '#D50000', '#2962FF', '#00C853', '#FF6D00', '#AA00FF', '#00BFA5', '#C2185B', '#3E2723',
];

const NEW_PALETTE = ['#9B5DE5', '#F15BB5', '#FEE440', '#00BBF9', '#00F5D4'];
const BLUE_PALETTE = ['#0D47A1', '#1565C0', '#1976D2', '#1E88E5', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9', '#BBDEFB', '#E3F2FD'];
const ORANGE_PALETTE = ['#FF7B00', '#FF8800', '#FF9500', '#FFA200', '#FFAA00', '#FFB700', '#FFC300', '#FFD000', '#FFDD00', '#FFEA00'];




const DashboardCharts: React.FC<Props> = ({ allTransactions, filters, drillDown, onDrillDown }) => {
  const [viewMode, setViewMode] = useState<TrendViewMode>('monthly');
  const [currentMetric, setCurrentMetric] = useState<'Income' | 'Expense' | 'Net'>('Expense');
  const [expandedChart, setExpandedChart] = useState<'category' | 'account' | 'efficiency' | null>(null);

  // Cross-filtering logic: Filter data by Global + Drilldown BUT exclude one field to keep chart context
  const getFilteredData = useCallback((excludeField?: keyof DrillDownState) => {
    return allTransactions.filter(t => {
      // 1. Global Filters
      if (filters.excludedCategories.has(t.category)) return false;
      if (!filters.years.has(t.date.getFullYear())) return false;
      if (!filters.months.has(t.date.getMonth())) return false;

      // 2. Drilldown Filters (Skip the excludeField to show full context in its own chart)
      if (excludeField !== 'type' && drillDown.type && t.type !== drillDown.type) return false;
      if (excludeField !== 'monthIdx' && drillDown.monthIdx !== null && t.date.getMonth() !== drillDown.monthIdx) return false;
      if (excludeField !== 'category' && drillDown.category && t.category !== drillDown.category) return false;
      if (excludeField !== 'account' && drillDown.account && t.account !== drillDown.account) return false;

      return true;
    });
  }, [allTransactions, filters, drillDown]);

  // Handle drilldown toggle
  const handleToggleDrillDown = (field: keyof DrillDownState, value: any) => {
    const isSame = drillDown[field] === value;
    onDrillDown(field, isSame ? null : value);
  };

  // KPIs use fully filtered data
  const kpiTransactions = getFilteredData();
  const income = kpiTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = kpiTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = income - expense;

  const activeMonthsInView = useMemo(() => {
    const uniqueMonthYears = new Set(kpiTransactions.map(t => `${t.date.getFullYear()}-${t.date.getMonth()}`));
    return uniqueMonthYears.size || 1;
  }, [kpiTransactions]);

  const currentMonthlyAvgInc = income / activeMonthsInView;
  const currentMonthlyAvgExp = expense / activeMonthsInView;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  const getSavingsStatus = (rate: number) => {
    if (rate >= 30) return { label: 'Excellent', color: 'text-purple-600 bg-purple-50', icon: <Zap size={10} /> };
    if (rate >= 10) return { label: 'Good', color: 'text-emerald-600 bg-emerald-50', icon: <TrendingUp size={10} /> };
    if (rate >= 0) return { label: 'Caution', color: 'text-orange-600 bg-orange-50', icon: <Minus size={10} /> };
    return { label: 'Deficit', color: 'text-rose-600 bg-rose-50', icon: <ArrowDownRight size={10} /> };
  };

  const savingsStatus = getSavingsStatus(savingsRate);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const uniqueYears = Array.from(new Set(allTransactions.map(t => t.date.getFullYear()))).sort();
  
  // Base transactions for trends & efficiency ignoring month limitation
  const trendTransactions = getFilteredData('monthIdx');

  // Efficiency Data ignores month selection but respects other filters

  // 1. Yearly Data
  const yearlyPerformanceData = uniqueYears.filter(y => filters.years.has(y)).map(y => {
    const yearTrans = trendTransactions.filter(t => t.date.getFullYear() === y);
    const inc = yearTrans.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const exp = yearTrans.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const netVal = inc - exp;
    const rate = inc > 0 ? (netVal / inc) * 100 : (inc === 0 && exp > 0 ? -100 : 0);
    return { name: y.toString(), Income: inc, Expense: exp, Net: netVal, SavingsRate: rate };
  });

  // 2. Aggregated Monthly Data (Seasonal Base)
  const aggregatedMonthData = monthNames.map((m, idx) => {
    const monthlyTrans = trendTransactions.filter(t => t.date.getMonth() === idx);
    const inc = monthlyTrans.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const exp = monthlyTrans.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const netVal = inc - exp;
    const rate = inc > 0 ? (netVal / inc) * 100 : (inc === 0 && exp > 0 ? -100 : 0);
    return { name: m, index: idx, Income: inc, Expense: exp, Net: netVal, SavingsRate: rate };
  });

  // 3. Continuous Monthly Data
  const continuousMonthlyData: any[] = [];
  uniqueYears.filter(y => filters.years.has(y)).forEach(year => {
    monthNames.forEach((m, idx) => {
      const trans = trendTransactions.filter(t => t.date.getFullYear() === year && t.date.getMonth() === idx);
      if (trans.length > 0) {
        const inc = trans.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const exp = trans.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const netVal = inc - exp;
        const rate = inc > 0 ? (netVal / inc) * 100 : (inc === 0 && exp > 0 ? -100 : 0);
        continuousMonthlyData.push({ name: `${m} ${year.toString().slice(-2)}`, index: idx, Income: inc, Expense: exp, Net: netVal, SavingsRate: rate });
      }
    });
  });

  const renderSavingsLabel = (props: any) => {
    const { x, y, value } = props;
    if (value === undefined) return null;
    return (
      <text x={x} y={y - 10} fill={value >= 0 ? "#4A148C" : "#ff686b"} fontSize={10} fontWeight="bold" textAnchor="middle">
        {value >= 0 ? '+' : ''}{value.toFixed(0)}%
      </text>

    );
  };

  // Trend Chart Logic
  let trendsChartContent;
  if (viewMode === 'monthly' || viewMode === 'yearly') {
    const dataToUse = viewMode === 'monthly' ? continuousMonthlyData : yearlyPerformanceData;

    if (currentMetric === 'Net') {
      trendsChartContent = (
        <ComposedChart data={dataToUse}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
          <YAxis yAxisId="money" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { notation: 'compact' })} />
          <YAxis yAxisId="percent" orientation="right" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(val: number, name: string) => name === "SavingsRate" ? [`${val.toFixed(1)}%`, "Savings Rate"] : [val.toLocaleString(), name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
          <ReferenceLine yAxisId="money" y={0} stroke="#cbd5e1" />
          <Bar yAxisId="money" dataKey="Net" radius={[2, 2, 2, 2]} onClick={(d: any) => d.index !== undefined && handleToggleDrillDown('monthIdx', d.index)} cursor="pointer">
            {dataToUse.map((entry, index) => {
              const isSelected = drillDown.monthIdx === entry.index;
              const hasSelection = drillDown.monthIdx !== null;
              return <Cell key={`cell-${index}`} fill={entry.Net >= 0 ? '#60d394' : '#ff686b'} fillOpacity={isSelected || !hasSelection ? 1 : 0.4} />;
            })}
          </Bar>
          <Line yAxisId="percent" type="monotone" dataKey="SavingsRate" stroke="#ff686b" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="3 3" label={renderSavingsLabel} />

        </ComposedChart>
      );
    } else {
      trendsChartContent = (
        <BarChart data={dataToUse}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
          <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { notation: 'compact' })} />
          <Tooltip formatter={(val: number) => val.toLocaleString()} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
          <Bar dataKey={currentMetric} radius={[4, 4, 0, 0]} onClick={(d: any) => d.index !== undefined && handleToggleDrillDown('monthIdx', d.index)} cursor="pointer">
             {dataToUse.map((entry, index) => {
              const isSelected = drillDown.monthIdx === entry.index;
              const hasSelection = drillDown.monthIdx !== null;
              return <Cell key={`cell-${index}`} fill={currentMetric === 'Income' ? '#60d394' : '#ff686b'} fillOpacity={isSelected || !hasSelection ? 1 : 0.4} />;

            })}
          </Bar>
        </BarChart>
      );
    }

  } else if (viewMode === 'seasonal') {
    const seasonalData = monthNames.map((m, idx) => {
      const row: Record<string, any> = { name: m, index: idx };
      uniqueYears.filter(y => filters.years.has(y)).forEach(y => {
        row[y.toString()] = trendTransactions
          .filter(t => t.date.getFullYear() === y && t.date.getMonth() === idx)

          .reduce((s: number, t: Transaction): number => {
            if (currentMetric === 'Expense') return t.amount < 0 ? s + Math.abs(t.amount) : s;
            if (currentMetric === 'Income') return t.amount > 0 ? s + t.amount : s;
            return s + t.amount;
          }, 0);
      });
      return row;
    });

    trendsChartContent = (
      <LineChart data={seasonalData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
        <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { notation: 'compact' })} />
        <Tooltip formatter={(val: number) => val.toLocaleString()} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
        {currentMetric === 'Net' && <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />}
        {uniqueYears.filter(y => filters.years.has(y)).map((y, idx) => (
          <Line key={y.toString()} type="monotone" dataKey={y.toString()} name={y.toString()} stroke={YEAR_COLORS[idx % YEAR_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />
        ))}
      </LineChart>

    );
  }

  // Allocation/Rankings use relevant contexts
  const isNetMode = currentMetric === 'Net';
  const breakdownMetric = isNetMode ? 'Expense' : currentMetric;
  
  // Rankings should ignore their own drill-down field to allow toggling/switching
  const catTransactions = getFilteredData('category');
  const catMap: Record<string, number> = {};
  catTransactions.filter(t => breakdownMetric === 'Income' ? t.amount > 0 : t.amount < 0).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const pieData = sortedCats.slice(0, 6).map(([name, value]) => ({ name, value }));
  const otherVal = sortedCats.slice(6).reduce((s, [, v]) => s + v, 0);
  if (otherVal > 0) pieData.push({ name: 'Others', value: otherVal });
  const topCatsData = sortedCats.slice(0, 10).map(([name, value]) => ({ name, value }));

  const accTransactions = getFilteredData('account');
  const accMap: Record<string, number> = {};
  accTransactions.filter(t => breakdownMetric === 'Income' ? t.amount > 0 : t.amount < 0).forEach(t => { accMap[t.account] = (accMap[t.account] || 0) + Math.abs(t.amount); });
  const sortedAccs = Object.entries(accMap).sort((a, b) => b[1] - a[1]);
  const topAccsData = sortedAccs.slice(0, 10).map(([name, value]) => ({ name, value }));

  const getActiveEfficiencyData = () => {
    if (viewMode === 'monthly') return continuousMonthlyData;
    if (viewMode === 'seasonal') return aggregatedMonthData;
    return yearlyPerformanceData;
  };

  const EfficiencyChartComp = ({ expanded = false }) => {
    const data = getActiveEfficiencyData();
    const barSize = expanded ? 40 : Math.min(28, 400 / Math.max(data.length, 1));
    return (
      <div className="flex-1 w-full min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={expanded ? 400 : 280}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" fontSize={expanded ? 12 : 10} axisLine={false} tickLine={false} />
            <YAxis yAxisId="money" fontSize={expanded ? 12 : 10} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { notation: 'compact' })} />
            <YAxis yAxisId="percent" orientation="right" fontSize={expanded ? 12 : 10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(val: number, name: string) => name === "SavingsRate" ? [`${val.toFixed(1)}%`, "Savings Rate"] : [val.toLocaleString(), name]} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: expanded ? '12px' : '10px', paddingTop: '15px' }} />
            <Bar yAxisId="money" dataKey="Income" fill="#60d394" radius={[6, 6, 0, 0]} barSize={barSize} />
            <Bar yAxisId="money" dataKey="Expense" fill="#ff686b" radius={[6, 6, 0, 0]} barSize={barSize} />

            <Line yAxisId="money" type="monotone" dataKey="Net" stroke="#9C27B0" strokeWidth={3} dot={{ r: 4, fill: '#9C27B0', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            <Line yAxisId="percent" type="monotone" dataKey="SavingsRate" name="SavingsRate" stroke="#2196F3" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#2196F3' }} label={renderSavingsLabel} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };


  const renderExpandedModal = () => {
    if (!expandedChart) return null;
    const isCat = expandedChart === 'category';
    const isAcc = expandedChart === 'account';
    const isEff = expandedChart === 'efficiency';

    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
          <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
             <h3 className="text-xl font-bold text-[#4A148C]">{isCat ? 'Categories Breakdown' : isAcc ? 'Accounts Breakdown' : 'Efficiency & Volume (Benchmark)'}</h3>
             <button onClick={() => setExpandedChart(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {isEff ? (
              <EfficiencyChartComp expanded={true} />
            ) : (
              <div style={{ height: Math.max(500, (isCat ? sortedCats : sortedAccs).length * 40), width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={500}>
                  <BarChart data={(isCat ? sortedCats : sortedAccs).map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ right: 30 }}>
                    <XAxis type="number" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={150} fontSize={12} />
                    <Tooltip formatter={(val: number) => val.toLocaleString()} />
                    <Bar dataKey="value" fill={isCat ? '#4A148C' : '#FF9800'} radius={[0, 4, 4, 0]} onClick={(d: any) => { handleToggleDrillDown(isCat ? 'category' : 'account', d.name); setExpandedChart(null); }} cursor="pointer">
                       {(isCat ? sortedCats : sortedAccs).map((entry, index) => {
                          const isSelected = drillDown[isCat ? 'category' : 'account'] === entry[0];
                          const hasSelection = drillDown[isCat ? 'category' : 'account'] !== null;
                          return <Cell key={`cell-${index}`} fillOpacity={isSelected || !hasSelection ? 1 : 0.4} />;
                       })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 mb-6 max-w-full overflow-hidden">
      <div className="bg-white rounded-2xl shadow-lg border border-purple-100/50 p-6 flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-10 flex-1 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Wallet size={20} /></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Income</span>
              <span className="text-xl font-black text-[#2E7D32] tracking-tight">{income.toLocaleString()}</span>
              <span className="text-[9px] font-bold text-gray-500 mt-0.5">Avg: {currentMonthlyAvgInc.toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><Receipt size={20} /></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Expense</span>
              <span className="text-xl font-black text-[#C62828] tracking-tight">{expense.toLocaleString()}</span>
              <span className="text-[9px] font-bold text-gray-500 mt-0.5">Avg: {currentMonthlyAvgExp.toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${net >= 0 ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}><Landmark size={20} /></div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Net Balance</span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${savingsStatus.color} uppercase`}>{savingsStatus.icon} {savingsStatus.label}</div>
              </div>
              <span className={`text-xl font-black tracking-tight ${net >= 0 ? 'text-[#4A148C]' : 'text-orange-600'}`}>{net.toLocaleString()}</span>
              <span className="text-[9px] font-bold text-gray-500 mt-0.5">Savings Rate: <span className="text-[#4A148C]">{savingsRate.toFixed(1)}%</span></span>
            </div>
          </div>
        </div>
        <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-1 border border-gray-100 z-10">
          {['Income', 'Expense', 'Net'].map(m => (
            <button key={m} onClick={() => setCurrentMetric(m as any)} className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${currentMetric === m ? 'bg-white text-[#4A148C] shadow-md ring-1 ring-purple-100' : 'text-gray-400 hover:bg-white/50'}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shadow-inner"><Scale size={18} /></div>
              <div><h4 className="text-[#4A148C] font-black text-sm uppercase tracking-wide">Efficiency & Volume</h4><p className="text-[10px] text-gray-400 font-bold">Earnings & efficiency timeline</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 hidden sm:flex">
                {['monthly', 'seasonal', 'yearly'].map(v => (
                  <button key={`eff-${v}`} onClick={() => setViewMode(v as any)} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${viewMode === v ? 'bg-white text-[#4A148C] shadow-sm' : 'text-gray-400 hover:text-[#4A148C]'}`}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                ))}
              </div>
              <button onClick={() => setExpandedChart('efficiency')} className="text-gray-300 hover:text-[#4A148C]"><Maximize2 size={16} /></button>
            </div>
          </div>

          <EfficiencyChartComp />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-inner"><TrendingUp size={18} /></div>
              <div><h4 className="text-[#4A148C] font-black text-sm uppercase tracking-wide">Trend Analysis</h4><p className="text-[10px] text-gray-400 font-bold">Time-series distribution & Efficiency</p></div>
            </div>
            <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
              {['monthly', 'seasonal', 'yearly'].map(v => (
                <button key={v} onClick={() => setViewMode(v as any)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${viewMode === v ? 'bg-white text-[#4A148C] shadow-sm' : 'text-gray-400'}`}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              {trendsChartContent || <div className="flex items-center justify-center h-full text-gray-400">Select data to view trends</div>}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 h-[360px] flex flex-col">
          <h4 className="text-[#4A148C] font-black text-xs uppercase tracking-widest mb-6 opacity-80">{breakdownMetric} Allocation</h4>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <PieChart>
                <Pie 
                  data={pieData} 
                  cx="45%" 
                  cy="50%"
                  innerRadius={55} 
                  outerRadius={80} 
                  paddingAngle={2} 
                  dataKey="value" 
                  stroke="none" 
                  onClick={(d: any) => d.name !== 'Others' && handleToggleDrillDown('category', d.name)} 
                  cursor="pointer"
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  label={(props: any) => {
                    const { x, y, name, textAnchor } = props;
                    return (
                      <text x={x} y={y} fill="#333" textAnchor={textAnchor} dominantBaseline="central" fontSize={9} fontWeight="500">
                        {name.length > 12 ? name.substring(0, 11) + '..' : name}
                      </text>
                    );
                  }}
                >
                  {pieData.map((entry, index) => {
                     const isSelected = drillDown.category === entry.name;
                     const hasSelection = drillDown.category !== null;
                     return <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} fillOpacity={isSelected || !hasSelection ? 1 : 0.4} />;
                  })}
                </Pie>
                <Tooltip formatter={(val: number) => val.toLocaleString()} />
                <Legend 
                  wrapperStyle={{ fontSize: '10px' }} 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right" 
                  iconType="square"
                />
              </PieChart>

            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 h-[360px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h4 className="text-[#4A148C] font-black text-xs uppercase tracking-widest opacity-80">Category Rankings</h4>
             <button onClick={() => setExpandedChart('category')} className="text-gray-300 hover:text-[#4A148C]"><Maximize2 size={16} /></button>
          </div>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <BarChart data={topCatsData} layout="vertical" margin={{ right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8fafc" />
                <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={85} fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val: number) => val.toLocaleString()} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(d: any) => handleToggleDrillDown('category', d.name)} cursor="pointer" barSize={16}>
                   {topCatsData.map((entry, index) => {
                      const isSelected = drillDown.category === entry.name;
                      const hasSelection = drillDown.category !== null;
                      return <Cell key={`cell-${index}`} fill={BLUE_PALETTE[index % BLUE_PALETTE.length]} fillOpacity={isSelected || !hasSelection ? 1 : 0.4} />;
                   })}
                </Bar>


              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 h-[360px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[#4A148C] font-black text-xs uppercase tracking-widest opacity-80">Account Weights</h4>
            <button onClick={() => setExpandedChart('account')} className="text-gray-300 hover:text-[#4A148C]"><Maximize2 size={16} /></button>
          </div>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <BarChart data={topAccsData} layout="vertical" margin={{ right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8fafc" />
                <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={85} fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val: number) => val.toLocaleString()} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(d: any) => handleToggleDrillDown('account', d.name)} cursor="pointer" barSize={16}>
                  {topAccsData.map((entry, index) => {
                      const isSelected = drillDown.account === entry.name;
                      const hasSelection = drillDown.account !== null;
                      return <Cell key={`cell-${index}`} fill={ORANGE_PALETTE[index % ORANGE_PALETTE.length]} fillOpacity={isSelected || !hasSelection ? 1 : 0.4} />;
                   })}
                </Bar>


              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {renderExpandedModal()}
    </div>
  );
};

export default DashboardCharts;
