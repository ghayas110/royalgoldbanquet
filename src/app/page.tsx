import Link from 'next/link';
import type { Metadata } from 'next';
import { getHalls, getRules, getPublishedReviews, getBrand } from '@/lib/data';
import { fmtMoney, fmtDate, MONTHS, monthRange } from '@/lib/format';
import { BrandLockup } from '@/components/brand';
import { facebookUrl, instagramUrl } from '@/lib/brand-info';
import { HeroSlider } from '@/components/hero-slider';
import { GalleryRail } from '@/components/gallery-rail';
import { EnquiryForm, WhatsAppFloat } from '@/components/enquiry';
import { FadeUp, Card } from '@/components/ui';
import {
  Users, Sparkles, UtensilsCrossed, Utensils, Car, Music, Snowflake, ArrowRight, MapPin, LogIn,
  Star, ShieldCheck, Flame, Wine, Coffee, Lightbulb, PartyPopper, CheckCircle2, Phone, Clock, Building2,
  ChefHat,
} from 'lucide-react';

/** What the Catering Service includes — marketing copy for the section below. */
const LIVE_COOKING_POINTS = [
  'Full catering setup on your floor, serving through the event',
  'Chefs, waiters and counter attendants included',
  'Buffet setup, live counters and elegant table presentation',
  'Menu agreed with you beforehand, priced per guest',
];

/** Title and social preview follow Settings → Business Profile. */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: brand.siteName,
    description:
      'Skylight Ballroom & Catering Service is a premium wedding & event venue and caterer in Karachi for shaadi, valima, mehndi, nikkah and corporate events. Air-conditioned ballrooms, full catering, a live cooking stall, premium décor, valet parking & generator backup. Book your date today.',
    keywords: [
      'ballroom Karachi', 'banquet hall Karachi', 'wedding hall Karachi', 'marriage hall Karachi',
      'shaadi hall', 'valima hall', 'mehndi venue', 'event hall Karachi', 'wedding venue Pakistan',
      'live cooking Karachi', 'live cooking stall', 'live counter catering',
      'catering service Karachi', 'wedding caterers Karachi', 'shaadi catering',
      'Skylight Ballroom', 'Skylight Ballroom & Catering Service',
    ],
    alternates: { canonical: '/' },
    openGraph: {
      title: 'Skylight Ballroom & Catering Service — Wedding Venue & Caterers, Karachi',
      description: 'Elegant air-conditioned ballrooms, full catering, a live cooking stall, premium décor, valet & generator backup. Book your celebration.',
      type: 'website',
      locale: 'en_PK',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Skylight Ballroom & Catering Service — Wedding Venue & Caterers, Karachi',
      description: 'Air-conditioned ballrooms, full catering, live cooking and full-service event styling in Karachi.',
    },
  };
}

const SERVICES = [
  // { icon: ChefHat, title: 'Live Cooking Stall', body: 'A manned live-cooking counter on your floor, cooking in front of your guests. Priced per guest, chefs and setup included.' },
  { icon: Building2, title: 'Full Venue Setup & Logistics', body: 'Complete venue arrangement, staging, seating layout and event coordination for a seamless celebration.' },
  { icon: Sparkles, title: 'Premium Décor & Staging', body: 'Themed stage, floral arrangements, drapery and centrepieces tailored to your event and colour palette.' },
  { icon: Users, title: 'Trained Waiters', body: 'Dedicated gents and ladies waiters ensure every guest is served with warmth and precision.' },
  { icon: Flame, title: 'Generator Backup', body: 'Uninterrupted power all evening with silent generator backup — never a moment in the dark.' },
  { icon: Car, title: 'Valet Parking', body: 'Ample, secure valet parking so your guests arrive and leave with ease and comfort.' },
  { icon: Wine, title: 'Cold Drinks & Beverages', body: 'Chilled soft drinks, mineral water and refreshment counters kept stocked throughout your function.' },
  { icon: Coffee, title: 'Tea Hall & Refreshments', body: 'A dedicated tea hall and refreshment service for mehndi, dholki and daytime gatherings.' },
  { icon: Music, title: 'Stage, Sound & Lighting', body: 'Professional sound system and ambient lighting to set the perfect mood for your celebration.' },
  { icon: Snowflake, title: 'Fully Air-Conditioned', body: 'All halls are fully air-conditioned for year-round comfort, whatever the Karachi weather.' },
];

const WHY = [
  { icon: ShieldCheck, title: 'Transparent pricing', body: 'A clear hall charge plus only the services you choose — no hidden extras. You decide what you need.' },
  { icon: Star, title: '500+ celebrations hosted', body: 'A decade of weddings, valimas and events — trusted by families across Karachi.' },
  { icon: Clock, title: 'On-time, every time', body: 'Meticulous coordination so your event starts and flows exactly as planned.' },
  { icon: PartyPopper, title: 'Truly full-service', body: 'From the first enquiry to the last guest, one team handles venue setup, décor and logistics.' },
];

