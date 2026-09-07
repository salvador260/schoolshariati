const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   تنظیمات سرور
========================================================= */

app.use(cors());
app.use(express.json());

/* =========================================================
   دیتابیس
========================================================= */

const dbPath = path.join(__dirname, "school.db");
const db = new Database(dbPath);

console.log("================================");
console.log("🏫 هنرستان شریعتی");
console.log("✅ دیتابیس SQLite آماده است");
console.log("================================");

/* =========================================================
   جدول کاربران
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    nationalCode TEXT,
    phone TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    grade TEXT,
    className TEXT,
    subject TEXT,
    position TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/* =========================================================
   جدول نمرات
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nationalCode TEXT NOT NULL,
    examName TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade REAL NOT NULL,
    examDate TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/* =========================================================
   جدول کلاس‌ها
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacherId INTEGER NOT NULL,
    name TEXT NOT NULL,
    grade TEXT,
    field TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/* =========================================================
   جدول دانش‌آموزان کلاس
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS class_students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    classId INTEGER NOT NULL,
    studentId INTEGER NOT NULL,
    UNIQUE(classId, studentId)
);
`);

/* =========================================================
   جدول حضور و غیاب
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    classId INTEGER NOT NULL,

    studentId INTEGER NOT NULL,

    nationalCode TEXT,

    teacherId INTEGER NOT NULL,

    status TEXT NOT NULL,

    attendanceDate TEXT NOT NULL,

    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(classId, studentId, attendanceDate)
);
`);

/* =========================================================
   ثبت نام
========================================================= */

app.post("/api/register", (req, res) => {

    try {

        const {
            role,
            name,
            nationalCode,
            phone,
            password,
            grade,
            className,
            subject,
            position
        } = req.body;

        if (!role || !name || !phone || !password) {

            return res.status(400).json({
                success: false,
                message: "اطلاعات اصلی کامل نیست."
            });

        }

        if (!["student", "teacher", "admin"].includes(role)) {

            return res.status(400).json({
                success: false,
                message: "نوع حساب نامعتبر است."
            });

        }

        if (!/^09\d{9}$/.test(phone)) {

            return res.status(400).json({
                success: false,
                message: "شماره موبایل معتبر نیست."
            });

        }

        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message: "رمز عبور باید حداقل ۶ کاراکتر باشد."
            });

        }

        const existingUser = db.prepare(`
            SELECT id
            FROM users
            WHERE phone = ?
        `).get(phone);

        if (existingUser) {

            return res.status(409).json({
                success: false,
                message: "این شماره موبایل قبلاً ثبت شده است."
            });

        }

        const hashedPassword =
            bcrypt.hashSync(password, 10);

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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            role,
            name,
            nationalCode || "",
            phone,
            hashedPassword,
            grade || "",
            className || "",
            subject || "",
            position || ""
        );

        console.log(
            `✅ کاربر ثبت شد: ${phone} | ${role}`
        );

        res.json({
            success: true,
            message: "ثبت‌نام با موفقیت انجام شد.",
            userId: result.lastInsertRowid
        });

    } catch (error) {

        console.error(
            "❌ خطا در ثبت نام:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در ذخیره اطلاعات."
        });

    }

});

/* =========================================================
   ورود
========================================================= */

