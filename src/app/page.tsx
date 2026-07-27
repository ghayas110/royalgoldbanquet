import Link from 'next/link';
import type { Metadata } from 'next';
import { getDefaultPeriod, getCalendarBookings, getHalls, getRules } from '@/lib/data';
import { fmtMoney, MONTHS, monthRange } from '@/lib/format';
import { BrandLockup } from '@/components/brand';
import { BRAND } from '@/lib/brand-info';
import { HeroSlider } from '@/components/hero-slider';
import { EnquiryForm, WhatsAppFloat } from '@/components/enquiry';
import { FadeUp, Card } from '@/components/ui';
import {
  Users, Sparkles, UtensilsCrossed, Car, Music, Snowflake, ArrowRight, MapPin, LogIn,
  Star, ShieldCheck, Flame, Wine, Coffee, Lightbulb, PartyPopper, CheckCircle2, Phone, Clock, Building2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Royal Gold Banquet — Wedding & Event Hall in Karachi | Marriage Hall',
  description:
    'Royal Gold Banquet is a premium wedding & event hall in Karachi for shaadi, valima, mehndi, nikkah and corporate events. Two air-conditioned halls up to 800 guests, in-house catering, décor, valet parking & generator backup. Book your date today.',
  keywords: [
    'banquet hall Karachi', 'wedding hall Karachi', 'marriage hall Karachi', 'shaadi hall',
    'valima hall', 'mehndi venue', 'event hall Karachi', 'wedding venue Pakistan', 'Royal Gold Banquet',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Royal Gold Banquet — Premium Wedding & Event Hall, Karachi',
    description: 'Two elegant air-conditioned halls up to 800 guests. In-house catering, décor, valet & generator backup. Book your celebration.',
    type: 'website',
    locale: 'en_PK',
  },
};

const SERVICES = [
  { icon: UtensilsCrossed, title: 'In-house Catering', body: 'Bespoke desi & continental menus prepared fresh by our kitchen — from wedding feasts to intimate dinners.' },
  { icon: Sparkles, title: 'Premium Décor & Staging', body: 'Themed stage, floral arrangements, drapery and centrepieces tailored to your event and colour palette.' },
  { icon: Users, title: 'Trained Waiters', body: 'Dedicated gents and ladies waiters ensure every guest is served with warmth and precision.' },
  { icon: Flame, title: 'Generator Backup', body: 'Uninterrupted power all evening with silent generator backup — never a moment in the dark.' },
  { icon: Car, title: 'Valet Parking', body: 'Ample, secure valet parking so your guests arrive and leave with ease and comfort.' },
  { icon: Wine, title: 'Cold Drinks & Beverages', body: 'Chilled soft drinks, mineral water and refreshment counters kept stocked throughout your function.' },
  { icon: Coffee, title: 'Tea Hall & Refreshments', body: 'A dedicated tea hall and refreshment service for mehndi, dholki and daytime gatherings.' },
  { icon: Music, title: 'Stage, Sound & Lighting', body: 'Professional sound system and ambient lighting to set the perfect mood for your celebration.' },
  { icon: Snowflake, title: 'Fully Air-Conditioned', body: 'Both halls are fully air-conditioned for year-round comfort, whatever the Karachi weather.' },
];

const WHY = [
  { icon: ShieldCheck, title: 'Transparent pricing', body: 'A clear hall charge plus only the services you choose — no hidden extras. You decide what you need.' },
  { icon: Star, title: '500+ celebrations hosted', body: 'A decade of weddings, valimas and events — trusted by families across Karachi.' },
  { icon: Clock, title: 'On-time, every time', body: 'Meticulous coordination so your event starts and flows exactly as planned.' },
  { icon: PartyPopper, title: 'Truly full-service', body: 'From the first enquiry to the last guest, one team handles catering, décor and logistics.' },
];

const FAQS = [
  { q: 'What is the guest capacity of Royal Gold Banquet?', a: 'We have two halls — the Grand Hall seats up to 800 guests and the Crystal Hall up to 400 guests, making us suitable for both large weddings and intimate functions.' },
  { q: 'Do I have to take your catering and services?', a: 'The hall charge is separate. Banquet services such as catering, décor, waiters and cold drinks are entirely optional — you choose exactly what you need for your event.' },
  { q: 'How do I confirm a booking?', a: 'A minimum 40% advance of the hall charge confirms and holds your date. The balance is settled on or before the event day. You can enquire via the form below or on WhatsApp.' },
  { q: 'What events do you host?', a: 'Weddings (barat, valima), mehndi, nikkah, engagements, aqiqah, birthdays and corporate events — for lunch or dinner shifts.' },
  { q: 'Is parking available?', a: 'Yes — we provide ample, secure valet parking for all guests.' },
];

