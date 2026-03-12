SELECT
    COUNT(*) AS amount
FROM
    lessons
WHERE
    status IN ('missed', 'excused');