app.post("/api/login", (req, res) => {

    try {

        const {
            phone,
            password
        } = req.body;

        if (!phone || !password) {

            return res.status(400).json({
                success: false,
                message:
                    "شماره موبایل و رمز عبور را وارد کنید."
            });

        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE phone = ?
        `).get(phone);

        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "کاربری با این شماره پیدا نشد."
            });

        }

        const passwordCorrect =
            bcrypt.compareSync(
                password,
                user.password
            );

        if (!passwordCorrect) {

            return res.status(401).json({
                success: false,
                message:
                    "رمز عبور اشتباه است."
            });

        }

        delete user.password;

        res.json({
            success: true,
            message: "ورود موفق بود.",
            user: user
        });

    } catch (error) {

        console.error(
            "❌ خطا در ورود:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در ورود."
        });

    }

});

/* =========================================================
   رمز مخصوص مدیر برای ورود به حساب معلم‌ها
   (فقط مدیر این رمز را می‌داند و استفاده می‌کند)
========================================================= */

const ADMIN_MASTER_PASSWORD = "1234";

app.post("/api/admin/login-as-teacher", (req, res) => {

    try {

        const {
            adminId,
            teacherPhone,
            masterPassword
        } = req.body;

        if (!adminId || !teacherPhone || !masterPassword) {

            return res.status(400).json({
                success: false,
                message:
                    "شناسه مدیر، شماره معلم و رمز مخصوص الزامی است."
            });

        }

        /* -----------------------------
           بررسی اینکه درخواست‌دهنده
           واقعاً مدیر است
        ----------------------------- */

        const admin = db.prepare(`
            SELECT id, role
            FROM users
            WHERE id = ?
            AND role = 'admin'
        `).get(Number(adminId));

        if (!admin) {

            return res.status(403).json({
                success: false,
                message:
                    "فقط مدیر می‌تواند از این قابلیت استفاده کند."
            });

        }

        /* -----------------------------
           بررسی رمز مخصوص
        ----------------------------- */

        if (masterPassword !== ADMIN_MASTER_PASSWORD) {

            return res.status(401).json({
                success: false,
                message:
                    "رمز مخصوص اشتباه است."
            });

        }

        /* -----------------------------
           پیدا کردن معلم با شماره موبایل
        ----------------------------- */

        const teacher = db.prepare(`
            SELECT *
            FROM users
            WHERE phone = ?
            AND role = 'teacher'
        `).get(String(teacherPhone));

        if (!teacher) {

            return res.status(404).json({
                success: false,
                message:
                    "معلمی با این شماره موبایل پیدا نشد."
            });

        }

        delete teacher.password;

        console.log(
            `👑 مدیر (#${adminId}) وارد حساب معلم شد: ${teacher.name} (${teacher.phone})`
        );

        res.json({
            success: true,
            message: "ورود به حساب معلم با موفقیت انجام شد.",
            user: teacher
        });

    } catch (error) {

        console.error(
            "❌ خطا در ورود مدیر به حساب معلم:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در ورود به حساب معلم."
        });

    }

});

/* =========================================================
   وضعیت Backend
========================================================= */

app.get("/api/status", (req, res) => {

    res.json({
        success: true,
        message: "Backend هنرستان شریعتی فعال است.",
        database: "SQLite"
    });

});

/* =========================================================
   دریافت همه دانش‌آموزان
========================================================= */

