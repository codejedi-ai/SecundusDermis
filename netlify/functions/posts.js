const { post1 } = require('./data/post-1');
const { post2 } = require('./data/post-2');
const { post3 } = require('./data/post-3');
const { post4 } = require('./data/post-4');
const { post5 } = require('./data/post-5');

// All blog posts
const allBlogPosts = [post1, post2, post3, post4, post5];

// Helper function to get a post by ID
const getPostById = (id) => {
  return allBlogPosts.find(post => post.id === parseInt(id));
};

// Helper function to get posts by category
const getPostsByCategory = (category) => {
  if (category === 'All') return allBlogPosts;
  return allBlogPosts.filter(post => post.category === category);
};

// Helper function to get featured posts
const getFeaturedPosts = () => {
  return allBlogPosts.filter(post => post.featured);
};

// Helper function to get recent posts
const getRecentPosts = (limit = 5) => {
  return allBlogPosts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
};

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { queryStringParameters } = event;
    
    // Get single post by ID
    if (queryStringParameters?.id) {
      const post = getPostById(queryStringParameters.id);
      if (!post) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Post not found' }),
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(post),
      };
    }

    // Get posts by category
    if (queryStringParameters?.category) {
      const posts = getPostsByCategory(queryStringParameters.category);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(posts),
      };
    }

    // Get featured posts
    if (queryStringParameters?.featured === 'true') {
      const posts = getFeaturedPosts();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(posts),
      };
    }

    // Get recent posts
    if (queryStringParameters?.recent) {
      const limit = parseInt(queryStringParameters.recent) || 5;
      const posts = getRecentPosts(limit);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(posts),
      };
    }

    // Default: return all posts
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(allBlogPosts),
    };

  } catch (error) {
    console.error('Error in posts function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

