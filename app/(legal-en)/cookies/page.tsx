import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — Momentum Playbook',
  description: 'Cookie Policy for Momentum Playbook — what cookies we use and how to manage them.',
};

const TOC = [
  { id: 'what-are-cookies',  label: '1. What Are Cookies?' },
  { id: 'how-we-use',        label: '2. How We Use Cookies' },
  { id: 'cookie-table',      label: '3. Cookie Table' },
  { id: 'managing',          label: '4. Managing Your Preferences' },
  { id: 'changes',           label: '5. Changes to This Policy' },
  { id: 'contact',           label: '6. Contact' },
];

export default function CookiesPage() {
  return (
    <article className="prose prose-invert max-w-none text-[var(--text-secondary)] leading-relaxed">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2 not-prose">
          Cookie Policy
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

        <section id="what-are-cookies" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">1. What Are Cookies?</h2>
          <p>
            Cookies are small text files that are placed on your computer, tablet, or mobile device when you visit
            a website. They are widely used to make websites work, work more efficiently, and to provide information
            to the owners of the site.
          </p>
          <p>
            Cookies set by the website operator (in this case, Momentum Playbook) are called &ldquo;first-party cookies.&rdquo;
            Cookies set by parties other than the website operator are called &ldquo;third-party cookies.&rdquo; Third-party cookies
            enable third-party features or functionality to be provided on or through the website (e.g., analytics).
          </p>
          <p>
            Cookies can be &ldquo;persistent&rdquo; (remaining on your device for a set period or until deleted) or &ldquo;session&rdquo;
            (deleted when you close your browser).
          </p>
        </section>

        <section id="how-we-use" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">2. How We Use Cookies</h2>
          <p>Momentum Playbook uses cookies in three categories:</p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-5">
            Strictly Necessary (Essential)
          </h3>
          <p>
            These cookies are required for the Service to function. They enable core features such as user
            authentication, session management, and security. The Service cannot function properly without them,
            and they <strong className="text-[var(--text-primary)]">cannot be disabled</strong> without breaking
            your ability to log in and use the Service.
          </p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-5">
            Functional
          </h3>
          <p>
            These cookies allow the Service to remember choices you make (such as your preferred theme — dark or
            light mode) and provide enhanced, personalised features. Disabling these cookies may affect your
            experience but will not prevent you from using the core Service.
          </p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-5">
            Analytical
          </h3>
          <p>
            These cookies help us understand how visitors interact with the Service by collecting and reporting
            information anonymously. The data is used to improve the Service and is never used to identify
            individual users. Where applicable law requires it, we will request your consent before setting
            analytical cookies.
          </p>
        </section>

        <section id="cookie-table" className="space-y-4 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">3. Cookie Table</h2>
          <p>
            The following table lists the cookies currently used by Momentum Playbook. This list is updated as
            the Service evolves.
          </p>
          <div className="not-prose overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Cookie Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Purpose</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Party</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">sb-&lt;ref&gt;-auth-token</td>
                  <td className="px-4 py-3">Supabase authentication session — keeps you logged in</td>
                  <td className="px-4 py-3 whitespace-nowrap">Session / 1 hour</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">Essential</span>
                  </td>
                  <td className="px-4 py-3">1st</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">sb-&lt;ref&gt;-auth-token-code-verifier</td>
                  <td className="px-4 py-3">PKCE code verifier for OAuth security</td>
                  <td className="px-4 py-3 whitespace-nowrap">Session</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">Essential</span>
                  </td>
                  <td className="px-4 py-3">1st</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">theme</td>
                  <td className="px-4 py-3">Stores user&apos;s dark/light mode preference</td>
                  <td className="px-4 py-3 whitespace-nowrap">1 year</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">Functional</span>
                  </td>
                  <td className="px-4 py-3">1st</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">paddle_*</td>
                  <td className="px-4 py-3">Paddle checkout session and fraud prevention</td>
                  <td className="px-4 py-3 whitespace-nowrap">Session</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">Essential</span>
                  </td>
                  <td className="px-4 py-3">3rd</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">_ga</td>
                  <td className="px-4 py-3">Google Analytics — distinguishes unique visitors</td>
                  <td className="px-4 py-3 whitespace-nowrap">2 years</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400">Analytics</span>
                  </td>
                  <td className="px-4 py-3">3rd</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">_ga_*</td>
                  <td className="px-4 py-3">Google Analytics — stores and counts page views</td>
                  <td className="px-4 py-3 whitespace-nowrap">2 years</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400">Analytics</span>
                  </td>
                  <td className="px-4 py-3">3rd</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--text-faint)] not-prose">
            * Cookie names containing <code className="font-mono text-xs">&lt;ref&gt;</code> include a project-specific
            identifier unique to the Momentum Playbook Supabase project. Analytics cookies marked with * are only
            set if/when an analytics integration is active.
          </p>
        </section>

        <section id="managing" className="space-y-4 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">4. Managing Your Preferences</h2>
          <p>
            You can control and manage cookies in several ways. Please note that removing or blocking certain cookies
            can impact your experience and parts of the Service may no longer work.
          </p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">Browser Controls</h3>
          <p>
            Most browsers allow you to view, delete, and block cookies. Here are direct links to instructions for
            the most popular browsers:
          </p>
          <ul className="space-y-1 ml-4 list-disc text-sm">
            <li>
              <strong className="text-[var(--text-primary)]">Google Chrome:</strong>{' '}
              Settings → Privacy and security → Cookies and other site data
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Mozilla Firefox:</strong>{' '}
              Preferences → Privacy &amp; Security → Cookies and Site Data
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Apple Safari:</strong>{' '}
              Preferences → Privacy → Manage Website Data
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Microsoft Edge:</strong>{' '}
              Settings → Cookies and site permissions → Cookies and site data
            </li>
          </ul>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">Opting Out of Analytics</h3>
          <p>
            To opt out of Google Analytics across all websites, you can install the{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-[#22D3EE] hover:underline">
              Google Analytics Opt-out Browser Add-on
            </a>.
          </p>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">Do Not Track</h3>
          <p>
            Some browsers include a &ldquo;Do Not Track&rdquo; (DNT) feature. We currently do not alter the Service&apos;s
            data collection practices in response to DNT signals, as there is no consistent industry standard for
            how to respond to them. We will revisit this position as standards emerge.
          </p>
        </section>

        <section id="changes" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">5. Changes to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time to reflect changes in our use of cookies, legal
            requirements, or for other operational reasons. When we make material changes, we will update the
            &ldquo;Last Updated&rdquo; date at the top of this page and, where appropriate, notify you via email or an
            in-app notice.
          </p>
          <p>
            We encourage you to review this policy periodically to stay informed about our use of cookies.
          </p>
        </section>

        <section id="contact" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">6. Contact</h2>
          <p>
            If you have questions about our use of cookies or this Cookie Policy, please contact:
          </p>
          <div className="not-prose rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)] space-y-1">
            <p><strong className="text-[var(--text-primary)]">Asaf Ablin</strong></p>
            <p>
              Email:{' '}
              <a href="mailto:asaf.abllin@gmail.com" className="text-[#22D3EE] hover:underline">
                asaf.abllin@gmail.com
              </a>
            </p>
            <p>
              See also our full{' '}
              <a href="/privacy" className="text-[#22D3EE] hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </section>

      </div>
    </article>
  );
}
