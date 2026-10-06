import { getFeed, getSources, openAlerts } from '@/lib/feeds';
import SetupNotice from '@/components/setup';
import ChannelView from '@/components/channel-view';
import Ticker from '@/components/ticker';

export const dynamic = 'force-dynamic';

export default async function ChannelPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let feed, sources, alerts;
  try {
    [feed, sources, alerts] = await Promise.all([getFeed(), getSources({ all: true }), openAlerts()]);
  } catch (e) {
    return (<><h1 className="pagetitle">Channel</h1><SetupNotice error={e.message} /></>);
  }
  return (
    <>
      <Ticker />
      <ChannelView feed={feed} sources={sources} alerts={alerts} params={{ tab: sp.tab || 'all', play: sp.play || null }} />
    </>
  );
}
