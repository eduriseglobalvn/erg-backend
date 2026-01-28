import { Opt, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid'; // Cách import chuẩn cho TS
export abstract class BaseEntity {
  @PrimaryKey()
  id: string = uuidv4();

  @Property()
  createdAt: Date & Opt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date & Opt = new Date();
}
