import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function FreeRouteUx() {
  const location = useLocation()

  useEffect(() => {
    const enabled = location.pathname.startsWith('/admin/free') || location.pathname.startsWith('/admin/artifacts')
    document.body.classList.toggle('kawvo-free-mobile', enabled)
    return () => document.body.classList.remove('kawvo-free-mobile')
  }, [location.pathname])

  return null
}
