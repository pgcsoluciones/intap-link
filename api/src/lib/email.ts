import { Resend } from 'resend'

export async function sendMagicLinkEmail(
  env: { RESEND_API_KEY: string },
  to: string,
  link: string,
): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY)

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    subject: 'Tu enlace de acceso a INTAP Link',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">Accede a INTAP Link</h2>
        <p style="color: #444;">Haz clic en el botón para ingresar a tu cuenta. El enlace expira en <strong>10 minutos</strong> y solo puede usarse una vez.</p>
        <a href="${link}"
           style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;">
          Ingresar a mi cuenta
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          Si no solicitaste este acceso, ignora este correo.<br>
          Enlace: <a href="${link}" style="color:#888;">${link}</a>
        </p>
      </div>
    `,
  })
}
