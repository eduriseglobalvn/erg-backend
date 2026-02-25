-- Increase last_error_message column size
ALTER TABLE `api_keys` MODIFY `last_error_message` TEXT NULL;
