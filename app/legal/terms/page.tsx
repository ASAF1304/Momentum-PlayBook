import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'תנאי שימוש — Momentum Playbook' };

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-none text-[var(--text-secondary)] leading-relaxed space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mb-2">תנאי שימוש</h1>
        <p className="text-xs text-[var(--text-faint)]">עדכון אחרון: אפריל 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">1. קבלת התנאים</h2>
        <p>
          השימוש ב-Momentum Playbook (להלן: "השירות") מהווה הסכמה לתנאים אלו. אם אינכם מסכימים לתנאים, אל תשתמשו בשירות.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">2. תיאור השירות</h2>
        <p>
          השירות הוא כלי דיגיטלי לניהול יומן מסחר אישי, המיועד לסוחרים בשוק ההון המבקשים לתעד ולנתח את עסקאותיהם. השירות אינו מספק ייעוץ השקעות.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">3. מנוי ותשלום</h2>
        <p>
          השירות מוצע במנוי חודשי בסך 50 ₪ (כולל מע&quot;מ אם חל). תקופת ניסיון חינמית של 30 יום ניתנת בתחילת כל מנוי חדש. לאחר תקופת הניסיון יחויב כרטיס האשראי שנמסר. ניתן לבטל את המנוי בכל עת; ביטול לאחר חיוב לא יזכה בהחזר יחסי אלא אם נדרש על פי חוק.
        </p>
        <p>
          התשלום מעובד על ידי Paddle.com (Merchant of Record). Momentum Playbook אינה שומרת פרטי כרטיס אשראי.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">4. זכויות משתמש</h2>
        <p>
          ניתנת לכם רישיון מוגבל, אישי, שאינו בלעדי, להשתמש בשירות לצרכים אישיים בלבד. אינכם רשאים:
        </p>
        <ul className="list-disc list-inside space-y-1 mr-4">
          <li>להעתיק, להפיץ, או למכור את השירות</li>
          <li>לבצע הנדסה הפוכה לקוד האפליקציה</li>
          <li>להשתמש בשירות לצורך מתן ייעוץ לאחרים בתשלום</li>
          <li>לשתף גישה לחשבונכם עם אחרים</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">5. הגבלת אחריות</h2>
        <p>
          השירות ניתן &quot;כמות שהוא&quot; (AS IS), ללא אחריות מכל סוג. לפי חוק הגנת הצרכן, התשמ&quot;א–1981, ומבלי לגרוע מזכויות הצרכן לפי הדין הישראלי, אחריות מפעילי השירות תוגבל לגובה התשלום ששולם עבור חודש השירות האחרון.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">6. שינויים בתנאים</h2>
        <p>
          נוכל לעדכן תנאים אלו מעת לעת. המשך השימוש לאחר פרסום העדכון מהווה הסכמה לתנאים המעודכנים.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">7. דין וסמכות שיפוט</h2>
        <p>
          תנאים אלו כפופים לדין הישראלי. לבתי המשפט בישראל תהיה סמכות שיפוט ייחודית לכל סכסוך הנובע מתנאים אלו.
        </p>
      </section>
    </article>
  );
}
