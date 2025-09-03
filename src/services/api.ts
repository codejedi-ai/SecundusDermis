// API service for fetching data from Netlify functions

const API_BASE_URL = '/.netlify/functions';

// Blog post interface (keeping it consistent with the existing types)
export interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
  tags: string[];
  featured?: boolean;
}

export interface BlogAuthor {
  name: string;
  bio: string;
  avatar?: string;
}

// Generic API call function
async function apiCall<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Blog Posts API
export async function getAllPosts(): Promise<BlogPost[]> {
  return apiCall<BlogPost[]>('/posts');
}

export async function getPostById(id: number): Promise<BlogPost> {
  return apiCall<BlogPost>('/posts', { id: id.toString() });
}

export async function getPostsByCategory(category: string): Promise<BlogPost[]> {
  return apiCall<BlogPost[]>('/posts', { category });
}

export async function getFeaturedPosts(): Promise<BlogPost[]> {
  return apiCall<BlogPost[]>('/posts', { featured: 'true' });
}

export async function getRecentPosts(limit: number = 5): Promise<BlogPost[]> {
  return apiCall<BlogPost[]>('/posts', { recent: limit.toString() });
}

// Authors API
export async function getAllAuthors(): Promise<Record<string, BlogAuthor>> {
  return apiCall<Record<string, BlogAuthor>>('/authors');
}

export async function getAuthorByName(name: string): Promise<BlogAuthor> {
  return apiCall<BlogAuthor>('/authors', { name });
}

// Categories API
export async function getCategories(): Promise<string[]> {
  return apiCall<string[]>('/categories');
}