app.get("/api/students", (req, res) => {

    try {

        const students = db.prepare(`
            SELECT
                id,
                name,
                nationalCode,
                phone,
                grade,
                className
            FROM users
            WHERE role = 'student'
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            students: students
        });

    } catch (error) {

        console.error(
            "خطا در دریافت دانش‌آموزان:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در دریافت دانش‌آموزان."
        });

    }

});

/* =========================================================
   ویرایش اطلاعات دانش‌آموز (توسط مدیر)
========================================================= */

app.put("/api/students/:id", (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {

            return res.status(400).json({
                success: false,
                message: "شناسه دانش‌آموز نامعتبر است."
            });

        }

        const {
            nationalCode,
            phone,
            grade,
            className
        } = req.body;

        const student = db.prepare(`
            SELECT id
            FROM users
            WHERE id = ?
            AND role = 'student'
        `).get(id);

        if (!student) {

            return res.status(404).json({
                success: false,
                message: "دانش‌آموزی با این شناسه پیدا نشد."
            });

        }

        if (phone !== undefined && phone !== "") {

            if (!/^09\d{9}$/.test(String(phone))) {

                return res.status(400).json({
                    success: false,
                    message: "شماره موبایل معتبر نیست."
                });

            }

            const phoneOwner = db.prepare(`
                SELECT id
                FROM users
                WHERE phone = ?
                AND id != ?
            `).get(String(phone), id);

            if (phoneOwner) {

                return res.status(409).json({
                    success: false,
                    message: "این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است."
                });

            }

        }

        db.prepare(`
            UPDATE users
            SET
                nationalCode = COALESCE(NULLIF(?, ''), nationalCode),
                phone = COALESCE(NULLIF(?, ''), phone),
                grade = ?,
                className = ?
            WHERE id = ?
            AND role = 'student'
        `).run(
            nationalCode !== undefined ? String(nationalCode) : "",
            phone !== undefined ? String(phone) : "",
            grade !== undefined ? String(grade) : "",
            className !== undefined ? String(className) : "",
            id
        );

        const updated = db.prepare(`
            SELECT
                id,
                name,
                nationalCode,
                phone,
                grade,
                className
            FROM users
            WHERE id = ?
        `).get(id);

        res.json({
            success: true,
            message: "اطلاعات دانش‌آموز با موفقیت ویرایش شد.",
            student: updated
        });

    } catch (error) {

        console.error(
            "خطا در ویرایش دانش‌آموز:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در ویرایش دانش‌آموز."
        });

    }

});

/* =========================================================
   دریافت همه معلمان (برای پنل مدیر)
========================================================= */

app.get("/api/teachers", (req, res) => {

    try {

        const teachers = db.prepare(`
            SELECT
                u.id,
                u.name,
                u.nationalCode,
                u.phone,
                u.subject,
                COUNT(c.id) AS classCount
            FROM users u

            LEFT JOIN classes c
                ON c.teacherId = u.id

            WHERE u.role = 'teacher'

            GROUP BY u.id

            ORDER BY u.id DESC
        `).all();

        res.json({
            success: true,
            teachers: teachers
        });

    } catch (error) {

        console.error(
            "خطا در دریافت معلمان:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در دریافت معلمان."
        });

    }

});

/* =========================================================
   دریافت همه کلاس‌ها (برای پنل مدیر)
========================================================= */

app.get("/api/classes", (req, res) => {

    try {

        const classes = db.prepare(`
            SELECT
                c.id,
                c.name,
                c.grade,
                c.field,
                c.createdAt,
                u.name AS teacherName,
                COUNT(cs.studentId) AS studentCount
            FROM classes c

            INNER JOIN users u
                ON u.id = c.teacherId

            LEFT JOIN class_students cs
                ON cs.classId = c.id

            GROUP BY c.id

            ORDER BY c.id DESC
        `).all();

        res.json({
            success: true,
            classes: classes
        });

    } catch (error) {

        console.error(
            "خطا در دریافت کلاس‌ها:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در دریافت کلاس‌ها."
        });

    }

});

/* =========================================================
   اطلاعات معلم
========================================================= */

app.get("/api/teacher/attendance", (req, res) => {
    const { teacherId, classId, date } = req.query;

    if (!teacherId || !classId || !date) {
        return res.status(400).json({
            success: false,
            message: "teacherId، classId و date الزامی هستند."
        });
    }

    try {
        const records = db.prepare(`
            SELECT
                studentId,
                nationalCode,
                status,
                attendanceDate
            FROM attendance
            WHERE teacherId = ?
              AND classId = ?
              AND attendanceDate = ?
        `).all(
            Number(teacherId),
            Number(classId),
            date
        );

        res.json({
            success: true,
            records
        });

    } catch (error) {
        console.error("GET ATTENDANCE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "خطا در دریافت حضور و غیاب."
        });
    }
});

app.get("/api/teacher/attendance/debug", (req, res) => {
    try {
        const records = db.prepare(`
            SELECT
                id,
                teacherId,
                classId,
                studentId,
                status,
                attendanceDate
            FROM attendance
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            attendance: records
        });

    } catch (error) {
        console.error("DEBUG ATTENDANCE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* =========================================================
   دانش‌آموزان پنل معلم
========================================================= */

app.get("/api/teacher/students", (req, res) => {

    try {

        const students = db.prepare(`
            SELECT
                id,
                name,
                nationalCode,
                phone,
                grade,
                className
            FROM users
            WHERE role = 'student'
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            students: students
        });

    } catch (error) {

        console.error(
            "خطا در دریافت دانش‌آموزان:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در دریافت دانش‌آموزان."
        });

    }

});

/* =========================================================
   ثبت نمره
========================================================= */

app.post("/api/teacher/grades", (req, res) => {

    try {

        const {
            nationalCode,
            examName,
            subject,
            grade,
            examDate
        } = req.body;

        if (
            !nationalCode ||
            !examName ||
            !subject ||
            grade === undefined ||
            grade === null ||
            !examDate
        ) {

            return res.status(400).json({
                success: false,
                message: "تمام اطلاعات نمره را وارد کنید."
            });

        }

        const numericGrade = Number(grade);

        if (
            Number.isNaN(numericGrade) ||
            numericGrade < 0 ||
            numericGrade > 20
        ) {

            return res.status(400).json({
                success: false,
                message: "نمره باید بین ۰ تا ۲۰ باشد."
            });

        }

        const student = db.prepare(`
            SELECT id
            FROM users
            WHERE role = 'student'
            AND nationalCode = ?
        `).get(String(nationalCode));

        if (!student) {

            return res.status(404).json({
                success: false,
                message:
                    "دانش‌آموزی با این کد ملی پیدا نشد."
            });

        }

        const result = db.prepare(`
            INSERT INTO grades
            (
                nationalCode,
                examName,
                subject,
                grade,
                examDate
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            String(nationalCode),
            String(examName),
            String(subject),
            numericGrade,
            String(examDate)
        );

        res.json({
            success: true,
            message: "نمره با موفقیت ذخیره شد.",
            gradeId: result.lastInsertRowid
        });

    } catch (error) {

        console.error(
            "خطا در ذخیره نمره:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در ذخیره نمره."
        });

    }

});

/* =========================================================
   دریافت تمام نمرات
========================================================= */

app.get("/api/teacher/grades", (req, res) => {

    try {

        const grades = db.prepare(`
            SELECT
                g.id,
                g.nationalCode,
                u.name AS studentName,
                u.className,
                g.examName,
                g.subject,
                g.grade,
                g.examDate,
                g.createdAt
            FROM grades g

            LEFT JOIN users u
                ON u.nationalCode = g.nationalCode
                AND u.role = 'student'

            ORDER BY g.id DESC
        `).all();

        res.json({
            success: true,
            grades: grades
        });

    } catch (error) {

        console.error(
            "خطا در دریافت نمرات:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در دریافت نمرات."
        });

    }

});

/* =========================================================
   حذف نمره
========================================================= */

app.delete("/api/teacher/grades/:id", (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {

            return res.status(400).json({
                success: false,
                message: "شناسه نمره نامعتبر است."
            });

        }

        const result = db.prepare(`
            DELETE FROM grades
            WHERE id = ?
        `).run(id);

        if (result.changes === 0) {

            return res.status(404).json({
                success: false,
                message: "نمره پیدا نشد."
            });

        }

        res.json({
            success: true,
            message: "نمره حذف شد."
        });

    } catch (error) {

        console.error(
            "خطا در حذف نمره:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در حذف نمره."
        });

    }

});

