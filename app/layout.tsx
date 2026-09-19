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
      <body className="antialiased m-0 p-0 overflow-hidden">{children}</body>
    </html>
  );
}
