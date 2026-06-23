import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../Header/Header.jsx'
import Sidebar from '../Sidebar/Sidebar.jsx'
import CategoryBar from '../../menu/CategoryBar/CategoryBar.jsx'
import './Layout.css'

export default function Layout() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState({})
  const location = useLocation()

  const isMenuPage = location.pathname === '/'

  function handleFilterChange(key, value) {
    setActiveFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="layout">
      <Header />

      {isMenuPage && (
        <>
          {/* دسکتاپ: Sidebar ثابت سمت راست */}
          <Sidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onSearch={setSearchQuery}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
          />

          {/* موبایل: نوار دسته‌بندی افقی زیر Header */}
          <CategoryBar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
          />
        </>
      )}

      <div className={`layout__content ${isMenuPage ? 'layout__content--with-sidebar' : ''}`}>
        <main className="layout__main">
          <Outlet
            context={{ activeCategory, searchQuery, activeFilters }}
          />
        </main>
      </div>
    </div>
  )
}
