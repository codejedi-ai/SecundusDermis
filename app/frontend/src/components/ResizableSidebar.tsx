import React, { useEffect, useRef } from 'react'
import { useShop } from '../lib/shop-context'
import '../styles/shop.css'

interface ResizableSidebarProps {
  children: React.ReactNode
}

export default function ResizableSidebar({ children }: ResizableSidebarProps) {
  const { sidebarWidth, setSidebarWidth } = useShop()

  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(0)

  const onDragStart = (e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartW.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      setSidebarWidth(Math.min(400, Math.max(160, dragStartW.current + delta)))
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setSidebarWidth])

  return (
    <div className="shop-sidebar-wrap" style={{ width: sidebarWidth }}>
      <div className="sidebar-resizer" onMouseDown={onDragStart} />
      <aside className="shop-sidebar">
        {children}
      </aside>
    </div>
  )
}
