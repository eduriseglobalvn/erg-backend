import { Injectable } from '@nestjs/common';
import { DOMAIN_MAPPING } from '@/modules/sitemap/sitemap.constants';

@Injectable()
export class MenusService {

    getMenuStructure(domain: string) {
        // Normalize domain
        if (domain.startsWith('http')) {
            domain = new URL(domain).hostname;
        }

        // --- 1. Main Domain (erg.edu.vn) ---
        if (domain === 'erg.edu.vn' || domain === 'www.erg.edu.vn') {
            return {
                data: [
                    { name: 'Trang chủ', url: '/', type: 'link' },
                    {
                        name: 'Giới thiệu',
                        url: '/gioi-thieu',
                        type: 'dropdown',
                        children: [
                            { name: 'Tầm nhìn - Sứ mệnh', url: '/gioi-thieu/tam-nhin-su-menh' },
                            { name: 'Giá trị cốt lõi', url: '/gioi-thieu/gia-tri-cot-loi' },
                            { name: 'Câu chuyện ERG', url: '/gioi-thieu/cau-chuyen-cua-erg' },
                            { name: 'Đội ngũ lãnh đạo', url: '/gioi-thieu/doi-ngu-lanh-dao' }
                        ]
                    },
                    {
                        name: 'Lĩnh vực đào tạo',
                        url: '/linh-vuc-dao-tao',
                        type: 'dropdown',
                        children: [
                            { name: 'AI & Khoa học dữ liệu', url: 'https://ai.erg.edu.vn' },
                            { name: 'Tin học Quốc tế', url: 'https://tinhocquocte.erg.edu.vn' },
                            { name: 'Tin học Quốc gia', url: 'https://tinhocquocgia.erg.edu.vn' },
                            { name: 'Tin học Thiếu nhi', url: 'https://tinhocthieunhi.erg.edu.vn' },
                            { name: 'Công dân số', url: 'https://congdanso.erg.edu.vn' },
                            { name: 'Điện toán đám mây', url: 'https://dientoandammay.erg.edu.vn' }
                        ]
                    },
                    { name: 'Tin tức', url: '/tin-tuc', type: 'link' },
                    { name: 'Tuyển dụng', url: 'https://tuyendung.erg.edu.vn', type: 'link' },
                    { name: 'Liên hệ', url: '/lien-he', type: 'link' }
                ]
            };
        }

        // --- 2. AI Subdomain ---
        if (domain.includes('ai.erg.edu.vn')) {
            return {
                data: [
                    { name: 'Trang chủ', url: '/', type: 'link' },
                    {
                        name: 'Khóa học',
                        url: '/khoa-hoc',
                        type: 'dropdown',
                        children: [
                            { name: 'Lập trình Python', url: '/khoa-hoc/lap-trinh-python' },
                            { name: 'Machine Learning', url: '/khoa-hoc/machine-learning' },
                            { name: 'Deep Learning', url: '/khoa-hoc/deep-learning' }
                        ]
                    },
                    { name: 'Tin tức AI', url: '/tin-tuc', type: 'link' },
                    { name: 'Giảng viên', url: '/doi-ngu-giao-vien', type: 'link' },
                    { name: 'Về ERG', url: 'https://erg.edu.vn', type: 'link' }
                ]
            };
        }

        // --- 3. Tin Học Quốc Tế ---
        if (domain.includes('tinhocquocte.erg.edu.vn')) {
            return {
                data: [
                    { name: 'Trang chủ', url: '/', type: 'link' },
                    { name: 'Giới thiệu', url: '/gioi-thieu', type: 'link' },
                    {
                        name: 'Chứng chỉ',
                        url: '/khoa-hoc',
                        type: 'dropdown',
                        children: [
                            { name: 'MOS (Word, Excel, PP)', url: '/khoa-hoc/mos' },
                            { name: 'IC3 GS6', url: '/khoa-hoc/ic3-gs6' },
                            { name: 'IC3 Spark', url: '/khoa-hoc/ic3-spark-gs6' }
                        ]
                    },
                    { name: 'Lộ trình', url: '/lo-trinh', type: 'link' },
                    { name: 'Tin tức', url: '/tin-tuc', type: 'link' },
                    { name: 'Liên hệ', url: '/lien-he', type: 'link' }
                ]
            };
        }

        // Default fallback
        return {
            data: [
                { name: 'Trang chủ', url: '/', type: 'link' },
                { name: 'Về ERG', url: 'https://erg.edu.vn', type: 'link' }
            ]
        };
    }
}
