SELECT 
    SUM(CASE WHEN attended = 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) * 100 AS quota
FROM 
    lessons
WHERE 
    cancelled = 0
