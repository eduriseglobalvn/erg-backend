-- Check for specific API key
SELECT * FROM api_keys WHERE `key` = 'AIzaSyCpEb1Ck9Fa6_NEC5XifjsYPHTNAQlfFUM';

-- List all API keys with their status
SELECT 
    SUBSTRING(`key`, 1, 30) as key_preview,
    `status`,
    `type`,
    `label`,
    `owner_id`,
    `today_usage`,
    `max_daily_quota`,
    `cooldown_until`,
    `created_at`
FROM api_keys
ORDER BY created_at DESC;
