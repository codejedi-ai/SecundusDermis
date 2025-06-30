// Import all blog posts
import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'
import { post4 } from './post-4'
import { BlogPost } from '../blogPosts'

// Export all posts as an array
export const allBlogPosts: BlogPost[] = [
  post1,
  post2,
  post3,
  post4,
  // Add more posts here as they are created
]

// Export individual posts for direct access
export {
  post1,
  post2,
  post3,
  post4
}

// Helper function to get a post by ID
export const getPostById = (id: number): BlogPost | undefined => {
  return allBlogPosts.find(post => post.id === id)
}

// Helper function to get posts by category
export const getPostsByCategory = (category: string): BlogPost[] => {
  if (category === 'All') return allBlogPosts
  return allBlogPosts.filter(post => post.category === category)
}

// Helper function to get featured posts
export const getFeaturedPosts = (): BlogPost[] => {
  return allBlogPosts.filter(post => post.featured)
}

// Helper function to get recent posts
export const getRecentPosts = (limit: number = 5): BlogPost[] => {
  return allBlogPosts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
}