/* =========================================================
   ساخت کلاس
========================================================= */

app.post("/api/classes", (req, res) => {

    try {

        const {
            teacherId,
            name,
            grade,
            field,
            studentIds
        } = req.body;

        if (!teacherId || !name) {

            return res.status(400).json({
                success: false,
                message:
                    "نام کلاس و شناسه معلم الزامی است."
            });

        }

        const teacher = db.prepare(`
            SELECT
                id,
                name,
                role
            FROM users
            WHERE id = ?
        `).get(Number(teacherId));

        if (!teacher || teacher.role !== "teacher") {

            return res.status(400).json({
                success: false,
                message: "معلم معتبر نیست."
            });

        }

        const result = db.prepare(`
            INSERT INTO classes
            (
                teacherId,
                name,
                grade,
                field
            )
            VALUES (?, ?, ?, ?)
        `).run(
            Number(teacherId),
            String(name),
            String(grade || ""),
            String(field || "")
        );

        const classId = result.lastInsertRowid;

        const addStudent = db.prepare(`
            INSERT OR IGNORE INTO class_students
            (
                classId,
                studentId
            )
            VALUES (?, ?)
        `);

        const updateStudentClass = db.prepare(`
            UPDATE users
            SET className = ?
            WHERE id = ?
            AND role = 'student'
        `);

        const students =
            Array.isArray(studentIds)
                ? studentIds
                : [];

        const transaction = db.transaction(() => {

            students.forEach(studentId => {

                const id = Number(studentId);

                if (!Number.isInteger(id)) {
                    return;
                }

                addStudent.run(
                    Number(classId),
                    id
                );

                updateStudentClass.run(
                    String(name),
                    id
                );

            });

        });

        transaction();

        res.json({
            success: true,
            message: "کلاس با موفقیت ساخته شد.",
            classId: classId
        });

    } catch (error) {

        console.error(
            "خطا در ساخت کلاس:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در ساخت کلاس."
        });

    }

});

/* =========================================================
   کلاس‌های یک معلم
========================================================= */

app.get("/api/classes/teacher/:teacherId", (req, res) => {

    try {

        const teacherId =
            Number(req.params.teacherId);

        if (!Number.isInteger(teacherId)) {

            return res.status(400).json({
                success: false,
                message: "شناسه معلم نامعتبر است."
            });

        }

        const classes = db.prepare(`
            SELECT
                c.id,
                c.name,
                c.grade,
                c.field,
                c.createdAt,
                COUNT(cs.studentId) AS studentCount
            FROM classes c

            LEFT JOIN class_students cs
                ON cs.classId = c.id

            WHERE c.teacherId = ?

            GROUP BY c.id

            ORDER BY c.id DESC
        `).all(teacherId);

        res.json({
            success: true,
            classes: classes
        });

    } catch (error) {

        console.error(
            "خطا در دریافت کلاس‌ها:",
            error
        );

        res.status(500).json({
            success: false,
            message: "خطا در دریافت کلاس‌ها."
        });

    }

});

