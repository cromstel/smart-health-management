import React from 'react';
import logoImage from '@/assets/images/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'default' | 'circle' | 'square' | 'rounded';
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'default',
  alt = 'Smart Health Manager Logo'
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20'
  };

  const variantClasses = {
    default: '',
    circle: 'rounded-full',
    square: 'rounded-lg',
    rounded: 'rounded-md'
  };

  const baseClasses = `${sizeClasses[size]} ${variantClasses[variant]} ${className} object-contain block`;

  return (
    <img
      src={logoImage}
      alt={alt}
      className={baseClasses}
    />
  );
};
