import { useEffect, useState } from "react";
import { formatISODateToBR, maskBRDateInput, parseBRDateToISO } from "../lib/dateBR";

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
};

/** Campo de data em texto `dd/mm/aaaa`; valor externo continua ISO `yyyy-mm-dd`. */
export function DateInputBR({ value, onChange, id, className, disabled, required }: Props) {
  const [text, setText] = useState(() => formatISODateToBR(value));

  useEffect(() => {
    setText(formatISODateToBR(value));
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      maxLength={10}
      disabled={disabled}
      required={required}
      value={text}
      onChange={(e) => {
        const masked = maskBRDateInput(e.target.value);
        setText(masked);
        const iso = parseBRDateToISO(masked);
        if (iso) onChange(iso);
      }}
      onBlur={() => {
        const iso = parseBRDateToISO(text);
        if (iso) {
          onChange(iso);
          setText(formatISODateToBR(iso));
        } else {
          setText(formatISODateToBR(value));
        }
      }}
      className={className}
    />
  );
}