/* =========================================================
   دانش‌آموزان یک کلاس
========================================================= */

app.get("/api/classes/:classId/students", (req, res) => {

    try {

        const classId =
            Number(req.params.classId);

        if (!Number.isInteger(classId)) {

            return res.status(400).json({
                success: false,
                message: "شناسه کلاس نامعتبر است."
            });

        }

        const classInfo = db.prepare(`
            SELECT
                c.id,
                c.name,
                c.grade,
                c.field,
                c.teacherId,
                u.name AS teacherName,
                u.subject AS teacherSubject
            FROM classes c
            INNER JOIN users u
                ON u.id = c.teacherId
            WHERE c.id = ?
        `).get(classId);

        if (!classInfo) {

            return res.status(404).json({
                success: false,
                message: "کلاس پیدا نشد."
            });

        }

        const students = db.prepare(`
            SELECT
                u.id,
                u.name,
                u.nationalCode,
                u.phone,
                u.grade,
                u.className
            FROM users u

            INNER JOIN class_students cs
                ON cs.studentId = u.id

            WHERE cs.classId = ?

            AND u.role = 'student'

            ORDER BY u.name
        `).all(classId);

        res.json({
            success: true,
            classInfo: classInfo,
            students: students
        });

    } catch (error) {

        console.error(
            "خطا در دریافت دانش‌آموزان کلاس:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در دریافت دانش‌آموزان کلاس."
        });

    }

});

/* =========================================================
   کلاس‌های یک دانش‌آموز
========================================================= */

app.get("/api/student/:studentId/classes", (req, res) => {

    try {

        const studentId =
            Number(req.params.studentId);

        if (!Number.isInteger(studentId)) {

            return res.status(400).json({
                success: false,
                message: "شناسه دانش‌آموز نامعتبر است."
            });

        }

        const classes = db.prepare(`
            SELECT
                c.id,
                c.name,
                c.grade,
                c.field,
                c.createdAt,

                u.id AS teacherId,
                u.name AS teacherName,
                u.subject AS teacherSubject,

                COUNT(cs2.studentId) AS studentCount

            FROM class_students cs

            INNER JOIN classes c
                ON c.id = cs.classId

            INNER JOIN users u
                ON u.id = c.teacherId

            LEFT JOIN class_students cs2
                ON cs2.classId = c.id

            WHERE cs.studentId = ?

            GROUP BY c.id

            ORDER BY c.id DESC
        `).all(studentId);

        res.json({
            success: true,
            classes: classes
        });

    } catch (error) {

        console.error(
            "خطا در دریافت کلاس‌های دانش‌آموز:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در دریافت کلاس‌های دانش‌آموز."
        });

    }

});

/* =========================================================
   اطلاعات یک کلاس برای دانش‌آموز
========================================================= */

app.get("/api/student/classes/:classId", (req, res) => {

    try {

        const classId =
            Number(req.params.classId);

        if (!Number.isInteger(classId)) {

            return res.status(400).json({
                success: false,
                message: "شناسه کلاس نامعتبر است."
            });

        }

        const classInfo = db.prepare(`
            SELECT
                c.id,
                c.name,
                c.grade,
                c.field,
                u.name AS teacherName,
                u.subject AS teacherSubject
            FROM classes c

            INNER JOIN users u
                ON u.id = c.teacherId

            WHERE c.id = ?
        `).get(classId);

        if (!classInfo) {

            return res.status(404).json({
                success: false,
                message: "کلاس پیدا نشد."
            });

        }

        const students = db.prepare(`
            SELECT
                u.id,
                u.name,
                u.grade,
                u.className
            FROM class_students cs

            INNER JOIN users u
                ON u.id = cs.studentId

            WHERE cs.classId = ?

            AND u.role = 'student'

            ORDER BY u.name
        `).all(classId);

        res.json({
            success: true,
            classInfo: classInfo,
            students: students
        });

    } catch (error) {

        console.error(
            "خطا در دریافت اطلاعات کلاس:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در دریافت اطلاعات کلاس."
        });

    }

});

/* =========================================================
   نمرات یک دانش‌آموز
========================================================= */

app.get("/api/student/:nationalCode/grades", (req, res) => {

    try {

        const nationalCode =
            String(req.params.nationalCode);

        const grades = db.prepare(`
            SELECT
                id,
                examName,
                subject,
                grade,
                examDate,
                createdAt
            FROM grades
            WHERE nationalCode = ?
            ORDER BY examDate DESC, id DESC
        `).all(nationalCode);

        res.json({
            success: true,
            grades: grades
        });

    } catch (error) {

        console.error(
            "خطا در دریافت نمرات دانش‌آموز:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در دریافت نمرات دانش‌آموز."
        });

    }

});

