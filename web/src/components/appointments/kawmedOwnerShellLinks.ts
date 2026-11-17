type OwnerContext = {
  is_owner?: boolean; is_master?: boolean; is_guest_editor?: boolean
  action_scope?: string | null; settings_url?: string; manage_url?: string
}

/** Like Free's owner return hints: fixed App destinations, never authorization.
 * App rechecks doctor, selected account, tab token and ownership on every entry. */
export function kawMedOwnerShellLinks({ mode, hostname, origin, profileId, context }: {
  mode: string; hostname: string; origin: string; profileId?: string; context: OwnerContext
}): { settings: string; agenda: string } | null {
  if (mode !== 'preview' || hostname !== 'preview.intaprd.com' || origin !== 'https://app.preview.intaprd.com'
    || !profileId || !/^[a-zA-Z0-9_-]{1,160}$/.test(profileId)
    || context.is_owner !== true || context.is_master !== false || context.is_guest_editor !== false || context.action_scope
    || context.settings_url !== '/admin/medical' || context.manage_url !== '/admin/medical/agenda') return null
  const target = (tab: 'profile' | 'agenda') => origin + '/admin/medical?' + new URLSearchParams({
    kawvo_med_shell: '1', med_account: profileId, med_tab: tab,
  }).toString()
  return { settings: target('profile'), agenda: target('agenda') }
}
