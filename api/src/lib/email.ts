import { Resend } from 'resend'

export async function sendMagicLinkEmail(
  env: { RESEND_API_KEY: string; RESEND_FROM?: string },
  to: string,
  link: string,
): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY)
  // RESEND_FROM debe apuntar a un dominio verificado en Resend (ej: noreply@intaprd.com).
  // Mientras el dominio no esté verificado, usar 'onboarding@resend.dev' solo entrega
  // al email del propietario de la cuenta de Resend (restricción del plan free).
  const from = env.RESEND_FROM || 'onboarding@resend.dev'

  await resend.emails.send({
    from,
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
