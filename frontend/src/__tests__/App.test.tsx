import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  it('renders Gemini Desk title', () => {
    render(<App />);
    const titleElement = screen.getByText('Gemini Desk');
    expect(titleElement).toBeInTheDocument();
  });

  it('renders session sync button', () => {
    render(<App />);
    const syncButton = screen.getByText('Sync Sessions');
    expect(syncButton).toBeInTheDocument();
  });
});
