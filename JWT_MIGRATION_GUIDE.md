# JWT Migration to HttpOnly Cookies - Implementation Guide

## Overview

This document describes the migration from localStorage-based JWT storage to httpOnly cookies for improved security. The implementation maintains backward compatibility during the transition period.

## Security Benefits

- **XSS Protection:** httpOnly cookies cannot be accessed by JavaScript, preventing XSS attacks from stealing tokens
- **Automatic Cookie Management:** Browser handles cookie expiration and secure transmission
- **CSRF Protection:** Existing CSRF token implementation protects against cross-site request forgery

## Implementation Details

### Backend Changes

#### 1. Login Controller (`server/src/controllers/auth.controller.ts`)

**Changes:**
- JWT token is now set in httpOnly cookie on successful login
- Token is still returned in response body for backward compatibility
- Cookie configuration:
  - `httpOnly: true` - Prevents JavaScript access
  - `secure: true` in production - HTTPS only
  - `sameSite: 'strict'` - CSRF protection
  - `maxAge: 24 hours` - Token expiration

**Code:**
```typescript
res.cookie('token', token, {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
});
```

#### 2. Authentication Middleware (`server/src/middleware/auth.ts`)

**Changes:**
- Reads token from httpOnly cookie first (preferred)
- Falls back to Authorization header for backward compatibility
- Supports both methods during transition

**Code:**
```typescript
// Try cookie first
let token = req.cookies?.token;

// Fallback to Authorization header
if (!token) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
}
```

#### 3. Logout Controller

**Changes:**
- Clears httpOnly cookie on logout
- Ensures token is removed from browser

**Code:**
```typescript
res.clearCookie('token', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});
```

#### 4. Token Refresh

**Changes:**
- Sets new token in httpOnly cookie
- Returns token in response for backward compatibility

### Frontend Changes

#### 1. API Service (`src/services/api.ts`)

**Changes:**
- All fetch requests now include `credentials: 'include'` to send cookies
- CSRF token automatically included from cookie
- Authorization header still sent for backward compatibility (will be removed later)

**Key Updates:**
- `getHeaders()` method reads CSRF token from cookie
- All authenticated requests include `credentials: 'include'`
- Token still stored in localStorage for backward compatibility (TODO: remove)

#### 2. Auth Context (`src/contexts/AuthContext.tsx`)

**Changes:**
- `logout()` now calls API endpoint to clear cookie
- Token still removed from localStorage (backward compatibility)
- Token storage in localStorage kept during transition

**Code:**
```typescript
const logout = async () => {
  try {
    await api.logout(); // Clears httpOnly cookie
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('token'); // Backward compatibility
    setUser(null);
  }
};
```

## Configuration

### Environment Variables

No new environment variables required. The implementation uses existing:
- `NODE_ENV` - Determines if cookies should be secure (HTTPS only in production)

### CORS Configuration

Ensure CORS is configured to allow credentials:

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGINS || 'http://localhost:5173',
  credentials: true // Required for cookies
}));
```

## Migration Steps

### Phase 1: Backend Implementation (✅ Completed)
- [x] Update login to set httpOnly cookie
- [x] Update authentication middleware to read from cookies
- [x] Update logout to clear cookie
- [x] Update token refresh to set cookie

### Phase 2: Frontend Updates (✅ Completed)
- [x] Add `credentials: 'include'` to all fetch requests
- [x] Update logout to call API endpoint
- [x] Add CSRF token handling
- [x] Maintain backward compatibility with localStorage

### Phase 3: Testing (Pending)
- [ ] Test login/logout flow
- [ ] Test token refresh
- [ ] Test CSRF protection
- [ ] Test in production environment
- [ ] Verify cookies are set correctly
- [ ] Test XSS protection (token not accessible via JavaScript)

### Phase 4: Cleanup (Future)
- [ ] Remove localStorage token storage from frontend
- [ ] Remove Authorization header fallback from backend
- [ ] Remove token from API responses
- [ ] Update documentation

## Testing

### Manual Testing

1. **Login Test:**
   - Login and verify cookie is set (check browser DevTools → Application → Cookies)
   - Verify cookie has `httpOnly` flag
   - Verify token is not accessible via `document.cookie` in console

2. **Authentication Test:**
   - Make authenticated API request
   - Verify request succeeds with cookie-based auth
   - Test Authorization header fallback (should still work)

3. **Logout Test:**
   - Logout and verify cookie is cleared
   - Verify subsequent requests fail with 401

4. **CSRF Test:**
   - Verify CSRF token is sent with requests
   - Test CSRF protection (should reject requests without valid token)

### Automated Testing

Update existing tests to:
- Mock cookie-based authentication
- Test cookie setting and clearing
- Verify credentials are included in requests

## Rollback Plan

If issues arise, the system maintains backward compatibility:

1. **Immediate Rollback:**
   - Frontend can still use Authorization header (already implemented)
   - Backend accepts both cookie and header tokens
   - No breaking changes

2. **Full Rollback:**
   - Revert backend changes to only use Authorization header
   - Remove cookie setting code
   - Frontend continues using localStorage

## Security Considerations

### CSRF Protection

The system already implements CSRF protection:
- CSRF token in cookie (`XSRF-TOKEN`)
- Token sent in header (`X-XSRF-TOKEN`)
- Validated on all state-changing requests

### Cookie Security

- **httpOnly:** Prevents JavaScript access (XSS protection)
- **secure:** HTTPS only in production
- **sameSite:** Prevents cross-site requests (CSRF protection)
- **path:** Restricted to application path

### Token Expiration

- Tokens expire after 24 hours
- Refresh token mechanism available
- Automatic cleanup on logout

## Known Limitations

1. **Backward Compatibility:** Currently supports both methods, increasing code complexity
2. **LocalStorage Still Used:** Token still stored in localStorage during transition
3. **Mobile Apps:** May need different approach for mobile applications

## Future Improvements

1. **Remove Backward Compatibility:** After full migration, remove Authorization header support
2. **Token Refresh:** Implement automatic token refresh before expiration
3. **Session Management:** Add session management dashboard
4. **Multi-Device Support:** Handle multiple devices/sessions

## Troubleshooting

### Cookies Not Being Set

1. Check CORS configuration includes `credentials: true`
2. Verify cookie domain matches frontend domain
3. Check browser console for cookie-related errors
4. Verify `secure` flag matches HTTPS usage

### Authentication Failing

1. Verify `credentials: 'include'` in all fetch requests
2. Check cookie is being sent (Network tab → Request Headers)
3. Verify backend is reading from `req.cookies.token`
4. Check CSRF token is being sent

### CSRF Errors

1. Verify CSRF token cookie is set
2. Check `X-XSRF-TOKEN` header is included
3. Verify CSRF validation middleware is working
4. Check session is being maintained

---

**Status:** Implementation Complete, Testing Pending  
**Last Updated:** January 2025

