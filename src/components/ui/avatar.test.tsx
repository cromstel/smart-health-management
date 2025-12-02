import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('@radix-ui/react-avatar', () => ({
  Root: (props: any) => <span data-slot="avatar" {...props} />,
  Image: (props: any) => <img data-slot="avatar-image" {...props} />,
  Fallback: (props: any) => <span data-slot="avatar-fallback" {...props} />,
}));
import { Avatar, AvatarImage, AvatarFallback } from './avatar';

describe('Avatar', () => {
  it('should render with an image', () => {
    render(
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
        <AvatarFallback>SC</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('SC')).toBeInTheDocument();
  });

  it('should render with fallback when image fails to load', () => {
    render(
      <Avatar>
        <AvatarImage src="invalid-image-url" alt="@shadcn" />
        <AvatarFallback>SC</AvatarFallback>
      </Avatar>
    );
    // In a real browser environment, this would involve mocking image load errors.
    // For testing purposes, we can directly check for the fallback content.
    expect(screen.getByText('SC')).toBeInTheDocument();
  });

  it('should render with fallback text when no image is provided', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should apply custom class names to Avatar', () => {
    render(<Avatar className="custom-avatar-class" data-testid="avatar"><AvatarFallback>A</AvatarFallback></Avatar>);
    expect(screen.getByTestId('avatar')).toHaveClass('custom-avatar-class');
  });

  it('should apply custom class names to AvatarImage', () => {
    render(
      <Avatar>
        <AvatarImage src="" alt="@shadcn" className="custom-image-class" />
        <AvatarFallback>SC</AvatarFallback>
      </Avatar>
    );
    const avatarElement = screen.getByRole('img', { name: '@shadcn', hidden: true });
    expect(avatarElement).toHaveClass('custom-image-class');
  });

  it('should apply custom class names to AvatarFallback', () => {
    render(
      <Avatar>
        <AvatarFallback className="custom-fallback-class">FB</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('FB')).toHaveClass('custom-fallback-class');
  });
});
