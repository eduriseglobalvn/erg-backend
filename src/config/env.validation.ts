import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync, IsOptional } from 'class-validator';

enum Environment {
    Development = 'development',
    Production = 'production',
    Test = 'test',
    Provision = 'provision',
}

class EnvironmentVariables {
    @IsEnum(Environment)
    @IsOptional()
    NODE_ENV: Environment;

    @IsNumber()
    @IsOptional()
    PORT: number;

    @IsString()
    JWT_ACCESS_SECRET: string;

    @IsString()
    JWT_REFRESH_SECRET: string;

    @IsString()
    @IsOptional()
    REDIS_HOST: string;

    @IsString()
    MONGO_URL: string;

    @IsString()
    DB_HOST: string;

    @IsNumber()
    DB_PORT: number;

    @IsString()
    DB_USER: string;

    @IsString()
    DB_PASS: string;

    @IsString()
    DB_NAME: string;
}

export function validate(config: Record<string, unknown>) {
    const validatedConfig = plainToInstance(
        EnvironmentVariables,
        config,
        { enableImplicitConversion: true },
    );

    const errors = validateSync(validatedConfig, { skipMissingProperties: false });

    if (errors.length > 0) {
        throw new Error(`Environment validation failed: ${errors.toString()}`);
    }
    return validatedConfig;
}
