SELECT 
    SUM(CASE WHEN status IN ('missed','excused') THEN 1 ELSE 0 END) * 1.0 / COUNT(*) * 100 AS quota
FROM 
    lessons
WHERE 
    status != 'cancelled';