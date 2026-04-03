export interface Transaction {
  date: Date;
  amount: number;
  category: string;
  account: string;
  note: string;
  type: 'Income' | 'Expense';
}

export type TrendViewMode = 'monthly' | 'seasonal' | 'yearly';

export interface FilterState {
  years: Set<number>;
  months: Set<number>;
  excludedCategories: Set<string>;
}

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

export interface DrillDownState {
  type: 'Income' | 'Expense' | null;
  monthIdx: number | null;
  category: string | null;
  account: string | null;
}