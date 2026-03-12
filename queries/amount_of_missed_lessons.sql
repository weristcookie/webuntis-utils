SELECT
    COUNT(*) AS amount
FROM
    lessons
WHERE
    status = "missed"
    OR status = "excused"