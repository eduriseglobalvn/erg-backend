import { Entity, Property, OneToMany, Collection } from '@mikro-orm/core';
import { BaseEntity } from '@/core/base/base.entity';
import { Post } from './post.entity';

@Entity({ tableName: 'post_categories' })
export class PostCategory extends BaseEntity {
  @Property()
  name!: string; // VD: Tin tức, Hoạt động, Tips

  @Property({ unique: true })
  slug!: string;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  icon?: string; // LuciaReact icon name (e.g. GraduationCap)

  // --- SEO METADATA ---
  @Property({ nullable: true })
  metaTitle?: string;

  @Property({ type: 'text', nullable: true })
  metaDescription?: string;

  @Property({ nullable: true })
  keywords?: string;

  @OneToMany(() => Post, (post) => post.category)
  posts = new Collection<Post>(this);
}