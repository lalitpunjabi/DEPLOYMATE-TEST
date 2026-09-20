import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525', 10);
const SMTP_USER = process.env.SMTP_USER || 'mock-user';
const SMTP_PASS = process.env.SMTP_PASS || 'mock-pass';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@deploymate.local';

class NotificationService {
  private transporter: any = null;

  constructor() {
    try {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
      // Test transporter connection in background
      this.transporter.verify((err: any) => {
        if (err) {
          console.warn('NotificationService: SMTP transporter verification failed. Mail alerts will run in simulation log mode.', err.message);
        } else {
          console.log('NotificationService: SMTP connection verified successfully.');
        }
      });
    } catch (err: any) {
      console.warn('NotificationService: Failed to instantiate SMTP transporter.', err.message);
    }
  }

  public async sendEmail(to: string, subject: string, bodyHtml: string): Promise<boolean> {
    if (!this.transporter) {
      console.log(`[MAIL SIMULATOR] Sending mail to: ${to} | Subject: ${subject}\nHTML Content:\n${bodyHtml}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"DEPLOYMATE" <${FROM_EMAIL}>`,
        to,
        subject,
        html: bodyHtml,
      });
      console.log(`NotificationService: Email alert sent successfully to ${to}`);
      return true;
    } catch (err: any) {
      console.error(`NotificationService: Failed to send email to ${to}:`, err.message);
      // Fallback log trace
      console.log(`[MAIL FALLBACK] To: ${to} | Subject: ${subject}`);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
