#!/usr/bin/env python3
from pathlib import Path

p = Path('api/src/account-access-methods.ts')
s = p.read_text(encoding='utf-8')

old = """async function createChallenge(c: any, userId: string, email: string, purpose: string) {\n  const recent = await c.env.DB.prepare(`SELECT COUNT(*) n FROM account_verification_challenges WHERE user_id=? AND purpose=? AND created_at>datetime('now','-10 minutes')`).bind(userId, purpose).first()\n  if (Number((recent as any)?.n || 0) >= 5) return { ok: false, error: 'Demasiados intentos. Espera unos minutos.' }\n  const id = crypto.randomUUID(), code = code6(), codeHash = await sha256Hex(`${id}:${code}`)\n  await c.env.DB.prepare(`INSERT INTO account_verification_challenges(id,user_id,email,purpose,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,datetime('now','+10 minutes'),datetime('now'))`).bind(id,userId,email,purpose,codeHash).run()\n  await sendVerificationCode(c,email,code,purpose)\n  return { ok: true }\n}\n"""
new = """async function createChallenge(c: any, userId: string, email: string, purpose: string) {\n  const recent = await c.env.DB.prepare(`SELECT COUNT(*) n FROM account_verification_challenges WHERE user_id=? AND purpose=? AND created_at>datetime('now','-10 minutes')`).bind(userId, purpose).first()\n  if (Number((recent as any)?.n || 0) >= 5) return { ok: false, status: 429, error: 'Demasiados intentos. Espera unos minutos.' }\n  const id = crypto.randomUUID(), code = code6(), codeHash = await sha256Hex(`${id}:${code}`)\n  await c.env.DB.prepare(`INSERT INTO account_verification_challenges(id,user_id,email,purpose,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,datetime('now','+10 minutes'),datetime('now'))`).bind(id,userId,email,purpose,codeHash).run()\n  try {\n    await sendVerificationCode(c,email,code,purpose)\n  } catch (error: any) {\n    console.error('[account-credentials] verification email failed', { purpose, email, message: error?.message || String(error) })\n    await c.env.DB.prepare(`DELETE FROM account_verification_challenges WHERE id=?`).bind(id).run().catch(() => undefined)\n    const missingProvider = !c.env.RESEND_API_KEY\n    return {\n      ok: false,\n      status: 503,\n      error: missingProvider\n        ? 'El servicio de verificación por correo no está configurado en este entorno.'\n        : 'No pudimos enviar el código de verificación. Intenta nuevamente.',\n    }\n  }\n  return { ok: true, status: 200 }\n}\n"""
if old not in s:
    raise SystemExit('ERROR: no encontré createChallenge esperado')
s = s.replace(old, new, 1)

old2 = """  const result = await createChallenge(c,c.get('accountUserId'),c.get('accountEmail'),purpose)\n  return result.ok ? c.json({ok:true}) : c.json(result,429)\n"""
new2 = """  const result = await createChallenge(c,c.get('accountUserId'),c.get('accountEmail'),purpose)\n  return result.ok ? c.json({ok:true}) : c.json({ok:false,error:result.error}, result.status || 500)\n"""
if old2 not in s:
    raise SystemExit('ERROR: no encontré respuesta verify/start esperada')
s = s.replace(old2, new2, 1)

old3 = """  const result=await createChallenge(c,userId,newEmail,'email_new')\n  return result.ok ? c.json({ok:true}) : c.json(result,429)\n"""
new3 = """  const result=await createChallenge(c,userId,newEmail,'email_new')\n  return result.ok ? c.json({ok:true}) : c.json({ok:false,error:result.error}, result.status || 500)\n"""
if old3 not in s:
    raise SystemExit('ERROR: no encontré respuesta email/change/start esperada')
s = s.replace(old3, new3, 1)

p.write_text(s, encoding='utf-8')
print('✓ Flujo de correo de verificación endurecido')
