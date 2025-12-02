# JWT Security Configuration Guide

## Overview

This document provides comprehensive guidance for super administrators on configuring and managing JWT (JSON Web Tokens) security settings for the Smart Health Manager application. It covers the enhanced JWT implementation that provides enterprise-grade security for healthcare data protection.

## Table of Contents
1. [Current Implementation Overview](#current-implementation-overview)
2. [Security Vulnerabilities Addressed](#security-vulnerabilities-addressed)
3. [New Security Features](#new-security-features)
4. [Configuration Options](#configuration-options)
5. [Key Management](#key-management)
6. [Migration Guide](#migration-guide)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Current Implementation Overview

### Basic JWT Configuration
The application uses JWT for stateless authentication with the following components:
- **Library**: `jsonwebtoken` (v9.0.2)
- **Current Secret**: Hardcoded static secret (not recommended for production)
- **Algorithm**: HS256 (symmetric encryption)
- **Token Expiration**: 24 hours
- **Payload**: Basic user information (id, email, role)

## Security Vulnerabilities Addressed

### 1. **Static Secret Key**
- **Issue**: Hardcoded JWT secret in environment files
- **Risk**: Single point of compromise across all deployments
- **Solution**: Dynamic key generation with crypto.randomBytes()

### 2. **Weak Signing Algorithm**
- **Issue**: HS256 symmetric encryption only
- **Risk**: Single key used for signing and verification
- **Solution**: Support for RS256 (asymmetric encryption)

### 3. **No Token Revocation**
- **Issue**: No mechanism to invalidate tokens before expiration
- **Risk**: Compromised tokens remain valid until natural expiration
- **Solution**: Token blacklist implementation

### 4. **Missing Security Claims**
- **Issue**: Lack of issuer, audience, and JWT ID validation
- **Risk**: Token impersonation and replay attacks
- **Solution**: Enhanced JWT claims validation

## New Security Features

### 1. **Enhanced Key Management**
- Cryptographically secure key generation
- Support for both symmetric (HS256) and asymmetric (RS256) algorithms
- Automatic key rotation with configurable intervals
- JWK (JSON Web Key) support for dynamic key management

### 2. **Advanced JWT Configuration**
```
{
  "alg": "RS256",                    // Algorithm
  "typ": "JWT",                      // Type
  "iss": "smart-health-manager",     // Issuer
  "aud": "healthcare-api",          // Audience
  "sub": "user-uuid",               // Subject (User ID)
  "iat": 1640995200,                // Issued At
  "exp": 1641081600,                // Expiration Time
  "nbf": 1640995200,                // Not Before
  "jti": "unique-token-id"          // JWT ID
}
```

### 3. **Token Security Features**
- **Payload Encryption**: Sensitive data encryption using AES-256-GCM
- **Token Blacklist**: Database-backed token revocation system
- **Automatic Cleanup**: Background process for expired token removal
- **Security Headers**: Enhanced security response headers

### 4. **Multi-Environment Configuration**
```env
# Development
JWT_ALGORITHM=HS256
JWT_SECRET_DERIVATION=true
JWT_KEY_ROTATION_HOURS=168

# Production
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_JWKS_ENDPOINT=/api/auth/jwks
```

## Configuration Options

### Environment Variables

#### Basic JWT Settings
```env
# JWT Algorithm (HS256, RS256, ES256)
JWT_ALGORITHM=RS256

# Expiration Settings
JWT_ACCESS_TOKEN_EXPIRES_IN=1h
JWT_REFRESH_TOKEN_EXPIRES_IN=30d
JWT_SESSION_TOKEN_EXPIRES_IN=24h

# Issuer and Audience
JWT_ISSUER=smart-health-manager
JWT_AUDIENCE=healthcare-api
```

#### Symmetric Key Configuration (HS256)
```env
# Automatic Key Generation
JWT_SECRET_DERIVATION=true
JWT_KEY_LENGTH=64
JWT_KEY_ROTATION_HOURS=168

# Manual Key (Not Recommended)
JWT_SECRET=your-secure-base64-encoded-secret
```

#### Asymmetric Key Configuration (RS256)
```env
# RSA Key Pair Paths
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem

# JWKS Configuration
JWT_JWKS_ENDPOINT=/api/auth/jwks
JWT_JWKS_CACHE_DURATION=3600

# Key Rotation for RSA
JWT_KEY_ROTATION_DAYS=90
```

#### Security Features
```env
# Token Blacklist
JWT_ENABLE_BLACKLIST=true
JWT_BLACKLIST_CLEANUP_INTERVAL=3600

# Payload Security
JWT_ENCRYPT_PAYLOAD=true
JWT_ENCRYPTION_KEY_DERIVATION=true

# Validation
JWT_VALIDATE_ISSUER=true
JWT_VALIDATE_AUDIENCE=true
JWT_CLOCK_TOLERANCE_SECONDS=30
```

#### Performance & Monitoring
```env
# Rate Limiting
JWT_RATE_LIMIT_WINDOW_MS=60000
JWT_RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
JWT_ENABLE_AUDIT_LOG=true
JWT_LOG_SENSITIVE_DATA=false

# Caching
JWT_JWK_CACHE_SIZE=100
JWT_BLACKLIST_CACHE_SIZE=10000
```

## Key Management

### Automatic Key Generation
```bash
# Generate new symmetric key
npm run jwt:generate-key

# Generate RSA key pair
npm run jwt:generate-rsa

# Rotate keys
npm run jwt:rotate-keys
```

### Manual Key Setup
1. **Generate RSA Key Pair:**
```bash
openssl genrsa -out private.pem 4096
openssl rsa -in private.pem -pubout -out public.pem
```

2. **Key Storage:**
- Store private keys securely (AWS KMS, HashiCorp Vault, Azure Key Vault)
- Use environment variables for key paths
- Implement proper file permissions (600 for private keys)

3. **Key Rotation:**
- Set `JWT_KEY_ROTATION_DAYS=90` for automatic rotation
- Manual rotation during maintenance windows
- Ensure zero-downtime key transitions

## Migration Guide

### Phase 1: Preparation
1. **Backup Current Database**
2. **Review Current JWT Usage**
3. **Plan Downtime Window**

### Phase 2: Environment Setup
1. **Update Environment Variables**
2. **Generate New Keys**
3. **Configure RSA Certificates (Production)**

### Phase 3: Deployment
1. **Deploy Code Changes**
2. **Monitor Authentication Logs**
3. **Gradual User Migration**

### Phase 4: Validation
1. **Test Token Generation**
2. **Verify Token Validation**
3. **Check Security Headers**

### Phase 5: Production Migration
1. **Update Load Balancers**
2. **Enable New Features**
3. **Monitor Performance**

## Best Practices

### 1. **Key Security**
- Use RSA (RS256+) for production environments
- Rotate keys regularly (90 days maximum)
- Store keys in secure systems (KMS, Vault)
- Never commit keys to version control

### 2. **Token Management**
- Use short-lived access tokens (1 hour max)
- Implement refresh token rotation
- Blacklist compromised tokens immediately
- Clean up expired tokens regularly

### 3. **Payload Security**
- Encrypt sensitive user data in JWT payload
- Include minimal required claims
- Use JWT ID (jti) for uniqueness
- Validate all required claims

### 4. **Monitoring & Auditing**
- Log JWT operations (exclude sensitive data)
- Monitor token usage patterns
- Alert on suspicious activities
- Regular security assessments

### 5. **Performance Optimization**
- Cache JWKs for public key access
- Use efficient blacklist storage
- Implement rate limiting
- Monitor response times

## Troubleshooting

### Common Issues

#### 1. **Token Validation Errors**
```log
Error: invalid signature
```
**Solution:**
- Verify JWT algorithm configuration matches token
- Check if keys have been rotated
- Confirm private/public key pairing

#### 2. **Key Rotation Issues**
```log
Error: JWK not found
```
**Solution:**
- Ensure JWKS endpoint is accessible
- Check cache invalidation
- Verify key rotation timing

#### 3. **Performance Problems**
**Symptoms:** Slow authentication, high memory usage
**Solution:**
- Increase cache sizes
- Optimize blacklist queries
- Review token cleanup intervals

#### 4. **Migration Errors**
```log
Error: Algorithm not supported
```
**Solution:**
- Update client configurations
- Ensure all services use compatible algorithms
- Phase rollout gradually

### Emergency Procedures

#### Immediate Token Blacklist
```bash
# Blacklist a specific token
curl -X POST /api/admin/jwt/blacklist \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"token": "compromised.jwt.token"}'
```

#### Emergency Key Rotation
```bash
# Force immediate key rotation
npm run jwt:emergency-rotate
```

### Support Contacts
- **Security Team**: security@smarthealthmanager.com
- **DevOps Team**: devops@smarthealthmanager.com
- **Emergency Hotline**: +1-800-SECURITY

---

## Maintenance Schedule
- **Weekly**: Review authentication logs
- **Monthly**: Key rotation verification
- **Quarterly**: Security assessment and penetration testing
- **Annually**: Complete key rotation and algorithm review

## Compliance Considerations
- **HIPAA**: Encrypt PHI data, audit all access
- **GDPR**: Data minimization, consent management
- **SOX**: Audit trail requirements
- **PCI DSS**: Token security requirements

---

*Document Version: 1.0 | Last Updated: 2024-11-24 | Author: Security Team*
