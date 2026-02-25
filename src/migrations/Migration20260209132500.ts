import { Migration } from '@mikro-orm/migrations';

export class Migration20260209132500 extends Migration {

    async up(): Promise<void> {
        // Increase last_error_message column size from 512 to 2000 characters
        this.addSql('ALTER TABLE `api_keys` MODIFY `last_error_message` VARCHAR(2000) NULL;');
    }

    async down(): Promise<void> {
        // Rollback to original size
        this.addSql('ALTER TABLE `api_keys` MODIFY `last_error_message` VARCHAR(512) NULL;');
    }

}
