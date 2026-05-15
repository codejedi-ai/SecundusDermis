import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ProgressiveImage from './ProgressiveImage'

describe('ProgressiveImage', () => {
  it('reveals full image after load (blur-up)', () => {
    render(
      <ProgressiveImage
        src="/images/test.jpg"
        alt="Test garment"
        data-testid="prog-wrap"
      />,
    )
    const full = screen.getByRole('img', { name: 'Test garment' })
    expect(full).not.toHaveClass('progressive-image__full--show')
    fireEvent.load(full)
    expect(full).toHaveClass('progressive-image__full--show')
    expect(full.closest('.progressive-image')).toHaveAttribute('data-loaded')
  })

  it('falls back when primary src fails', () => {
    render(
      <ProgressiveImage
        src="/broken.jpg"
        fallbackSrc="/img/placeholder.svg"
        alt="Fallback"
      />,
    )
    const full = screen.getByRole('img', { name: 'Fallback' })
    fireEvent.error(full)
    expect(full).toHaveAttribute('src', '/img/placeholder.svg')
  })
})
