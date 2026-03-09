# webuntis-utils

## Purpose:

This script fetches lesson data from one or more WebUntis accounts using [this API](https://github.com/SchoolUtils/WebUntis) and stores it in a local database. This allows for easy creation of dashboards (e.g. using [Metabase](https://github.com/metabase/metabase)) to track lessons and analyze student attendance.

## Setup:

1. Install dependencies: `npm install`
2. Place your credentials in `creds.json` at the project root
3. Create a `.env` file at the project root with your configuration
4. Run the script: `node src/getLessons.js`

## Sample configurations:

- [creds.json](docs/creds.json.sample)
- [.env](docs/.env.sample)

## Commands:

- `--sqlite`: Write data to a SQLite database located in `data/`
- `--mysql`: Write data to a MySQL database configured in `.env`
- `--help`: Print help