export default async function Landing() {
  const { year, month } = await getDefaultPeriod();
  const [booked, halls, rules] = await Promise.all([
    getCalendarBookings(year, month, true),
    getHalls(),
    getRules(true),
  ]);
  const { days } = monthRange(year, month);
  const bookedSet = new Set(booked.map((b: any) => `${Number(String(b.event_date).slice(8, 10))}|${b.shift}`));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EventVenue',
    name: 'Royal Gold Banquet',
    description: 'Premium wedding & event banquet hall in Karachi with two air-conditioned halls, in-house catering, décor and valet parking.',
    address: { '@type': 'PostalAddress', streetAddress: BRAND.address, addressLocality: 'Karachi', addressCountry: 'PK' },
    telephone: '+92-315-9008065',
    sameAs: [BRAND.facebookUrl],
    maximumAttendeeCapacity: 800,
    amenityFeature: SERVICES.map((s) => ({ '@type': 'LocationFeatureSpecification', name: s.title })),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ══ HERO — banquet photo slider ══ */}
      <section className="relative isolate flex min-h-[90vh] flex-col overflow-hidden text-ivory" style={{ backgroundColor: '#0B0B0D' }}>
        <HeroSlider />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
          <BrandLockup />
          <div className="flex items-center gap-2">
            <a href="#enquire" className="hidden rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink ring-1 ring-inset ring-white/15 transition-colors hover:bg-gold-light sm:inline-flex">Book now</a>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-[rgba(240,214,123,0.35)] px-4 py-2 text-sm text-ivory transition-colors hover:bg-[rgba(240,214,123,0.1)]">
              <LogIn className="h-4 w-4" /> Staff portal
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-16 text-center">
          <FadeUp>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[rgba(240,214,123,0.3)] bg-[rgba(240,214,123,0.08)] px-4 py-1.5 text-xs text-gold-light">
              <MapPin className="h-3.5 w-3.5" /> Karachi · Premium Wedding & Event Hall
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-7xl">
              Where every celebration<br /><span className="text-gold-gradient">turns golden</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-ivory/75">
              An elegant banquet for weddings, valimas, mehndi and grand events. Two air-conditioned halls, in-house
              catering, timeless décor and impeccable service — a night your guests will remember.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a href="#enquire" className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 font-semibold text-ink ring-1 ring-inset ring-white/20 transition-colors hover:bg-gold-light">
                Book your date <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#services" className="inline-flex items-center gap-2 rounded-full border border-[rgba(240,214,123,0.4)] px-7 py-3.5 text-ivory transition-colors hover:bg-[rgba(240,214,123,0.1)]">
                Explore services
              </a>
            </div>
          </FadeUp>

          {/* Stats */}
          <FadeUp delay={0.1}>
            <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4">
              {[['800', 'Guest capacity'], ['2', 'Elegant halls'], ['500+', 'Events hosted']].map(([n, l]) => (
                <div key={l} className="rounded-2xl border border-[rgba(240,214,123,0.18)] bg-[rgba(255,255,255,0.03)] px-4 py-5">
                  <div className="font-display text-3xl text-gold-light">{n}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-ivory/55">{l}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══ SERVICES ══ */}
      <section id="services" className="relative mx-auto max-w-7xl px-6 py-20">
        <FadeUp>
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">What we offer</div>
            <h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Banquet services, done right</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[rgb(var(--text-muted))]">Everything your event needs under one roof — and you only pay for what you choose.</p>
          </div>
        </FadeUp>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <FadeUp key={s.title} delay={0.04 * i}>
              <Card className="h-full p-6 transition-transform hover:-translate-y-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--gold)/0.14)] text-gold ring-1 ring-inset ring-[rgb(var(--gold)/0.3)]"><s.icon className="h-6 w-6" /></div>
                <h3 className="mt-4 font-display text-lg text-[rgb(var(--text))]">{s.title}</h3>
                <p className="mt-1.5 text-sm text-[rgb(var(--text-muted))]">{s.body}</p>
              </Card>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ══ HALLS ══ */}
      <section id="halls" className="relative bg-[rgb(var(--surface)/0.5)] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Our venues</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Two elegant halls</h2></div></FadeUp>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {halls.map((h: any, i: number) => (
              <FadeUp key={h.id} delay={0.06 * i}>
                <Card className="overflow-hidden">
                  <div className="relative flex h-44 items-center justify-center" style={{ background: 'linear-gradient(135deg, #14110A, #2a2210 55%, #14110A)' }}>
                    <div aria-hidden className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(60% 80% at 50% 0%, rgba(240,214,123,0.5), transparent 60%)' }} />
                    <Building2 className="relative h-14 w-14 text-gold-light/70" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-2xl text-[rgb(var(--text))]">{h.name}</h3>
                      <span className="tnum text-sm text-gold">{fmtMoney(Number(h.base_charge))}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-[rgb(var(--text-dim))]"><Users className="h-4 w-4" /> up to {h.capacity} guests</div>
                    <p className="mt-3 text-sm text-[rgb(var(--text-muted))]">{h.description}</p>
                    <a href="#enquire" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline">Enquire about {h.name} <ArrowRight className="h-4 w-4" /></a>
                  </div>
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHY CHOOSE US ══ */}
      <section className="relative mx-auto max-w-7xl px-6 py-20">
        <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Why Royal Gold</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">The details make the difference</h2></div></FadeUp>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w, i) => (
            <FadeUp key={w.title} delay={0.05 * i}>
              <Card className="h-full p-6">
                <w.icon className="h-7 w-7 text-gold" />
                <h3 className="mt-4 font-display text-lg text-[rgb(var(--text))]">{w.title}</h3>
                <p className="mt-1.5 text-sm text-[rgb(var(--text-muted))]">{w.body}</p>
              </Card>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section className="relative bg-[rgb(var(--surface)/0.5)] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Kind words</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Loved by families across Karachi</h2></div></FadeUp>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { n: 'Ayesha & Bilal', t: 'Our valima was flawless — the décor, the food, the service. Guests are still talking about it.' },
              { n: 'The Malik Family', t: 'Transparent pricing and a team that genuinely cared. The Grand Hall looked magical.' },
              { n: 'Hassan R.', t: 'Booked the Crystal Hall for our mehndi. Warm, elegant and perfectly managed from start to finish.' },
            ].map((r, i) => (
              <FadeUp key={r.n} delay={0.05 * i}>
                <Card className="h-full p-6">
                  <div className="flex gap-0.5 text-gold">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}</div>
                  <p className="mt-3 text-sm text-[rgb(var(--text-muted))]">&ldquo;{r.t}&rdquo;</p>
                  <div className="mt-4 text-sm font-medium text-[rgb(var(--text))]">{r.n}</div>
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ RULES / POLICIES ══ */}
      {rules.length > 0 && (
        <section className="relative mx-auto max-w-4xl px-6 py-20">
          <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Good to know</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Booking &amp; venue policies</h2></div></FadeUp>
          <FadeUp delay={0.05}>
            <Card className="mt-10 divide-y divide-[rgb(var(--border)/0.3)] p-2">
              {rules.map((r: any) => (
                <div key={r.id} className="flex items-start gap-3 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <div><div className="font-medium text-[rgb(var(--text))]">{r.title}</div><div className="text-sm text-[rgb(var(--text-muted))]">{r.body}</div></div>
                </div>
              ))}
            </Card>
          </FadeUp>
        </section>
      )}

      {/* ══ FAQ (SEO, native accordion) ══ */}
      <section className="relative bg-[rgb(var(--surface)/0.5)] py-20">
        <div className="mx-auto max-w-3xl px-6">
          <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">FAQ</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Questions, answered</h2></div></FadeUp>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl surface p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-[rgb(var(--text))]">
                  {f.q}
                  <span className="ml-4 text-gold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-[rgb(var(--text-muted))]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AVAILABILITY ══ */}
      <section id="availability" className="relative mx-auto max-w-4xl px-6 py-20">
        <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Live availability</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Check open dates</h2><p className="mt-2 text-sm text-[rgb(var(--text-dim))]">{MONTHS[month - 1]} {year} · gold marks a reserved evening</p></div></FadeUp>
        <FadeUp delay={0.05}>
          <Card className="mt-8 p-5">
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                const dinner = bookedSet.has(`${d}|DINNER`), lunch = bookedSet.has(`${d}|LUNCH`);
                const full = dinner && lunch;
                return (
                  <div key={d} className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm ${full ? 'border-[rgb(var(--gold)/0.5)] bg-[rgb(var(--gold)/0.18)] text-gold' : dinner || lunch ? 'border-[rgb(var(--gold)/0.3)] bg-[rgb(var(--gold)/0.08)] text-[rgb(var(--text-muted))]' : 'border-[rgb(var(--border)/0.4)] text-[rgb(var(--text-dim))]'}`}>
                    <span>{d}</span>{(dinner || lunch) && <span className="text-[8px] uppercase">{full ? 'full' : dinner ? 'eve' : 'day'}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </FadeUp>
      </section>

      {/* ══ ENQUIRY ══ */}
      <section id="enquire" className="relative mx-auto max-w-2xl px-6 py-20">
        <FadeUp><EnquiryForm /></FadeUp>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="relative border-t border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface)/0.5)] px-6 py-14">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandLockup />
            <p className="mt-4 max-w-sm text-sm text-[rgb(var(--text-muted))]">Royal Gold Banquet — a premium wedding and event hall in Karachi. Weddings, valimas, mehndi, nikkah and corporate functions, done beautifully.</p>
          </div>
          <div>
            <div className="text-sm font-semibold text-[rgb(var(--text))]">Contact</div>
            <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--text-muted))]">
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> {BRAND.address}</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-gold" /> <a href={`tel:+${BRAND.phoneIntl}`} className="hover:text-gold">{BRAND.phone}</a></li>
              <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-gold" /> Lunch & Dinner shifts</li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-[rgb(var(--text))]">Explore</div>
            <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--text-muted))]">
              <li><a href="#services" className="hover:text-gold">Services</a></li>
              <li><a href="#halls" className="hover:text-gold">Our halls</a></li>
              <li><a href="#enquire" className="hover:text-gold">Book now</a></li>
              <li><Link href="/login" className="hover:text-gold">Staff portal</Link></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-[rgb(var(--border)/0.3)] pt-6 text-center text-xs text-[rgb(var(--text-dim))]">© {year} Royal Gold Banquet · Karachi, Pakistan · All rights reserved</div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
