"use client";

import { useId } from "react";
import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme";

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeControl() {
  const { preference, hydrated, setPreference } = useTheme();
  const controlId = useId();
  const groupName = `theme-${controlId}`;

  return (
    <fieldset className="theme-control" disabled={!hydrated} aria-busy={!hydrated || undefined}>
      <legend>Theme</legend>
      <div className="theme-control-options">
        {options.map((option) => {
          const id = `${controlId}-${option.value}`;
          return (
            <label key={option.value} htmlFor={id}>
              <input
                id={id}
                name={groupName}
                type="radio"
                value={option.value}
                checked={hydrated && preference === option.value}
                onChange={() => setPreference(option.value)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
