// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '../src/pages/LandingPage';
import { PLAYER_CUSTOMIZATION_STORAGE_KEY } from '../src/lib/playerCustomization';

const createLandingPage = () => (
  <LandingPage
    onHostGame={vi.fn()}
    onJoinGame={vi.fn()}
    onClearError={vi.fn()}
  />
);

describe('LandingPage customization persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('restores the nickname and wizard after LandingPage remounts', async () => {
    const user = userEvent.setup();
    const firstRender = render(createLandingPage());

    const nameInput = screen.getByLabelText('Wizard Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'merlin');
    await user.click(screen.getByRole('button', { name: 'Change Wizard' }));
    await user.click(screen.getByRole('button', { name: /Red Rhyme/ }));

    expect(JSON.parse(localStorage.getItem(PLAYER_CUSTOMIZATION_STORAGE_KEY) ?? '{}')).toEqual({
      nickname: 'MERLIN',
      wizardId: 'crimson-aegis',
    });

    firstRender.unmount();
    render(createLandingPage());

    expect((screen.getByLabelText('Wizard Name') as HTMLInputElement).value).toBe('MERLIN');
    expect(screen.getByText('Red Rhyme')).toBeTruthy();
  });
});
