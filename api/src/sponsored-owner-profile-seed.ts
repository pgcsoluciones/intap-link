function cleanSlug(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,30)}

export async function ensureSponsorOwnerProfileBase(c:any,sponsorId:string,userId:string){
  const tenant=await c.env.DB.prepare(`SELECT name,sponsor_type,logo_url,banner_image_url,contact_whatsapp,profile_slug FROM sponsor_tenants WHERE id=? LIMIT 1`).bind(sponsorId).first()
  if(!tenant)return null

  const sponsorName=String((tenant as any).name||'').trim().slice(0,100)
  const sponsorType=String((tenant as any).sponsor_type||'merchant')==='brand'?'brand':'merchant'
  const specialization=sponsorType==='brand'?'Marca':'Comercio'
  const whatWeDo='Conoce nuestros productos, servicios y canales de contacto.'
  const whatsapp=String((tenant as any).contact_whatsapp||'').trim().slice(0,40)
  const logoUrl=String((tenant as any).logo_url||'').trim().slice(0,800)
  const bannerUrl=String((tenant as any).banner_image_url||'').trim().slice(0,800)

  let profile=await c.env.DB.prepare(`SELECT id,username,status FROM sponsored_profiles WHERE sponsor_id=? AND user_id=? AND profile_role='sponsor_owner' LIMIT 1`).bind(sponsorId,userId).first()
  if(profile){
    await c.env.DB.prepare(`UPDATE sponsored_profiles SET
      business_name=CASE WHEN trim(COALESCE(business_name,''))='' THEN ? ELSE business_name END,
      specialization=CASE WHEN trim(COALESCE(specialization,''))='' THEN ? ELSE specialization END,
      what_we_do=CASE WHEN trim(COALESCE(what_we_do,''))='' THEN ? ELSE what_we_do END,
      avatar_url=CASE WHEN trim(COALESCE(avatar_url,''))='' THEN ? ELSE avatar_url END,
      hero_url=CASE WHEN trim(COALESCE(hero_url,''))='' THEN ? ELSE hero_url END,
      phone=CASE WHEN trim(COALESCE(phone,''))='' THEN ? ELSE phone END,
      whatsapp=CASE WHEN trim(COALESCE(whatsapp,''))='' THEN ? ELSE whatsapp END,
      gallery_json=CASE WHEN trim(COALESCE(gallery_json,''))='' THEN '[]' ELSE gallery_json END,
      gallery_title=CASE WHEN trim(COALESCE(gallery_title,''))='' THEN 'Catálogo' ELSE gallery_title END,
      palette_id=CASE WHEN trim(COALESCE(palette_id,''))='' THEN 'blue' ELSE palette_id END,
      updated_at=datetime('now')
      WHERE id=?`).bind(sponsorName,specialization,whatWeDo,logoUrl,bannerUrl,whatsapp,whatsapp,String((profile as any).id)).run()
    return profile
  }

  let preferred=cleanSlug((tenant as any).profile_slug)
  if(preferred){
    const used=await c.env.DB.prepare(`SELECT id FROM sponsored_profiles WHERE username=? LIMIT 1`).bind(preferred).first()
    if(used)preferred=''
  }

  const id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO sponsored_profiles (
    id,sponsor_id,user_id,username,business_name,specialization,what_we_do,avatar_url,hero_url,show_avatar,phone,whatsapp,gallery_json,gallery_title,palette_id,status,profile_role
  ) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,'Catálogo','blue','draft','sponsor_owner')`).bind(
    id,sponsorId,userId,preferred||null,sponsorName,specialization,whatWeDo,logoUrl,bannerUrl,whatsapp,whatsapp,'[]',
  ).run()
  return {id,username:preferred||null,status:'draft'}
}
