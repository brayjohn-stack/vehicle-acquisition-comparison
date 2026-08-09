import { useEffect, useState, type ReactNode } from 'react';

function parseNumeric(raw: string): number {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

function useNumericText(value: number, format: (n: number) => string) {
  const [text, setText] = useState(() => format(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(format(value));
  }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps
  return { text, setText, focused, setFocused };
}

const moneyText = (n: number) =>
  n === 0 ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>
        {label}
        {hint ? <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}> · {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  const { text, setText, setFocused } = useNumericText(value, moneyText);
  return (
    <div className="input">
      <span className="affix">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? '0'}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          setText(moneyText(parseNumeric(e.target.value)));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseNumeric(e.target.value));
        }}
      />
    </div>
  );
}

/** Displays a human percentage (6.25) while storing a decimal rate (0.0625). */
export function PercentInput({
  value,
  onChange,
  decimals = 3,
}: {
  value: number;
  onChange: (decimalRate: number) => void;
  decimals?: number;
}) {
  const format = (n: number) => {
    if (n === 0) return '';
    const pct = n * 100;
    return String(parseFloat(pct.toFixed(decimals)));
  };
  const { text, setText, setFocused } = useNumericText(value, format);
  return (
    <div className="input">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="0"
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          setText(format(parseNumeric(e.target.value) / 100));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseNumeric(e.target.value) / 100);
        }}
      />
      <span className="affix suffix">%</span>
    </div>
  );
}

export function IntegerInput({ value, onChange, suffix }: { value: number; onChange: (n: number) => void; suffix?: string }) {
  const format = (n: number) => (n === 0 ? '' : String(Math.round(n)));
  const { text, setText, setFocused } = useNumericText(value, format);
  return (
    <div className="input">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder="0"
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          setText(format(Math.round(parseNumeric(e.target.value))));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(Math.round(parseNumeric(e.target.value)));
        }}
      />
      {suffix ? <span className="affix suffix">{suffix}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="input">
      <input
        type="text"
        className="text-left"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
