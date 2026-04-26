import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'מדיניות החזרים — Momentum Playbook' };

export default function RefundPage() {
  return (
    <article className="prose prose-invert max-w-none text-[var(--text-secondary)] leading-relaxed space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mb-2">מדיניות החזרים</h1>
        <p className="text-xs text-[var(--text-faint)]">עדכון אחרון: אפריל 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">1. תקופת ניסיון</h2>
        <p>
          כל מנוי חדש כולל תקופת ניסיון חינמית של 30 יום. במהלך תקופה זו לא יחויב כרטיס האשראי שלכם, ותוכלו לבטל את המנוי בכל עת ללא עלות.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">2. מדיניות ביטול</h2>
        <p>
          ניתן לבטל את המנוי בכל עת דרך פורטל הלקוחות של Paddle. הביטול ייכנס לתוקף בתום תקופת החיוב הנוכחית — לא יבוצעו חיובים נוספים, אך לא יינתן החזר יחסי על החלק שלא נוצל מהתקופה ששולמה.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">3. החזר כספי</h2>
        <p>
          לא מוענקים החזרים כספיים לאחר ביצוע החיוב, למעט במקרים הבאים:
        </p>
        <ul className="list-disc list-inside space-y-2 mr-4">
          <li>
            <strong className="text-[var(--text-primary)]">תקלה טכנית:</strong> אם השירות לא היה זמין ברציפות ל-72 שעות או יותר בתקופת החיוב, יינתן החזר יחסי לפי בקשה.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">חיוב שגוי:</strong> אם בוצע חיוב בטעות (כפיל, סכום שגוי), יוחזר ההפרש במלואו.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">זכות ביטול לפי חוק:</strong> בהתאם לחוק הגנת הצרכן, התשמ&quot;א–1981 ותקנות הגנת הצרכן (ביטול עסקה), התשע&quot;א–2010, עסקה שנעשתה מרחוק ניתנת לביטול תוך 14 יום ממועד ביצוע העסקה ובתנאי שהשירות לא נוצל.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">4. פנייה לקבלת החזר</h2>
        <p>
          לבקשת החזר כספי, פנו אלינו בדוא&quot;ל עם פרטי ההזמנה. פניות יטופלו תוך 5 ימי עסקים. Paddle.com, כ-Merchant of Record, מעבד את כל החיובים וההחזרים.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">5. עיבוד תשלומים</h2>
        <p>
          כל התשלומים וההחזרים מעובדים דרך Paddle.com. Momentum Playbook אינה שומרת פרטי כרטיס אשראי בשרתיה.
        </p>
      </section>
    </article>
  );
}
