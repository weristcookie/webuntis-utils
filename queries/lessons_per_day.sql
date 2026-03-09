SELECT
    date,
    SUM(CASE WHEN attended = 0 THEN 1 ELSE 0 END) AS missed,
    SUM(CASE WHEN attended = 1 THEN 1 ELSE 0 END) AS attended
FROM
    lessons
WHERE
    cancelled = 0
GROUP BY
    date
ORDER BY
    date ASC