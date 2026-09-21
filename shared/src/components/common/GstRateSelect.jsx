import React, { useMemo } from "react";
import { GST_RATES } from "../../constants/gstRates";

/**
 * Reusable Indian GST Rate Dropdown Selector
 * @param {Object} props
 * @param {string} [props.label] - Field label above select
 * @param {number|string} props.value - Selected GST rate (e.g. 18 or "18")
 * @param {Function} props.onChange - Callback with the new GST rate (number or string)
 * @param {boolean} [props.compact=false] - Compact mode for table rows
 * @param {string} [props.className] - Additional wrapper/select class names
 * @param {boolean} [props.disabled=false] - Whether dropdown is disabled
 */
export default function GstRateSelect({
  label = "GST Rate",
  value = 18,
  onChange,
  compact = false,
  className = "",
  disabled = false,
}) {
  const numericVal = value === "" || value === null || value === undefined ? "" : Number(value);

  // Check if current value is custom (not in standard GST_RATES)
  const isCustom = useMemo(() => {
    if (numericVal === "") return false;
    return !GST_RATES.some((r) => Number(r.value) === numericVal);
  }, [numericVal]);

  const allOptions = useMemo(() => {
    if (isCustom && numericVal !== "") {
      return [
        { value: numericVal, label: `${numericVal}% (Custom Rate)` },
        ...GST_RATES,
      ];
    }
    return GST_RATES;
  }, [isCustom, numericVal]);

  if (compact) {
    return (
      <select
        value={numericVal}
        onChange={(e) => {
          const val = e.target.value === "" ? 0 : Number(e.target.value);
          onChange?.(val);
        }}
        disabled={disabled}
        className={`bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md py-1.5 px-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center font-mono cursor-pointer ${className}`}
      >
        {allOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value}%
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        value={numericVal}
        onChange={(e) => {
          const val = e.target.value === "" ? 0 : Number(e.target.value);
          onChange?.(val);
        }}
        disabled={disabled}
        className="w-full border border-gray-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
      >
        {allOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
