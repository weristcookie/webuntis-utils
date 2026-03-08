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

const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

dotenv.config({
  path: path.join(__dirname, "..", ".env")
});


async function main() {
    let db;

    switch (process.argv[2]) {
        case "--mysql":
            console.log("Connecting to MySQL...");            

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
        case "--console":
            let lessons = await getLessonsForUser(credentials[process.argv[3]]);
            let totalLessons = 0;
            let missedLessons = 0;
            let cancelledLessons = 0;

            for (let lesson of lessons) {           
                if (!lesson.cancelled) {
                    totalLessons++;
                    if (!lesson.attended) missedLessons++;
                } else {
                    cancelledLessons++;
                }
            }
            
            console.log("Active lessons: " + totalLessons);
            console.log("Cancelled lessons: " + cancelledLessons);
            console.log("Missed lessons: " + missedLessons + ", or " + (Math.floor(missedLessons / totalLessons * 1000) / 10) + "%");

            process.exit();
        case "--help":
            console.log("Available commands:");
            console.log("--mysql");
            console.log("--sqlite");
            console.log("--console <credential_id>")
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
            id VARCHAR(255),
            name VARCHAR(255),
            longname VARCHAR(255),
            cancelled BOOLEAN,
            attended BOOLEAN,
            date DATE,
            student VARCHAR(255),
            excused TINYINT,
            teacher VARCHAR(255)
        )
    `);
}

async function getLessonsForUser(user) {
    const url = `untis://setschool?url=lgs.webuntis.com&school=lgs&user=${user.name}&key=${user.data}&schoolNumber=3994800`;
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
        let cancelled = entry.code === 'cancelled';
        let { wasAbsent, excused } = isLessonDuringAbsence(entry, absences);
        let attended = !cancelled && !wasAbsent;
        if (attended || cancelled) {
            excused = -1;
        }
        let name = entry.su[0] ? entry.su[0].name : 'leer';
        let longname = entry.su[0] ? entry.su[0].longname : 'leer';
        let date = formatDate(entry.date);
        let student = user.name.split('.')[0];
        let teacher = entry.te[0].longname;

        lessons.push(new Lesson(name, longname, cancelled, attended, date, student, entry.id, excused, teacher));
    }

    return lessons;
}

async function insertLessonsIntoDB(lessons, db) {
    for (let lesson of lessons) {
        await db.run(
            `INSERT INTO lessons (name, longname, cancelled, attended, date, student, id, excused, teacher) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lesson.name, lesson.longname, lesson.cancelled, lesson.attended, lesson.date, lesson.student, lesson.id, lesson.excused, lesson.teacher]
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
    constructor(name, longname, cancelled, attended, date, student, id, excused, teacher) {
        this.name = name;
        this.longname = longname;
        this.cancelled = cancelled;
        this.attended = attended;
        this.date = date;
        this.student = student;
        this.id = id;
        this.excused = excused;
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
