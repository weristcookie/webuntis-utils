import mysql from 'mysql2/promise';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { WebUntisQR } from 'webuntis';
import { URL } from 'url';
import { authenticator as Authenticator } from 'otplib';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credsPath = path.join(__dirname, '..', 'creds.json');
const dbPath = path.join(__dirname, '..', 'data', 'lessons.db');

if (!fs.existsSync(credsPath)) {
    console.log("creds.json file not found, exiting");
    process.exit();
}

const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

dotenv.config({
  path: path.join(__dirname, "..", ".env")
});

try {
    process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
    console.log(".env file not found, exiting")
    process.exit();
}

const untisUrlTemplate = process.env.UNTIS_URL;
if (!untisUrlTemplate) {
    console.log("UNTIS_URL not set in .env file, exiting");
    process.exit();
}

async function main() {
    let db;

    switch (process.argv[2]) {
        case "--mysql":
            console.log("Connecting to MySQL...");

            if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
                console.log("Database credentials not fully set in .env file, exiting");
                process.exit();
            }

            const mysqlConn = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            });

            db = new Database("mysql", mysqlConn);

            break;
        case "--sqlite":
            console.log("Connecting to SQLite...");

            fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

            const sqliteConn = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });

            db = new Database("sqlite", sqliteConn);

            break;
        case "--help":
            console.log("Available commands:");
            console.log("--mysql");
            console.log("--sqlite");
            console.log("--help")
            process.exit();
        default:
            console.log("Invalid usage! Use --help for help!");
            process.exit();
    }

    await initializeDB(db);

    for (let user of credentials) {
        let lessons = await getLessonsForUser(user);
        await insertLessonsIntoDB(lessons, db);
        console.log(user.name + " done")
    }

    await db.close();
}

async function initializeDB(db) {
    await db.run(`DROP TABLE IF EXISTS lessons`);

    await db.run(`
        CREATE TABLE IF NOT EXISTS lessons (
            id VARCHAR(255) NOT NULL,
            student VARCHAR(255) NOT NULL,
            subject VARCHAR(255),
            date DATE,
            status VARCHAR(255),
            teacher VARCHAR(255),
            PRIMARY KEY (id, student)
        )
    `);
}

async function getLessonsForUser(user) {
    const url = untisUrlTemplate
        .replace("USERNAME", user.name)
        .replace("KEY", user.data);

    const untis = new WebUntisQR(url, 'custom-identity', Authenticator, URL);
    await untis.login();

    const currentDate = new Date();
    const schoolYear = await untis.getCurrentSchoolyear();
    let endDate = schoolYear.endDate.getTime() > currentDate.getTime() ? currentDate : schoolYear.endDate;
    let endTime = getCurrentTimeHM();

    const timetable = await untis.getOwnTimetableForRange(schoolYear.startDate, endDate);
    const absences = await untis.getAbsentLesson(schoolYear.startDate, endDate);

    const today = getDateAsNumber(currentDate);

    let lessons = [];

    for (const entry of timetable) {
        if (entry.date === today && entry.startTime > endTime) continue;
        if (entry.activityType !== 'Unterricht') continue;

        let lessonStatus;

        if (entry.code === "cancelled") {
            lessonStatus = "cancelled";
        } else {
            const { wasAbsent, excused } = isLessonDuringAbsence(entry, absences);

            if (wasAbsent) {
                lessonStatus = excused ? "excused" : "missed";
            } else {
                lessonStatus = "attended";
            }
        }

        let subject = entry.su[0] ? entry.su[0].longname : 'leer';
        let date = formatDate(entry.date);
        let student = user.name.split('.')[0];
        let teacher = entry.te[0].longname;

        lessons.push(new Lesson(entry.id, student, subject, date, lessonStatus, teacher));
    }

    return lessons;
}

async function insertLessonsIntoDB(lessons, db) {
    for (let lesson of lessons) {
        await db.run(
            `INSERT INTO lessons (id, student, subject, date, status, teacher) VALUES (?, ?, ?, ?, ?, ?)`,
            [lesson.id, lesson.student, lesson.subject, lesson.date, lesson.status, lesson.teacher]
        );
    }
}

function isLessonDuringAbsence(lesson, absences, threshold = 45) {
    for (const absence of absences.absences) {
        const lessonDate = lesson.date;

        if (lessonDate >= absence.startDate && lessonDate <= absence.endDate) {
            const lessonStart = convertToMinutes(lesson.startTime);
            const lessonEnd = convertToMinutes(lesson.endTime);

            let absenceStart = 0;
            let absenceEnd = 2400;

            if (lessonDate === absence.startDate) {
                absenceStart = convertToMinutes(absence.startTime);
            }

            if (lessonDate === absence.endDate) {
                absenceEnd = convertToMinutes(absence.endTime);
            }

            if (
                lessonDate === absence.startDate &&
                lessonStart === absenceStart &&
                (absenceEnd - absenceStart) < threshold
            ) {
                return { wasAbsent: false, excused: -1 };
            }

            const wasAbsent = lessonStart < absenceEnd && lessonEnd > absenceStart;
            return { wasAbsent, excused: absence.isExcused };
        }
    }

    return { wasAbsent: false, excused: -1 };
}

function convertToMinutes(time) {
    const hours = Math.floor(time / 100);
    const minutes = time % 100;
    return hours * 60 + minutes;
}

function formatDate(lessonDate) {
    let rawDate = lessonDate.toString();
    let year = rawDate.substring(0, 4);
    let month = rawDate.substring(4, 6);
    let day = rawDate.substring(6, 8);
    return `${year}-${month}-${day}`;
}

function getCurrentTimeHM() {
    const now = new Date();
    const hours = now.getHours(); // 0–23
    const minutes = now.getMinutes();

    const hourStr = hours.toString().padStart(2, '0');
    const minuteStr = minutes.toString().padStart(2, '0');

    return `${hourStr}${minuteStr}`;
}

function getDateAsNumber(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return parseInt(`${year}${month}${day}`, 10);
}

class Lesson {
    constructor(id, student, subject, date, status, teacher) {
        this.id = id;
        this.student = student;
        this.subject = subject;
        this.date = date;
        this.status = status;
        this.teacher = teacher;
    }
}

class Database {
  constructor(dbType, db) {
    this.dbType = dbType;
    this.db = db;
  }

  async run(sql, params = []) {
    if (this.dbType === "sqlite") {
      return this.db.run(sql, params);
    } else if (this.dbType === "mysql") {
      return this.db.execute(sql, params);
    }
  }

  async close() {
    if (this.dbType === "sqlite") {
      return this.db.close();
    } else if (this.dbType === "mysql") {
      return this.db.end();
    }
  }
}


main().catch(console.error);