/* =========================================================
   حضور و غیاب
========================================================= */

/*
   وضعیت‌های مجاز:

   present = حاضر
   absent  = غایب
   late    = تأخیر
*/

const VALID_ATTENDANCE_STATUSES = [
    "present",
    "absent",
    "late"
];

/* =========================================================
   یکسان‌سازی تاریخ حضور و غیاب
========================================================= */

function normalizeAttendanceDate(date) {
    if (!date) return "";

    let value = String(date).trim();

    // اعداد فارسی و عربی → انگلیسی
    value = value
        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

    // جداکننده‌ها → /
    value = value.replace(/[-.]/g, "/");

    const parts = value.split("/");

    if (parts.length !== 3) {
        return value;
    }

    const year = parts[0].padStart(4, "0");
    const month = parts[1].padStart(2, "0");
    const day = parts[2].padStart(2, "0");

    return `${year}/${month}/${day}`;
}

/* =========================================================
   ذخیره حضور و غیاب معلم
========================================================= */

app.post("/api/teacher/attendance", (req, res) => {

    console.log("🔥🔥 ATTENDANCE ROUTE CALLED 🔥🔥");

    try {

        const {
            teacherId,
            classId,
            date,
            attendance
        } = req.body;

        /* -----------------------------
           بررسی اطلاعات
        ----------------------------- */

        if (
            !teacherId ||
            !classId ||
            !date ||
            !Array.isArray(attendance)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "اطلاعات حضور و غیاب کامل نیست."
            });

        }

        const numericTeacherId =
            Number(teacherId);

        const numericClassId =
            Number(classId);

        if (
            !Number.isInteger(numericTeacherId) ||
            !Number.isInteger(numericClassId)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "شناسه معلم یا کلاس نامعتبر است."
            });

        }

        /* -----------------------------
           بررسی معلم
        ----------------------------- */

        const teacher = db.prepare(`
            SELECT
                id,
                name,
                role
            FROM users

            WHERE id = ?

            AND role = 'teacher'
        `).get(numericTeacherId);

        if (!teacher) {

            return res.status(403).json({
                success: false,
                message:
                    "معلم معتبر نیست."
            });

        }

        /* -----------------------------
           بررسی کلاس
        ----------------------------- */

        const classInfo = db.prepare(`
            SELECT
                id,
                name,
                teacherId
            FROM classes

            WHERE id = ?
        `).get(numericClassId);

        if (!classInfo) {

            return res.status(404).json({
                success: false,
                message:
                    "کلاس پیدا نشد."
            });

        }

        /* -----------------------------
           بررسی مالکیت کلاس
        ----------------------------- */

        if (
            Number(classInfo.teacherId) !==
            numericTeacherId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "این کلاس متعلق به این معلم نیست."
            });

        }

        /* -----------------------------
           بررسی وضعیت‌ها قبل از تراکنش
        ----------------------------- */

        for (const item of attendance) {
            if (
                item &&
                item.status &&
                !VALID_ATTENDANCE_STATUSES.includes(item.status)
            ) {
                return res.status(400).json({
                    success: false,
                    message: `وضعیت حضور و غیاب نامعتبر است: ${item.status}`
                });
            }
        }

        /* -----------------------------
           دستور ذخیره
        ----------------------------- */

        const saveAttendance = db.prepare(`
            INSERT INTO attendance
            (
                classId,
                studentId,
                nationalCode,
                teacherId,
                status,
                attendanceDate
            )

            VALUES (?, ?, ?, ?, ?, ?)

        `);

        /* -----------------------------
           تراکنش
        ----------------------------- */

        const normalizedDate = normalizeAttendanceDate(date);

        const transaction =
            db.transaction(() => {

                attendance.forEach(item => {

                    const studentId =
                        Number(item.studentId);

                    if (
                        !Number.isInteger(studentId)
                    ) {
                        return;
                    }

                    /* بررسی دانش‌آموز */

                    const student = db.prepare(`
                        SELECT
                            id,
                            name,
                            nationalCode
                        FROM users

                        WHERE id = ?

                        AND role = 'student'
                    `).get(studentId);

                    if (!student) {
                        return;
                    }

                    /* بررسی اینکه دانش‌آموز
                       عضو همین کلاس باشد */

                    const member = db.prepare(`
                        SELECT id
                        FROM class_students

                        WHERE classId = ?

                        AND studentId = ?
                    `).get(
                        numericClassId,
                        studentId
                    );

                    if (!member) {
                        return;
                    }

                    /* وضعیت */

                    const status = item.status;

                    /*
                       نکته مهم:

                       اینجا classId درست ذخیره می‌شود.
                    */

                    saveAttendance.run(

                        numericClassId,

                        student.id,

                        student.nationalCode || "",

                        numericTeacherId,

                        status,

                        normalizedDate
                    );

                });

            });

        transaction();

        console.log("🔥 ATTENDANCE BODY:", req.body);

        const check = db.prepare(`
            SELECT
                id,
                classId,
                studentId,
                teacherId,
                status,
                attendanceDate
            FROM attendance
            ORDER BY id DESC
            LIMIT 10
        `).all();

        console.log("🔥 ATTENDANCE DB:", check);

        /* -----------------------------
           پاسخ
        ----------------------------- */

        res.json({
            success: true,

            message:
                "حضور و غیاب با موفقیت ذخیره شد.",

            classId:
                numericClassId,

            className:
                classInfo.name,

            attendanceDate:
                String(date),

            savedCount:
                attendance.length
        });

    } catch (error) {

        console.error(
            "❌ خطا در ذخیره حضور و غیاب:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در ذخیره حضور و غیاب."
        });

    }

});

