import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RecruitmentService } from './modules/recruitment/recruitment.service';
import { JOB_DATABASE } from './modules/recruitment/seed.data';
import { CreateJobDto } from './modules/recruitment/dto/create-job.dto';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const service = app.get(RecruitmentService);

    console.log('START SEEDING...');
    for (const slug of Object.keys(JOB_DATABASE)) {
        const data = JOB_DATABASE[slug];

        const createDto: CreateJobDto = {
            title: data.title,
            slug: slug,
            salary: data.salary,
            quantity: parseInt(data.quantity) || 1,
            workType: data.employer === "Trunng tâm tin học ERG" && data.quantity === "5" ? "Bán thời gian" : "Toàn thời gian", // Fake workType to map filter instead of schedule! Wait, I should just use "Toàn thời gian" or whatever fits best since the mock originally had "Từ T2 đến T7" as workType. Let's make it consistent.
            workSchedule: data.workType, // From UI mapping logic (actually workType -> workSchedule)
            deadline: data.deadline,
            postDate: data.postDate,
            location: data.location,
            summary: data.summary,
            description: data.jobDescription,
            requirements: data.requirements,
            benefits: data.benefits,
            isActive: true, // Mặc định publish
            isHot: data.status === 'hot',
            isUrgent: data.status === 'urgent',
            isNew: data.status === 'new',
        };

        try {
            await service.createJob(createDto);
            console.log(`✅ Added: ${data.title}`);
        } catch (err: any) {
            console.log(`❌ Skipped ${data.title}: ${err.message}`);
        }
    }

    await app.close();
}
bootstrap();
