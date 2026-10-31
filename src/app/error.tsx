'use client';
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main id="main" className="error-page"><p className="eyebrow">A brief interruption</p><h1>We couldn’t open this space.</h1><p className="muted">The service may be unavailable or this environment may need configuration. Please try again shortly.</p><button className="primary" onClick={retry}>Try again</button></main>;
}