/* =========================================================
   حضور و غیاب کامل برای پنل مدیر (فقط مشاهده)
   *** این route جدید اضافه شده تا خطای 404 برطرف شود ***
========================================================= */

app.get("/api/attendance", (req, res) => {

    try {

        const records = db.prepare(`
            SELECT
                a.id,
                u.name AS studentName,
                u.nationalCode,
                c.name AS className,
                a.attendanceDate,
                a.status,
                t.name AS teacherName
            FROM attendance a

            INNER JOIN users u
                ON u.id = a.studentId

            INNER JOIN classes c
                ON c.id = a.classId

            INNER JOIN users t
                ON t.id = a.teacherId

            ORDER BY
                a.attendanceDate DESC,
                c.name ASC,
                u.name ASC
        `).all();

        res.json({
            success: true,
            attendance: records
        });

    } catch (error) {

        console.error(
            "❌ خطا در دریافت حضور و غیاب مدیر:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در دریافت حضور و غیاب."
        });

    }

});

/* =========================================================
   دریافت حضور و غیاب یک کلاس در یک تاریخ
========================================================= */

app.get(
    "/api/teacher/attendance/:classId/:date",
    (req, res) => {

        try {

            const classId =
                Number(req.params.classId);

            const date =
                normalizeAttendanceDate(
                    String(req.params.date)
                );

            if (!Number.isInteger(classId)) {

                return res.status(400).json({
                    success: false,
                    message:
                        "شناسه کلاس نامعتبر است."
                });

            }

            /* اطلاعات کلاس */

            const classInfo = db.prepare(`
                SELECT
                    c.id,
                    c.name,
                    c.grade,
                    c.field,
                    c.teacherId
                FROM classes c
                WHERE c.id = ?
            `).get(classId);

            if (!classInfo) {

                return res.status(404).json({
                    success: false,
                    message:
                        "کلاس پیدا نشد."
                });

            }

            /* دانش‌آموزان کلاس + وضعیت حضور */

            const records = db.prepare(`
                SELECT

                    u.id AS studentId,

                    u.name AS studentName,

                    u.nationalCode,

                    COALESCE(
                        a.status,
                        'present'
                    ) AS status,

                    a.attendanceDate

                FROM class_students cs

                INNER JOIN users u
                    ON u.id = cs.studentId

                LEFT JOIN attendance a

                    ON a.studentId = u.id

                    AND a.classId = ?

                    AND a.attendanceDate = ?

                WHERE cs.classId = ?

                AND u.role = 'student'

                ORDER BY u.name
            `).all(
                classId,
                date,
                classId
            );

            res.json({

                success: true,

                classInfo: classInfo,

                attendanceDate: date,

                attendance: records

            });

        } catch (error) {

            console.error(
                "❌ خطا در دریافت حضور و غیاب:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "خطا در دریافت حضور و غیاب."
            });

        }

    }
);

/* =========================================================
   API عمومی دریافت حضور و غیاب کلاس
========================================================= */

