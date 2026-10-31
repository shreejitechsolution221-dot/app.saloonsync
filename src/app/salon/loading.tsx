export default function SalonLoading() {
  return (
    <div className="studio-loading page-loading" aria-busy="true">
      <div className="navigation-progress" aria-hidden="true"/>
      <div className="page-loading-label" role="status"><span className="ui-spinner" aria-hidden="true"/>Loading your workspace…</div>
      <div className="loading-heading loading-pulse" aria-hidden="true"/>
      <div className="loading-cards" aria-hidden="true">{[0,1,2,3].map(n=><div className="loading-card" key={n}><div className="loading-pulse"/><div className="loading-pulse"/></div>)}</div>
      <div className="loading-panel" aria-hidden="true">{[0,1,2,3].map(n=><div className="loading-pulse" key={n}/>)}</div>
    </div>
  );
}

