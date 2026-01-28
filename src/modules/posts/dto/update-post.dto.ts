import { PartialType } from '@nestjs/mapped-types'; // Hoặc @nestjs/swagger nếu dùng Swagger
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}
