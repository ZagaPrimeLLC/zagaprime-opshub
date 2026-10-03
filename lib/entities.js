// Whitelist for the generic CRUD API: table -> primary key + editable columns.
export const ENTITIES = {
  providers: { pk: 'slug', cols: ['slug', 'name', 'category', 'console_url', 'notes'], order: 'name' },
  accounts: {
    pk: 'slug',
    cols: ['slug', 'provider_slug', 'label', 'login_hint', 'console_url', 'bitwarden_url', 'status', 'notes'],
    order: 'label',
  },
  projects: {
    pk: 'slug',
    cols: ['slug', 'name', 'client', 'status', 'prod_url', 'repo_url', 'notes'],
    order: 'name',
  },
  resources: {
    pk: 'id',
    serialPk: true,
    cols: ['kind', 'name', 'external_ref', 'url', 'environment', 'account_slug', 'project_slug', 'notes'],
    order: 'name',
  },
  domains: {
    pk: 'domain',
    cols: [
      'domain', 'registrar_account', 'dns_account', 'project_slug', 'notes',
      'description', 'built_with', 'status',
      'score_security', 'score_compliance', 'score_seo', 'score_performance', 'score_risk',
      'improvements', 'scores_assessed_at',
    ],
    order: 'domain',
  },
  subscriptions: {
    pk: 'id',
    serialPk: true,
    cols: ['account_slug', 'name', 'monthly_cost', 'billing_cycle', 'renews_on', 'notes'],
    order: 'name',
  },
  feed_sources: {
    pk: 'id',
    serialPk: true,
    cols: ['name', 'url', 'kind', 'category', 'enabled', 'notes'],
    order: 'category, name',
  },
  kb: { pk: 'key', cols: ['key', 'content'], order: 'key' },
  stack_news: {
    pk: 'id',
    serialPk: true,
    cols: ['provider_slug', 'title', 'url', 'summary', 'criticality', 'category', 'effort', 'action', 'affected_projects', 'published_at', 'status'],
    order: null,
  },
};

export const SCHEMA = 'proj_opsdash';