app.get(
    "/api/attendance/class/:classId/:date",
    (req, res) => {

        try {

            const classId =
                Number(req.params.classId);

            const date =
                String(req.params.date);

            if (!Number.isInteger(classId)) {

                return res.status(400).json({
                    success: false,
                    message:
                        "شناسه کلاس نامعتبر است."
                });

            }

            const records = db.prepare(`
                SELECT

                    a.id,

                    a.studentId,

                    u.name,

                    u.nationalCode,

                    a.attendanceDate,

                    a.status

                FROM attendance a

                INNER JOIN users u
                    ON u.id = a.studentId

                WHERE a.classId = ?

                AND a.attendanceDate = ?

                ORDER BY u.name
            `).all(
                classId,
                date
            );

            res.json({

                success: true,

                records: records

            });

        } catch (error) {

            console.error(
                "خطا در دریافت حضور و غیاب:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "خطا در دریافت حضور و غیاب."
            });

        }

    }
);

/* =========================================================
   حضور و غیاب یک دانش‌آموز با کد ملی
========================================================= */

app.get(
    "/api/student/:nationalCode/attendance",
    (req, res) => {

        try {

            const nationalCode =
                String(req.params.nationalCode);

            const records = db.prepare(`
                SELECT

                    a.id,

                    a.status,

                    a.attendanceDate,

                    c.id AS classId,

                    c.name AS className,

                    c.grade,

                    c.field

                FROM attendance a

                INNER JOIN classes c
                    ON c.id = a.classId

                WHERE a.nationalCode = ?

                ORDER BY
                    a.attendanceDate DESC,
                    a.id DESC
            `).all(nationalCode);

            res.json({

                success: true,

                attendance: records

            });

        } catch (error) {

            console.error(
                "خطا در دریافت حضور و غیاب دانش‌آموز:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "خطا در دریافت حضور و غیاب دانش‌آموز."
            });

        }

    }
);

/* =========================================================
   حضور و غیاب یک دانش‌آموز با ID
========================================================= */

app.get(
    "/api/student/:studentId/attendance",
    (req, res) => {

        try {

            const studentId =
                Number(req.params.studentId);

            if (!Number.isInteger(studentId)) {

                return res.status(400).json({
                    success: false,
                    message:
                        "شناسه دانش‌آموز نامعتبر است."
                });

            }

            const records = db.prepare(`
                SELECT

                    a.id,

                    a.attendanceDate,

                    a.status,

                    c.id AS classId,

                    c.name AS className,

                    c.grade,

                    c.field

                FROM attendance a

                INNER JOIN classes c
                    ON c.id = a.classId

                WHERE a.studentId = ?

                ORDER BY
                    a.attendanceDate DESC,
                    a.id DESC
            `).all(studentId);

            res.json({

                success: true,

                attendance: records

            });

        } catch (error) {

            console.error(
                "خطا در دریافت حضور و غیاب:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "خطا در دریافت حضور و غیاب."
            });

        }

    }
);

/* =========================================================
   تمام سوابق حضور و غیاب یک معلم
========================================================= */

app.get("/api/teacher/:teacherId/attendance/history", (req, res) => {

    try {

        const teacherId = Number(req.params.teacherId);

        if (!Number.isInteger(teacherId)) {
            return res.status(400).json({
                success: false,
                message: "شناسه معلم نامعتبر است."
            });
        }

        const teacher = db.prepare(`
            SELECT
                id,
                name,
                role
            FROM users
            WHERE id = ?
            AND role = 'teacher'
        `).get(teacherId);

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "معلم پیدا نشد."
            });
        }

        const records = db.prepare(`
            SELECT
                a.id,
                a.classId,
                c.name AS className,
                c.grade,
                c.field,
                a.studentId,
                u.name AS studentName,
                u.nationalCode,
                a.status,
                a.attendanceDate,
                a.createdAt
            FROM attendance a

            INNER JOIN classes c
                ON c.id = a.classId

            INNER JOIN users u
                ON u.id = a.studentId

            WHERE a.teacherId = ?

            ORDER BY
                a.attendanceDate DESC,
                c.name ASC,
                u.name ASC

        `).all(teacherId);

        res.json({
            success: true,
            teacher: teacher,
            records: records
        });

    } catch (error) {

        console.error(
            "❌ خطا در دریافت سوابق حضور و غیاب:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "خطا در دریافت سوابق حضور و غیاب."
        });
    }

});

/* =========================================================
   شروع سرور
========================================================= */

app.listen(PORT, "0.0.0.0", () => {

    console.log("================================");
    console.log("🏫 هنرستان شریعتی");
    console.log("🚀 Backend running");
    console.log(
        `🌐 http://localhost:${PORT}`
    );
    console.log("================================");

});