import './print.css';
import { Noto_Nastaliq_Urdu } from 'next/font/google';

// The booking rules are written in Urdu, which needs a Nastaliq face — the
// default sans renders Urdu in a disconnected, hard-to-read fallback.
const urdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '600'],
  variable: '--font-urdu',
  display: 'swap',
});

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className={urdu.variable}>{children}</div>;
}
