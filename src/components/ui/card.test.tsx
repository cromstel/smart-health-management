import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

describe('Card Component', () => {
  it('should render the card with the correct classNames', () => {
    render(<Card className="test-class">Test Card</Card>);
    const cardElement = screen.getByTestId('card');
    expect(cardElement).toHaveClass('test-class');
  });

  it('should render the card header with the correct classNames', () => {
    render(<CardHeader className="test-class" data-testid="card-header">Test Header</CardHeader>);
    const cardHeaderElement = screen.getByTestId('card-header');
    expect(cardHeaderElement).toHaveClass('test-class');
  });

  it('should render the card title with the correct classNames', () => {
    render(<CardTitle className="test-class">Test Title</CardTitle>);
    const cardTitleElement = screen.getByText('Test Title');
    expect(cardTitleElement).toHaveClass('test-class');
  });

  it('should render the card description with the correct classNames', () => {
    render(<CardDescription className="test-class">Test Description</CardDescription>);
    const cardDescriptionElement = screen.getByText('Test Description');
    expect(cardDescriptionElement).toHaveClass('test-class');
  });

  it('should render the card content with the correct classNames', () => {
    render(<CardContent className="test-class">Test Content</CardContent>);
    const cardContentElement = screen.getByText('Test Content');
    expect(cardContentElement).toHaveClass('test-class');
  });

  it('should render the card footer with the correct classNames', () => {
    render(<CardFooter className="test-class" data-testid="card-footer">Test Footer</CardFooter>);
    const cardFooterElement = screen.getByTestId('card-footer');
    expect(cardFooterElement).toHaveClass('test-class');
  });
});