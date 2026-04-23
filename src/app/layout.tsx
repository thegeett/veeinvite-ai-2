// Root layout. Stream A may extend — keep it minimal.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeeInvite",
  description: "AI-native wedding invitation websites — under 2 minutes."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
