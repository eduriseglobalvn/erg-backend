import { PrimaryKey, SerializedPrimaryKey, Property } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

export abstract class MongoBaseEntity {
  // 1. Dùng ObjectId làm khóa chính thực sự trong DB
  @PrimaryKey()
  _id!: ObjectId;

  // 2. SerializedPrimaryKey giúp biến _id thành chuỗi "id" khi trả về JSON (FE dễ dùng)
  @SerializedPrimaryKey()
  id!: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
