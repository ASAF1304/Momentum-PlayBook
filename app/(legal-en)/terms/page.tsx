import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Momentum Playbook',
  description: 'Terms of Service for Momentum Playbook, a stock trading journal SaaS.',
};

const TOC = [
  { id: 'definitions',        label: '1. Definitions' },
  { id: 'acceptance',         label: '2. Acceptance of Terms' },
  { id: 'service',            label: '3. Description of Service' },
  { id: 'permitted-use',      label: '4. Permitted and Prohibited Use' },
  { id: 'subscription',       label: '5. Subscription and Payment' },
  { id: 'no-refund',          label: '6. No-Refund Policy' },
  { id: 'financial',          label: '7. Financial Disclaimer' },
  { id: 'ip',                 label: '8. Intellectual Property' },
  { id: 'user-content',       label: '9. User Content' },
  { id: 'termination',        label: '10. Account Termination' },
  { id: 'indemnification',    label: '11. Indemnification' },
  { id: 'warranties',         label: '12. Disclaimer of Warranties' },
  { id: 'liability',          label: '13. Limitation of Liability' },
  { id: 'amendments',         label: '14. Amendments' },
  { id: 'governing-law',      label: '15. Governing Law and Jurisdiction' },
  { id: 'contact',            label: '16. Contact' },
];

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-none text-[var(--text-secondary)] leading-relaxed">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2 not-prose">
          Terms of Service
        </h1>
        <p className="text-xs text-[var(--text-faint)] not-prose">
          Effective Date: June 5, 2026 &nbsp;·&nbsp; Last Updated: June 5, 2026
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="not-prose mb-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
          Table of Contents
        </p>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {TOC.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      <div className="space-y-10">

        <section id="definitions" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">1. Definitions</h2>
          <p>
            For the purposes of these Terms of Service, the following definitions apply:
          </p>
          <ul className="space-y-2 ml-4 list-disc">
            <li>
              <strong className="text-[var(--text-primary)]">&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;</strong> means Asaf Ablin,
              an Israeli sole proprietor (<em>עוסק פטור</em>), operating Momentum Playbook.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&ldquo;Service&rdquo;</strong> means the Momentum Playbook web application accessible at{' '}
              <span className="font-mono text-sm">momentum-playbook.vercel.app</span> and any associated APIs, features, or content
              provided by the Company.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&ldquo;User&rdquo;, &ldquo;you&rdquo;, &ldquo;your&rdquo;</strong> means any individual or entity that
              accesses or uses the Service.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&ldquo;Subscription&rdquo;</strong> means a paid recurring plan granting access to premium features
              of the Service, billed through Paddle.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&ldquo;Content&rdquo;</strong> means any data, files, text, trade records, spreadsheets, or other
              materials that a User uploads, imports, or otherwise submits to the Service.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">&ldquo;Paddle&rdquo;</strong> means Paddle.com Market Limited, our authorised Merchant of Record for
              payment processing.
            </li>
          </ul>
        </section>

        <section id="acceptance" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">2. Acceptance of Terms</h2>
          <p>
            By accessing, registering for, or using the Service in any manner, you confirm that you are at least 18 years
            of age and that you have read, understood, and agree to be legally bound by these Terms of Service and our{' '}
            <a href="/privacy" className="text-[#22D3EE] hover:underline">Privacy Policy</a>.
          </p>
          <p>
            If you are using the Service on behalf of a company or other legal entity, you represent that you have the
            authority to bind that entity to these Terms. If you do not have such authority, or if you do not agree with
            these Terms, you may not access or use the Service.
          </p>
        </section>

        <section id="service" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">3. Description of Service</h2>
          <p>
            Momentum Playbook is a software-as-a-service (&ldquo;SaaS&rdquo;) trading journal platform that enables traders to
            record, organise, analyse, and review their securities trading activity. Core features include:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Importing trade data from Excel and CSV files</li>
            <li>Visual analytics including equity curves, win-rate statistics, and position-sizing tools</li>
            <li>Daily Stage 2 stock screening based on Minervini&apos;s Trend Template</li>
            <li>Playbook and watchlist management</li>
          </ul>
          <p>
            <strong className="text-[var(--text-primary)]">The Service is a record-keeping and analytical tool only.</strong>{' '}
            It does not provide investment advice, portfolio management, brokerage services, or any regulated financial
            service. See Section 7 for the full Financial Disclaimer.
          </p>
        </section>

        <section id="permitted-use" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">4. Permitted and Prohibited Use</h2>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">4.1 Permitted Use</h3>
          <p>
            Subject to these Terms and the payment of applicable Subscription fees, the Company grants you a limited,
            non-exclusive, non-transferable, revocable licence to access and use the Service solely for your own
            personal or internal business record-keeping purposes.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">4.2 Prohibited Use</h3>
          <p>You agree that you will not:</p>
          <ul className="space-y-2 ml-4 list-disc">
            <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service;</li>
            <li>Copy, reproduce, distribute, sublicense, sell, resell, or commercially exploit the Service or any portion thereof;</li>
            <li>Use the Service to provide investment advice, financial planning, or similar regulated services to third parties, whether or not for compensation;</li>
            <li>Share, sell, or transfer your account credentials or access rights to any other person;</li>
            <li>Access the Service by automated means (bots, scrapers, crawlers) without prior written consent;</li>
            <li>Upload or transmit malicious code, viruses, ransomware, or any content that is unlawful, harmful, defamatory, or infringing on third-party rights;</li>
            <li>Attempt to gain unauthorised access to any part of the Service, its servers, or any related systems;</li>
            <li>Use the Service in violation of any applicable Israeli or international law or regulation;</li>
            <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
          </ul>
          <p>
            Violation of these prohibitions may result in immediate termination of your account and, where applicable,
            legal action.
          </p>
        </section>

        <section id="subscription" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">5. Subscription and Payment</h2>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">5.1 Subscription Plans</h3>
          <p>
            The Service is offered on a subscription basis. Available plans, pricing, and billing cycles are described on
            the <a href="/pricing" className="text-[#22D3EE] hover:underline">Pricing page</a>. All prices are quoted in the
            applicable currency displayed at checkout and are inclusive of any applicable taxes where Paddle is required to
            collect them.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">5.2 Free Trial</h3>
          <p>
            New accounts may be offered a free trial period as displayed on the Pricing page. At the end of the trial,
            your account will automatically convert to a paid subscription using the payment method you provided, unless
            you cancel before the trial ends.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">5.3 Payment Processing</h3>
          <p>
            All payments are processed by <strong className="text-[var(--text-primary)]">Paddle.com Market Limited</strong>{' '}
            (&ldquo;Paddle&rdquo;), acting as our Merchant of Record. Paddle handles all billing, invoicing, and tax compliance.
            By purchasing a Subscription, you also agree to Paddle&apos;s{' '}
            <a href="https://www.paddle.com/legal/buyer-terms" target="_blank" rel="noopener noreferrer" className="text-[#22D3EE] hover:underline">
              Buyer Terms of Service
            </a>.
            The Company does not store, process, or have access to your credit card details.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">5.4 Automatic Renewal</h3>
          <p>
            Subscriptions renew automatically at the end of each billing cycle (monthly or annual, as applicable) at the
            then-current price, unless cancelled before the renewal date. You will receive advance notice of any price
            changes that affect your renewal.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">5.5 Cancellation</h3>
          <p>
            You may cancel your Subscription at any time through your account settings at{' '}
            <a href="/billing" className="text-[#22D3EE] hover:underline">/billing</a> or by contacting us at{' '}
            <a href="mailto:asaf.abllin@gmail.com" className="text-[#22D3EE] hover:underline">asaf.abllin@gmail.com</a>.
            Cancellation takes effect at the end of the current paid billing period; you will retain access to premium
            features until that date.
          </p>
        </section>

        <section id="no-refund" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">6. No-Refund Policy</h2>
          <p>
            <strong className="text-[var(--text-primary)]">
              ALL SUBSCRIPTION FEES PAID ARE NON-REFUNDABLE.
            </strong>
          </p>
          <p>
            Except as expressly required by applicable mandatory law (including the Israeli Consumer Protection Law,
            5741-1981, and EU Directive 2011/83/EU for EEA-resident consumers), the Company does not issue refunds or
            credits for:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Any partial use of the Service during a billing period;</li>
            <li>Features or functionality you chose not to use;</li>
            <li>Early cancellation of a Subscription;</li>
            <li>Account termination resulting from a breach of these Terms.</li>
          </ul>
          <p>
            If you believe a charge was made in error, please contact us within 30 days of the charge at{' '}
            <a href="mailto:asaf.abllin@gmail.com" className="text-[#22D3EE] hover:underline">asaf.abllin@gmail.com</a>.
            We will investigate and respond within 10 business days.
          </p>
          <p>
            Chargebacks initiated without first contacting us may result in immediate account suspension pending
            resolution.
          </p>
        </section>

        <section id="financial" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">7. Financial Disclaimer</h2>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 not-prose">
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-amber-400 uppercase text-xs tracking-wider block mb-2">Important Notice</strong>
              THE SERVICE IS A PERSONAL RECORD-KEEPING AND ANALYTICAL TOOL ONLY. NOTHING CONTAINED IN OR PROVIDED
              THROUGH THE SERVICE CONSTITUTES FINANCIAL ADVICE, INVESTMENT ADVICE, TRADING ADVICE, OR ANY OTHER
              TYPE OF PROFESSIONAL ADVICE. THE COMPANY IS NOT REGISTERED AS A FINANCIAL ADVISER, INVESTMENT
              MANAGER, OR PORTFOLIO MANAGER UNDER ISRAEL&apos;S REGULATION OF INVESTMENT ADVICE, INVESTMENT MARKETING
              AND PORTFOLIO MANAGEMENT LAW, 5755-1995, OR UNDER ANY OTHER APPLICABLE REGULATION.
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">
              ALL TRADING AND INVESTMENT DECISIONS ARE MADE BY YOU EXCLUSIVELY, AT YOUR OWN RISK. THE COMPANY
              ACCEPTS NO RESPONSIBILITY OR LIABILITY FOR ANY LOSSES, DAMAGES, OR COSTS ARISING FROM OR RELATED TO
              YOUR TRADING DECISIONS, REGARDLESS OF WHETHER THOSE DECISIONS WERE INFORMED IN ANY WAY BY THE SERVICE.
              PAST PERFORMANCE REFLECTED IN YOUR JOURNAL DATA DOES NOT GUARANTEE OR PREDICT FUTURE RESULTS.
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-3">
              IF YOU REQUIRE FINANCIAL OR INVESTMENT ADVICE, PLEASE CONSULT A LICENSED AND QUALIFIED FINANCIAL
              PROFESSIONAL.
            </p>
          </div>
        </section>

        <section id="ip" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">8. Intellectual Property</h2>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">8.1 Company IP</h3>
          <p>
            The Service and all of its components, including but not limited to software, source code, algorithms,
            databases, user interface design, trademarks, logos, and written content created by the Company, are
            exclusively owned by Asaf Ablin and are protected by Israeli and international intellectual property laws.
            Nothing in these Terms transfers any ownership interest in Company IP to you.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">8.2 Feedback</h3>
          <p>
            If you submit suggestions, ideas, or feedback regarding the Service, you grant the Company a perpetual,
            irrevocable, royalty-free licence to use and implement such feedback without any obligation to you.
          </p>
        </section>

        <section id="user-content" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">9. User Content</h2>
          <p>
            You retain full ownership of all Content you upload or input into the Service (including your trade data,
            notes, and imported files). By submitting Content, you grant the Company a limited, non-exclusive,
            worldwide licence to store, process, and display your Content solely for the purpose of delivering the
            Service to you.
          </p>
          <p>
            You represent and warrant that: (i) you own or have the necessary rights to your Content; and
            (ii) your Content does not violate any third-party intellectual property rights, privacy rights, or
            applicable law.
          </p>
          <p>
            The Company does not sell, share, or use your trade data for any purpose other than providing the Service.
            See our <a href="/privacy" className="text-[#22D3EE] hover:underline">Privacy Policy</a> for full details.
          </p>
        </section>

        <section id="termination" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">10. Account Termination</h2>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">10.1 Termination by You</h3>
          <p>
            You may close your account at any time by visiting your account settings or by contacting us at{' '}
            <a href="mailto:asaf.abllin@gmail.com" className="text-[#22D3EE] hover:underline">asaf.abllin@gmail.com</a>.
            Upon account closure, we will permanently delete your data within 30 days, except where we are legally
            required to retain certain records.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">10.2 Termination by the Company</h3>
          <p>
            We reserve the right to suspend or permanently terminate your account, with or without notice, if we
            reasonably determine that you have:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Violated any provision of these Terms;</li>
            <li>Engaged in fraudulent, illegal, or abusive activity;</li>
            <li>Failed to pay applicable Subscription fees after a grace period of 5 business days.</li>
          </ul>
          <p>
            For non-material breaches, we will provide at least 7 days&apos; written notice before termination, during
            which you may remedy the breach.
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">10.3 Effect of Termination</h3>
          <p>
            Upon termination for any reason, your right to access and use the Service ceases immediately. No refunds
            are issued for unused subscription periods following termination for cause. Sections 7, 8, 11, 12, 13,
            and 15 of these Terms survive termination.
          </p>
        </section>

        <section id="indemnification" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">11. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless the Company, its owner Asaf Ablin, contractors, and
            service providers from and against any claims, liabilities, damages, judgments, awards, losses, costs, and
            expenses (including reasonable attorneys&apos; fees) arising out of or relating to:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Your violation of any provision of these Terms;</li>
            <li>Your Content, including any claim that your Content infringes third-party rights;</li>
            <li>Your trading activities and any resulting financial losses;</li>
            <li>Your use of the Service in a manner not expressly authorised by these Terms;</li>
            <li>Your violation of any applicable law or regulation.</li>
          </ul>
        </section>

        <section id="warranties" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">12. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
            IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE COMPANY EXPRESSLY DISCLAIMS ALL
            WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            ACCURACY, AND NON-INFRINGEMENT.
          </p>
          <p>
            The Company does not warrant that: (i) the Service will be uninterrupted, error-free, or secure;
            (ii) any errors or defects will be corrected; (iii) the Service or its servers are free of viruses or
            other harmful components; or (iv) the results obtained from using the Service will be accurate or reliable.
          </p>
        </section>

        <section id="liability" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">13. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE COMPANY, ITS OWNER, OR
            CONTRACTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
            DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS
            OPPORTUNITIES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p>
            THE COMPANY&apos;S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING UNDER OR RELATED TO THESE TERMS
            OR THE SERVICE SHALL NOT EXCEED THE TOTAL SUBSCRIPTION FEES ACTUALLY PAID BY YOU TO THE COMPANY IN
            THE TWELVE (12) CALENDAR MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR ILS 50
            (FIFTY NEW ISRAELI SHEKELS), WHICHEVER IS GREATER.
          </p>
          <p>
            Nothing in these Terms limits or excludes liability that cannot be limited under mandatory Israeli
            consumer protection law.
          </p>
        </section>

        <section id="amendments" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">14. Amendments</h2>
          <p>
            The Company reserves the right to modify these Terms at any time. When we make material changes, we will
            notify you by email (to the address associated with your account) and/or by a prominent in-app notice at
            least 14 days before the changes take effect. The updated Terms will be posted on this page with a revised
            &ldquo;Last Updated&rdquo; date.
          </p>
          <p>
            Your continued use of the Service after the effective date of the updated Terms constitutes your acceptance
            of those changes. If you do not agree to the revised Terms, you must stop using the Service and cancel
            your Subscription before the effective date.
          </p>
        </section>

        <section id="governing-law" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">15. Governing Law and Jurisdiction</h2>
          <p>
            These Terms of Service shall be governed by and construed in accordance with the laws of the
            <strong className="text-[var(--text-primary)]"> State of Israel</strong>, without regard to its conflict-of-law
            principles.
          </p>
          <p>
            Any dispute, controversy, or claim arising out of or in connection with these Terms, or the breach,
            termination, or invalidity thereof, shall be submitted to the exclusive jurisdiction of the competent
            courts of <strong className="text-[var(--text-primary)]">Tel Aviv-Jaffa, Israel</strong>. If you are a
            consumer resident in the EU or EEA, you retain the right to bring proceedings in the courts of your
            country of residence pursuant to applicable mandatory consumer protection laws.
          </p>
        </section>

        <section id="contact" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">16. Contact</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us:
          </p>
          <div className="not-prose rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)] space-y-1">
            <p><strong className="text-[var(--text-primary)]">Asaf Ablin</strong></p>
            <p>Sole Proprietor (<em>עוסק פטור</em>), Israel</p>
            <p>
              Email:{' '}
              <a href="mailto:asaf.abllin@gmail.com" className="text-[#22D3EE] hover:underline">
                asaf.abllin@gmail.com
              </a>
            </p>
            <p>
              Website:{' '}
              <a href="https://momentum-playbook.vercel.app" className="text-[#22D3EE] hover:underline">
                momentum-playbook.vercel.app
              </a>
            </p>
          </div>
        </section>

      </div>
    </article>
  );
}
