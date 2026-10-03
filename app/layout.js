import './globals.css';
import Nav from '@/components/nav';
import Chat from '@/components/chat';

export const metadata = {
  title: { default: 'ZagaPrime Ops Hub', template: '%s · ZagaPrime Ops Hub' },
  description: 'Accounts, projects, resources, domains and the daily tech & AI channel for everything ZagaPrime runs.',
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: '#040716' };

const themeInit = `try{var t=localStorage.getItem('opshub-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <Nav />
        <main className="wrap">{children}</main>
        <Chat />
      </body>
    </html>
  );
}
