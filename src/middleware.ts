import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

// Update TRUSTED_DOMAINS to include all necessary domains
const TRUSTED_DOMAINS = [
  'app.aiedify.com',
  'localhost:3000',
  'edify-dev.vercel.app',
  'edify-git-dev-hari-vorugantis-projects.vercel.app',
  'great-koala-32.clerk.accounts.dev',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/waitlist(.*)',
  '/waitlist-confirmation(.*)',
  '/user-type(.*)',
  '/',
  '/api/webhooks/clerk',
  '/api/webhooks/waitlist(.*)',
  '/api/waitlist',
  '/api/clerk/waitlist(.*)',
  '/api/webhooks/stripe',
  '/api/organizations/check-name',
  '/api/waitlist/update-type'
]);
const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
]);
const isOrgProtectedRoute = createRouteMatcher([
  '/dashboard',
]);

export default clerkMiddleware(async (auth, req) => {
  console.log('=== MIDDLEWARE START ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-clerk-key, next-action, next-router-state-tree, clerk-frontend-api',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Add explicit webhook bypass
  if (req.nextUrl.pathname.startsWith('/api/webhooks/')) {
    console.log('Bypassing auth for webhook route');
    return NextResponse.next();
  }

  const url = new URL(req.url);
  const hostname = url.host;
  const origin = req.headers.get('origin');

  // Keep redirects within same environment
  const isDev = hostname.includes('edify-dev.vercel.app');
  const baseUrl = isDev ? 'https://edify-dev.vercel.app' : 'https://app.aiedify.com';

  // Handle sign-in related paths without redirection
  if (url.pathname.startsWith('/sign-in') ||
    url.pathname.includes('/factor-one') ||
    url.pathname.includes('/__clerk')) {
    console.log('Allowing auth-related route');
    return NextResponse.next();
  }

  // Update redirect logic to maintain the current domain
  if (!TRUSTED_DOMAINS.includes(hostname)) {
    console.log('Unauthorized domain:', hostname);
    const currentDomain = req.headers.get('host') || 'app.aiedify.com';
    return NextResponse.redirect(new URL(req.nextUrl.pathname, `https://${currentDomain}`));
  }

  const { userId, orgId } = await auth();
  console.log('Auth:', { userId, orgId });
  console.log('Current path:', req.nextUrl.pathname); // Debug log

  // Allow all API routes related to waitlist
  if (req.nextUrl.pathname.startsWith('/api/clerk/waitlist') ||
    req.nextUrl.pathname.startsWith('/api/waitlist') ||
    req.nextUrl.pathname.startsWith('/api/webhooks/waitlist')) {
    console.log('Allowing waitlist API route');
    return NextResponse.next();
  }

  // Handle waitlist routes first
  if (req.nextUrl.pathname.startsWith('/waitlist') &&
    !req.nextUrl.pathname.startsWith('/admin/waitlist')) {
    console.log('Waitlist route detected');
    if (userId) {
      return NextResponse.redirect(new URL('/tools', req.url));
    }
    return NextResponse.next();
  }

  // Redirect root to tools
  if (req.nextUrl.pathname === '/') {
    const toolsUrl = new URL('/tools', req.url);
    return NextResponse.redirect(toolsUrl);
  }

  // API route check
  if (req.nextUrl.pathname.startsWith("/api/")) {
    // Allow prompt library routes without API key check
    if (req.nextUrl.pathname.startsWith("/api/prompt-lib/")) {
      return NextResponse.next();
    }

    if (!process.env.OPENAI_API_KEY || !process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API configuration is incomplete" },
        { status: 500 }
      );
    }
  }

  // Organization route check
  if (req.nextUrl.pathname.startsWith("/organization")) {
    if (!orgId) {
      const orgSelection = new URL("/select-org", req.url);
      return NextResponse.redirect(orgSelection);
    }
  }

  // Protect admin routes
  if (isProtectedRoute(req)) {
    if (!userId) {
      const signIn = new URL('/sign-in', req.url);
      return NextResponse.redirect(signIn);
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const isAdmin = user.publicMetadata.role === 'admin';

    if (!isAdmin) {
      console.log('Non-admin user attempting to access admin route');
      return NextResponse.redirect(new URL('/tools', req.url));
    }
    // If user is admin, allow access to admin routes including analytics
    return NextResponse.next();
  }

  if (isOrgProtectedRoute(req)) {
    if (!userId) {
      const signIn = new URL('/sign-in', req.url);
      return NextResponse.redirect(signIn);
    }

    const { orgRole } = await auth();
    const isOrgAdmin = orgRole === 'org:admin';

    if (!isOrgAdmin) return NextResponse.redirect(new URL('/tools', req.url));

    return NextResponse.next();
  }

  // Protect non-public routes
  if (!isPublicRoute(req)) {
    if (!userId) {
      const signIn = new URL('/sign-in', req.url);
      // Add the callback URL as a search parameter
      signIn.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signIn);
    }
  }

  // If user is signed in and tries to access auth pages
  if (userId && (
    req.nextUrl.pathname.startsWith('/sign-in') ||
    req.nextUrl.pathname.startsWith('/sign-up') ||
    req.nextUrl.pathname.startsWith('/waitlist')
  )) {
    console.log('Authenticated user trying to access auth pages');
    // Check if there's a redirect URL in the search params
    const redirectUrl = req.nextUrl.searchParams.get('redirect_url');
    if (redirectUrl) {
      return NextResponse.redirect(new URL(redirectUrl));
    }
    // Default redirect to tools if no redirect URL
    return NextResponse.redirect(new URL('/tools', req.url));
  }

  // Update the sign-out handling in the middleware
  if (req.nextUrl.pathname.startsWith('/sign-out')) {
    const signOutUrl = new URL('/sign-in', req.url);
    return NextResponse.redirect(signOutUrl);
  }

  if (req.nextUrl.pathname.startsWith("/tools")) {
    const checkRes = await fetch(new URL('/api/check-premium', req.url).toString(), {
      headers: { cookie: req.headers.get('cookie') || '' },
    });
    const checkData = await checkRes.json();

    if (!checkData.premium && checkData.usageExceeded) {
      return NextResponse.redirect(new URL('/pricing', req.url));
    }
  }

  console.log('=== MIDDLEWARE END ===');
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)',
    '/',
    '/(api|trpc)(.*)',
    '/api/webhooks/(.*)'
  ],
};