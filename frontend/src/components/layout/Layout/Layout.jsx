import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../Header/Header.jsx'
import Sidebar from '../Sidebar/Sidebar.jsx'
import './Layout.css'

const SIDEBAR_PAGES = ['/']

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState({})
  const location = useLocation()

  const showSidebar = location.pathname === '/'

  function handleFilterChange(key, value) {
    setActiveFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="layout">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      {showSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onSearch={setSearchQuery}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
        />
      )}

      <div className="layout__content">
        <main className="layout__main">
          <Outlet
            context={{
              activeCategory,
              searchQuery,
              activeFilters,
            }}
          />
        </main>
      </div>
    </div>
  )
}
