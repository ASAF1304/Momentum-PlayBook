import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'מדיניות פרטיות — Momentum Playbook' };

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-none text-[var(--text-secondary)] leading-relaxed space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mb-2">מדיניות פרטיות</h1>
        <p className="text-xs text-[var(--text-faint)]">עדכון אחרון: אפריל 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">1. מידע שאנו אוספים</h2>
        <p>אנו אוספים את המידע הבא:</p>
        <ul className="list-disc list-inside space-y-1 mr-4">
          <li><strong className="text-[var(--text-primary)]">פרטי חשבון:</strong> כתובת דוא&quot;ל, שם תצוגה</li>
          <li><strong className="text-[var(--text-primary)]">נתוני מסחר:</strong> עסקאות, יעדים, הערות שתזינו</li>
          <li><strong className="text-[var(--text-primary)]">נתוני תשלום:</strong> מזהה לקוח ב-Paddle בלבד — לא פרטי כרטיס</li>
          <li><strong className="text-[var(--text-primary)]">לוגים טכניים:</strong> שגיאות, ביצועים (ללא זיהוי אישי)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">2. שימוש במידע</h2>
        <p>המידע משמש אך ורק ל:</p>
        <ul className="list-disc list-inside space-y-1 mr-4">
          <li>מתן השירות ושמירת הנתונים שלכם</li>
          <li>עיבוד תשלומים וניהול מנויים</li>
          <li>שיפור השירות וזיהוי תקלות</li>
          <li>משלוח עדכונים חיוניים על השירות</li>
        </ul>
        <p>אנו <strong className="text-[var(--text-primary)]">אינם</strong> מוכרים מידע אישי לגורמים שלישיים.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">3. ספקי שירות</h2>
        <p>אנו משתמשים בספקים הבאים:</p>
        <ul className="list-disc list-inside space-y-1 mr-4">
          <li><strong className="text-[var(--text-primary)]">Supabase</strong> — אחסון נתונים ואימות זהות (EU)</li>
          <li><strong className="text-[var(--text-primary)]">Paddle.com</strong> — עיבוד תשלומים (UK)</li>
          <li><strong className="text-[var(--text-primary)]">Vercel</strong> — אחסון האפליקציה (US/EU)</li>
          <li><strong className="text-[var(--text-primary)]">Sentry</strong> — ניטור שגיאות (US)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">4. זכויותיכם</h2>
        <p>
          בהתאם לחוק הגנת הפרטיות, התשמ&quot;א–1981, יש לכם זכות לעיין במידע האצור אודותיכם, לתקנו, ולבקש את מחיקתו. לבקשות פנו לכתובת הדוא&quot;ל ביצירת קשר.
        </p>
        <p>
          מחיקת חשבון תגרור מחיקת כל נתוני המסחר שלכם ממסדי הנתונים שלנו תוך 30 יום. נתוני גיבוי יימחקו תוך 90 יום.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">5. אבטחה</h2>
        <p>
          הנתונים מוצפנים בעת מנוחה ובעת העברה. אנו משתמשים ב-Row Level Security של Supabase כדי לוודא שכל משתמש רואה רק את הנתונים שלו.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">6. עוגיות (Cookies)</h2>
        <p>
          אנו משתמשים בעוגיות הכרחיות בלבד — לניהול הסשן המאובטח. אין שימוש בעוגיות פרסום או מעקב של צד שלישי.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">7. יצירת קשר</h2>
        <p>
          לכל שאלה הקשורה לפרטיות, ניתן לפנות אלינו דרך עמוד ההגדרות באפליקציה.
        </p>
      </section>
    </article>
  );
}
