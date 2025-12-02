import type { Request, Response, NextFunction } from 'express';
import { validationResult, type ValidationError } from 'express-validator';

/**
 * Enhanced validation middleware with better error formatting
 * Formats validation errors for consistent API responses
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Format errors for better client-side handling
    const formattedErrors = errors.array().map((error: ValidationError) => {
      // Handle both field-based and non-field errors
      if ('path' in error && error.path) {
        return {
          field: error.path,
          message: error.msg,
          value: 'value' in error ? error.value : undefined,
        };
      }
      return {
        message: error.msg,
        type: error.type || 'validation_error',
      };
    });

    // Log validation errors in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Validation errors:', {
        path: req.path,
        method: req.method,
        errors: formattedErrors,
      });
    }

    res.status(400).json({ 
      error: 'Validation failed',
      errors: formattedErrors,
    });
    return;
  }
  
  next();
};

/**
 * Sanitize string input to prevent XSS attacks
 * Removes potentially dangerous characters and trims whitespace
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

/**
 * Validate and sanitize email address
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') {
    return '';
  }
  
  return email.trim().toLowerCase();
};

/**
 * Validate and sanitize numeric ID
 */
export const sanitizeId = (id: string | number): number | null => {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  
  if (isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
    return null;
  }
  
  return numId;
};