import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="About Abhay Hostel">
        <Brand />
        <div className="auth-copy">
          <p className="eyebrow">Student Development System</p>
          <h1>Daily discipline.<br /><span>Measurable progress.</span></h1>
          <p className="tagline">A Place to Stay, A Place to Grow</p>
          <p className="supporting">
            A secure workspace for Students, Mentors, and hostel administration
            to record routines, review progress, and build consistent habits.
          </p>
        </div>
        <p className="auth-footer">Abhay Hostel · Dhanbad</p>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
