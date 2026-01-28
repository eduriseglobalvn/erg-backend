import { MikroORM } from '@mikro-orm/core';
import { User } from './src/modules/users/entities/user.entity';
import mikroOrmConfig from './mikro-orm.config';

async function checkAdmin() {
    const orm = await MikroORM.init(mikroOrmConfig as any);
    const em = orm.em.fork();
    const user = await em.findOne(User, { email: 'admin@erg.edu.vn' }, { populate: ['roles', 'roles.permissions'] });
    const oldUser = await em.findOne(User, { email: 'erg@admin' });

    if (user) {
        console.log('✅ New Admin found in DB:', user.email);
        console.log('Roles:', user.roles.getItems().map(r => r.name));
        console.log('Permissions count:', user.roles.getItems().reduce((acc, r) => acc + r.permissions.count(), 0));
    } else {
        console.log('❌ New Admin NOT found in DB');
    }

    if (oldUser) {
        console.log('⚠️ Old Admin still exists:', oldUser.email);
    }

    await orm.close();
}

checkAdmin();
