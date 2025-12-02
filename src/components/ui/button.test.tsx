import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button Component', () => {
  it('should render the button with the correct text', () => {
    render(<Button>Test Button</Button>);
    const buttonElement = screen.getByText(/Test Button/i);
    expect(buttonElement).toBeInTheDocument();
  });

  it('should render the button with the primary variant by default', () => {
    render(<Button>Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('bg-primary');
  });

  it('should render the button with the secondary variant', () => {
    render(<Button variant="secondary">Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('bg-secondary');
  });

  it('should render the button with the outline variant', () => {
    render(<Button variant="outline">Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('border');
  });

  it('should render the button with the link variant', () => {
    render(<Button variant="link">Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('text-primary');
    expect(buttonElement).toHaveClass('hover:underline');
  });

  it('should render the button with the large size', () => {
    render(<Button size="lg">Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('h-10');
  });

  it('should render the button with the small size', () => {
    render(<Button size="sm">Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('h-8');
  });

  it('should render the button with the icon size', () => {
    render(<Button size="icon">Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('size-9');
  });

  it('should render the button with the default classNames', () => {
    render(<Button className="test-class">Test Button</Button>);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement).toHaveClass('test-class');
  });
});