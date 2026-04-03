
// services/gemini.ts
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, FilterState, DrillDownState } from "../types";

const formatCurrency = (val: number) => val.toLocaleString('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Helper to summarize data
const getSummary = (txs: Transaction[]) => {
  const totalIncome = txs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = txs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return { totalIncome, totalExpense, net: totalIncome - totalExpense, count: txs.length };
};

const generateContextPrompt = (allTransactions: Transaction[], filters: FilterState, drillDown?: DrillDownState): string => {
  if (allTransactions.length === 0) {
    return "The user has no data loaded.";
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // 1. Filter Logic matching the Dashboard view (for "Current Selection" context)
  const currentViewTransactions = allTransactions.filter(t => {
    const matchYear = filters.years.has(t.date.getFullYear());
    const matchMonth = filters.months.has(t.date.getMonth());
    if (!matchYear || !matchMonth) return false;
    if (drillDown) {
      if (drillDown.type && t.type !== drillDown.type) return false;
      if (drillDown.monthIdx !== null && t.date.getMonth() !== drillDown.monthIdx) return false;
      if (drillDown.category && t.category !== drillDown.category) return false;
      if (drillDown.account && t.account !== drillDown.account) return false;
    }
    return true;
  });

  // 2. Global Data Analysis (Cross-Time)
  // Group all data by Year to give AI perspective
  const yearlyStats: Record<number, { inc: number, exp: number, topCats: string[] }> = {};
  allTransactions.forEach(t => {
    const y = t.date.getFullYear();
    if (!yearlyStats[y]) yearlyStats[y] = { inc: 0, exp: 0, topCats: [] };
    if (t.amount > 0) yearlyStats[y].inc += t.amount;
    else yearlyStats[y].exp += Math.abs(t.amount);
  });

  // Simplified Yearly Summary string
  const globalYearlySummary = Object.entries(yearlyStats)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([y, stats]) => `Year ${y}: Inc ${formatCurrency(stats.inc)}, Exp ${formatCurrency(stats.exp)}`)
    .join("\n    ");

  // Get Top 10 All-time Expenses for reference
  const topAllTimeExpenses = [...allTransactions]
    .filter(t => t.amount < 0)
    .sort((a, b) => a.amount - b.amount) // Most negative first
    .slice(0, 10)
    .map(t => `[${t.date.toLocaleDateString('en-GB')}] ${t.category}: ${formatCurrency(t.amount)} (${t.note})`)
    .join("\n    ");

  // Current Selection Context
  const selectedYearsStr = Array.from(filters.years).sort().join(", ");
  const currentStats = getSummary(currentViewTransactions);
  
  return `
    You are an intelligent financial assistant. 
    You have access to the COMPLETE set of uploaded data as well as the USER'S CURRENT DASHBOARD SELECTION.

    --- GLOBAL DATA OVERVIEW (ALL UPLOADED DATA) ---
    Total Records: ${allTransactions.length}
    Yearly Trends:
    ${globalYearlySummary}

    Largest Expenses (All Time):
    ${topAllTimeExpenses}

    --- CURRENT DASHBOARD VIEW (WHAT USER SEES NOW) ---
    Active Filters: Years [${selectedYearsStr}], DrillDown: ${JSON.stringify(drillDown || 'None')}
    Total Income: ${formatCurrency(currentStats.totalIncome)}
    Total Expense: ${formatCurrency(currentStats.totalExpense)}
    Count: ${currentStats.count}

    --- INSTRUCTIONS ---
    1. If the user asks about broad patterns (e.g., "Which year did I spend most?"), look at the GLOBAL DATA OVERVIEW.
    2. If the user asks about what's on screen, prioritize the CURRENT DASHBOARD VIEW.
    3. Reply in Thai.
    4. Use Markdown for readability:
       - Bullet points for lists.
       - **Bold** for emphasis on amounts and dates.
       - Separate sections with blank lines.
    5. Be helpful and proactive in spotting trends across different years if requested.
  `;
};

export const sendMessageToGemini = async (message: string, validTransactions: Transaction[], filters: FilterState, drillDown?: DrillDownState): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const systemInstruction = generateContextPrompt(validTransactions, filters, drillDown);
    
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: systemInstruction 
      }
    });
    
    return response.text || "ขออภัย ระบบไม่สามารถประมวลผลคำตอบได้";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI (กรุณาตรวจสอบ Console Log)";
  }
};

export const optimizeTransactionCategories = async (
  uniqueSignatures: { id: number; category: string; note: string; account: string }[]
): Promise<Array<{ id: number; newCategory: string }>> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are a specialized data cleaning AI. I will provide a list of transaction records.
        Your task is to analyze the 'category', 'note', and 'account' to determine the most appropriate, clean, and readable personal finance category.
        
        Standard Categories to use (but not limited to):
        Food & Dining, Transportation, Shopping, Bills & Utilities, Transfer, Income, Health & Wellness, Home, Entertainment, Travel, Miscellaneous.

        INSTRUCTIONS:
        1. Fix vague categories (e.g. "7-11" -> "Shopping" or "Food").
        2. Group similar items (e.g. "Grab", "Uber", "BTS" -> "Transportation").
        3. Keep 'Income' or 'Salary' distinct.
        4. Return the result as a JSON Array of objects with 'id' and 'newCategory'.

        Input Data:
        ${JSON.stringify(uniqueSignatures.slice(0, 150))}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.NUMBER },
              newCategory: { type: Type.STRING }
            },
            required: ["id", "newCategory"]
          }
        }
      }
    });

    const jsonText = response.text || "[]";
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("AI Optimization Error:", error);
    throw new Error("Failed to optimize categories using AI.");
  }
};
