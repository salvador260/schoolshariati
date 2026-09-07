/**
 * =========================================================
 *  اسکریپت ساخت اکانت مدیر
 * =========================================================
 *
 *  این اسکریپت یک حساب با نقش "admin" مستقیماً در دیتابیس
 *  می‌سازد (بدون نیاز به رفتن به صفحه ثبت‌نام سایت).
 *
 *  نحوه اجرا:
 *    1. این فایل را کنار server.js و school.db قرار دهید.
 *    2. بهتر است سرور (node server.js) موقتاً بسته باشد.
 *    3. در ترمینال دستور زیر را بزنید:
 *
 *         node create-admin.js
 *
 *    4. بعد از دیدن پیام موفقیت، دوباره سرور را اجرا کنید:
 *
 *         node server.js
 *
 *  بعد از اجرای این اسکریپت می‌توانید از صفحه login.html
 *  با همین شماره موبایل و رمز عبور وارد پنل مدیریت شوید.
 */

const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const dbPath = path.join(__dirname, "school.db");
const db = new Database(dbPath);

/* =========================================================
   اطلاعات حساب مدیر جدید
========================================================= */

const ADMIN_NAME = "آرتین";
const ADMIN_PHONE = "09941618984";
const ADMIN_PASSWORD = "1388Artin###";

console.log("================================");
console.log("🏫 هنرستان شریعتی — ساخت حساب مدیر");
console.log("================================");

try {

    // بررسی اینکه آیا این شماره قبلاً ثبت شده یا نه
    const existing = db.prepare(`
        SELECT id, name, role
        FROM users
        WHERE phone = ?
    `).get(ADMIN_PHONE);

    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);

    if (existing) {

        // اگر قبلاً وجود داشت، آپدیتش می‌کنیم به مدیر با اطلاعات جدید
        db.prepare(`
            UPDATE users
            SET role = 'admin',
                name = ?,
                password = ?
            WHERE phone = ?
        `).run(ADMIN_NAME, hashedPassword, ADMIN_PHONE);

        console.log(`ℹ️  کاربری با این شماره از قبل وجود داشت (نقش قبلی: ${existing.role}).`);
        console.log("✅ اطلاعاتش به‌روزرسانی شد و نقش آن به مدیر تغییر کرد.");

    } else {

        // ساخت کاربر جدید با نقش مدیر
        const result = db.prepare(`
            INSERT INTO users (
                role,
                name,
                nationalCode,
                phone,
                password,
                grade,
                className,
                subject,
                position
            )
            VALUES ('admin', ?, '', ?, ?, '', '', '', 'مدیر مدرسه')
        `).run(ADMIN_NAME, ADMIN_PHONE, hashedPassword);

        console.log(`✅ حساب مدیر جدید ساخته شد (شناسه: ${result.lastInsertRowid}).`);

    }

    console.log("--------------------------------");
    console.log(`👤 نام:         ${ADMIN_NAME}`);
    console.log(`📱 شماره موبایل: ${ADMIN_PHONE}`);
    console.log(`🔑 رمز عبور:    ${ADMIN_PASSWORD}`);
    console.log("--------------------------------");
    console.log("حالا می‌توانید از صفحه login.html با همین اطلاعات وارد پنل مدیر شوید.");
    console.log("================================");

} catch (error) {

    console.error("❌ خطا در ساخت حساب مدیر:", error);

} finally {

    db.close();

}
