'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'หน้าหลัก', icon: HomeIcon },
  { href: '/add', label: 'เพิ่มรายการ', icon: PlusIcon },
  { href: '/history', label: 'ประวัติ', icon: ListIcon },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-amber-800' : 'text-gray-400'
              }`}
            >
              <tab.icon active={active} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        stroke={active ? '#92400e' : '#9ca3af'}
        strokeWidth="2"
        fill={active ? '#fef3c7' : 'none'}
      />
      <path
        d="M9 22V12h6v10"
        stroke={active ? '#92400e' : '#9ca3af'}
        strokeWidth="2"
      />
    </svg>
  )
}

function PlusIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
      <circle
        cx="12" cy="12" r="9"
        stroke={active ? '#92400e' : '#9ca3af'}
        strokeWidth="2"
        fill={active ? '#fef3c7' : 'none'}
      />
      <path
        d="M12 8v8M8 12h8"
        stroke={active ? '#92400e' : '#9ca3af'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
      <rect
        x="3" y="4" width="18" height="16" rx="2"
        stroke={active ? '#92400e' : '#9ca3af'}
        strokeWidth="2"
        fill={active ? '#fef3c7' : 'none'}
      />
      <path
        d="M7 9h10M7 13h6"
        stroke={active ? '#92400e' : '#9ca3af'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
