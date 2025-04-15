import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const CORE_API_KEY = process.env.CORE_API_KEY;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Add constants for API configuration
const BATCH_SIZE = 50;
const SCROLL_TIMEOUT = "30m";
const BASE_URL = "https://api.core.ac.uk/v3";

// Add caching configuration
const CACHE_DURATION = 3600; // 1 hour in seconds
const cache = new Map<string, { data: any; timestamp: number }>();

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function for caching
function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
    return cached.data;
  }
  return null;
}

// Enhanced makeRequestWithRetry with exponential backoff
async function makeRequestWithRetry(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        // Exponential backoff with jitter
        const backoffTime = Math.min(
          RETRY_DELAY * Math.pow(2, retryCount) + Math.random() * 1000,
          10000 // Max 10 seconds
        );
        await delay(Math.max(retryAfter * 1000, backoffTime));
        return makeRequestWithRetry(url, options, retryCount + 1);
      }
    }
    
    return response;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const backoffTime = RETRY_DELAY * Math.pow(2, retryCount);
      await delay(backoffTime);
      return makeRequestWithRetry(url, options, retryCount + 1);
    }
    throw error;
  }
}

// Utility function to format time in Hyderabad timezone
function formatResetTime(resetTimestamp: string | null) {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true // This will show time in 12-hour format with AM/PM
  };

  if (!resetTimestamp) {
    // Default 10 second window from now
    const defaultTime = new Date(Date.now() + 10000);
    return defaultTime.toLocaleString('en-IN', options);
  }

  const resetTime = new Date(parseInt(resetTimestamp) * 1000);
  return resetTime.toLocaleString('en-IN', options);
}

