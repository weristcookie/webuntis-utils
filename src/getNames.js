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
const dbPath = path.join(__dirname, '..', 'data', 'names.db');

const credential = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))[0];

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
    default:
      console.log("Invalid usage! Use --mysql or --sqlite");

      process.exit();
  }

  await db.run(`DROP TABLE IF EXISTS students`);
  await db.run(`
    CREATE TABLE IF NOT EXISTS students (
      first_name TEXT,
      last_name TEXT
    )
  `);

  const url = `untis://setschool?url=lgs.webuntis.com&school=lgs&user=${credential.name}&key=${credential.data}&schoolNumber=3994800`;
  const untis = new WebUntisQR(url, 'custom-identity', Authenticator, URL);
  await untis.login();

  const students = await untis.getStudents();

  for (const student of students) {
    const firstName = student.foreName.split(" ")[0];
    const lastName = student.longName;
    await db.run(
      `INSERT INTO students (first_name, last_name) VALUES (?, ?)`,
      [firstName, lastName]
    );
  }

  await db.close();
  console.log("Done");
}

main().catch(console.error);

class Database {
  constructor(dbType, db) {
    this.dbType = dbType; // "sqlite" or "mysql"
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