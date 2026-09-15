import nodemailer from 'nodemailer';

export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      const port = Number(process.env.SMTP_PORT ?? '1025');
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
  }

  async sendVerificationCode(
    email: string,
    code: string,
    type: 'register' | 'reset_password',
  ): Promise<void> {
    const subject = type === 'register' ? '注册验证码' : '重置密码验证码';
    const text = `您的验证码是：${code}，10分钟内有效。`;

    if (!this.transporter) {
      console.log(`[MailService] 验证码邮件 → ${email}: ${code} (${type})`);
      return;
    }

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? '15280256971@163.com',
      to: email,
      subject,
      text,
    });
  }
}
