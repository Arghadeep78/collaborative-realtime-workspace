import nodemailer from "nodemailer";
import validator from "validator";
import dotenv from "dotenv";

dotenv.config();

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendInstantEmail(sendTo, subject, content, isHtml = false) {
  try {
    if (!sendTo || !subject || !content) {
      throw new Error("All parameters (sendTo, subject, content) are required");
    }

    // Validate email format
    if (
      !validator.isEmail(sendTo, {
        require_tld: true,
        allow_utf8_local_part: false,
      })
    ) {
      throw new Error("Please provide a valid email address");
    }

    let mailOptions = {
      from: `"CollabBoard" <${process.env.EMAIL_USER}>`,
      to: sendTo,
      subject: subject,
    };

    if (isHtml) {
      mailOptions.html = content;
      mailOptions.text = content.replace(/<[^>]*>/g, ""); // Strip HTML for text version
    } else {
      mailOptions.text = content;
    }

    // Send email
    let info = await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully to ${sendTo}: ${info.response}`);

    return {
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error("Error sending email:", error);

    return {
      success: false,
      message: "Failed to send email",
      error: error.message,
    };
  }
}

// Send plain text email
async function sendPlainTextEmail(sendTo, subject, content) {
  return await sendInstantEmail(sendTo, subject, content, false);
}

// Send HTML email
async function sendHtmlEmail(sendTo, subject, htmlContent) {
  return await sendInstantEmail(sendTo, subject, htmlContent, true);
}

// Export the functions
export { sendInstantEmail, sendPlainTextEmail, sendHtmlEmail };
