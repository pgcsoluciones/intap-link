import app from './index'

function cleanUsername(value:unknown){return String(value??'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function cleanText(value:unknown,max=500){return String(value??'').trim().slice(0,max)}
function parseArray(value:unknown){try{const parsed=JSON.parse(String(value||'[]'));return Array.isArray(parsed)?parsed:[]}catch{return []}}
function rowToProfile(row:any){
  return {
    id:row.id,username:row.username,business_name:row.business_name,specialization:row.specialization,what_we_do:row.what_we_do,
    avatar_url:row.avatar_url,hero_url:row.hero_url,map_url:row.map_url,show_avatar:Number(row.show_avatar)===1,cover_variant:row.cover_variant||'standard',phone:row.phone,whatsapp:row.whatsapp,instagram:row.instagram,address:row.address,
    schedule:parseArray(row.schedule_json),gallery:parseArray(row.gallery_json),gallery_title:row.gallery_title||'Catálogo',palette_id:row.palette_id||'blue',status:row.status,
    modules:parseArray(row.modules_json),
    sponsor:{id:row.sponsor_id,name:row.sponsor_name,type:row.sponsor_type,logo_url:row.sponsor_logo_url,banner_title:row.banner_title||'Impulsado por',banner_image_url:row.banner_image_url,banner_cta_label:row.banner_cta_label||'Conocer más',banner_cta_type:row.banner_cta_type||'none',banner_cta_value:row.banner_cta_value,whatsapp_message_template:row.whatsapp_message_template,website_url:row.sponsor_website_url,contact_whatsapp:row.sponsor_contact_whatsapp}
  }
}
const SELECT=`SELECT sp.*,st.name AS sponsor_name,st.sponsor_type,st.logo_url AS sponsor_logo_url,st.banner_title,st.banner_image_url,st.banner_cta_label,st.banner_cta_type,st.banner_cta_value,st.whatsapp_message_template,st.website_url AS sponsor_website_url,st.contact_whatsapp AS sponsor_contact_whatsapp FROM sponsored_profiles sp JOIN sponsor_tenants st ON st.id=sp.sponsor_id`

// A claimed sponsored presentation is permanent for the beneficiary. Sponsor
// commercial inactivity is intentionally NOT a publication condition here.
app.get('/api/v1/public/sponsored/:username',async(c:any)=>{
  const username=cleanUsername(c.req.param('username'))
  if(!username)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  const row=await c.env.DB.prepare(`${SELECT} WHERE sp.username=? AND sp.status='published' LIMIT 1`).bind(username).first()
  if(!row)return c.json({ok:false,error:'Perfil no encontrado.'},404)
  return c.json({ok:true,data:rowToProfile(row)})
})

app.get('/api/v1/public/sponsored/:username/vcard',async(c:any)=>{
  const username=cleanUsername(c.req.param('username'))
  const row=await c.env.DB.prepare(`${SELECT} WHERE sp.username=? AND sp.status='published' LIMIT 1`).bind(username).first()
  if(!row)return c.text('Perfil no encontrado',404)
  const name=cleanText((row as any).business_name||username,120)
  const phone=cleanText((row as any).phone||(row as any).whatsapp,40)
  const url=`${String(c.env.WEB_URL||'https://intaprd.com').replace(/\/$/,'')}/p/${encodeURIComponent(username)}`
  const lines=['BEGIN:VCARD','VERSION:3.0',`FN:${name}`,phone?`TEL;TYPE=CELL:${phone}`:'',`URL:${url}`,'END:VCARD'].filter(Boolean)
  return new Response(lines.join('\r\n'),{headers:{'Content-Type':'text/vcard; charset=utf-8','Content-Disposition':`attachment; filename="${username}.vcf"`}})
})

export default app