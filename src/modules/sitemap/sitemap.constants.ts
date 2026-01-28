export const STATIC_URLS = [
    // 1. Main Domain
    { loc: 'https://erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'Trang chủ' },
    { loc: 'https://erg.edu.vn/tin-tuc', changefreq: 'daily', priority: 0.9, title: 'Tin tức tổng hợp' },
    { loc: 'https://erg.edu.vn/lien-he', changefreq: 'monthly', priority: 0.5, title: 'Liên hệ' },
    { loc: 'https://erg.edu.vn/gioi-thieu/tam-nhin-su-menh', changefreq: 'monthly', priority: 0.6, title: 'Tầm nhìn - Sứ mệnh' },
    { loc: 'https://erg.edu.vn/gioi-thieu/gia-tri-cot-loi', changefreq: 'monthly', priority: 0.6, title: 'Giá trị cốt lõi' },
    { loc: 'https://erg.edu.vn/gioi-thieu/cau-chuyen-cua-erg', changefreq: 'monthly', priority: 0.6, title: 'Câu chuyện ERG' },
    { loc: 'https://erg.edu.vn/gioi-thieu/doi-ngu-lanh-dao', changefreq: 'monthly', priority: 0.6, title: 'Đội ngũ lãnh đạo' },
    { loc: 'https://erg.edu.vn/linh-vuc-dao-tao', changefreq: 'weekly', priority: 0.8, title: 'Lĩnh vực đào tạo' },
    { loc: 'https://erg.edu.vn/doi-tac', changefreq: 'monthly', priority: 0.7, title: 'Đối tác' },
    { loc: 'https://erg.edu.vn/co-hoi-nghe-nghiep', changefreq: 'monthly', priority: 0.7, title: 'Cơ hội nghề nghiệp' },

    // 2. Subdomain AI
    { loc: 'https://ai.erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'AI Trang chủ' },
    { loc: 'https://ai.erg.edu.vn/tin-tuc', changefreq: 'daily', priority: 0.9, title: 'AI Tin tức' },
    { loc: 'https://ai.erg.edu.vn/khoa-hoc', changefreq: 'weekly', priority: 0.9, title: 'AI Khóa học' },
    { loc: 'https://ai.erg.edu.vn/doi-ngu-giao-vien', changefreq: 'monthly', priority: 0.7, title: 'AI Giáo viên' },
    { loc: 'https://ai.erg.edu.vn/lien-he', changefreq: 'monthly', priority: 0.5, title: 'AI Liên hệ' },

    // 3. Subdomain Tin Học Quốc Tế
    { loc: 'https://tinhocquocte.erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'Tin học Quốc tế' },
    { loc: 'https://tinhocquocte.erg.edu.vn/gioi-thieu', changefreq: 'monthly', priority: 0.6, title: 'Giới thiệu THQT' },
    { loc: 'https://tinhocquocte.erg.edu.vn/lo-trinh', changefreq: 'monthly', priority: 0.8, title: 'Lộ trình THQT' },
    { loc: 'https://tinhocquocte.erg.edu.vn/khoa-hoc', changefreq: 'weekly', priority: 0.9, title: 'Khóa học THQT' },
    { loc: 'https://tinhocquocte.erg.edu.vn/khoa-hoc/mos', changefreq: 'weekly', priority: 0.9, title: 'MOS' },
    { loc: 'https://tinhocquocte.erg.edu.vn/khoa-hoc/ic3-gs6', changefreq: 'weekly', priority: 0.9, title: 'IC3 GS6' },
    { loc: 'https://tinhocquocte.erg.edu.vn/khoa-hoc/ic3-spark-gs6', changefreq: 'weekly', priority: 0.9, title: 'IC3 Spark' },
    { loc: 'https://tinhocquocte.erg.edu.vn/tin-tuc', changefreq: 'daily', priority: 0.8, title: 'Tin tức THQT' },
    { loc: 'https://tinhocquocte.erg.edu.vn/doi-ngu-giao-vien', changefreq: 'monthly', priority: 0.7, title: 'Giáo viên THQT' },
    { loc: 'https://tinhocquocte.erg.edu.vn/lien-he', changefreq: 'monthly', priority: 0.5, title: 'Liên hệ THQT' },

    // 4. Subdomain Tin Học Quốc Gia
    { loc: 'https://tinhocquocgia.erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'Tin học Quốc gia' },
    { loc: 'https://tinhocquocgia.erg.edu.vn/lo-trinh', changefreq: 'monthly', priority: 0.8, title: 'Lộ trình THQG' },
    { loc: 'https://tinhocquocgia.erg.edu.vn/khoa-hoc', changefreq: 'weekly', priority: 0.9, title: 'Khóa học THQG' },
    { loc: 'https://tinhocquocgia.erg.edu.vn/tin-tuc', changefreq: 'daily', priority: 0.8, title: 'Tin tức THQG' },
    { loc: 'https://tinhocquocgia.erg.edu.vn/doi-ngu-giao-vien', changefreq: 'monthly', priority: 0.7, title: 'Giáo viên THQG' },
    { loc: 'https://tinhocquocgia.erg.edu.vn/lien-he', changefreq: 'monthly', priority: 0.6, title: 'Liên hệ THQG' },

    // 5. Subdomain Tin Học Thiếu Nhi
    { loc: 'https://tinhocthieunhi.erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'Tin học Thiếu nhi' },
    { loc: 'https://tinhocthieunhi.erg.edu.vn/khoa-hoc', changefreq: 'weekly', priority: 0.9, title: 'Khóa học Thiếu nhi' },
    { loc: 'https://tinhocthieunhi.erg.edu.vn/khoa-hoc/lap-trinh-scratch', changefreq: 'weekly', priority: 0.9, title: 'Scratch' },
    { loc: 'https://tinhocthieunhi.erg.edu.vn/khoa-hoc/lap-trinh-python-thieu-nhi', changefreq: 'weekly', priority: 0.9, title: 'Python Thiếu nhi' },
    { loc: 'https://tinhocthieunhi.erg.edu.vn/tin-tuc', changefreq: 'daily', priority: 0.8, title: 'Tin tức Thiếu nhi' },
    { loc: 'https://tinhocthieunhi.erg.edu.vn/doi-ngu-giao-vien', changefreq: 'monthly', priority: 0.7, title: 'Giáo viên Thiếu nhi' },
    { loc: 'https://tinhocthieunhi.erg.edu.vn/lien-he', changefreq: 'monthly', priority: 0.6, title: 'Liên hệ Thiếu nhi' },

    // 6. Subdomain Công Dân Số
    { loc: 'https://congdanso.erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'Công dân số' },
    { loc: 'https://congdanso.erg.edu.vn/lo-trinh', changefreq: 'monthly', priority: 0.8, title: 'Lộ trình CDS' },
    { loc: 'https://congdanso.erg.edu.vn/tin-tuc', changefreq: 'daily', priority: 0.8, title: 'Tin tức CDS' },
    { loc: 'https://congdanso.erg.edu.vn/lien-he', changefreq: 'monthly', priority: 0.6, title: 'Liên hệ CDS' },

    // 7. Subdomain Điện Toán Đám Mây
    { loc: 'https://dientoandammay.erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'Điện toán đám mây' },

    // 8. Subdomain Tuyển Dụng
    { loc: 'https://tuyendung.erg.edu.vn/', changefreq: 'daily', priority: 1.0, title: 'Tuyển dụng' },
    { loc: 'https://tuyendung.erg.edu.vn/tuyen-dung', changefreq: 'daily', priority: 0.9, title: 'Việc làm' },
    { loc: 'https://tuyendung.erg.edu.vn/chinh-sach', changefreq: 'monthly', priority: 0.7, title: 'Chính sách' },
    { loc: 'https://tuyendung.erg.edu.vn/van-hoa', changefreq: 'monthly', priority: 0.7, title: 'Văn hóa' },
    { loc: 'https://tuyendung.erg.edu.vn/lien-he', changefreq: 'monthly', priority: 0.6, title: 'Liên hệ Tuyển dụng' },
];

export const DOMAIN_MAPPING = {
    MAIN: 'https://erg.edu.vn',
    AI: 'https://ai.erg.edu.vn',
    TIN_HOC_QUOC_TE: 'https://tinhocquocte.erg.edu.vn',
    TIN_HOC_QUOC_GIA: 'https://tinhocquocgia.erg.edu.vn',
    TIN_HOC_THIEU_NHI: 'https://tinhocthieunhi.erg.edu.vn',
    CONG_DAN_SO: 'https://congdanso.erg.edu.vn',
    DIEN_TOAN_DAM_MAY: 'https://dientoandammay.erg.edu.vn',
    TUYEN_DUNG: 'https://tuyendung.erg.edu.vn',
};
