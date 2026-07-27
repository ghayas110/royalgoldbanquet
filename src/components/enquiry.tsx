'use client';

import { useState, useTransition } from 'react';
import { Card, Field, Input, Button } from '@/components/ui';
import { createLead } from '@/lib/actions/misc';
import { MessageCircle, Check, Send } from 'lucide-react';

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? '923159008065';

export function WhatsAppFloat() {
  const text = encodeURIComponent('Assalam o Alaikum! I would like to enquire about booking Royal Gold Banquet.');
  return (
    <a
      href={`https://wa.me/${WHATSAPP}?text=${text}`}
      target="_blank" rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 font-semibold text-white shadow-lift transition-transform hover:scale-105"
    >
      <MessageCircle className="h-5 w-5" /> <span className="hidden sm:inline">WhatsApp us</span>
    </a>
  );
}

export function EnquiryForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const waText = encodeURIComponent(`Assalam o Alaikum! I'm ${name || '[name]'}. I'd like to enquire about ${eventDate ? `an event on ${eventDate}` : 'a booking'}. ${message}`);

  function submit() {
    setError('');
    start(async () => {
      const res = await createLead({ name, phone, eventDate: eventDate || null, message: message || null, source: 'WEBSITE' });
      if (res.ok) setDone(true); else setError(res.error);
    });
  }

  if (done) return (
    <Card glass className="p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-positive/15"><Check className="h-7 w-7 text-positive" /></div>
      <h3 className="mt-4 font-display text-2xl text-[rgb(var(--text))]">Thank you!</h3>
      <p className="mt-1 text-sm text-[rgb(var(--text-dim))]">We&apos;ve received your enquiry and will contact you shortly.</p>
      <a href={`https://wa.me/${WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> Continue on WhatsApp</a>
    </Card>
  );

  return (
    <Card glass className="p-6 md:p-8">
      <h3 className="mb-1 font-display text-2xl text-gold-gradient">Enquire now</h3>
      <p className="mb-5 text-sm text-[rgb(var(--text-dim))]">Tell us about your event — we&apos;ll respond within the hour.</p>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
          <Field label="Phone / WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" /></Field>
        </div>
        <Field label="Event date (optional)"><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></Field>
        <Field label="Message"><Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. 500 guests, dinner shift" /></Field>
        {error && <div className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</div>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" disabled={pending || !name || !phone} onClick={submit}><Send className="h-4 w-4" /> {pending ? 'Sending…' : 'Send enquiry'}</Button>
          <a href={`https://wa.me/${WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"><MessageCircle className="h-4 w-4" /> WhatsApp instead</a>
        </div>
      </div>
    </Card>
  );
}
