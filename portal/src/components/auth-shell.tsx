import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="About Abhay Hostel">
        <Brand />
        <div className="auth-copy">
          <p className="eyebrow">Disciplined daily progress</p>
          <h1>
            Stay focused. <span>Grow daily.</span>
          </h1>
          <p className="tagline">A Place to Stay, A Place to Grow</p>
          <p className="supporting">
            Record daily routines, understand progress, and help every student
            build consistent habits in a secure environment.
          </p>
        </div>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
