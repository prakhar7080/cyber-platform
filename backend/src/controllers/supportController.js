// controllers/supportController.js
import { sendContactEmail } from '../utils/emailService.js';

// Submit contact form
export const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      });
    }

    // Send contact email
    const emailResult = await sendContactEmail({
      name,
      email,
      subject,
      message,
    });

    res.json({
      success: true,
      message: emailResult?.mocked
        ? 'Thank you for your message! We\'ll get back to you soon. (Email service is in mock mode)'
        : 'Thank you for your message! We\'ll get back to you soon.',
      emailDelivery: emailResult?.mocked ? 'mock' : 'sent',
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form. Please try again later.',
    });
  }
};