// Function to calculate time remaining in a more readable format
function calculateTimeRemaining(resetTimestamp: string | null): string {
  if (!resetTimestamp) return "10 seconds";
  
  const resetTime = new Date(parseInt(resetTimestamp) * 1000);
  const now = new Date();
  const diffSeconds = Math.max(0, Math.ceil((resetTime.getTime() - now.getTime()) / 1000));
  
  if (diffSeconds < 60) return `${diffSeconds} seconds`;
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''}`;
  }
  return `${Math.ceil(diffSeconds / 3600)} hours`;
}

function optimizeSearchQuery(query: string): string {
  // Remove parentheses and common words
  const simplified = query
    // Remove content in parentheses with bounded length
    .replace(/\([^)]{0,1000}\)/g, '')
    .split(' ')
    .filter(word => word.length > 2) // Remove very short words
    .slice(0, 6) // Limit to 6 key terms
    .join(' ');
  
  return simplified;
}

// Add a new endpoint to test API status
export async function GET() {
  try {
    // Simple test query to check API status
    const testResponse = await fetch(`${BASE_URL}/search/works`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CORE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: "*",
        limit: 1,
        fields: ["title"]
      })
    });

    const rateLimitInfo = {
      limit: testResponse.headers.get('X-RateLimit-Limit'),
      remaining: testResponse.headers.get('X-RateLimit-Remaining'),
      reset: testResponse.headers.get('X-RateLimit-Reset')
    };

    if (!testResponse.ok) {
      const errorBody = await testResponse.text();
      return NextResponse.json({
        status: 'error',
        apiStatus: testResponse.status,
        message: `API Error: ${testResponse.statusText}`,
        rateLimitInfo,
        details: errorBody
      }, { status: testResponse.status });
    }

    return NextResponse.json({
      status: 'ok',
      apiKey: CORE_API_KEY ? 'configured' : 'missing',
      rateLimitInfo: {
        limit: rateLimitInfo.limit,
        remaining: rateLimitInfo.remaining,
        resetInfo: {
          exactTime: formatResetTime(rateLimitInfo.reset),
          timeRemaining: calculateTimeRemaining(rateLimitInfo.reset)
        },
        humanReadable: {
          limit: `${rateLimitInfo.limit} requests per window`,
          remaining: `${rateLimitInfo.remaining} requests remaining`,
          reset: `Resets at ${formatResetTime(rateLimitInfo.reset)}`,
          timeUntilReset: `Resets in ${calculateTimeRemaining(rateLimitInfo.reset)}`
        }
      },
      message: 'API is working correctly'
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to connect to CORE API',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Enhanced rate limit monitoring for the main search endpoint
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!CORE_API_KEY) {
      return NextResponse.json({
        error: "API key is not configured",
        suggestion: "Please check your environment variables"
      }, { status: 500 });
    }

    const body = await request.json();
    const { 
      query, 
      scrollToken: previousScrollToken, 
      batchNumber = 0, 
      searchField = "all",
      filters = { 
        languages: [], 
        types: [] 
      } 
    } = body;

    if (!query && !previousScrollToken) {
      return new NextResponse("Query parameter is required", { status: 400 });
    }

    // Generate cache key based on query parameters
    const cacheKey = JSON.stringify({ query, filters, searchField });
    
    // Check cache for initial queries
    if (!previousScrollToken) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
    }

    // Update query based on searchField
    let searchQuery = query;
    if (searchField === "title") {
      searchQuery = `title:"${query}"`;
    } else if (searchField === "author") {
      searchQuery = `authors:"${query}"`;
    }

    // Update filter combination logic
    const filterQueries = [];
    
    if (searchQuery) filterQueries.push(searchQuery);
    
    // Add language filter
    if (filters.languages?.length > 0) {
      const languageQuery = filters.languages
        .map((lang: string) => `language.code:"${lang}"`)
        .join(' OR ');
      filterQueries.push(`(${languageQuery})`);
    }

    // Update document type filter to match the working version
    if (filters.documentTypes?.length > 0) {
      const typeQuery = filters.documentTypes
        .map((type: string) => `documentType:"${type}"`)  // Changed back to documentType
        .join(' OR ');
      filterQueries.push(`(${typeQuery})`);
    }

    const fullQuery = filterQueries.join(' AND ');

    const headers = {
      "Authorization": `Bearer ${CORE_API_KEY}`,
      "Content-Type": "application/json"
    };

    // Build search body for CORE API
    const searchBody = {
      q: fullQuery,
      limit: BATCH_SIZE,
      scroll: SCROLL_TIMEOUT,
      fields: [
        "title", "authors", "abstract", "downloadUrl", "year",
        "yearPublished", "publishedDate", "publisher", "journals",
        "doi", "language", "documentType"  // Changed back to documentType
      ],
      scrollId: previousScrollToken
    };

    const response = await makeRequestWithRetry(
      `${BASE_URL}/search/works`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(searchBody)
      }
    );

    // Enhanced rate limit monitoring
    const rateLimitInfo = {
      limit: response.headers.get('X-RateLimit-Limit'),
      remaining: response.headers.get('X-RateLimit-Remaining'),
      reset: response.headers.get('X-RateLimit-Reset')
    };

    // Log rate limit status
    console.log("Rate Limit Status:", {
      ...rateLimitInfo,
      timestamp: new Date().toISOString(),
      endpoint: '/search/works'
    });

    // Warn if approaching rate limit
    const remainingRequests = parseInt(rateLimitInfo.remaining || '0', 10);
    const totalLimit = parseInt(rateLimitInfo.limit || '0', 10);
    if (remainingRequests < totalLimit * 0.1) { // Warning at 10% remaining
      console.warn("Rate limit running low:", rateLimitInfo);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("CORE API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        rateLimitInfo,
        query: fullQuery,
        searchBody
      });

      // Add specific handling for scroll expired error
      if (response.status === 500 && errorBody.includes("No search context found")) {
        return NextResponse.json({
          error: "SCROLL_EXPIRED",
          message: "Scroll session expired. Please search again.",
          suggestion: "This usually happens when too much time has passed between loading more results."
        }, { status: 400 });
      }

      if (response.status === 429) {
        const timeRemaining = calculateTimeRemaining(rateLimitInfo.reset);
        return NextResponse.json({
          error: "Rate limit exceeded",
          message: `You've reached the API request limit. Please wait ${timeRemaining} before trying again.`,
          rateLimitInfo: {
            ...rateLimitInfo,
            humanReadable: {
              limit: `${rateLimitInfo.limit} requests per window`,
              remaining: `${rateLimitInfo.remaining} requests remaining`,
              reset: `Resets at ${formatResetTime(rateLimitInfo.reset)}`,
              timeUntilReset: `Resets in ${timeRemaining}`
            }
          },
          suggestion: "Consider refining your search terms or using more specific filters to make the most of your available requests."
        }, { status: 429 });
      }

      if (response.status === 500) {
        if (errorBody.includes("memory size")) {
          return NextResponse.json({
            error: "Search query too complex",
            message: "Please try a more specific search or use fewer words",
            suggestion: "Try searching for key terms only, like 'AI Cataract Disparities'",
            details: "The search engine couldn't process this query due to its complexity"
          }, { status: 503 });
        }
        return NextResponse.json(
          { 
            error: "CORE API Server Not Responding.",
            details: errorBody
          },
          { status: 503 } // Service Unavailable
        );
      }

      throw new Error(`CORE API error: ${response.status} - ${response.statusText}\nDetails: ${errorBody}`);
    }

    const data = await response.json();

    // Log the actual values from API for debugging
    console.log("CORE API Response Stats:", {
      totalHits: data.totalHits,
      resultCount: data.results?.length,
      batchSize: BATCH_SIZE
    });

    // Calculate correct total batches
    const totalBatches = Math.ceil((data.totalHits || 0) / BATCH_SIZE);

    // Cache initial query results
    if (!previousScrollToken) {
      cache.set(cacheKey, {
        data: {
          results: data.results || [],
          scrollToken: data.scrollId,
          totalHits: data.totalHits || 0
        },
        timestamp: Date.now()
      });
    }

    // Add check for no more results
    const noMoreResults = !data.results || data.results.length === 0;
    const reachedMaxResults = (batchNumber * BATCH_SIZE) >= Math.min(data.totalHits, 5000);

    return NextResponse.json({
      results: data.results || [],
      scrollToken: noMoreResults ? null : data.scrollId, // Don't return scroll token if no more results
      totalHits: data.totalHits || 0,
      paginationInfo: {
        currentBatch: batchNumber + 1,
        totalBatches,
        resultsPerBatch: BATCH_SIZE,
        currentResultCount: data.results?.length || 0,
        noMoreResults: noMoreResults || reachedMaxResults // Add flag to indicate no more results
      },
      cached: false,
      rateLimitInfo
    });

  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch results. Please try again.",
        details: error instanceof Error ? error.message : 'Unknown error',
        // Add suggestion for user action
        suggestion: "The search service might be temporarily unavailable. Please try again in a few minutes or try refining your search query."
      },
      { status: 500 }
    );
  }
}
