import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Overnighter'
const BASE_URL = 'https://overnighter.net'
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`

interface SEOHeadProps {
  title: string
  description: string
  canonical?: string
  ogImage?: string
  noIndex?: boolean
}

export function SEOHead({ title, description, canonical, ogImage = DEFAULT_OG_IMAGE, noIndex }: SEOHeadProps) {
  const fullTitle = `${title} | ${SITE_NAME}`
  const url = canonical ? `${BASE_URL}${canonical}` : undefined

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      {url && <meta property="og:url" content={url} />}

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  )
}
