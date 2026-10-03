import './globals.css';
import Nav from '@/components/nav';

export const metadata = {
  title: 'ZagaPrime Ops Hub',
  description: 'Accounts, projects, resources and stack news for everything ZagaPrime runs.',
  robots: { index: false, follow: false },
};

const themeInit = `try{var t=localStorage.getItem('opshub-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <Nav />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
