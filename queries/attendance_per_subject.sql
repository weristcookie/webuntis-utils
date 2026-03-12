SELECT
    subject,
    SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) AS attended,
    SUM(CASE WHEN status IN ('missed','excused') THEN 1 ELSE 0 END) AS missed
FROM
    lessons
WHERE
    status != 'cancelled'
GROUP BY
    subject;