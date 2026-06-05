import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility Statement — Momentum Playbook',
  description: 'Accessibility Statement for Momentum Playbook — our commitment to WCAG 2.1 AA compliance.',
};

const TOC = [
  { id: 'commitment',    label: '1. Our Commitment' },
  { id: 'status',        label: '2. Conformance Status' },
  { id: 'technical',     label: '3. Technical Specifications' },
  { id: 'limitations',   label: '4. Known Limitations' },
  { id: 'feedback',      label: '5. Feedback and Reporting' },
  { id: 'enforcement',   label: '6. Enforcement Procedure' },
  { id: 'contact',       label: '7. Contact' },
];

export default function AccessibilityPage() {
  return (
    <article className="prose prose-invert max-w-none text-[var(--text-secondary)] leading-relaxed">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2 not-prose">
          Accessibility Statement
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

        <section id="commitment" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">1. Our Commitment</h2>
          <p>
            Momentum Playbook, operated by Asaf Ablin, is committed to ensuring that the Service is accessible to
            the widest possible audience, including people with disabilities. We believe that digital accessibility
            is not only a legal obligation but a fundamental aspect of providing a high-quality, inclusive product.
          </p>
          <p>
            We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA, published by the
            World Wide Web Consortium (W3C). These guidelines explain how to make web content more accessible to
            people with a wide range of disabilities, including visual, auditory, physical, speech, cognitive,
            language, learning, and neurological disabilities.
          </p>
          <p>
            In addition, where applicable, we aim to comply with the Israeli Equal Rights for Persons with
            Disabilities Regulations (Service Accessibility Adjustments), 5773-2013.
          </p>
        </section>

        <section id="status" className="space-y-4 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">2. Conformance Status</h2>
          <div className="not-prose rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-amber-400 uppercase text-xs tracking-wider block mb-2">Current Status</strong>
              Momentum Playbook is <strong className="text-[var(--text-primary)]">partially conformant</strong> with
              WCAG 2.1 Level AA. Partial conformance means that some parts of the content do not fully conform to
              the accessibility standard. We are actively working to address the known limitations described in
              Section 4.
            </p>
          </div>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">What We Have Implemented</h3>
          <ul className="space-y-2 ml-4 list-disc">
            <li>
              <strong className="text-[var(--text-primary)]">Keyboard navigation</strong> — All primary navigation
              items and interactive controls are reachable and operable via keyboard alone.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Semantic HTML</strong> — We use appropriate heading
              hierarchies (<code className="font-mono text-xs">h1</code>–<code className="font-mono text-xs">h3</code>),
              landmark elements (<code className="font-mono text-xs">main</code>,{' '}
              <code className="font-mono text-xs">nav</code>, <code className="font-mono text-xs">header</code>,{' '}
              <code className="font-mono text-xs">footer</code>), and ARIA labels where appropriate.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Colour contrast</strong> — Primary text and interactive
              elements meet the WCAG 2.1 AA minimum contrast ratio of 4.5:1 against their backgrounds.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Dark and light mode</strong> — Both themes are designed
              to maintain adequate contrast ratios for readability.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Responsive design</strong> — The Service is usable at
              various zoom levels and on different screen sizes without loss of content or functionality.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Focus indicators</strong> — Visible focus styles are
              present on interactive elements.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Form labels</strong> — All form inputs have associated
              labels or descriptive ARIA attributes.
            </li>
          </ul>
        </section>

        <section id="technical" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">3. Technical Specifications</h2>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">Technologies Used</h3>
          <p>
            Momentum Playbook relies on the following technologies for accessibility conformance:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>HTML5 (semantic markup)</li>
            <li>CSS (Tailwind CSS v4)</li>
            <li>JavaScript / TypeScript (React, Next.js)</li>
            <li>WAI-ARIA (where native HTML semantics are insufficient)</li>
          </ul>

          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">Supported Browsers and Assistive Technologies</h3>
          <p>
            Momentum Playbook has been tested with the following combinations and is expected to work correctly:
          </p>
          <div className="not-prose overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Screen Reader</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Browser</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <td className="px-4 py-3">NVDA (latest)</td>
                  <td className="px-4 py-3">Google Chrome</td>
                  <td className="px-4 py-3">Windows</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">JAWS (latest)</td>
                  <td className="px-4 py-3">Mozilla Firefox</td>
                  <td className="px-4 py-3">Windows</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">VoiceOver</td>
                  <td className="px-4 py-3">Safari</td>
                  <td className="px-4 py-3">macOS / iOS</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">TalkBack</td>
                  <td className="px-4 py-3">Chrome for Android</td>
                  <td className="px-4 py-3">Android</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The Service also supports keyboard-only navigation in all major browsers (Chrome, Firefox, Safari,
            Edge) on both Windows and macOS.
          </p>
        </section>

        <section id="limitations" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">4. Known Limitations</h2>
          <p>
            Despite our best efforts to ensure accessibility, some areas of the Service have known limitations.
            We document them here to set clear expectations and to track our remediation progress:
          </p>
          <div className="not-prose overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Area</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Limitation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">WCAG Criterion</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                <tr>
                  <td className="px-4 py-3">Trade journal data tables</td>
                  <td className="px-4 py-3">Complex sortable tables may not announce sort state to all screen readers</td>
                  <td className="px-4 py-3 whitespace-nowrap">1.3.1 Info and Relationships</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">In progress</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Equity curve charts</td>
                  <td className="px-4 py-3">Interactive SVG charts do not yet provide full text alternatives or data table equivalents</td>
                  <td className="px-4 py-3 whitespace-nowrap">1.1.1 Non-text Content</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">In progress</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">CSV/Excel file upload</td>
                  <td className="px-4 py-3">Drag-and-drop upload area may not convey drag state to screen readers in all browsers</td>
                  <td className="px-4 py-3 whitespace-nowrap">4.1.3 Status Messages</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">Planned</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Keyboard shortcuts</td>
                  <td className="px-4 py-3">Some power-user keyboard shortcuts are not yet documented or configurable</td>
                  <td className="px-4 py-3 whitespace-nowrap">2.1.4 Character Key Shortcuts</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">Reviewing</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            We are committed to addressing these limitations. If you encounter an accessibility barrier not listed
            here, please let us know (see Section 5).
          </p>
        </section>

        <section id="feedback" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">5. Feedback and Reporting</h2>
          <p>
            We welcome feedback on the accessibility of Momentum Playbook. If you experience barriers that prevent
            you from accessing any part of the Service, please let us know so we can work to correct the issue.
          </p>
          <p>
            When reporting an accessibility issue, it would be helpful to include:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>The URL of the page where you encountered the issue</li>
            <li>A description of the problem and what you were trying to do</li>
            <li>The browser, operating system, and assistive technology you are using</li>
            <li>Any error messages you received</li>
          </ul>
          <div className="not-prose rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)] space-y-1 mt-4">
            <p className="font-medium text-[var(--text-primary)]">Report an accessibility issue:</p>
            <p>
              Email:{' '}
              <a href="mailto:asaf.abllin@gmail.com?subject=Accessibility%20Feedback%20%E2%80%94%20Momentum%20Playbook" className="text-[#22D3EE] hover:underline">
                asaf.abllin@gmail.com
              </a>
              {' '}with subject line <strong>&ldquo;Accessibility Feedback&rdquo;</strong>
            </p>
            <p className="text-xs text-[var(--text-faint)] pt-1">
              We aim to acknowledge all accessibility reports within 2 business days and to provide a substantive
              response or interim workaround within 5 business days.
            </p>
          </div>
        </section>

        <section id="enforcement" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">6. Enforcement Procedure</h2>
          <p>
            If you are not satisfied with our response to an accessibility complaint, you may escalate the matter
            to the relevant authority:
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">Israel</h3>
          <p>
            The Commission for Equal Rights of Persons with Disabilities operates under the Israeli Ministry of
            Justice. Complaints relating to the accessibility of digital services may be directed to:
          </p>
          <p className="ml-4">
            Commission for Equal Rights of Persons with Disabilities<br />
            Ministry of Justice, 29 Salah al-Din Street, Jerusalem 91010, Israel<br />
            Website:{' '}
            <span className="font-mono text-sm">www.gov.il/en/Departments/disability-and-accessibility</span>
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] not-prose mt-4">European Union</h3>
          <p>
            EU residents may also contact their national enforcement body under Directive (EU) 2016/2102 on the
            accessibility of public sector bodies&apos; websites and mobile applications.
          </p>
        </section>

        <section id="contact" className="space-y-3 scroll-mt-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)] not-prose">7. Contact</h2>
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
