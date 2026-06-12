import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendProjectInviteEmail({ toEmail, fromEmail, projectTitle, projectId, role }) {
  // Client-facing invite URL targets the frontend route (still /board/:id).
  const projectUrl = `${process.env.FRONTEND_URL}/board/${projectId}`;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  await transporter.sendMail({
    from: `"Collaborative Workspace" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${fromEmail} shared a project with you`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">You've been invited to a project</h2>
        <p style="margin:0 0 20px;color:#555;font-size:15px">
          <strong>${fromEmail}</strong> gave you <strong>${roleLabel}</strong> access to
          "<strong>${projectTitle}</strong>".
        </p>
        <a href="${projectUrl}"
           style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Open Project
        </a>
        <p style="margin:28px 0 0;color:#aaa;font-size:12px">
          If you weren't expecting this, you can ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({ toEmail, resetUrl }) {
  await transporter.sendMail({
    from: `"Collaborative Workspace" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your password",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Reset your password</h2>
        <p style="margin:0 0 20px;color:#555;font-size:15px">
          We received a request to reset your password. Click the button below to
          choose a new one. This link expires in <strong>15 minutes</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Reset Password
        </a>
        <p style="margin:28px 0 0;color:#aaa;font-size:12px">
          If you didn't request this, you can safely ignore this email — your
          password won't change.
        </p>
      </div>
    `,
  });
}
