// utils/emailService.js
// Email service for sending OTP and password reset emails

// Check if email service is enabled
const isEmailEnabled = () => {
  return process.env.EMAIL_ENABLED === 'true' || 
         process.env.SENDGRID_API_KEY || 
         process.env.SMTP_HOST;
};

// Mock email sending (for development)
const mockSendEmail = (to, subject, html, otp = null) => {
  console.log('='.repeat(60));
  console.log('📧 EMAIL (MOCK MODE)');
  console.log('='.repeat(60));
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  if (otp) {
    console.log(`OTP Code: ${otp}`);
  }
  console.log('='.repeat(60));
  console.log('HTML Content:');
  console.log(html);
  console.log('='.repeat(60));
  
  const result = {
    mocked: true,
    reason: 'EMAIL_ENABLED is false or no email service configured'
  };
  
  if (otp) {
    result.otp = otp; // Include OTP in mock mode for development
  }
  
  return result;
};

// Send OTP email for email verification
export const sendOTP = async (email, otp) => {
  try {
    if (!isEmailEnabled()) {
      return mockSendEmail(
        email,
        'Verify Your Email - CyberAware',
        generateOTPEmailHTML(otp),
        otp
      );
    }

    // Try SendGrid first if API key is available
    if (process.env.SENDGRID_API_KEY) {
      return await sendViaSendGrid(email, 'Verify Your Email - CyberAware', generateOTPEmailHTML(otp), otp);
    }

    // Try SMTP if configured
    if (process.env.SMTP_HOST) {
      return await sendViaSMTP(email, 'Verify Your Email - CyberAware', generateOTPEmailHTML(otp), otp);
    }

    // Fallback to mock
    return mockSendEmail(email, 'Verify Your Email - CyberAware', generateOTPEmailHTML(otp), otp);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    // Return mock result on error to prevent breaking the flow
    return mockSendEmail(email, 'Verify Your Email - CyberAware', generateOTPEmailHTML(otp), otp);
  }
};

// Send password reset OTP email
export const sendPasswordResetOTP = async (email, otp) => {
  try {
    if (!isEmailEnabled()) {
      return mockSendEmail(
        email,
        'Password Reset - CyberAware',
        generatePasswordResetEmailHTML(otp),
        otp
      );
    }

    // Try SendGrid first if API key is available
    if (process.env.SENDGRID_API_KEY) {
      return await sendViaSendGrid(email, 'Password Reset - CyberAware', generatePasswordResetEmailHTML(otp), otp);
    }

    // Try SMTP if configured
    if (process.env.SMTP_HOST) {
      return await sendViaSMTP(email, 'Password Reset - CyberAware', generatePasswordResetEmailHTML(otp), otp);
    }

    // Fallback to mock
    return mockSendEmail(email, 'Password Reset - CyberAware', generatePasswordResetEmailHTML(otp), otp);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // Return mock result on error
    return mockSendEmail(email, 'Password Reset - CyberAware', generatePasswordResetEmailHTML(otp), otp);
  }
};

// Send contact form email
export const sendContactEmail = async ({ name, email, subject, message }) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'support@cyberaware.com';
    const html = generateContactEmailHTML({ name, email, subject, message });

    if (!isEmailEnabled()) {
      console.log('='.repeat(60));
      console.log('📧 CONTACT FORM (MOCK MODE)');
      console.log('='.repeat(60));
      console.log(`From: ${name} <${email}>`);
      console.log(`To: ${adminEmail}`);
      console.log(`Subject: ${subject}`);
      console.log(`Message: ${message}`);
      console.log('='.repeat(60));
      
      return {
        mocked: true,
        reason: 'EMAIL_ENABLED is false or no email service configured'
      };
    }

    // Try SendGrid first if API key is available
    if (process.env.SENDGRID_API_KEY) {
      return await sendViaSendGrid(adminEmail, `Contact Form: ${subject}`, html);
    }

    // Try SMTP if configured
    if (process.env.SMTP_HOST) {
      return await sendViaSMTP(adminEmail, `Contact Form: ${subject}`, html);
    }

    // Fallback to mock
    return {
      mocked: true,
      reason: 'No email service configured'
    };
  } catch (error) {
    console.error('Error sending contact email:', error);
    return {
      mocked: true,
      reason: 'Email service error'
    };
  }
};

// Send via SendGrid
const sendViaSendGrid = async (to, subject, html, otp = null) => {
  try {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@cyberaware.com',
      subject,
      html,
    };

    await sgMail.default.send(msg);
    return { mocked: false };
  } catch (error) {
    console.error('SendGrid error:', error);
    // Fallback to mock on SendGrid error
    return mockSendEmail(to, subject, html, otp);
  }
};

// Send via SMTP (using nodemailer)
const sendViaSMTP = async (to, subject, html, otp = null) => {
  try {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@cyberaware.com',
      to,
      subject,
      html,
    });

    return { mocked: false };
  } catch (error) {
    console.error('SMTP error:', error);
    // Fallback to mock on SMTP error
    return mockSendEmail(to, subject, html, otp);
  }
};

// Generate OTP email HTML template
const generateOTPEmailHTML = (otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🛡️ CyberAware</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; margin-top: 0;">Verify Your Email Address</h2>
        <p style="color: #4b5563;">Thank you for signing up! Please use the following code to verify your email address:</p>
        <div style="background: white; border: 2px solid #06b6d4; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
          <div style="font-size: 32px; font-weight: bold; color: #06b6d4; letter-spacing: 8px;">${otp}</div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">If you didn't create an account, please ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        <p>© ${new Date().getFullYear()} CyberAware. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

// Generate password reset email HTML template
const generatePasswordResetEmailHTML = (otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🛡️ CyberAware</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #4b5563;">You requested to reset your password. Use the following code to complete the process:</p>
        <div style="background: white; border: 2px solid #06b6d4; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
          <div style="font-size: 32px; font-weight: bold; color: #06b6d4; letter-spacing: 8px;">${otp}</div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #ef4444; font-size: 14px; margin-top: 30px;">If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        <p>© ${new Date().getFullYear()} CyberAware. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

// Generate contact form email HTML template
const generateContactEmailHTML = ({ name, email, subject, message }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contact Form Submission</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🛡️ CyberAware Contact Form</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; margin-top: 0;">New Contact Form Submission</h2>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p style="margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 10px 0;"><strong>Message:</strong></p>
            <p style="color: #4b5563; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          <a href="mailto:${email}" style="color: #06b6d4; text-decoration: none;">Reply to ${name}</a>
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        <p>© ${new Date().getFullYear()} CyberAware. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

