/**
 * =========================================================
 *  اسکریپت پاکسازی دیتابیس مدرسه شریعتی
 * =========================================================
 *
 *  این اسکریپت موارد زیر را کاملاً پاک می‌کند:
 *    - همه معلم‌ها (users با role = 'teacher')
 *    - همه دانش‌آموزها (users با role = 'student')
 *    - همه کلاس‌ها (classes)
 *    - همه اعضای کلاس‌ها (class_students)
 *    - همه نمرات (grades)
 *    - همه حضور و غیاب‌ها (attendance)
 *
 *  و فقط حساب‌های مدیر (role = 'admin') را دست‌نخورده نگه می‌دارد.
 *
 *  نحوه اجرا:
 *    1. این فایل را کنار server.js و school.db قرار دهید.
 *    2. مطمئن شوید سرور (node server.js) در حال اجرا نیست
 *       (بهتر است قبل از اجرای این اسکریپت سرور را ببندید).
 *    3. در ترمینال دستور زیر را اجرا کنید:
 *
 *         node reset-data.js
 *
 *    4. بعد از پایان، دوباره سرور را اجرا کنید: node server.js
 *
 *  ⚠️ هشدار: این عملیات غیرقابل بازگشت است.
 *  پیشنهاد می‌شود قبل از اجرا از فایل school.db یک نسخه پشتیبان
 *  بگیرید (کافیست فایل school.db را در یک پوشه دیگر کپی کنید).
 */

const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "school.db");
const db = new Database(dbPath);

console.log("================================");
console.log("🏫 هنرستان شریعتی — پاکسازی داده‌ها");
console.log("================================");

try {

    const transaction = db.transaction(() => {

        // شمارش قبل از حذف (برای گزارش نهایی)
        const beforeTeachers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'teacher'`).get().c;
        const beforeStudents = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'student'`).get().c;
        const beforeClasses = db.prepare(`SELECT COUNT(*) AS c FROM classes`).get().c;
        const beforeGrades = db.prepare(`SELECT COUNT(*) AS c FROM grades`).get().c;
        const beforeAttendance = db.prepare(`SELECT COUNT(*) AS c FROM attendance`).get().c;
        const beforeAdmins = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get().c;

        // ۱. حذف کامل حضور و غیاب
        db.prepare(`DELETE FROM attendance`).run();

        // ۲. حذف کامل نمرات
        db.prepare(`DELETE FROM grades`).run();

        // ۳. حذف کامل اعضای کلاس‌ها
        db.prepare(`DELETE FROM class_students`).run();

        // ۴. حذف کامل کلاس‌ها
        db.prepare(`DELETE FROM classes`).run();

        // ۵. حذف معلم‌ها و دانش‌آموزها (فقط، نه مدیرها)
        db.prepare(`DELETE FROM users WHERE role != 'admin'`).run();

        // ریست شمارنده‌های AUTOINCREMENT برای شروع تمیز از ۱
        db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('attendance','grades','classes','class_students')`).run();

        console.log("📊 قبل از پاکسازی:");
        console.log(`   👨‍🏫 معلم‌ها:        ${beforeTeachers}`);
        console.log(`   👨‍🎓 دانش‌آموزان:    ${beforeStudents}`);
        console.log(`   🏫 کلاس‌ها:         ${beforeClasses}`);
        console.log(`   📝 نمرات:          ${beforeGrades}`);
        console.log(`   📋 حضور و غیاب:    ${beforeAttendance}`);
        console.log(`   👑 مدیرها (حفظ‌شده): ${beforeAdmins}`);

    });

    transaction();

    console.log("--------------------------------");
    console.log("✅ پاکسازی با موفقیت انجام شد.");
    console.log("👑 حساب‌های مدیر دست‌نخورده باقی ماندند.");
    console.log("================================");

    // نمایش لیست باقی‌مانده کاربران برای اطمینان
    const remaining = db.prepare(`SELECT id, name, phone, role FROM users`).all();
    console.log("👥 کاربران باقی‌مانده در سیستم:");
    remaining.forEach(u => {
        console.log(`   #${u.id} | ${u.name} | ${u.phone} | ${u.role}`);
    });

} catch (error) {

    console.error("❌ خطا در پاکسازی داده‌ها:", error);

} finally {

    db.close();

}
