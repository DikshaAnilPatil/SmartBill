import { useState, useEffect, useRef } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Eye,
  EyeOff,
  Plus,
  Minus,
} from "lucide-react";

export function Btn({
  children,
  variant = "primary",
  size = "md",
  onClick,
  className = "",
  disabled = false,
  icon,
}) {
  const base =
    "inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer select-none";
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-2.5 text-sm",
  };
  const variants = {
    primary:
      "text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors",
    secondary:
      "bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors",
    outline:
      "border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors",
    ghost: "text-gray-600 hover:bg-gray-100 transition-colors",
    danger:
      "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={variant === "primary" ? { backgroundColor: "var(--primary, #2563eb)", color: "#ffffff" } : {}}
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      {icon && icon}
      {children}
    </button>
  );
}

export function Badge({ label, variant = "gray" }) {
  const v = {
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    yellow: "bg-amber-50 text-amber-700 border border-amber-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    gray: "bg-gray-100 text-gray-600 border border-gray-200",
    purple: "bg-purple-50 text-purple-700 border border-purple-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${v[variant]}`}
    >
      {label}
    </span>
  );
}

export function statusBadge(status) {
  const map = {
    Active: "green",
    Inactive: "gray",
    Paid: "green",
    Pending: "yellow",
    Overdue: "red",
    Received: "green",
    Suspended: "red",
    Pro: "blue",
    Enterprise: "purple",
    Starter: "gray",
  };
  return <Badge label={status} variant={map[status] ?? "gray"} />;
}

