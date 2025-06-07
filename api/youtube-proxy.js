// Helper function to extract video ID from YouTube URL
const extractVideoId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

// Get video metadata from YouTube API
const getVideoMetadata = async (videoId, apiKey) => {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('API quota exceeded or invalid API key');
      }
      if (response.status === 404) {
        throw new Error('Video not found');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found or is private');
    }
    
    const video = data.items[0];
    const snippet = video.snippet;
    const statistics = video.statistics;
    
    return {
      title: snippet.title,
      description: snippet.description,
      channelTitle: snippet.channelTitle,
      channelId: snippet.channelId,
      publishedAt: snippet.publishedAt,
      thumbnail: snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url,
      duration: video.contentDetails.duration,
      viewCount: parseInt(statistics.viewCount || 0),
      likeCount: parseInt(statistics.likeCount || 0),
      tags: snippet.tags || []
    };
  } catch (error) {
    console.error('YouTube API error:', error);
    throw error;
  }
};

// Main handler function
export default async function handler(req, res) {
  console.log('Function started - method:', req.method);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled');
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }
  
  try {
    console.log('Processing POST request');
    const { url } = req.body;
    console.log('Request body:', req.body);
    
    if (!url) {
      console.log('No URL provided');
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }
    
    // Extract video ID
    const videoId = extractVideoId(url);
    console.log('Extracted video ID:', videoId);
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid YouTube URL format' 
      });
    }
    
    // Get API key
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    console.log('API key exists:', !!YOUTUBE_API_KEY);
    
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error - API key missing' 
      });
    }
    
    console.log('Calling YouTube API...');
    const metadata = await getVideoMetadata(videoId, YOUTUBE_API_KEY);
    console.log('YouTube API success');
    
    return res.status(200).json({
      success: true,
      videoId,
      url,
      contentType: 'youtube',
      ...metadata,
      extractedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error',
      details: error.toString()
    });
  }
}
