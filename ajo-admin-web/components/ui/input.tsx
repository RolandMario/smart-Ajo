import { InputHTMLAttributes, LabelHTMLAttributes, forwardRef } from "react";

export const Label = ({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={`block text-sm font-medium text-ink-soft mb-1.5 ${className}`}
    {...props}
  />
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus-visible:outline-2 focus-visible:outline-accent ${className}`}
      {...props}
    />
  ),
);

Input.displayName = "Input";
