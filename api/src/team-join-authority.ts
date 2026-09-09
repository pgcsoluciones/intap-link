import app from './index'

/**
 * Authority guard for the retired self-join endpoint.
 *
 * Team devices are prepared only by the Team Master through
 * /me/team/corporate/assign. Keeping this guard registered before team-v2
 * prevents an old client/bookmark from converting an independent Free profile
 * into a Team member or consuming a physical product through the obsolete path.
 */
app.post('/api/v1/me/team/join', async (c: any) => {
  return c.json({
    ok: false,
    error: 'Este flujo de vinculación fue reemplazado. Los dispositivos Team deben ser preparados por el Administrador Master.',
    code: 'TEAM_MASTER_PREPARATION_REQUIRED',
  }, 409)
})

export default app
