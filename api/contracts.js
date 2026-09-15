import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // 1. CORS 보안 헤더 설정
    const allowedOrigin = 'https://contract.adplanters.com';
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
    }

    try {
        const { contractPages, customerEmail, agreed, signatureImage, signedPage2Image, submittedAt } = req.body;

        if (!customerEmail || !signatureImage) {
            return res.status(400).json({ message: '필수 데이터가 누락되었습니다.' });
        }

        // 2. 메일 전송 객체 구성
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // 3. 첨부파일 목록 (투명 PNG 서명 원본 + 합성 완료된 2페이지 파일)
        const attachments = [
            {
                filename: 'customer_signature.png',
                content: signatureImage.split('base64,')[1],
                encoding: 'base64',
                contentType: 'image/png'
            }
        ];

        let signedPage2Html = '';
        if (signedPage2Image) {
            attachments.push({
                filename: 'signed_contract_page2.jpg',
                content: signedPage2Image.split('base64,')[1],
                encoding: 'base64',
                contentType: 'image/jpeg',
                cid: 'signedPage2Img'
            });

            signedPage2Html = `
                <div style="margin-top: 25px; text-align: center;">
                    <h3 style="font-size: 15px; color: #1e3a8a; margin-bottom: 10px; text-align: left;">서명 완료된 계약서 2페이지</h3>
                    <img src="cid:signedPage2Img" alt="서명 완료된 계약서 2페이지" style="max-width: 100%; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" />
                </div>
            `;
        }

        // 4. 이메일 템플릿 구성
        const mailOptions = {
            from: `"애드플랜터스" <${process.env.SMTP_USER}>`,
            to: customerEmail,
            bcc: process.env.SMTP_USER,
            subject: '[애드플랜터스] 전자계약서 서명이 완료되었습니다.',
            html: `
                <div style="font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
                    <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-top: 0;">전자계약서 서명 완료 안내</h2>
                    <p style="font-size: 15px; color: #374151; line-height: 1.6;">안녕하세요. 애드플랜터스 온라인 마케팅 파트너 계약이 성공적으로 체결되었습니다.</p>
                    
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>체결 일시:</strong> ${new Date(submittedAt).toLocaleString('ko-KR')}</p>
                        <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>법적 효력 안내 동의:</strong> ${agreed ? '동의 완료' : '미동의'}</p>
                        <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>수신 이메일:</strong> ${customerEmail}</p>
                    </div>

                    ${signedPage2Html}
                    
                    <div style="margin-top: 25px;">
                        <p style="font-size: 14px; color: #374151; font-weight: bold;">계약서 원본 이미지 링크:</p>
                        <ul style="padding-left: 20px; margin-top: 5px;">
                            ${contractPages.map((url, idx) => `<li style="margin-bottom: 6px;"><a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline;">계약서 ${idx + 1}페이지 원본 보기</a></li>`).join('')}
                        </ul>
                    </div>
                    
                    <p style="font-size: 13px; color: #6b7280; margin-top: 25px;">※ 본 메일에 고객님의 서명이 날인된 계약서 이미지와 서명 원본 파일이 첨부되어 있습니다.</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center;">© ADplanters. All rights reserved.</p>
                </div>
            `,
            attachments: attachments
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: '이메일 발송 완료' });

    } catch (error) {
        console.error('Vercel Backend Mailer Error:', error);
        return res.status(500).json({ success: false, message: '서버 에러 발생', error: error.message });
    }
}