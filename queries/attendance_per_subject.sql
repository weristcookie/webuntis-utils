SELECT
    longname AS subject,
    SUM(CASE WHEN attended = 1 THEN 1 ELSE 0 END) AS attended,
    SUM(CASE WHEN attended = 0 THEN 1 ELSE 0 END) AS missed
FROM
    lessons
WHERE
    cancelled = 0
GROUP BY
    longname
