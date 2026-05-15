import {
  useCallback,
  useEffect,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react'

export type ProgressiveImageFit = 'cover' | 'contain' | 'fill'

export interface ProgressiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onLoad' | 'onError'> {
  src: string
  fallbackSrc?: string
  fit?: ProgressiveImageFit
  wrapperClassName?: string
  onError?: ImgHTMLAttributes<HTMLImageElement>['onError']
}

/**
 * Blur-up progressive loader: a blurred low-res decode layer crossfades into the sharp image.
 */
export default function ProgressiveImage({
  src,
  alt = '',
  fallbackSrc,
  fit = 'cover',
  wrapperClassName = '',
  className = '',
  loading = 'lazy',
  onError,
  ...rest
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [activeSrc, setActiveSrc] = useState(src)

  useEffect(() => {
    setLoaded(false)
    setActiveSrc(src)
  }, [src])

  const handleLoad = useCallback(() => {
    setLoaded(true)
  }, [])

  const handleError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      if (fallbackSrc && activeSrc !== fallbackSrc) {
        setLoaded(false)
        setActiveSrc(fallbackSrc)
        return
      }
      onError?.(e)
    },
    [activeSrc, fallbackSrc, onError],
  )

  if (!activeSrc) return null

  const wrapperClasses = [
    'progressive-image',
    `progressive-image--${fit}`,
    wrapperClassName,
  ]
    .filter(Boolean)
    .join(' ')

  const fullClasses = ['progressive-image__full', loaded ? 'progressive-image__full--show' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={wrapperClasses} data-loaded={loaded || undefined}>
      {!loaded && <span className="progressive-image__shimmer" aria-hidden />}
      <img
        src={activeSrc}
        alt=""
        aria-hidden
        className={`progressive-image__blur ${loaded ? 'progressive-image__blur--hide' : ''}`}
        decoding="async"
        draggable={false}
      />
      <img
        {...rest}
        src={activeSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        className={fullClasses}
        onLoad={handleLoad}
        onError={handleError}
      />
    </span>
  )
}
