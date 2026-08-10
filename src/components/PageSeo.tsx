import { Helmet } from 'react-helmet-async';

interface Props {
  title: string;
  description: string;
  path: string; // e.g. /login
  noindex?: boolean;
}

const SITE = 'https://www.viasetu.com';

export default function PageSeo({ title, description, path, noindex }: Props) {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? 'noindex,nofollow' : 'index,follow'} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
