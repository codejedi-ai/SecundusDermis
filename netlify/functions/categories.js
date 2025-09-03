const blogCategories = [
  'Fashion Tips',
  'Styling', 
  'Care Guide',
  'Sustainability',
  'Wellness',
  'Innovation',
  'Wardrobe',
  'Product Guide',
  'Lifestyle'
];

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
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(blogCategories),
    };

  } catch (error) {
    console.error('Error in categories function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