/**
 * Rendered per request, never prerendered.
 *
 * Without this Next bakes this page to static HTML at build time, so the halls,
 * policies and guest reviews on the live site were frozen at whatever was in
 * the database on the BUILD machine — new comments cards never appeared.
 */
export const dynamic = 'force-dynamic';

export default async function Landing() {
  const [halls, rules, reviews, BRAND] = await Promise.all([
    getHalls(),
    getRules(true),
    getPublishedReviews(9),
    getBrand(),
  ]);

  const hallCount = halls.length;
  const maxCapacity = halls.reduce((m: number, h: any) => Math.max(m, Number(h.capacity || 0)), 0);

  const faqs = [
    {
      q: 'What is the guest capacity of Skylight Ballroom & Catering Service?',
      a: halls.length > 0
        ? `We feature ${halls.map((h: any) => `${h.name} (up to ${h.capacity} guests)`).join(' and ')}, making us suitable for both large celebrations and intimate functions.`
        : 'Our banquet hall accommodates up to 800 guests, suitable for both large celebrations and intimate functions.',
    },
    { q: 'Do I have to take all your extra services?', a: 'The hall charge is separate. Services such as décor, waiters, generator, cold drinks and the Live Cooking Stall are entirely optional — you choose exactly what you need for your event.' },
    { q: 'What is the Live Cooking Stall?', a: 'Live Cooking is an optional service: a manned counter set up on your floor that cooks in front of your guests through the event. It is quoted per guest and includes the chef, counter attendants and the stall setup, with the menu agreed with you beforehand. Add it to your booking like any other service — it appears as its own line on your slip.' },
    { q: 'How do I confirm a booking?', a: 'A minimum 40% advance of the hall charge confirms and holds your date. The balance is settled on or before the event day. You can enquire via the form below or on WhatsApp.' },
    { q: 'What events do you host?', a: 'Weddings (barat, valima), mehndi, nikkah, engagements, aqiqah, birthdays and corporate events — for lunch or dinner shifts.' },
    { q: 'Is parking available?', a: 'Yes — we provide ample, secure valet parking for all guests.' },
  ];

  /**
   * Only real comments cards the owner has published.
   *
   * There is deliberately no placeholder set behind this. Invented
   * testimonials on a venue's own site are a claim about customers who do not
   * exist, and a visitor who recognises them as stock copy trusts the rest of
   * the page less. With nothing published the section does not render at all,
   * which is honest and reads as a site that is simply new.
   */
  const testimonials = reviews.map((r) => ({
    key: `r${r.id}`,
    name: r.guestName || 'A Skylight guest',
    text: r.comments ?? '',
    stars: Math.round(r.stars ?? 5),
    when: r.eventDate ? fmtDate(r.eventDate) : '',
  }));

  const ratedCount = reviews.filter((r) => r.stars !== null).length;
  const avgRating = ratedCount > 0
    ? Math.round((reviews.reduce((s, r) => s + (r.stars ?? 0), 0) / ratedCount) * 10) / 10
    : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EventVenue',
    name: 'Skylight Ballroom & Catering Service',
    description: `Premium wedding & event ballroom in Karachi with ${hallCount === 1 ? 'an air-conditioned hall' : `${hallCount} air-conditioned halls`}, a live cooking stall, premium décor and valet parking.`,
    address: { '@type': 'PostalAddress', streetAddress: BRAND.address, addressLocality: BRAND.city, addressCountry: 'PK' },
    telephone: '+92-315-9008065',
    sameAs: [facebookUrl(BRAND), ...(BRAND.instagram ? [instagramUrl(BRAND)] : [])],
    maximumAttendeeCapacity: maxCapacity || 800,
    amenityFeature: SERVICES.map((s) => ({ '@type': 'LocationFeatureSpecification', name: s.title })),
    // The Live Cooking service, so it can surface as an offering in search.
    makesOffer: [{
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Live Cooking Stall',
        description: 'A manned live-cooking counter set up at your event, cooking in front of guests. Quoted per guest, chefs and stall setup included.',
      },
    }],
    ...(avgRating !== null && ratedCount > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avgRating, reviewCount: ratedCount, bestRating: 5, worstRating: 1 } }
      : {}),
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
              <MapPin className="h-3.5 w-3.5" /> Karachi · Wedding Venue &amp; Caterers
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-7xl">
              Where every celebration<br /><span className="text-gold-gradient">turns golden</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-ivory/75">
              An elegant ballroom and full catering service for weddings, valimas, mehndi and grand
              events. {hallCount === 1 ? 'Air-conditioned luxury hall' : `${hallCount} air-conditioned halls`},
              timeless décor, full venue setup and impeccable service — a night your guests will remember.
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
              {[[`${maxCapacity || 800}`, 'Guest capacity'], [`${hallCount}`, hallCount === 1 ? 'Elegant hall' : 'Elegant halls'], ['500+', 'Events hosted']].map(([n, l]) => (
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
            <h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Ballroom services, done right</h2>
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

      {/* ══ FILMS ══ */}
      <GalleryRail />

      {/* ══ CATERING SERVICE ══ */}
      <section id="live-cooking" className="relative bg-[rgb(var(--surface)/0.5)] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <FadeUp>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Catering Service</div>
              <h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">
                Cooked in front of your guests
              </h2>
              <p className="mt-4 text-[rgb(var(--text-muted))]">
                Our Catering Service brings master chefs and delicious cuisine directly to your floor — freshly
                prepared and served to order all evening. It is an optional service you can add to any booking,
                quoted per guest, with the menu agreed with you beforehand.
              </p>
              <ul className="mt-6 space-y-3">
                {LIVE_COOKING_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-[rgb(var(--text-muted))]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {point}
                  </li>
                ))}
              </ul>
              <a href="#enquire" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-medium text-[rgb(var(--bg))] transition hover:brightness-110">
                Ask about Catering Service <ArrowRight className="h-4 w-4" />
              </a>
            </FadeUp>

            <FadeUp delay={0.1}>
              <Card className="relative overflow-hidden p-8">
                <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-[rgb(var(--gold)/0.10)] blur-3xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgb(var(--gold)/0.14)] text-gold ring-1 ring-inset ring-[rgb(var(--gold)/0.3)]">
                  <ChefHat className="h-8 w-8" />
                </div>
                <h3 className="relative mt-6 font-display text-2xl text-[rgb(var(--text))]">Catering Service</h3>
                <p className="relative mt-2 text-sm text-[rgb(var(--text-muted))]">
                  Added to your booking like any other service — you pay for it only if you want it, and it
                  appears as its own line on your booking slip so you can see exactly what it costs.
                </p>
                <div className="relative mt-6 flex items-center gap-2 text-sm text-[rgb(var(--text-dim))]">
                  <Utensils className="h-4 w-4 text-gold" /> Quoted per guest · menu agreed in advance
                </div>
              </Card>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ WHY CHOOSE US ══ */}
      <section className="relative mx-auto max-w-7xl px-6 py-20">
        <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Why Skylight</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">The details make the difference</h2></div></FadeUp>
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

      {/* ══ TESTIMONIALS — only when real reviews exist ══ */}
      {testimonials.length > 0 && (
      <section className="relative bg-[rgb(var(--surface)/0.5)] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <FadeUp><div className="text-center"><div className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Kind words</div><h2 className="mt-3 font-display text-3xl text-[rgb(var(--text))] md:text-5xl">Loved by families across Karachi</h2></div></FadeUp>
          <div className={`mt-12 grid gap-4 ${testimonials.length === 1 ? 'max-w-xl mx-auto' : testimonials.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-3'}`}>
            {testimonials.map((r, i) => (
              <FadeUp key={r.key} delay={0.05 * i}>
                <Card className="h-full p-6">
                  <div className="flex gap-0.5 text-gold">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className={`h-4 w-4 ${k < r.stars ? 'fill-current' : 'opacity-25'}`} />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-[rgb(var(--text-muted))]">&ldquo;{r.text}&rdquo;</p>
                  <div className="mt-4 text-sm font-medium text-[rgb(var(--text))]">{r.name}</div>
                  {r.when && <div className="text-xs text-[rgb(var(--text-dim))]">{r.when}</div>}
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>
      )}

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
            {faqs.map((f) => (
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

      {/* ══ ENQUIRY ══ */}
      <section id="enquire" className="relative mx-auto max-w-2xl px-6 py-20">
        <FadeUp><EnquiryForm whatsapp={BRAND.whatsapp} /></FadeUp>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="relative border-t border-[rgb(var(--border)/0.4)] bg-[rgb(var(--surface)/0.5)] px-6 py-14">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandLockup />
            <p className="mt-4 max-w-sm text-sm text-[rgb(var(--text-muted))]">Skylight Ballroom &amp; Catering Service — a premium wedding and event venue and caterer in Karachi. Weddings, valimas, mehndi, nikkah and corporate functions, with full catering, live cooking and full-service styling.</p>
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
              <li><a href="#enquire" className="hover:text-gold">Book now</a></li>
              <li><Link href="/login" className="hover:text-gold">Staff portal</Link></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-[rgb(var(--border)/0.3)] pt-6 text-center text-xs text-[rgb(var(--text-dim))]">© {new Date().getFullYear()} Skylight Ballroom &amp; Catering Service · Karachi, Pakistan · All rights reserved</div>
      </footer>

      <WhatsAppFloat whatsapp={BRAND.whatsapp} />
    </div>
  );
}
