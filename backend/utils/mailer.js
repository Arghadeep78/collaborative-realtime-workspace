import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendBoardInviteEmail({ toEmail, fromEmail, boardTitle, boardId, role }) {
  const boardUrl = `${process.env.FRONTEND_URL}/board/${boardId}`;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  await transporter.sendMail({
    from: `"Collaborative Workspace" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${fromEmail} shared a board with you`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">You've been invited to a board</h2>
        <p style="margin:0 0 20px;color:#555;font-size:15px">
          <strong>${fromEmail}</strong> gave you <strong>${roleLabel}</strong> access to
          "<strong>${boardTitle}</strong>".
        </p>
        <a href="${boardUrl}"
           style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Open Board
        </a>
        <p style="margin:28px 0 0;color:#aaa;font-size:12px">
          If you weren't expecting this, you can ignore this email.
        </p>
      </div>
    `,
  });
}
