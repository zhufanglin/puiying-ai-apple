"use client";

import { Search, Filter, X } from "lucide-react";

interface FilterField {
  key: string;
  label: string;
  type?: "text" | "select" | "date";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  onSearch: () => void;
}

export default function FilterBar({ fields, values, onChange, onReset, onSearch }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white rounded-lg border border-gray-200">
      <Filter size={16} className="text-gray-400" />
      {fields.map((field) => (
        <div key={field.key} className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">{field.label}</label>
          {field.type === "select" && field.options ? (
            <select
              value={values[field.key] || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-primary-400"
            >
              <option value="">全部</option>
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type || "text"}
              placeholder={field.placeholder || "请输入..."}
              value={values[field.key] || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 w-36 focus:outline-none focus:border-primary-400"
            />
          )}
        </div>
      ))}
      <button
        onClick={onSearch}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-primary-500 rounded hover:bg-primary-600"
      >
        <Search size={14} /> 搜索
      </button>
      <button
        onClick={onReset}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <X size={14} /> 重置
      </button>
    </div>
  );
}
