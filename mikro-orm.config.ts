// mikro-orm.config.ts (tại thư mục gốc)
import mysqlConfig from '@/config/mikro-orm-mysql.config';

/**
 * File này chủ yếu phục vụ cho MikroORM CLI
 * Lệnh: yarn mikro-orm migration:create, vv.
 */
export default mysqlConfig;
