import type { Metadata } from "next";
import { ScoreSettingsForm } from "@/components/score-settings-form";
import { PaymentSettingsForm } from "@/components/payment-settings-form";
import { requireProfile } from "@/lib/auth";
import { getPaymentQrSignedUrl, getPaymentSettings, getScoreSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireProfile(["super_admin"]);
  const [scoreSettings, paymentResult] = await Promise.all([getScoreSettings(), getPaymentSettings()]);
  const paymentQrUrl = paymentResult.settings ? await getPaymentQrSignedUrl(paymentResult.settings.qr_path) : null;
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">System</p><h1>Portal Settings</h1><p>Manage the transparent Growth Score rubric.</p></div></header>
      <section id="growth-score" className="panel settings-section"><div className="panel-title"><div><h2>Growth Score</h2><span>Changes recalculate eligible reports from the scoring launch date.</span></div></div><ScoreSettingsForm settings={scoreSettings} /></section>
      <section id="payments" className="panel settings-section section-gap"><div className="panel-title"><div><h2>Monthly Payments</h2><span>Upload the QR code and instructions shown to Students.</span></div></div>{paymentResult.available && paymentResult.settings ? <PaymentSettingsForm settings={paymentResult.settings} qrUrl={paymentQrUrl} /> : <div className="empty-state unavailable-state"><strong>Payment Settings Unavailable</strong><p>Apply the supplied database migration to enable monthly payments.</p></div>}</section>
    </main>
  );
}
