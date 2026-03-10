import { Resend } from 'resend'

export async function sendLeadNotificationEmail(
  env: { RESEND_API_KEY: string; RESEND_FROM?: string },
  to: string,
  lead: { name: string; email: string; phone?: string; message: string; origin?: string },
): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY)
  const from   = env.RESEND_FROM || 'onboarding@resend.dev'

  await resend.emails.send({
    from,
    to,
    subject: `Nuevo contacto: ${lead.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="color: #111;">Nuevo contacto en INTAP Link</h2>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <tr><td style="padding:8px 0; color:#666; width:110px;">Nombre</td><td style="padding:8px 0; font-weight:bold;">${lead.name}</td></tr>
          <tr><td style="padding:8px 0; color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
          ${lead.phone ? `<tr><td style="padding:8px 0; color:#666;">Teléfono</td><td style="padding:8px 0;">${lead.phone}</td></tr>` : ''}
          <tr><td style="padding:8px 0; color:#666; vertical-align:top;">Mensaje</td><td style="padding:8px 0;">${lead.message}</td></tr>
          ${lead.origin ? `<tr><td style="padding:8px 0; color:#666;">Origen</td><td style="padding:8px 0; font-size:12px; color:#888;">${lead.origin}</td></tr>` : ''}
        </table>
        <p style="color:#aaa; font-size:11px; margin-top:24px;">Gestiona tus contactos en <a href="https://app.intaprd.com">app.intaprd.com</a></p>
      </div>
    `,
  })
}

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
