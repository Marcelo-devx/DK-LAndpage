import React, { useRef } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
}

const OtpInput: React.FC<OtpInputProps> = ({ value, onChange }) => {
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref4 = useRef<HTMLInputElement>(null);
  const ref5 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1, ref2, ref3, ref4, ref5];

  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleChange = (i: number, char: string) => {
    const d = char.replace(/\D/g, '').slice(-1);
    const arr = [...digits];
    arr[i] = d;
    onChange(arr.join(''));
    if (d && i < 5) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[i]) {
        if (i > 0) {
          const arr = [...digits];
          arr[i - 1] = '';
          onChange(arr.join(''));
          refs[i - 1].current?.focus();
        }
      } else {
        const arr = [...digits];
        arr[i] = '';
        onChange(arr.join(''));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs[i - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs[i + 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const arr = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
      onChange(arr.join(''));
      refs[Math.min(pasted.length, 5)].current?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 border-stone-200 bg-white text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-all shadow-sm"
        />
      ))}
    </div>
  );
};

export default OtpInput;
