-- Create Procedure to Add Columns Safely
DELIMITER //

CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(255),
    IN columnName VARCHAR(255),
    IN columnDef VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = tableName
          AND COLUMN_NAME = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDef);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

-- Execute Calls
CALL AddColumnIfNotExists('posts', 'readability_score', 'INT DEFAULT 0');
CALL AddColumnIfNotExists('posts', 'keyword_density', 'DECIMAL(5,4) DEFAULT 0');
CALL AddColumnIfNotExists('posts', 'schema_data', 'JSON NULL');
CALL AddColumnIfNotExists('posts', 'enabled_schema_types', 'JSON NULL');
CALL AddColumnIfNotExists('posts', 'robots_index', 'BOOLEAN DEFAULT TRUE');
CALL AddColumnIfNotExists('posts', 'robots_follow', 'BOOLEAN DEFAULT TRUE');
CALL AddColumnIfNotExists('posts', 'robots_advanced', 'VARCHAR(200) NULL');
CALL AddColumnIfNotExists('posts', 'breadcrumb_title', 'VARCHAR(255) NULL');
CALL AddColumnIfNotExists('posts', 'faq_items', 'JSON NULL');
CALL AddColumnIfNotExists('posts', 'how_to_steps', 'JSON NULL');
CALL AddColumnIfNotExists('posts', 'schema_type', "ENUM('Article', 'NewsArticle', 'BlogPosting') NULL");
CALL AddColumnIfNotExists('posts', 'seo_score', 'INT DEFAULT 0');

-- Drop Procedure
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
