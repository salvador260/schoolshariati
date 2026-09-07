const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database("school.db");

const password = bcrypt.hashSync("1234", 10);

const admins = [
    {
        name: "مدیر اول",
        phone: "09941618984"
    },
    {
        name: "مدیر دوم",
        phone: "09186183171"
    }
];

const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO users
    (role, name, nationalCode, phone, password, position)
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const admin of admins) {

    try {

        const result = insertAdmin.run(
            "admin",
            admin.name,
            "",
            admin.phone,
            password,
            "مدیر مدرسه"
        );

        if (result.changes === 1) {

            console.log(
                "✅ مدیر " + admin.phone + " ساخته شد"
            );

        } else {

            console.log(
                "ℹ️ مدیر " + admin.phone + " از قبل وجود دارد"
            );

        }

    } catch (error) {

        console.log(
            "❌ خطا در ساخت مدیر " +
            admin.phone +
            ": " +
            error.message
        );

    }
}

db.close();

console.log("");
console.log("================================");
console.log("✅ ساخت مدیرها تمام شد");
console.log("================================");