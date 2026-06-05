// app/contact/page.tsx

import Link from 'next/link';
import { Mail, Phone, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import { LegalFooter } from '@/components/legal-footer';

export const metadata: Metadata = {
  title: 'Contact — Momentum Playbook',
  description: 'Get in touch with the Momentum Playbook team.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center px-4 py-16">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
            Momentum Playbook
          </span>
          <span className="text-[9px] text-[var(--text-faint)] tracking-[0.22em] uppercase font-semibold mt-0.5">
            Stage 2 only
          </span>
        </div>
      </div>

      <div
        className="w-full max-w-md rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8"
        style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
      >
        <h1 className="text-[22px] font-extrabold tracking-tight mb-1">Contact us</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8 leading-relaxed">
          Questions about your subscription, technical issues, or anything else — we&apos;re here to help.
        </p>

        <div className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#22D3EE]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-[#22D3EE]" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--text-muted)] mb-1">
                Email
              </div>
              <a
                href="mailto:asaf.abllin@gmail.com"
                className="text-[14px] font-semibold text-[var(--text-primary)] hover:text-[#22D3EE] transition-colors"
              >
                asaf.abllin@gmail.com
              </a>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                We typically respond within 1 business day.
              </p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#10F088]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Phone className="w-4 h-4 text-[#10F088]" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--text-muted)] mb-1">
                Phone
              </div>
              <a
                href="tel:+972529532231"
                className="text-[14px] font-semibold text-[var(--text-primary)] hover:text-[#10F088] transition-colors block"
              >
                052-9532231
              </a>
              <a
                href="tel:+972506953888"
                className="text-[14px] font-semibold text-[var(--text-primary)] hover:text-[#10F088] transition-colors block"
              >
                050-6953888
              </a>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                Sun–Thu, 9:00–18:00 Israel time.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-faint)] leading-relaxed">
            For billing issues, visit the{' '}
            <Link href="/settings?tab=billing" className="text-[#22D3EE] hover:underline">
              Billing tab in Settings
            </Link>
            {' '}to manage your subscription.
          </p>
        </div>
      </div>

      <div className="w-full mt-8">
        <LegalFooter />
      </div>
    </div>
  );
}
