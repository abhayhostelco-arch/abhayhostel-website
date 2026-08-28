import type { Metadata } from "next";
import { ScoreSettingsForm } from "@/components/score-settings-form";
import { requireProfile } from "@/lib/auth";
import { getScoreSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireProfile(["super_admin"]);
  const scoreSettings = await getScoreSettings();
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">System</p><h1>Portal Settings</h1><p>Manage the transparent Growth Score rubric.</p></div></header>
      <section id="growth-score" className="panel settings-section"><div className="panel-title"><div><h2>Growth Score</h2><span>Changes recalculate eligible reports from the scoring launch date.</span></div></div><ScoreSettingsForm settings={scoreSettings} /></section>
    </main>
  );
}
