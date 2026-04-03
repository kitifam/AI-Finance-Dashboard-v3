import React, { useState } from 'react';
import { Transaction } from '../types';
import { ArrowUpDown } from 'lucide-react';

interface Props {
  data: Transaction[];
}

const TransactionTable: React.FC<Props> = ({ data }) => {
  const [sortCol, setSortCol] = useState<keyof Transaction>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (col: keyof Transaction) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const valA = a[sortCol];
    const valB = b[sortCol];
    
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="bg-white p-5 rounded-xl shadow-[0_4px_20px_rgba(74,20,140,0.08)] flex flex-col h-[500px]">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
        <h3 className="text-[#4A148C] font-bold flex items-center gap-2">
          <span className="text-lg">History</span>
          <span className="text-xs bg-[#4A148C] text-white px-2 py-0.5 rounded-full">
            {data.length.toLocaleString()} items
          </span>
        </h3>
      </div>
      
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-[#FAFAFA] z-10">
            <tr>
              {[
                { label: 'Date', key: 'date' },
                { label: 'Category', key: 'category' },
                { label: 'Note', key: 'note' },
                { label: 'Account', key: 'account' },
                { label: 'Amount', key: 'amount', right: true }
              ].map((th) => (
                <th 
                  key={th.key}
                  onClick={() => handleSort(th.key as keyof Transaction)}
                  className={`p-3 text-left font-semibold text-gray-500 border-b-2 border-gray-100 cursor-pointer hover:text-[#4A148C] transition-colors ${th.right ? 'text-right' : ''}`}
                >
                  <div className={`flex items-center gap-1 ${th.right ? 'justify-end' : ''}`}>
                    {th.label} <ArrowUpDown size={12} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-8 text-gray-400">
                  No transactions found. Upload a CSV.
                </td>
              </tr>
            ) : (
              sortedData.slice(0, 500).map((t, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3 text-gray-700">
                    {/* Force Gregorian Calendar (AD Year) via 'en-GB' locale */}
                    {t.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="p-3 text-gray-700">{t.category}</td>
                  <td className="p-3 text-gray-500 truncate max-w-[200px]">{t.note || '-'}</td>
                  <td className="p-3 text-gray-700">{t.account}</td>
                  <td className={`p-3 text-right font-medium ${t.amount >= 0 ? 'text-[#2E7D32]' : 'text-[#C62828]'}`}>
                    {t.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;