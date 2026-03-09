SELECT
    count(*) as amount
FROM
    lessons
WHERE
    attended = 0
    AND cancelled = 0