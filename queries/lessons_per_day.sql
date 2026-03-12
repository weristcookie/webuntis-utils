SELECT
    date,
    SUM(CASE WHEN status IN ('missed','excused') THEN 1 ELSE 0 END) AS missed,
    SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) AS attended
FROM
    lessons
WHERE
    status != 'cancelled'
GROUP BY
    date
ORDER BY
    date ASC;