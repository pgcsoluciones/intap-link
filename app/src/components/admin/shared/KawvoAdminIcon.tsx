import { FiHome, FiUser, FiPhone, FiMousePointer, FiMapPin, FiLink, FiImage, FiBriefcase, FiCreditCard, FiSliders, FiSettings, FiLock, FiBell, FiCpu, FiCalendar, FiMoreHorizontal, FiEdit2, FiEye, FiShare2, FiChevronRight, FiArrowLeft, FiUsers, FiSearch } from 'react-icons/fi'
const icons = {
 home:FiHome, profile:FiUser, identity:FiUser, contact:FiPhone, quick:FiMousePointer, location:FiMapPin, links:FiLink, portfolio:FiImage, services:FiBriefcase, bank:FiCreditCard, design:FiSliders, account:FiSettings, credentials:FiLock, notifications:FiBell, ai:FiCpu, agenda:FiCalendar, more:FiMoreHorizontal, edit:FiEdit2, preview:FiEye, share:FiShare2, chevron:FiChevronRight, back:FiArrowLeft, team:FiUsers, search:FiSearch,
} as const
export type KawvoAdminIconName = keyof typeof icons
export default function KawvoAdminIcon({name,className='h-5 w-5 shrink-0'}:{name:KawvoAdminIconName;className?:string}){
 const Icon=icons[name]
 return <Icon aria-hidden="true" focusable="false" className={className}/>
}
