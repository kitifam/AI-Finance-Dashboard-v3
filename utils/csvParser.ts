
import { Transaction } from "../types";

export const parseCSV = (text: string): { transactions: Transaction[], years: Set<number>, categories: Set<string> } => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let headerIdx = -1;
  let idxDate = -1;
  let idxVal = -1;
  let idxCat = -1;
  let idxAcc = -1;
  let idxNote = -1;
  let idxFromTo = -1;

  // Scan the first 10 lines to find the header row
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const currentHeaders = lines[i].split(';').map(h => h.replace(/"/g, '').trim());
    const dIdx = currentHeaders.indexOf('Date');
    const vIdx = currentHeaders.indexOf('Value (THB)');
    
    if (dIdx !== -1 && vIdx !== -1) {
      headerIdx = i;
      idxDate = dIdx;
      idxVal = vIdx;
      idxCat = currentHeaders.indexOf('Category');
      idxAcc = currentHeaders.indexOf('Account');
      idxNote = currentHeaders.indexOf('Notes');
      idxFromTo = currentHeaders.indexOf('From/To');
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error("Invalid CSV Format. Could not find header row with 'Date' and 'Value (THB)'. Please check your CSV file structure.");
  }

  const transactions: Transaction[] = [];
  const years = new Set<number>();
  const categories = new Set<string>();

  // Start parsing from the line after the header
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.replace(/"/g, '').trim());
    
    // Basic validation to ensure the line has enough columns
    if (cols.length <= Math.max(idxDate, idxVal)) continue;

    const rawDate = cols[idxDate];
    const rawVal = parseFloat(cols[idxVal].replace(/,/g, '')); // Handle potential thousands separators
    let category = cols[idxCat] || "Uncategorized";
    const account = cols[idxAcc] || "General";
    
    let note = cols[idxNote] || "";
    const fromTo = idxFromTo !== -1 ? (cols[idxFromTo] || "") : "";

    // Cleansing Rule: If Note is empty but From/To exists, use From/To
    if (!note && fromTo) {
      note = fromTo;
    }

    if (isNaN(rawVal)) continue;

    // Cleansing Rule: Remove trailing '+' or '-' from category (e.g. "Investment+" -> "Investment")
    category = category.replace(/[+-]$/, "").trim();

    // Hardcoded cleansing rules from original logic
    if (category === "Transfer between accounts") continue;
    if (account.startsWith("Cr") && rawVal > 0) continue;
    if (category.startsWith("Modified Bal")) continue;
    if (category.startsWith("Credit card bill")) continue;

    let dateObj: Date;
    try {
        const parts = rawDate.split('/');
        if(parts.length === 3) {
            const m = parseInt(parts[0]) - 1; 
            const d = parseInt(parts[1]);
            let y = parseInt(parts[2]);
            if (y < 100) y += 2000;
            dateObj = new Date(y, m, d);
        } else { dateObj = new Date(rawDate); }
    } catch (e) { continue; }

    if (isNaN(dateObj.getTime())) continue;

    // Special Business Rule: Split Household Ake + Papa Mama ChildFood
    // If Category is "Household Ake" and Notes contain "Papa Mama ChildFood"
    if (category === "Household Ake" && note.includes("Papa Mama ChildFood")) {
      const amountHousehold = (rawVal * 2) / 3;
      const amountChild = rawVal / 3;

      // Part 1: Household Ake (2/3 amount)
      transactions.push({
        date: dateObj,
        amount: amountHousehold,
        category: "Household Ake",
        account,
        note: "Papa Mama",
        type: amountHousehold >= 0 ? 'Income' : 'Expense'
      });
      categories.add("Household Ake");

      // Part 2: F.Child (1/3 amount)
      transactions.push({
        date: dateObj,
        amount: amountChild,
        category: "F.Child",
        account,
        note: "F.Child",
        type: amountChild >= 0 ? 'Income' : 'Expense'
      });
      categories.add("F.Child");

      years.add(dateObj.getFullYear());
      continue; // Skip the standard push below
    }

    // Standard Transaction Push
    transactions.push({
      date: dateObj,
      amount: rawVal,
      category,
      account,
      note,
      type: rawVal >= 0 ? 'Income' : 'Expense'
    });

    years.add(dateObj.getFullYear());
    categories.add(category);
  }

  if (transactions.length === 0) {
    throw new Error("No valid transactions were found in the file after parsing.");
  }

  return { transactions, years, categories };
};
