# webuntis-utils

## Purpose

This script fetches lesson data from one or more WebUntis accounts using [this API](https://github.com/SchoolUtils/WebUntis) and stores it in a local database. This allows for easy creation of dashboards (e.g. using [Metabase](https://github.com/metabase/metabase)) to track lessons and analyze student attendance.

## Requirements

- [Node.js](https://nodejs.org/en/download/current)

## Getting started

1. Clone the repository
2. Install dependencies: `npm install`
3. Place your credentials in `creds.json` at the project root
4. Create a `.env` file at the project root with your configuration
5. Run the script: `node src/getLessons.js`

## Sample configurations
- [creds.json](docs/creds.json.sample)
- [.env](docs/.env.sample)

## Commands

- `--sqlite (--reset)`: Insert data into a SQLite database located in `data/`
- `--mysql (--reset)`: Insert data into a MySQL database configured in `.env`
- `--reset`: Reset the database before inserting the data (recommended after updating)
- `--help`: Print help

## Insightful queries

- [Amount of missed lessons](queries/amount_of_missed_lessons.sql)
- [Missed lesson quota](queries/missed_lesson_quota.sql)
- [Amount of attended/missed lessons per day](queries/lessons_per_day.sql)
- [Attendance per subject](queries/attendance_per_subject.sql)