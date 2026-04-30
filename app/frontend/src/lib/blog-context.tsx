import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import * as blogApi from '../services/blogApi'

interface BlogCtx {
  posts: blogApi.JournalPost[]
  categories: string[]
  loading: boolean
  refreshBlog: () => Promise<void>
}

const Ctx = createContext<BlogCtx | null>(null)

export function BlogProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<blogApi.JournalPost[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBlogData = async () => {
    setLoading(true)
    try {
      const [list, cats] = await Promise.all([
        blogApi.getJournalList(),
        blogApi.getJournalCategories(),
      ])
      setPosts(list.posts)
      setCategories(cats.categories)
    } catch (err) {
      console.error('Failed to fetch blog data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBlogData()
  }, [])

  return (
    <Ctx.Provider value={{
      posts,
      categories,
      loading,
      refreshBlog: fetchBlogData
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBlog() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBlog must be used within BlogProvider')
  return ctx
}