export function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-md border border-gray-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function FixedPhoneInput({
  label,
  icon,
  placeholder,
  error,
  value: controlledValue,
  onChange,
}) {
  const PREFIX = "+91 ";
  const TEN = 10;
  const inputRef = useRef(null);

  const [internalValue, setInternalValue] = useState(PREFIX);
  const value = controlledValue ?? internalValue;

  const getDigits = (v) => {
    const raw = String(v ?? "");
    const withoutPrefix = raw.startsWith(PREFIX)
      ? raw.slice(PREFIX.length)
      : raw;
    return withoutPrefix.replace(/\D/g, "").slice(0, TEN);
  };

  const validate = (v) => {
    const raw = String(v ?? "");
    if (!raw || !raw.trim()) return "Phone field is required.";

    if (!raw.startsWith(PREFIX)) {
      return "Phone must contain exactly 10 numeric digits.";
    }

    const digitsPart = raw.slice(PREFIX.length);
    if (!digitsPart) return "Phone field is required.";

    if (digitsPart.length !== TEN) {
      return "Phone number must be exactly 10 digits.";
    }
    if (!/^\d{10}$/.test(digitsPart)) return "Phone number must be numeric.";

    return "";
  };

  const normaliseToFullValue = (digits) => `${PREFIX}${digits}`;
  const updateValue = (next) => {
    if (typeof onChange === "function") onChange(next);
    else setInternalValue(next);
  };

  const setCaret = (position) => {
    setTimeout(() => {
      try {
        inputRef.current?.setSelectionRange(position, position);
      } catch {}
    }, 0);
  };

  const setCaretToEnd = () => {
    const digitsLength = value.slice(PREFIX.length).length;
    const caret = Math.min(PREFIX.length + digitsLength, PREFIX.length + TEN);
    setCaret(caret);
  };

  useEffect(() => {
    setCaretToEnd();
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onKeyDown={(e) => {
            const input = inputRef.current;
            const selectionStart = input?.selectionStart ?? 0;
            const selectionEnd = input?.selectionEnd ?? 0;
            const prefixLength = PREFIX.length;

            if (e.key === "Backspace") {
              e.preventDefault();
              if (selectionStart <= prefixLength) {
                setCaretToEnd();
                return;
              }

              const digitStart = selectionStart - prefixLength;
              const digitEnd = selectionEnd - prefixLength;
              const currentDigits = value.slice(prefixLength);
              const start = Math.max(
                0,
                Math.min(digitStart, currentDigits.length),
              );
              const end = Math.max(0, Math.min(digitEnd, currentDigits.length));
              const nextDigits =
                currentDigits.slice(
                  0,
                  start - (selectionStart === selectionEnd ? 1 : 0),
                ) + currentDigits.slice(end);
              const caretPosition = Math.max(
                0,
                start - (selectionStart === selectionEnd ? 1 : 0),
              );
              updateValue(normaliseToFullValue(nextDigits));
              setCaret(prefixLength + caretPosition);
              return;
            }

            if (e.key === "Delete") {
              e.preventDefault();
              if (selectionStart < prefixLength) {
                setCaretToEnd();
                return;
              }

              const digitStart = selectionStart - prefixLength;
              const digitEnd = selectionEnd - prefixLength;
              const currentDigits = value.slice(prefixLength);
              const start = Math.max(
                0,
                Math.min(digitStart, currentDigits.length),
              );
              const end = Math.max(0, Math.min(digitEnd, currentDigits.length));
              const nextDigits =
                currentDigits.slice(0, start) +
                currentDigits.slice(
                  end + (selectionStart === selectionEnd ? 1 : 0),
                );
              const caretPosition = start;
              updateValue(normaliseToFullValue(nextDigits));
              setCaret(prefixLength + caretPosition);
              return;
            }

            if (selectionStart < prefixLength) {
              e.preventDefault();
              setCaretToEnd();
              return;
            }

            if (e.key === "ArrowLeft" && selectionStart <= prefixLength) {
              e.preventDefault();
              setCaretToEnd();
              return;
            }

            if (e.key === "ArrowRight" && selectionStart < prefixLength) {
              e.preventDefault();
              setCaretToEnd();
              return;
            }

            if (e.key.length === 1 && !/\d/.test(e.key)) {
              if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
            }
          }}
          onBeforeInput={(e) => {
            const data = e.data;
            const selectionStart = inputRef.current?.selectionStart ?? 0;
            if (selectionStart < PREFIX.length) {
              e.preventDefault();
              return;
            }
            if (data && !/^\d+$/.test(data)) e.preventDefault();
          }}
          onChange={(e) => {
            const raw = String(e.target.value ?? "");
            const digits = getDigits(raw);
            const next = normaliseToFullValue(digits);
            updateValue(next);

            setTimeout(() => {
              try {
                const caret = Math.min(
                  PREFIX.length + digits.length,
                  PREFIX.length + TEN,
                );
                inputRef.current?.setSelectionRange(caret, caret);
              } catch {}
            }, 0);
          }}
          placeholder={placeholder}
          inputMode="numeric"
          className={`w-full border border-gray-300 rounded-md bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors py-2 ${icon ? "pl-9 pr-3" : "px-3"} ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""}`}
        />
      </div>
      {error ? <p className="text-xs text-red-600 mt-0.5">{error}</p> : null}
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  icon,
  className = "",
  inputClassName = "",
  error,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword && showPassword ? "text" : type;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          type={actualType}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-md bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors py-2 ${icon ? "pl-9" : "px-3"} ${isPassword ? "pr-10" : "pr-3"} ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""} ${inputClassName}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            tabIndex="-1"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

export function Select({ label, value, onChange, options = [] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="border border-gray-300 rounded-md bg-white text-sm text-gray-900 px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        {options.map((o) => {
          const val = typeof o === "object" && o !== null ? o.value : o;
          const lbl = typeof o === "object" && o !== null ? o.label : o;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function StatCard({ label, value, sub, trend, icon, color }) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-500"}`}
          >
            {trend === "up" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : trend === "down" ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : null}
            {sub}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  );
}

export function Modal({ title, onClose, children, className = "max-w-lg" }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className={`w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-150 ${className}`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ message, onConfirm, onCancel, confirmText = "Delete", cancelText = "Cancel" }) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200 dark:border-red-800/60">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-base">Are you sure?</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <Btn variant="outline" onClick={onCancel} className="flex-1">
            {cancelText}
          </Btn>
          <Btn
            variant="danger"
            onClick={onConfirm}
            className="flex-1 bg-red-600 text-white hover:bg-red-700 border-0 shadow-sm"
          >
            {confirmText}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function StepperInput({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  className = "",
  inputClassName = "",
}) {
  const handleDecrement = () => {
    const next = Number(value) - step;
    if (next >= min) onChange(next);
  };
  const handleIncrement = () => {
    const next = Number(value) + step;
    if (next <= max) onChange(next);
  };

  return (
    <div
      className={`flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={handleDecrement}
        className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const val = e.target.value === "" ? "" : Number(e.target.value);
          onChange(val);
        }}
        min={min}
        max={max}
        className={`flex-1 text-center text-sm font-semibold text-slate-900 dark:text-white bg-transparent outline-none focus:ring-0 px-1 py-1 font-mono ${inputClassName}`}
      />
      <button
        type="button"
        onClick={handleIncrement}
        className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-4 max-w-xs">{sub}</p>
      {action}
    </div>
  );
}

export function Toast({ message, type, onClose }) {
  const colors = {
    success: "bg-emerald-600",
    error: "bg-red-500",
    info: "bg-red-600",
  };
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-xl ${colors[type]}`}
    >
      {type === "success" && <CheckCircle className="w-4 h-4" />}
      {type === "error" && <XCircle className="w-4 h-4" />}
      {type === "info" && <Info className="w-4 h-4" />}
      {message}
      <button onClick={onClose}>
        <X className="w-4 h-4 opacity-70 hover:opacity-100" />
      </button>
    </div>
  );
}



