import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Momentum Playbook',
  description: 'Privacy Policy for Momentum Playbook — how we collect, use, and protect your personal data.',
};

const TOC = [
  { id: 'introduction',    label: '1. Introduction' },
  { id: 'data-collected',  label: '2. Information We Collect' },
  { id: 'legal-basis',     label: '3. Legal Basis for Processing' },
  { id: 'how-we-use',      label: '4. How We Use Your Information' },
  { id: 'processors',      label: '5. Data Processors' },
  { id: 'retention',       label: '6. Data Retention' },
  { id: 'your-rights',     label: '7. Your Rights' },
  { id: 'cookies',         label: '8. Cookies and Analytics' },
  { id: 'third-parties',   label: '9. Third-Party Transfers' },
  { id: 'security',        label: '10. Data Security' },
  { id: 'children',        label: '11. Children\'s Privacy' },
  { id: 'changes',         label: '12. Changes to This Policy' },
  { id: 'contact',         label: '13. Contact / DPO' },
];

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-none text-[var(--text-secondary)] leading-relaxed">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2 not-prose">
          Privacy Policy
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

        <section id="introduction" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">1. Introduction</h2>
          <p>
            Asaf Ablin (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), an Israeli sole proprietor, operates the
            Momentum Playbook web application. We are committed to protecting your personal data and respecting
            your privacy in accordance with the Israeli Privacy Protection Law, 5741-1981 (as amended), and,
            where applicable, the EU General Data Protection Regulation (GDPR) 2016/679.
          </p>
          <p>
            This Privacy Policy explains what personal data we collect when you use the Service at{' '}
            <span className="font-mono text-sm">momentum-playbook.vercel.app</span>, how we use it, and what
            rights you have with respect to it. Please read this policy carefully. By using the Service, you
            acknowledge that you have read and understood this policy.
          </p>
        </section>

        <section id="data-collected" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">2. Information We Collect</h2>
          <p>We collect the following categories of personal data:</p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">2.1 Account Data</h3>
          <ul className="space-y-1 ml-4 list-disc">
            <li><strong className="text-[var(--text-primary)]">Email address</strong> — required for account creation and authentication</li>
            <li><strong className="text-[var(--text-primary)]">Password</strong> — stored exclusively as a salted hash by Supabase Auth; we never see your plaintext password</li>
            <li><strong className="text-[var(--text-primary)]">Display name</strong> — optional, if provided by you</li>
          </ul>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">2.2 Trade Data</h3>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Securities transaction records you import or enter (ticker symbols, dates, prices, quantities, gains/losses)</li>
            <li>Notes and annotations you attach to trades or journal entries</li>
            <li>Watchlist entries and playbook content you create</li>
          </ul>
          <p className="text-sm italic">
            Your trade data is <strong className="text-[var(--text-primary)]">never sold, shared with advertisers, or used for any purpose other than providing the Service to you.</strong>
          </p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">2.3 Usage Data</h3>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Pages and features accessed within the Service</li>
            <li>Session duration and frequency of use</li>
            <li>Browser type and version, device type, operating system</li>
            <li>Approximate geographic location (country/region level, derived from IP)</li>
            <li>Error logs and crash reports</li>
          </ul>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">2.4 Payment Data</h3>
          <p>
            We receive from Paddle: your subscription plan, billing cycle, subscription status (active, cancelled,
            past due), and transaction IDs. We do <strong className="text-[var(--text-primary)]">not</strong> receive
            or store your credit card number, card expiry, or CVV — these are handled exclusively by Paddle.
          </p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">2.5 Technical Data</h3>
          <ul className="space-y-1 ml-4 list-disc">
            <li>IP address (logged by Supabase and Vercel for security and abuse prevention)</li>
            <li>Cookies and similar identifiers (see Section 8 and our <a href="/cookies" className="text-[#22D3EE] hover:underline">Cookie Policy</a>)</li>
          </ul>
        </section>

        <section id="legal-basis" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">3. Legal Basis for Processing</h2>
          <p>
            For users located in the EU/EEA, we rely on the following legal bases under GDPR Article 6:
          </p>
          <ul className="space-y-2 ml-4 list-disc">
            <li>
              <strong className="text-[var(--text-primary)]">Performance of contract</strong> (Art. 6(1)(b)) —
              processing necessary to provide the Service you signed up for (account management, delivering features,
              payment processing).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Legitimate interests</strong> (Art. 6(1)(f)) —
              Service improvement, analytics, fraud prevention, and security (where these do not override your rights
              and freedoms).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Legal obligation</strong> (Art. 6(1)(c)) —
              retaining accounting records as required by Israeli bookkeeping law.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Consent</strong> (Art. 6(1)(a)) —
              for optional analytics cookies (where applicable). You may withdraw consent at any time.
            </li>
          </ul>
          <p>
            For users in Israel, processing is governed by the Privacy Protection Law, 5741-1981 and its
            regulations, including the Privacy Protection Regulations (Data Security), 5777-2017.
          </p>
        </section>

        <section id="how-we-use" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">4. How We Use Your Information</h2>
          <p>We use your personal data for the following purposes:</p>
          <ul className="space-y-2 ml-4 list-disc">
            <li>To create, authenticate, and maintain your account</li>
            <li>To provide and operate the Service, including storing and displaying your trade data</li>
            <li>To process your Subscription payments via Paddle</li>
            <li>To send transactional emails (account confirmation, password reset, subscription receipts)</li>
            <li>To send service-related notifications (planned maintenance, feature updates, policy changes)</li>
            <li>To analyse aggregated, anonymised usage patterns and improve the Service</li>
            <li>To detect, investigate, and prevent fraud, abuse, or security incidents</li>
            <li>To comply with applicable legal obligations</li>
            <li>To respond to your support inquiries</li>
          </ul>
          <p>
            We do <strong className="text-[var(--text-primary)]">not</strong> use your trade data for training machine
            learning models, benchmarking against other users, or any purpose unrelated to your individual use of the
            Service.
          </p>
        </section>

        <section id="processors" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">5. Data Processors</h2>
          <p>
            We engage the following third-party data processors. Each processor handles your data only as necessary
            to perform services on our behalf and under contractual data processing obligations:
          </p>
          <div className="not-prose overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Processor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Purpose</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Data Transferred</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">Supabase, Inc.</td>
                  <td className="px-4 py-3">Database, authentication, file storage</td>
                  <td className="px-4 py-3">Account data, trade data, session tokens</td>
                  <td className="px-4 py-3">EU (Frankfurt)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">Paddle.com Market Ltd</td>
                  <td className="px-4 py-3">Payment processing, Merchant of Record</td>
                  <td className="px-4 py-3">Email, subscription status, transaction IDs</td>
                  <td className="px-4 py-3">UK / Global</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">Vercel Inc.</td>
                  <td className="px-4 py-3">Hosting and edge deployment</td>
                  <td className="px-4 py-3">Request logs, IP addresses</td>
                  <td className="px-4 py-3">USA / Global CDN</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            For transfers to processors outside the EEA (e.g., Vercel in the USA), we rely on the European
            Commission&apos;s Standard Contractual Clauses or the processor&apos;s participation in an approved
            transfer mechanism.
          </p>
        </section>

        <section id="retention" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">6. Data Retention</h2>
          <p>We retain your personal data only for as long as necessary for the purposes described in this policy:</p>
          <div className="not-prose overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Data Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Retention Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <td className="px-4 py-3">Account data</td>
                  <td className="px-4 py-3">Duration of account + 30 days after deletion</td>
                  <td className="px-4 py-3">Contract performance</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Trade data &amp; journal content</td>
                  <td className="px-4 py-3">Deleted within 30 days of account closure</td>
                  <td className="px-4 py-3">Contract performance</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Server/access logs</td>
                  <td className="px-4 py-3">90 days</td>
                  <td className="px-4 py-3">Legitimate interests (security)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Payment &amp; billing records</td>
                  <td className="px-4 py-3">7 years</td>
                  <td className="px-4 py-3">Legal obligation (Israeli bookkeeping law)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Support correspondence</td>
                  <td className="px-4 py-3">3 years</td>
                  <td className="px-4 py-3">Legitimate interests (dispute resolution)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="your-rights" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">7. Your Rights</h2>
          <p>
            Depending on your jurisdiction, you have the following rights regarding your personal data. To exercise
            any of these rights, contact us at{' '}
            <a href="mailto:asaf.abllin@gmail.com" className="text-[#22D3EE] hover:underline">asaf.abllin@gmail.com</a>.
            We will respond within 30 days (or within the shorter period required by applicable law).
          </p>
          <ul className="space-y-3 ml-4 list-disc">
            <li>
              <strong className="text-[var(--text-primary)]">Right of Access</strong> — You may request a copy of the
              personal data we hold about you, along with information about how it is processed.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to Rectification</strong> — You may ask us to
              correct inaccurate or incomplete personal data.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;)</strong> — You
              may request deletion of your personal data where there is no compelling reason for its continued
              processing. Note that we may need to retain certain data for legal reasons (see Section 6).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to Restriction of Processing</strong> — You may ask
              us to restrict processing of your data in certain circumstances (e.g., while a dispute is resolved).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to Data Portability</strong> — You may request your
              personal data in a structured, commonly used, machine-readable format (e.g., JSON or CSV export of
              your trade data).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to Object</strong> — You may object to processing
              based on legitimate interests, including for direct marketing purposes.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to Withdraw Consent</strong> — Where processing is
              based on consent (e.g., analytics cookies), you may withdraw consent at any time without affecting the
              lawfulness of prior processing.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Right to Lodge a Complaint</strong> — EU/EEA residents
              have the right to lodge a complaint with their local supervisory authority. Israeli residents may
              contact the Privacy Protection Authority (Reshut HaGanat HaPrivacy) at{' '}
              <span className="font-mono text-sm">www.gov.il/en/Departments/the_privacy_protection_authority</span>.
            </li>
          </ul>
        </section>

        <section id="cookies" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">8. Cookies and Analytics</h2>
          <p>
            We use cookies and similar tracking technologies to operate the Service and understand how it is used.
            For detailed information, including a full list of cookies and instructions on how to manage them, see
            our <a href="/cookies" className="text-[#22D3EE] hover:underline">Cookie Policy</a>.
          </p>
          <p>
            In summary, we use:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li><strong className="text-[var(--text-primary)]">Essential cookies</strong> — required for authentication and basic functionality</li>
            <li><strong className="text-[var(--text-primary)]">Functional cookies</strong> — to remember your preferences (e.g., dark/light mode)</li>
            <li><strong className="text-[var(--text-primary)]">Analytics cookies</strong> — to measure aggregate usage and improve the Service (where consent is given)</li>
          </ul>
        </section>

        <section id="third-parties" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">9. Third-Party Transfers</h2>
          <p>
            We do <strong className="text-[var(--text-primary)]">not sell</strong> your personal data to any third
            party. We do <strong className="text-[var(--text-primary)]">not share</strong> your personal data with
            advertisers, data brokers, or other parties for their own marketing purposes.
          </p>
          <p>We may disclose personal data to third parties only in the following circumstances:</p>
          <ul className="space-y-2 ml-4 list-disc">
            <li>
              <strong className="text-[var(--text-primary)]">Service providers</strong> — The data processors listed
              in Section 5, who process data solely on our behalf.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Legal obligations</strong> — Where required by law,
              court order, or binding governmental request.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Business transfers</strong> — In the event of a merger,
              acquisition, or sale of all or substantially all assets, your data may be transferred. We will notify
              you before your data is subject to a new privacy policy.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Protection of rights</strong> — Where we reasonably
              believe disclosure is necessary to protect our rights, your safety, or the safety of others.
            </li>
          </ul>
        </section>

        <section id="security" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">10. Data Security</h2>
          <p>
            We implement appropriate technical and organisational security measures designed to protect your personal
            data against unauthorised access, alteration, disclosure, or destruction. These measures include:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>TLS/HTTPS encryption for all data in transit</li>
            <li>Supabase Row-Level Security (RLS) ensuring each user can only access their own data</li>
            <li>Hashed password storage via Supabase Auth (bcrypt)</li>
            <li>Access controls limiting who can access production systems</li>
            <li>Regular security reviews of the application and its dependencies</li>
          </ul>
          <p>
            Despite these measures, no system is entirely secure. In the event of a data breach that is likely to
            result in a high risk to your rights and freedoms, we will notify you without undue delay and, where
            required, notify the relevant supervisory authority within 72 hours.
          </p>
        </section>

        <section id="children" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">11. Children&apos;s Privacy</h2>
          <p>
            The Service is intended solely for users who are at least 18 years of age. We do not knowingly collect
            personal data from anyone under 18. If we become aware that we have inadvertently collected data from a
            minor, we will take prompt steps to delete such data. If you believe a minor has provided us with
            personal data, please contact us immediately at{' '}
            <a href="mailto:asaf.abllin@gmail.com" className="text-[#22D3EE] hover:underline">asaf.abllin@gmail.com</a>.
          </p>
        </section>

        <section id="changes" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you
            by email and/or by a prominent notice within the Service at least 14 days before the changes take effect.
            The updated policy will be posted on this page with a revised &ldquo;Last Updated&rdquo; date.
          </p>
          <p>
            Your continued use of the Service after the effective date of the changes constitutes your acceptance of
            the updated policy.
          </p>
        </section>

        <section id="contact" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">13. Contact / Data Protection Officer</h2>
          <p>
            For all privacy-related inquiries, requests to exercise your rights, or questions about this policy,
            please contact:
          </p>
          <div className="not-prose rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)] space-y-1">
            <p><strong className="text-[var(--text-primary)]">Asaf Ablin</strong> — Data Controller &amp; Privacy Contact</p>
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
            <p className="pt-1 text-xs text-[var(--text-faint)]">
              We aim to respond to all privacy requests within 30 calendar days.
            </p>
          </div>
        </section>

      </div>
    </article>
  );
}
