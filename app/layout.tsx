import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Isha Sahayata · Isha Yoga Center',
  description: 'Shared yellow cycles across the Isha Yoga Center campus',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://static.sadhguru.org" crossOrigin="anonymous" />
        {/* Brand display face only — UI chrome uses system / SF Pro stack */}
        <link
          rel="stylesheet"
          href="https://static.sadhguru.org/assets/fonts/mukta-fonts.css?family=FedraSerifAStdBook"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Trirong:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* No overflow-hidden here. The rider app is a fixed phone frame that
          must not scroll, and used to lock the body globally to get that — but
          the staff console is an ordinary scrolling document behind the same
          layout, so the lock left it unable to reach its own content with a
          wheel or trackpad. The rider page opts into the lock itself via
          .yc-phone-stage; see globals.css. */}
      <body className="antialiased m-0 p-0">{children}</body>
    </html>
  );
}
