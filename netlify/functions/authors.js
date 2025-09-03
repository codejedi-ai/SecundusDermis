const blogAuthors = {
  'Sarah Chen': {
    name: 'Sarah Chen',
    bio: 'Sarah is a fashion industry expert with over 10 years of experience in luxury apparel design and consumer psychology. She specializes in the intersection of comfort, style, and innovative textile technology.'
  },
  'Dr. Rachel Kim': {
    name: 'Dr. Rachel Kim',
    bio: 'Dr. Rachel Kim is a textile engineer and women\'s health advocate with over 15 years of experience in innovative fabric design. She specializes in creating functional solutions for women\'s intimate apparel and foundation wear. She is also a successful entrepreneur who has experienced firsthand how thoughtful design can impact professional success.'
  },
  'Emma Rodriguez': {
    name: 'Emma Rodriguez',
    bio: 'Emma is a professional stylist and fashion consultant with expertise in creating versatile, sophisticated looks for modern women. She has worked with executives, entrepreneurs, and celebrities to develop signature styles that enhance confidence and professional presence.'
  },
  'Dr. Lisa Park': {
    name: 'Dr. Lisa Park',
    bio: 'Dr. Lisa Park is a materials scientist specializing in textile innovation and sustainable fabric development. She holds a PhD in Materials Engineering and has published extensively on antimicrobial textiles and eco-friendly manufacturing processes.'
  },
  'Maya Thompson': {
    name: 'Maya Thompson',
    bio: 'Maya is a sustainability advocate and conscious fashion expert. She helps brands and consumers make more environmentally responsible choices while maintaining style and quality. She has consulted for numerous eco-luxury brands.'
  },
  'Tech Team': {
    name: 'Secundus Dermis Tech Team',
    bio: 'Our technical team consists of textile engineers, product designers, and innovation specialists dedicated to pushing the boundaries of what foundation wear can achieve. They combine cutting-edge technology with practical design solutions.'
  },
  'Style Team': {
    name: 'Secundus Dermis Style Team',
    bio: 'Our style team brings together fashion experts, trend forecasters, and wardrobe consultants who understand how foundation pieces can transform your entire approach to dressing. They provide practical styling advice for real-world situations.'
  }
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
    
    // Get specific author by name
    if (queryStringParameters?.name) {
      const author = blogAuthors[queryStringParameters.name];
      if (!author) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Author not found' }),
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(author),
      };
    }

    // Return all authors
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(blogAuthors),
    };

  } catch (error) {
    console.error('Error in authors function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

