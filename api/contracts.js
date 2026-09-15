import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // 1. CORS 보안 헤더 설정 (contract.adplanters.com 프론트엔드 출처만 허용)
    const allowedOrigin = 'https://contract.adplanters.com';
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 브라우저의 사전 탐색 요청(Preflight/OPTIONS) 200 OK 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POST 이외의 요청 메서드 차단
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '허용되지 않은 메서드입니다. POST 방식을 사용하세요.' });
    }

    try {
        // 2. 프론트엔드 페이로드 데이터 추출
        const { contractPages, customerEmail, agreed, signatureImage, submittedAt } = req.body;

        if (!customerEmail || !signatureImage) {
            return res.status(400).json({ message: '필수 데이터(이메일 주소 또는 서명 이미지)가 누락되었습니다.' });
        }

        // 3. Nodemailer 전송 객체 생성 (Vercel 환경 변수 바인딩)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // 4. 발송 이메일 템플릿 및 첨부 서명 파일 구성
        const mailOptions = {
            from: `"애드플랜터스" <${process.env.SMTP_USER}>`,
            to: customerEmail,
            bcc: process.env.SMTP_USER, // 본사 메일 계정으로 사본 자동 발송
            subject: '[애드플랜터스] 전자계약서 서명이 완료되었습니다.',
            html: `
                <div style="font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">전자계약서 서명 완료 안내</h2>
                    <p style="font-size: 15px; color: #374151; line-height: 1.6;">안녕하세요. 애드플랜터스 온라인 마케팅 파트너 계약이 성공적으로 체결되었습니다.</p>
                    
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>체결 일시:</strong> ${new Date(submittedAt).toLocaleString('ko-KR')}</p>
                        <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>법적 효력 안내 동의:</strong> ${agreed ? '동의 완료' : '미동의'}</p>
                        <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>수신 이메일:</strong> ${customerEmail}</p>
                    </div>
                    
                    <p style="font-size: 14px; color: #374151;">아래 링크를 통해 서명하신 계약서 원본 이미지를 확인하실 수 있습니다.</p>
                    <ul style="padding-left: 20px;">
                        ${contractPages.map((url, idx) => `<li style="margin-bottom: 8px;"><a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline;">계약서 ${idx + 1}페이지 원본 보기</a></li>`).join('')}
                    </ul>
                    
                    <p style="font-size: 13px; color: #6b7280; margin-top: 25px;">※ 본 메일에 고객님의 서명이 파일로 첨부되어 있습니다.</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center;">© ADplanters. All rights reserved.</p>
                </div>
            `,
            attachments: [
                {
                    filename: 'customer_signature.png',
                    content: signatureImage.split('base64,')[1],
                    encoding: 'base64'
                }
            ]
        };

        // 5. 이메일 실제 발송 수행
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: '계약 완료 및 사본 이메일 발송이 완료되었습니다.' });

    } catch (error) {
        console.error('Vercel Backend Mailer Error:', error);
        return res.status(500).json({ success: false, message: '서버 내부 처리 중 오류가 발생했습니다.', error: error.message });
    }
}