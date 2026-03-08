# webuntis-utils

## Purpose

This script fetches data from your WebUntis account using [this API](https://github.com/SchoolUtils/WebUntis) and stores it in a local database. This allows for easy creation of dashboards (e.g. using [Metabase](https://github.com/metabase/metabase)) to track lessons and analyze student attendance. 

## Setup:

1. Place your credentials in `creds.json` at the project root
2. Create a `.env` file at the project root with your configuration
3. Run the script: `node src/getLessons.js`

## Sample configurations:

- [creds.json](docs/creds.json.sample)
- [.env](docs/.env.sample)
