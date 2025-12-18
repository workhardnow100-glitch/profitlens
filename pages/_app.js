import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import CookieBanner from '../components/CookieBanner'; // ✅ Add this import

export default function App({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session}>
      <CookieBanner />   {/* ✅ Global cookie banner */}
      <Component {...pageProps} />
    </SessionProvider>
  );
}
