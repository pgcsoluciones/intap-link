type OwnerContext = {
  is_owner?: boolean; is_master?: boolean; is_guest_editor?: boolean
  action_scope?: string | null; settings_url?: string; manage_url?: string
}

/** Like Free's owner return hints: fixed App destinations, never authorization.
 * App rechecks doctor, selected account, tab token and ownership on every entry. */
export function kawMedOwnerShellLinks({ mode, hostname, origin, profileId, context }: {
  mode: string; hostname: string; origin: string; profileId?: string; context: OwnerContext
}): { settings: string; agenda: string } | null {
  if (!isOwnerShellHost(mode,hostname,origin)
    || !profileId || !/^[a-zA-Z0-9_-]{1,160}$/.test(profileId)
    || context.is_owner !== true || context.is_master !== false || context.is_guest_editor !== false || context.action_scope
    || context.settings_url !== '/admin/medical' || context.manage_url !== '/admin/medical/agenda') return null
  const target = (tab: 'profile' | 'agenda') => origin + '/admin/medical?' + new URLSearchParams({
    kawvo_med_shell: '1', med_account: profileId, med_tab: tab,
  }).toString()
  return { settings: target('profile'), agenda: target('agenda') }
}

export function isOwnerShellHost(mode:string, hostname:string, origin:string):boolean {
  return (mode==='preview'&&hostname==='preview.intaprd.com'&&origin==='https://app.preview.intaprd.com')
    || (mode==='production'&&hostname==='intaprd.com'&&origin==='https://app.intaprd.com')
}

export function otherOwnerShellLinks({mode,hostname,origin,context,ownerApiBase,username}:{
  mode:string; hostname:string; origin:string; context:OwnerContext; ownerApiBase:string; username:string
}):{settings:string;agenda:string}|null {
  if(!isOwnerShellHost(mode,hostname,origin)||context.is_owner!==true)return null
  const settings=context.settings_url||'',agenda=context.manage_url||''
  if(ownerApiBase.endsWith('/api/v1/me/sponsored-profile/appointments')&&!context.action_scope){
    const match=settings.match(/^\/admin\/sponsored\?profile_id=([a-zA-Z0-9_-]{1,160})$/)
    if(!match||!(agenda==='/admin/sponsored/agenda'||agenda==='/admin/sponsored/agenda?profile_id='+match[1]))return null
    const target=(tab:string)=>origin+'/admin/sponsored?'+new URLSearchParams({profile_id:match[1],kawvo_sponsored_shell:'1',sp_tab:tab})
    return {settings:target('profile'),agenda:target('agenda')}
  }
  if(ownerApiBase.endsWith('/api/v1/me/medical-profile/appointments')){
    if(context.is_master===true&&context.is_guest_editor===false&&context.action_scope==='sponsor_master'&&settings==='/admin/sponsor/kawmed?tab=profile'&&agenda==='/admin/medical/agenda?scope=sponsor_master')
      return {settings:origin+settings,agenda:origin+'/admin/sponsor/kawmed?kawvo_med_shell=1&tab=agenda'}
    if(context.is_guest_editor===true&&context.is_master===false&&!context.action_scope&&/^\/admin\/medical\/demo\/i-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(settings)&&agenda===settings+'/agenda')
      return {settings:origin+settings+'?kawvo_med_shell=1&med_tab=profile',agenda:origin+settings+'?kawvo_med_shell=1&med_tab=agenda'}
  }
  if(ownerApiBase.endsWith('/api/v1/me/free/appointments')&&settings==='/admin/free'&&agenda==='/admin/free/agenda'&&/^[a-zA-Z0-9_-]{1,160}$/.test(username)){
    const target=(tab:string)=>origin+'/admin/free/shell-preview?'+new URLSearchParams({kawvo_shell:'1',resume:tab,slug:username})
    return {settings:target('profile'),agenda:target('agenda')}
  }
  return null
}
