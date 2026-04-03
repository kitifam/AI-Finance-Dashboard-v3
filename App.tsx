
// App.tsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Upload, PieChart, ChevronLeft, ChevronRight, Filter, XCircle, FileText, Bot, Sparkles, Download, Check, X, AlertCircle, Layers, Edit2, RotateCcw, CalendarCheck, CheckCircle, ListChecks } from 'lucide-react';
import { parseCSV } from './utils/csvParser';
import { Transaction, FilterState, DrillDownState } from './types';
import DashboardCharts from './components/DashboardCharts';
import TransactionTable from './components/TransactionTable';
import ChatSidebar from './components/ChatSidebar';
import { optimizeTransactionCategories } from './services/gemini';

interface ProposalGroup {
  key: string;
  originalCategory: string;
  newCategory: string;
  account: string;
  note: string;
  count: number;
  dataIndices: number[];
  selected: boolean;
}

const STORAGE_KEY = 'fast_budget_csv_data';
const FILENAME_KEY = 'fast_budget_filename';
const APP_PASSWORD = '9871'; // Change this easily here


const App: React.FC = () => {


  // Global Data
  const [allData, setAllData] = useState<Transaction[]>([]);
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const [availableCategories, setAvailableCategories] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isDataLoadedFromStorage, setIsDataLoadedFromStorage] = useState(false);


  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isMultiYearMode, setIsMultiYearMode] = useState(false);
  const [isMultiMonthMode, setIsMultiMonthMode] = useState(false);

  // Optimization Review State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [proposals, setProposals] = useState<ProposalGroup[]>([]);

  // Ref for year scroll container
  const yearScrollRef = React.useRef<HTMLDivElement>(null);

  // Filters
  const currentYearNum = new Date().getFullYear();
  const [filters, setFilters] = useState<FilterState>({
    years: new Set([currentYearNum]),
    months: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), // Default all months selected
    excludedCategories: new Set()
  });

  const [drillDown, setDrillDown] = useState<DrillDownState>({
    type: null, monthIdx: null, category: null, account: null
  });

  const userPickedFileRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const applyParsedCsv = useCallback((csvText: string) => {
    try {
      const { transactions, years, categories } = parseCSV(csvText);
      setAllData(transactions);
      const sortedYears = Array.from(years).sort((a, b) => a - b);
      setAvailableYears(sortedYears);
      setAvailableCategories(categories);

      // Persist to local storage for automatic loading next time
      localStorage.setItem(STORAGE_KEY, csvText);


      if (sortedYears.length > 0) {
        const latestYear = sortedYears[sortedYears.length - 1];
        setFilters(prev => ({ ...prev, years: new Set([latestYear]) }));

        setTimeout(() => {
          if (yearScrollRef.current) {
            yearScrollRef.current.scrollLeft = yearScrollRef.current.scrollWidth;
          }
        }, 100);
      }
    } catch (err: any) {
      alert(err.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Try loading from Local Storage first (User's personal data)
        const savedData = localStorage.getItem(STORAGE_KEY);
        const savedFilename = localStorage.getItem(FILENAME_KEY);
        if (savedData && !userPickedFileRef.current) {
          setIsDataLoadedFromStorage(true);
          setActiveFilename(savedFilename || 'Cached Data');
          applyParsedCsv(savedData);
          return;
        }


        // 2. Fallback to Dev/Public default if no saved data
        const r = await fetch('/__local-default-csv', { cache: 'no-store' });
        if (cancelled || userPickedFileRef.current) return;
        if (!r.ok) return;
        if (r.headers.get('X-Local-Default-Csv') !== '1') return;
        const text = await r.text();
        if (cancelled || userPickedFileRef.current) return;
        setActiveFilename('FastBudget.csv');
        applyParsedCsv(text);
      } catch {
        /* static deploy / no dev middleware */
      }
    })();



    return () => {
      cancelled = true;
    };
  }, [applyParsedCsv]);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    userPickedFileRef.current = true;
    const file = e.target.files?.[0];
    if (!file) return;
    setActiveFilename(file.name);
    localStorage.setItem(FILENAME_KEY, file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      setIsAuthenticated(true); // Bypass password if user explicitly picks a file
      applyParsedCsv(evt.target?.result as string);
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Year Selection Logic
  const handleYearClick = (y: number) => {
    setFilters(prev => {
      const newYears = new Set(isMultiYearMode ? prev.years : []);
      if (isMultiYearMode) {
        if (newYears.has(y)) newYears.delete(y);
        else newYears.add(y);
      } else {
        newYears.clear();
        newYears.add(y);
      }
      if (newYears.size === 0) newYears.add(y);
      return { ...prev, years: newYears };
    });
  };

  const toggleAllYears = () => {
    setFilters(prev => {
      const allSelected = prev.years.size === availableYears.length;
      if (allSelected && availableYears.length > 0) {
        // Toggle to only latest year if all were selected
        return { ...prev, years: new Set([availableYears[availableYears.length - 1]]) };
      } else {
        return { ...prev, years: new Set(availableYears) };
      }
    });
  };

  const scrollYearLeft = () => {
    if (yearScrollRef.current) yearScrollRef.current.scrollBy({ left: -100, behavior: 'smooth' });
  };
  const scrollYearRight = () => {
    if (yearScrollRef.current) yearScrollRef.current.scrollBy({ left: 100, behavior: 'smooth' });
  };

  // Month Selection Logic
  const handleMonthClick = (mIdx: number) => {
    setFilters(prev => {
      const newMonths = new Set(isMultiMonthMode ? prev.months : []);
      if (isMultiMonthMode) {
        if (newMonths.has(mIdx)) newMonths.delete(mIdx);
        else newMonths.add(mIdx);
      } else {
        newMonths.clear();
        newMonths.add(mIdx);
      }
      if (newMonths.size === 0) newMonths.add(mIdx);
      return { ...prev, months: newMonths };
    });
  };

  const toggleAllMonths = () => {
    setFilters(prev => {
      const allSelected = prev.months.size === 12;
      if (allSelected) {
        // Toggle to only current month or first month
        const now = new Date();
        return { ...prev, months: new Set([now.getMonth()]) };
      } else {
        return { ...prev, months: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) };
      }
    });
  };

  // AI Re-Categorization Logic
  const handleAIOptimize = async () => {
    if (allData.length === 0) return;
    setIsOptimizing(true);
    try {
      const uniqueMap = new Map<string, number[]>();
      const uniquePayloads: { id: number; category: string; note: string; account: string }[] = [];
      allData.forEach((t, idx) => {
        const noteSnippet = t.note.substring(0, 40).replace(/;/g, ' ');
        const signature = `${t.category}|${noteSnippet}|${t.account}`;
        if (!uniqueMap.has(signature)) {
          uniqueMap.set(signature, [idx]);
          uniquePayloads.push({ id: uniquePayloads.length, category: t.category, note: noteSnippet, account: t.account });
        } else {
          uniqueMap.get(signature)?.push(idx);
        }
      });
      const aiResults = await optimizeTransactionCategories(uniquePayloads);
      const groups = new Map<string, ProposalGroup>();
      aiResults.forEach(res => {
        const payload = uniquePayloads[res.id];
        if (payload && payload.category !== res.newCategory) {
          const signature = `${payload.category}|${payload.note}|${payload.account}`;
          const indices = uniqueMap.get(signature) || [];
          const groupKey = `${payload.category}::${res.newCategory}::${payload.account}::${payload.note}`;
          if (!groups.has(groupKey)) {
            groups.set(groupKey, {
              key: groupKey, originalCategory: payload.category, newCategory: res.newCategory, account: payload.account, note: payload.note, count: 0, dataIndices: [], selected: true
            });
          }
          const group = groups.get(groupKey)!;
          group.count += indices.length;
          group.dataIndices.push(...indices);
        }
      });
      const groupedProposals = Array.from(groups.values()).sort((a, b) => a.originalCategory.localeCompare(b.originalCategory));
      if (groupedProposals.length === 0) {
        alert("AI found no new categories to suggest based on your data.");
      } else {
        setProposals(groupedProposals);
        setShowReviewModal(true);
      }
    } catch (e: any) {
      alert("Optimization failed: " + e.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const toggleProposal = (key: string) => {
    setProposals(prev => prev.map(p => p.key === key ? { ...p, selected: !p.selected } : p));
  };

  const handleCategoryEdit = (key: string, newCategory: string) => {
    setProposals(prev => prev.map(p => p.key === key ? { ...p, newCategory } : p));
  };

  const applyChanges = () => {
    const newData = [...allData];
    proposals.forEach(p => {
      if (p.selected) {
        p.dataIndices.forEach(idx => { newData[idx] = { ...newData[idx], category: p.newCategory }; });
      }
    });
    setAllData(newData);
    const rebuiltCategories = new Set<string>();
    newData.forEach(t => rebuiltCategories.add(t.category));
    setAvailableCategories(rebuiltCategories);
    setShowReviewModal(false);
    setProposals([]);
  };

  const handleDownloadCSV = () => {
    if (allData.length === 0) return;
    const header = "Date;Category;Value (THB);Account;Notes";
    const rows = allData.map(t => {
      const dateStr = `${t.date.getMonth() + 1}/${t.date.getDate()}/${t.date.getFullYear()}`;
      return `${dateStr};${t.category.replace(/;/g, ',')};${t.amount};${t.account.replace(/;/g, ',')};${t.note.replace(/;/g, ',')}`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "ai_optimized_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tableData = useMemo(() => {
    return allData.filter(t => {
      if (filters.excludedCategories.has(t.category)) return false;
      const matchYear = filters.years.has(t.date.getFullYear());
      const matchMonth = filters.months.has(t.date.getMonth());
      if (!matchYear || !matchMonth) return false;
      if (drillDown.type && t.type !== drillDown.type) return false;
      if (drillDown.monthIdx !== null && t.date.getMonth() !== drillDown.monthIdx) return false;
      if (drillDown.category && t.category !== drillDown.category) return false;
      if (drillDown.account && t.account !== drillDown.account) return false;
      return true;
    });
  }, [allData, filters, drillDown]);

  const validDataForAI = useMemo(() => {
    return allData.filter(t => !filters.excludedCategories.has(t.category));
  }, [allData, filters.excludedCategories]);

  const toggleCategory = (cat: string) => {
    const newSet = new Set(filters.excludedCategories);
    if (newSet.has(cat)) newSet.delete(cat);
    else newSet.add(cat);
    setFilters({ ...filters, excludedCategories: newSet });
  };

  const clearDrillDown = (key: keyof DrillDownState) => {
    setDrillDown(prev => ({ ...prev, [key]: null }));
  };

  const yearsAllSelected = availableYears.length > 0 && filters.years.size === availableYears.length;
  const monthsAllSelected = filters.months.size === 12;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  if (isDataLoadedFromStorage && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F3E5F5] flex items-center justify-center p-4 selection:bg-purple-200">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-purple-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-purple-100 text-[#4A148C] rounded-full flex items-center justify-center mb-6 shadow-inner">
            <CalendarCheck size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2 text-center">Protected Access</h2>
          <p className="text-gray-500 text-sm mb-8 text-center px-4">Your financial data is stored locally in this browser. Please enter your password to continue.</p>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••"
                className={`w-full px-6 py-4 bg-gray-50 border ${loginError ? 'border-red-400' : 'border-gray-200'} rounded-2xl outline-none focus:ring-2 focus:ring-[#4A148C] transition-all text-center text-xl tracking-widest`}
                autoFocus
              />
              {loginError && <p className="text-red-500 text-xs mt-2 text-center font-bold">Incorrect password. Please try again.</p>}
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-[#4A148C] to-[#7c43bd] text-white rounded-2xl font-black shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Unlock Dashboard
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100 w-full text-center">
            <p className="text-gray-400 text-[10px] mb-3 uppercase tracking-widest font-black">Secure Local Access</p>
            <label className="text-purple-600 font-bold text-xs cursor-pointer hover:underline flex items-center justify-center gap-2">
              <RotateCcw size={14} /> Use different CSV file
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#F3E5F5] min-h-screen font-sans text-gray-800 overflow-x-hidden">


      {/* Main Content */}
      <div className={`flex-1 p-4 md:p-6 min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:mr-[380px]' : ''}`}>

        {/* Header */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-[0_4px_20px_rgba(74,20,140,0.08)] mb-6 flex flex-col gap-6 max-w-full">

          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <h2 className="text-xl md:text-2xl font-bold text-[#4A148C] flex items-center gap-3 shrink-0">
              <PieChart /><span>Finance Dashboard</span>
            </h2>

            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 w-full justify-end">
              {/* Year Selector Group */}
              <div className="flex items-center gap-1 bg-gray-50 rounded-full p-1 border border-gray-200 flex-1 min-w-0">
                <button
                  onClick={toggleAllYears}
                  className={`p-2 rounded-full transition-all shrink-0 ${yearsAllSelected ? 'bg-[#4A148C] text-white' : 'bg-white text-gray-400 hover:text-[#4A148C]'}`}
                  title="Toggle All Years"
                >
                  <CalendarCheck size={18} />
                </button>
                <button
                  onClick={() => setIsMultiYearMode(!isMultiYearMode)}
                  className={`p-2 rounded-full transition-all shrink-0 ${isMultiYearMode ? 'bg-[#4A148C] text-white' : 'bg-white text-gray-400 hover:text-[#4A148C]'}`}
                  title="Toggle Multi-Selection"
                >
                  <Layers size={18} />
                </button>

                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <button onClick={scrollYearLeft} className="px-1 shrink-0 text-gray-400 hover:text-[#4A148C]"><ChevronLeft size={16} /></button>
                  <div
                    ref={yearScrollRef}
                    className="flex flex-nowrap gap-1 px-1 overflow-x-auto scrollbar-hide no-scrollbar w-full"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {availableYears.map(y => (
                      <button
                        key={y}
                        onClick={() => handleYearClick(y)}
                        className={`px-3 py-1 rounded-full text-xs md:text-sm transition-all shrink-0 ${filters.years.has(y) ? 'bg-[#4A148C] text-white font-bold shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                  <button onClick={scrollYearRight} className="px-1 text-gray-400 hover:text-[#4A148C]"><ChevronRight size={16} /></button>
                </div>
              </div>

              {/* Categories Button */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowCatDropdown(!showCatDropdown)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${filters.excludedCategories.size > 0 ? 'bg-[#4A148C] text-white border-[#4A148C]' : 'bg-white text-[#4A148C] border-[#4A148C] hover:bg-[#F3E5F5]'}`}
                >
                  <Filter size={16} />
                  <span className="hidden sm:inline">Categories</span>
                  {filters.excludedCategories.size > 0 &&
                    <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs font-bold">
                      {availableCategories.size - filters.excludedCategories.size}
                    </span>
                  }
                </button>
                {showCatDropdown && (
                  <div className="absolute top-12 right-0 w-64 md:w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-20 flex flex-col max-h-[350px]">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                      <span className="text-xs font-bold text-gray-600">Visibility</span>
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => setFilters({ ...filters, excludedCategories: new Set() })} className="text-[#4A148C] font-semibold">All</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => setFilters({ ...filters, excludedCategories: new Set(availableCategories) })} className="text-[#4A148C] font-semibold">None</button>
                      </div>
                    </div>
                    <div className="overflow-y-auto p-2">
                      {Array.from(availableCategories).sort().map(cat => (
                        <label key={cat} className="flex items-center p-2 text-sm cursor-pointer hover:bg-purple-50 rounded transition-colors">
                          <input type="checkbox" className="mr-3 accent-[#4A148C] w-4 h-4 rounded" checked={!filters.excludedCategories.has(cat)} onChange={() => toggleCategory(cat)} />
                          <span className={!filters.excludedCategories.has(cat) ? 'text-gray-800' : 'text-gray-400'}>{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-t border-gray-100 pt-4">
            {/* Month Selector Group */}
            <div className="flex items-center gap-1 bg-gray-50 rounded-full p-1 border border-gray-200 overflow-hidden w-full md:w-auto">
              <button
                onClick={toggleAllMonths}
                className={`p-2 rounded-full transition-all shrink-0 ${monthsAllSelected ? 'bg-[#4A148C] text-white' : 'bg-white text-gray-400 hover:text-[#4A148C]'}`}
                title="Toggle All Months"
              >
                <ListChecks size={18} />
              </button>
              <button
                onClick={() => setIsMultiMonthMode(!isMultiMonthMode)}
                className={`p-2 rounded-full transition-all shrink-0 ${isMultiMonthMode ? 'bg-[#4A148C] text-white' : 'bg-white text-gray-400 hover:text-[#4A148C]'}`}
                title="Toggle Multi-Month Mode"
              >
                <Layers size={18} />
              </button>

              <div className="flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide no-scrollbar px-1">
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, idx) => (
                  <button key={m} onClick={() => handleMonthClick(idx)} className={`px-3 py-1.5 rounded-full text-xs transition-all ${filters.months.has(idx) ? 'bg-[#4A148C] text-white font-bold' : 'bg-white text-gray-600 border border-gray-100'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 w-full md:w-auto justify-end pt-1">
              <button
                onClick={handleAIOptimize}
                disabled={isOptimizing || allData.length === 0}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all text-xs md:text-sm font-medium h-[40px] ${isOptimizing ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'}`}
              >
                {isOptimizing ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{isOptimizing ? 'AI...' : 'AI Cat.'}</span>
              </button>

              {allData.length > 0 && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadCSV}
                      disabled={allData.length === 0}
                      className="flex items-center gap-2 px-3 py-2 bg-[#2E7D32] text-white rounded-lg hover:bg-[#1B5E20] transition-colors text-xs md:text-sm font-medium shadow disabled:opacity-50 h-[40px]"
                      title="Save CSV"
                    >
                      <Download size={16} /> <span className="hidden sm:inline">Save</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 bg-white text-[#4A148C] border border-[#4A148C] rounded-lg hover:bg-[#F3E5F5] transition-colors text-xs md:text-sm font-medium h-[40px]"
                      title="Upload CSV"
                    >
                      <Upload size={16} /> <span className="hidden sm:inline">Upload</span>
                      <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileUpload} />
                    </button>
                  </div>
                  {activeFilename && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 italic">
                      <FileText size={10} /> {activeFilename}
                    </span>
                  )}
                </div>
              )}
            </div>

          </div>

          {(drillDown.type || drillDown.monthIdx !== null || drillDown.category || drillDown.account) && (
            <div className="flex gap-2 flex-wrap pt-2">
              {drillDown.type && <span className="bg-teal-50 text-teal-800 text-[10px] md:text-xs px-3 py-1 rounded-full border border-teal-200 flex items-center gap-1">Type: {drillDown.type} <XCircle size={12} className="cursor-pointer text-teal-600" onClick={() => clearDrillDown('type')} /></span>}
              {drillDown.monthIdx !== null && <span className="bg-teal-50 text-teal-800 text-[10px] md:text-xs px-3 py-1 rounded-full border border-teal-200 flex items-center gap-1">Month: {drillDown.monthIdx + 1} <XCircle size={12} className="cursor-pointer text-teal-600" onClick={() => clearDrillDown('monthIdx')} /></span>}
              {drillDown.category && <span className="bg-teal-50 text-teal-800 text-[10px] md:text-xs px-3 py-1 rounded-full border border-teal-200 flex items-center gap-1">Cat: {drillDown.category} <XCircle size={12} className="cursor-pointer text-teal-600" onClick={() => clearDrillDown('category')} /></span>}
              {drillDown.account && <span className="bg-teal-50 text-teal-800 text-[10px] md:text-xs px-3 py-1 rounded-full border border-teal-200 flex items-center gap-1">Acc: {drillDown.account} <XCircle size={12} className="cursor-pointer text-teal-600" onClick={() => clearDrillDown('account')} /></span>}
            </div>
          )}
        </div>

        {allData.length > 0 ? (
          <>
            <DashboardCharts
              allTransactions={allData}
              filters={filters}
              drillDown={drillDown}
              onDrillDown={(field: keyof DrillDownState, value: any) => setDrillDown(prev => ({ ...prev, [field]: value }))}
            />
            <TransactionTable data={tableData} />
          </>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-dashed border-purple-200 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-purple-50 text-[#4A148C] rounded-full flex items-center justify-center"><Upload size={32} /></div>
            <div><h3 className="text-xl font-bold text-gray-800 mb-2">No Data Available</h3><p className="text-gray-500 max-w-sm mx-auto">Upload your CSV file with 'Date' and 'Value (THB)' columns to see your financial analytics.</p></div>
            <label className="mt-4 px-8 py-3 bg-[#4A148C] text-white rounded-xl font-bold cursor-pointer hover:bg-[#7c43bd] transition-all shadow-lg hover:scale-105 active:scale-95">Select CSV File<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} /></label>
          </div>
        )}
      </div>

      <button onClick={() => setIsSidebarOpen(true)} className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-[#4A148C] text-white rounded-full px-5 py-3 md:px-6 md:py-4 shadow-xl z-40 flex items-center gap-2 font-bold hover:scale-105 transition-transform ${isSidebarOpen ? 'hidden' : 'flex'}`}>
        <Bot size={20} /> <span className="text-sm md:text-base">Chat AI</span>
      </button>

      <ChatSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} validTransactions={validDataForAI} currentFilters={filters} drillDown={drillDown} />

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-[#F3E5F5] rounded-t-2xl">
              <h3 className="text-lg md:text-xl font-bold text-[#4A148C] flex items-center gap-2"><Sparkles size={20} /> Review AI Suggestions</h3>
              <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-white/50 rounded-full"><X size={20} className="text-gray-600" /></button>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs md:text-sm text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr><th className="p-3 w-10 text-center"><input type="checkbox" checked={proposals.every(p => p.selected)} onChange={(e) => setProposals(prev => prev.map(p => ({ ...p, selected: e.target.checked })))} className="accent-[#4A148C]" /></th><th className="p-3 font-semibold text-gray-600">Original</th><th className="p-3 font-semibold text-gray-600 hidden sm:table-cell">Context</th><th className="p-3 font-semibold text-gray-600">New Category</th><th className="p-3 font-semibold text-gray-600 text-right">Items</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {proposals.map((p) => (
                    <tr key={p.key} className="hover:bg-gray-50">
                      <td className="p-3 text-center"><input type="checkbox" checked={p.selected} onChange={() => toggleProposal(p.key)} className="accent-[#4A148C] w-4 h-4" /></td>
                      <td className="p-3 text-red-500 font-medium line-through decoration-red-300">{p.originalCategory}</td>
                      <td className="p-3 text-[10px] text-gray-500 hidden sm:table-cell"><div className="font-bold">{p.account}</div><div className="truncate max-w-[150px]">{p.note}</div></td>
                      <td className="p-3"><input type="text" value={p.newCategory} onChange={(e) => handleCategoryEdit(p.key, e.target.value)} className="w-full border-b border-gray-300 focus:border-[#4A148C] bg-transparent font-bold text-green-700 outline-none" /></td>
                      <td className="p-3 text-right font-bold">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 md:p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl text-sm">Cancel</button>
              <button onClick={applyChanges} className="px-4 py-2 bg-[#4A148C] text-white font-bold rounded-xl shadow-lg text-sm">Apply Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
