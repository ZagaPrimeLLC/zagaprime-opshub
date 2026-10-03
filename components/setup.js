export default function SetupNotice({ error }) {
  return (
    <div className="setup">
      <h2>Database not connected yet</h2>
      <p className="muted" style={{ fontSize: 13.5 }}>{error}</p>
      <ol>
        <li>Create the scoped <span className="mono">opsdash_app</span> role on the shared Supabase host (ask Claude to run it, or run the saved SQL in the Supabase SQL editor).</li>
        <li>Set <span className="mono">SUPABASE_DB_URL</span> on the Vercel project to the pooler connection string for that role.</li>
        <li>Redeploy — <span className="mono">/api/health</span> turns green and every page goes live.</li>
      </ol>
    </div>
  );
}
