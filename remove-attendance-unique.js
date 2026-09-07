const Database = require("better-sqlite3");

const db = new Database("school.db");

try {

db.exec(`
BEGIN TRANSACTION;

CREATE TABLE attendance_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    classId INTEGER NOT NULL,

    studentId INTEGER NOT NULL,

    nationalCode TEXT,

    teacherId INTEGER NOT NULL,

    status TEXT NOT NULL,

    attendanceDate TEXT NOT NULL,

    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO attendance_new
(
    id,
    classId,
    studentId,
    nationalCode,
    teacherId,
    status,
    attendanceDate,
    createdAt
)

SELECT
    id,
    classId,
    studentId,
    nationalCode,
    teacherId,
    status,
    attendanceDate,
    createdAt

FROM attendance;


DROP TABLE attendance;


ALTER TABLE attendance_new
RENAME TO attendance;


COMMIT;
`);

console.log("Attendance history mode enabled ✅");

}
catch(error){

console.error(error);

}

db.close();