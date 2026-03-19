import './globals.css';

export const metadata = {
  title: 'Golden Cut – Online Termine',
  description: 'Online Terminbuchung für Golden Cut in Neustadt an der Waldnaab.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
