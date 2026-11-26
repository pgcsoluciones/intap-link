import { FiHome, FiUser, FiPhone, FiMousePointer, FiMapPin, FiLink, FiImage, FiBriefcase, FiCreditCard, FiSliders, FiSettings, FiLock, FiBell, FiCpu, FiCalendar, FiMoreHorizontal, FiEdit2, FiEye, FiShare2, FiChevronRight, FiArrowLeft, FiUsers, FiSearch, FiClock, FiShield, FiInbox, FiCheckCircle, FiSlash, FiPackage, FiDownload, FiLogOut, FiRefreshCw, FiStar } from 'react-icons/fi'
const icons = {
 home:FiHome, profile:FiUser, identity:FiUser, contact:FiPhone, quick:FiMousePointer, location:FiMapPin, links:FiLink, portfolio:FiImage, services:FiBriefcase, bank:FiCreditCard, reviews:FiStar, design:FiSliders, account:FiSettings, credentials:FiLock, notifications:FiBell, ai:FiCpu, agenda:FiCalendar, more:FiMoreHorizontal, edit:FiEdit2, preview:FiEye, share:FiShare2, chevron:FiChevronRight, back:FiArrowLeft, team:FiUsers, search:FiSearch, centers:FiMapPin, schedule:FiClock, insurance:FiShield, appearance:FiSliders, requests:FiInbox, confirmed:FiCheckCircle, availability:FiCalendar, blocks:FiSlash, settings:FiSettings, sponsorship:FiPackage, install:FiDownload, logout:FiLogOut, switchAccount:FiRefreshCw,
} as const
export type KawvoAdminIconName = keyof typeof icons
export default function KawvoAdminIcon({name,className='h-5 w-5 shrink-0'}:{name:KawvoAdminIconName;className?:string}){
 const Icon=icons[name]
 return <Icon aria-hidden="true" focusable="false" className={className}/>
}

export function KawvoIconTile({name}:{name:KawvoAdminIconName}){
 return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-cyan-800"><KawvoAdminIcon name={name}/></span>
}
export function KawvoActionContent({name,title,detail}:{name:KawvoAdminIconName;title:import('react').ReactNode;detail?:import('react').ReactNode}){
 return <><KawvoIconTile name={name}/><span className="min-w-0 flex-1 break-words"><strong className="block text-sm font-bold">{title}</strong>{detail&&<span className="mt-1 block text-xs font-normal text-slate-600">{detail}</span>}</span><KawvoAdminIcon name="chevron" className="h-4 w-4 shrink-0 text-slate-400"/></>
}
export function KawvoNavIcon({id}:{id:string}){
 const name=id==='home'?'home':id==='profile'?'profile':id==='agenda'?'agenda':id==='sponsorship'?'sponsorship':'more'
 return <KawvoIconTile name={name}/>
}
