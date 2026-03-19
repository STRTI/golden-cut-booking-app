'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Lock,
  Mail,
  MapPin,
  Menu,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  User,
  XCircle
} from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';

const FALLBACK_SERVICES = [
  {
    id: 'fallback-cut',
    name: 'Herrenhaarschnitt',
    duration_minutes: 30,
    price_label: 'ab 24 €',
    description: 'Sauberer Schnitt, moderne Form und gepflegtes Finish.'
  },
  {
    id: 'fallback-fade',
    name: 'Fade / moderner Haarschnitt',
    duration_minutes: 45,
    price_label: 'ab 29 €',
    description: 'Präzise Übergänge und moderne Herrenlooks mit klarer Linie.'
  },
  {
    id: 'fallback-beard',
    name: 'Bartpflege / Bartshave',
    duration_minutes: 20,
    price_label: 'ab 15 €',
    description: 'Trimmen, pflegen und definieren für ein sauberes Ergebnis.'
  },
  {
    id: 'fallback-combo',
    name: 'Schnitt + Bart',
    duration_minutes: 50,
    price_label: 'ab 39 €',
    description: 'Die starke Kombi für einen frischen Gesamtlook.'
  }
];

const FALLBACK_BARBERS = [
  { id: 'fallback-team', name: 'Golden Cut Team' },
  { id: 'fallback-barber-1', name: 'Barber 1' }
];

const OPENING_HOURS = {
  1: { start: '09:00', end: '19:00' },
  2: { start: '09:00', end: '19:00' },
  3: { start: '09:00', end: '19:00' },
  4: { start: '09:00', end: '19:00' },
  5: { start: '09:00', end: '19:00' },
  6: { start: '09:00', end: '16:00' }
};

function cls(...parts) {
  return parts.filter(Boolean).join(' ');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad(h)}:${pad(m)}`;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatLongDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function addDays(base, days) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildNextDays(count = 14) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const current = addDays(today, index);
    return {
      key: formatDateKey(current),
      label: current.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit'
      })
    };
  });
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getAvailableSlots(dateKey, serviceDuration, barberId, appointments) {
  const date = parseDateKey(dateKey);
  const weekday = date.getDay();
  const hours = OPENING_HOURS[weekday];
  if (!hours) return [];

  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  const step = 15;

  const relevant = appointments.filter((appointment) => {
    if (appointment.appointment_date !== dateKey) return false;
    if (appointment.status === 'declined' || appointment.status === 'cancelled') return false;
    if (!barberId || barberId === 'team') return true;
    return appointment.barber_id === barberId;
  });

  const slots = [];
  for (let t = start; t + serviceDuration <= end; t += step) {
    const slotStart = t;
    const slotEnd = t + serviceDuration;
    const hasConflict = relevant.some((appointment) => {
      const apStart = toMinutes(appointment.start_time.slice(0, 5));
      const apEnd = toMinutes(appointment.end_time.slice(0, 5));
      return overlaps(slotStart, slotEnd, apStart, apEnd);
    });

    if (!hasConflict) {
      slots.push(fromMinutes(t));
    }
  }

  return slots;
}

function SectionBadge({ children }) {
  return <div className="gc-badge">{children}</div>;
}

function GlassCard({ className = '', children }) {
  return <div className={cls('gc-glass', className)}>{children}</div>;
}

function StatusPill({ status }) {
  const map = {
    pending: { label: 'Angefragt', className: 'gc-pill gc-pill-pending' },
    confirmed: { label: 'Bestätigt', className: 'gc-pill gc-pill-confirmed' },
    declined: { label: 'Abgelehnt', className: 'gc-pill gc-pill-declined' },
    cancelled: { label: 'Storniert', className: 'gc-pill gc-pill-cancelled' }
  };

  const item = map[status] || map.pending;
  return <span className={item.className}>{item.label}</span>;
}

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState(true);
  const [services, setServices] = useState(FALLBACK_SERVICES);
  const [barbers, setBarbers] = useState(FALLBACK_BARBERS);
  const [appointments, setAppointments] = useState([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminUser, setAdminUser] = useState(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(FALLBACK_SERVICES[0].id);
  const nextDays = useMemo(() => buildNextDays(14), []);
  const [selectedDateKey, setSelectedDateKey] = useState(nextDays[0].key);
  const [selectedBarberId, setSelectedBarberId] = useState('team');
  const [selectedTime, setSelectedTime] = useState('');
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    note: ''
  });
  const [adminFilter, setAdminFilter] = useState('all');
  const [tab, setTab] = useState('booking');

  const selectedService = useMemo(() => {
    return services.find((item) => String(item.id) === String(selectedServiceId)) || services[0];
  }, [services, selectedServiceId]);

  const availableSlots = useMemo(() => {
    if (!selectedService) return [];
    return getAvailableSlots(selectedDateKey, selectedService.duration_minutes, selectedBarberId, appointments);
  }, [selectedDateKey, selectedService, selectedBarberId, appointments]);

  const filteredAppointments = useMemo(() => {
    if (adminFilter === 'all') return appointments;
    return appointments.filter((item) => item.status === adminFilter);
  }, [appointments, adminFilter]);

  const stats = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter((a) => a.status === 'pending').length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    declined: appointments.filter((a) => a.status === 'declined').length
  }), [appointments]);

  useEffect(() => {
    let supabase;

    async function init() {
      try {
        supabase = getSupabaseClient();
        setSupabaseReady(true);

        const { data: authData } = await supabase.auth.getUser();
        setAdminUser(authData.user || null);

        const [{ data: serviceRows }, { data: barberRows }] = await Promise.all([
          supabase.from('services').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
          supabase.from('barbers').select('*').eq('is_active', true).order('sort_order', { ascending: true })
        ]);

        if (serviceRows?.length) {
          setServices(serviceRows);
          setSelectedServiceId(String(serviceRows[0].id));
        }

        if (barberRows?.length) {
          setBarbers(barberRows);
        }

        await loadAppointments(supabase);
      } catch (error) {
        setSupabaseReady(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!availableSlots.includes(selectedTime)) {
      setSelectedTime(availableSlots[0] || '');
    }
  }, [availableSlots, selectedTime]);

  async function loadAppointments(client) {
    try {
      const supabase = client || getSupabaseClient();
      const { data, error } = await supabase
        .from('appointments')
        .select('id,status,service_id,service_name,duration_minutes,barber_id,barber_name,customer_name,customer_phone,customer_email,customer_note,appointment_date,start_time,end_time,created_at')
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      setAppointments([]);
    }
  }

  async function handleBook(event) {
    event.preventDefault();
    setBookingMessage('');

    if (!selectedService || !selectedTime || !customer.name || !customer.phone || !customer.email) {
      setBookingMessage('Bitte fülle alle Pflichtfelder aus und wähle eine Uhrzeit.');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const barber = barbers.find((item) => String(item.id) === String(selectedBarberId));
      const startTime = `${selectedTime}:00`;
      const endTime = `${fromMinutes(toMinutes(selectedTime) + selectedService.duration_minutes)}:00`;

      const payload = {
        service_id: selectedService.id,
        service_name: selectedService.name,
        duration_minutes: selectedService.duration_minutes,
        barber_id: barber?.id || null,
        barber_name: barber?.name || 'Golden Cut Team',
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        customer_note: customer.note,
        appointment_date: selectedDateKey,
        start_time: startTime,
        end_time: endTime,
        status: 'pending'
      };

      const { error } = await supabase.from('appointments').insert(payload);
      if (error) throw error;

      setCustomer({ name: '', phone: '', email: '', note: '' });
      setBookingMessage('Deine Terminanfrage wurde erfolgreich gesendet. Golden Cut kann sie jetzt im Dashboard bestätigen.');
      await loadAppointments(supabase);
    } catch (error) {
      setBookingMessage(error.message || 'Die Buchung konnte gerade nicht gespeichert werden.');
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setAdminMessage('');

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });
      if (error) throw error;
      setAdminUser(data.user);
      setAdminPassword('');
      setAdminMessage('Login erfolgreich.');
      await loadAppointments(supabase);
    } catch (error) {
      setAdminMessage(error.message || 'Login fehlgeschlagen.');
    }
  }

  async function handleLogout() {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      setAdminUser(null);
      setAdminMessage('Abgemeldet.');
      setAppointments([]);
    } catch (error) {
      setAdminMessage('Logout fehlgeschlagen.');
    }
  }

  async function updateStatus(id, status) {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
      await loadAppointments(supabase);
    } catch (error) {
      setAdminMessage(error.message || 'Status konnte nicht aktualisiert werden.');
    }
  }

  return (
    <div className="gc-shell">
      <style jsx global>{`
        .gc-shell { min-height: 100vh; background: #050505; color: #fff; }
        .gc-shell::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at top left, rgba(181,129,49,0.16), transparent 24%),
            radial-gradient(circle at top right, rgba(181,129,49,0.08), transparent 18%),
            radial-gradient(circle at bottom, rgba(181,129,49,0.06), transparent 25%);
        }
        .gc-container { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 0 16px; }
        .gc-header {
          position: sticky; top: 0; z-index: 50; border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.85); backdrop-filter: blur(16px);
        }
        .gc-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 0; position: relative; }
        .gc-brand { font-size: 24px; font-weight: 700; letter-spacing: .35em; text-transform: uppercase; color: #f2cd81; }
        .gc-subbrand { margin-top: 6px; font-size: 11px; letter-spacing: .28em; text-transform: uppercase; color: rgba(255,255,255,.55); }
        .gc-nav { display: none; gap: 28px; font-size: 14px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.8); }
        .gc-nav a:hover { color: #d7a852; }
        .gc-header-cta { display: none; align-items: center; gap: 12px; }
        .gc-mobile-menu { position: absolute; top: 78px; left: 0; right: 0; padding: 16px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); background: rgba(10,10,10,0.95); backdrop-filter: blur(20px); box-shadow: 0 20px 60px rgba(0,0,0,0.55); }
        .gc-mobile-links { display: flex; flex-direction: column; gap: 12px; font-size: 14px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.85); }
        .gc-btn, .gc-btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px; padding: 14px 22px; font-size: 14px; font-weight: 700; cursor: pointer; border: 0;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }
        .gc-btn:hover, .gc-btn-outline:hover { transform: translateY(-1px); }
        .gc-btn { background: #d7a852; color: #000; }
        .gc-btn-outline { border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #fff; }
        .gc-grid-hero { display: grid; gap: 40px; padding: 56px 0 20px; }
        .gc-badge {
          display: inline-flex; border-radius: 999px; border: 1px solid #5a4321;
          background: linear-gradient(90deg, rgba(193,143,64,0.18), rgba(193,143,64,0.05));
          padding: 10px 16px; font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: #d7a852;
        }
        .gc-hero-title { margin: 26px 0 0; max-width: 760px; font-size: 48px; line-height: .96; letter-spacing: -.04em; font-weight: 700; }
        .gc-hero-copy { margin-top: 22px; max-width: 700px; color: rgba(255,255,255,.78); font-size: 18px; line-height: 1.8; }
        .gc-actions { margin-top: 28px; display: flex; flex-direction: column; gap: 12px; }
        .gc-stat-grid { margin-top: 36px; display: grid; gap: 14px; }
        .gc-glass {
          border-radius: 28px; border: 1px solid rgba(255,255,255,.08);
          background: radial-gradient(circle at top left, rgba(197,148,61,0.13), transparent 30%), linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
          box-shadow: 0 24px 80px rgba(0,0,0,.45);
          backdrop-filter: blur(6px);
        }
        .gc-preview { padding: 12px; }
        .gc-preview-inner { border-radius: 28px; border: 1px solid rgba(255,255,255,.08); background: #0a0a0a; padding: 24px; }
        .gc-section { padding: 56px 0; }
        .gc-title { margin: 22px 0 0; max-width: 860px; font-size: 38px; line-height: 1.02; letter-spacing: -.04em; font-weight: 700; }
        .gc-text { margin-top: 18px; max-width: 850px; font-size: 18px; line-height: 1.8; color: rgba(255,255,255,.78); }
        .gc-services { margin-top: 36px; display: grid; gap: 18px; }
        .gc-service-card {
          width: 100%; text-align: left; cursor: pointer; padding: 24px; border-radius: 28px; border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.04); color: #fff;
        }
        .gc-service-card.active {
          border-color: #8a6422;
          background: linear-gradient(180deg, rgba(193,143,64,0.16), rgba(255,255,255,.02));
        }
        .gc-icon-circle {
          display: inline-flex; width: 48px; height: 48px; align-items: center; justify-content: center; border-radius: 999px;
          border: 1px solid #5a4321; background: linear-gradient(180deg, rgba(193,143,64,0.12), rgba(193,143,64,0.02)); color: #d7a852;
        }
        .gc-service-title { margin-top: 18px; font-size: 28px; line-height: 1.05; letter-spacing: -.04em; font-weight: 700; }
        .gc-service-meta { margin-top: 14px; display: flex; justify-content: space-between; gap: 16px; font-size: 14px; color: rgba(255,255,255,.72); }
        .gc-tabs { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
        .gc-tab { border-radius: 999px; padding: 12px 20px; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #fff; }
        .gc-tab.active { background: #d7a852; color: #000; border-color: transparent; }
        .gc-booking-grid { display: grid; gap: 24px; }
        .gc-panel { padding: 28px; }
        .gc-label { margin-bottom: 10px; display: block; font-size: 12px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: #d7a852; }
        .gc-field, .gc-select, .gc-textarea {
          width: 100%; border-radius: 18px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05);
          color: #fff; outline: none;
        }
        .gc-field, .gc-select { padding: 16px 16px 16px 44px; }
        .gc-textarea { min-height: 120px; padding: 16px; resize: vertical; }
        .gc-field-wrap { position: relative; }
        .gc-field-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,.35); }
        .gc-date-grid, .gc-time-grid, .gc-stat-boxes, .gc-admin-grid, .gc-benefit-grid { display: grid; gap: 14px; }
        .gc-date-btn, .gc-time-btn {
          cursor: pointer; border-radius: 18px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #fff;
        }
        .gc-date-btn { padding: 16px; text-align: left; }
        .gc-time-btn { padding: 12px 16px; font-size: 14px; font-weight: 700; border-radius: 999px; }
        .gc-date-btn.active, .gc-time-btn.active { border-color: #8a6422; background: #1a140a; color: #f2cd81; }
        .gc-date-btn:disabled, .gc-time-btn:disabled { opacity: .35; cursor: not-allowed; }
        .gc-summary { margin-top: 8px; border-radius: 24px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); padding: 20px; }
        .gc-summary-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; font-size: 14px; color: rgba(255,255,255,.8); }
        .gc-summary-row strong { color: #fff; }
        .gc-message { margin-top: 14px; border-radius: 18px; border: 1px solid #5a4321; background: #1a140a; color: #f2cd81; padding: 14px 16px; font-size: 14px; }
        .gc-warning { margin-top: 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); padding: 18px; color: rgba(255,255,255,.75); }
        .gc-stat-card, .gc-benefit-card { padding: 22px; }
        .gc-stat-value { margin-top: 12px; font-size: 42px; font-weight: 700; letter-spacing: -.04em; }
        .gc-pill { display: inline-flex; border-radius: 999px; border: 1px solid; padding: 6px 12px; font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
        .gc-pill-pending { border-color: rgba(245,158,11,.3); background: rgba(245,158,11,.1); color: #fcd34d; }
        .gc-pill-confirmed { border-color: rgba(16,185,129,.3); background: rgba(16,185,129,.1); color: #6ee7b7; }
        .gc-pill-declined { border-color: rgba(239,68,68,.3); background: rgba(239,68,68,.1); color: #fca5a5; }
        .gc-pill-cancelled { border-color: rgba(113,113,122,.3); background: rgba(113,113,122,.1); color: #d4d4d8; }
        .gc-admin-card { padding: 24px; border-radius: 24px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
        .gc-admin-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
        .gc-footer-space { height: 28px; }
        @media (min-width: 768px) {
          .gc-actions { flex-direction: row; }
          .gc-stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .gc-date-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .gc-time-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .gc-stat-boxes { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .gc-benefit-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .gc-header-cta { display: flex; }
        }
        @media (min-width: 1024px) {
          .gc-nav { display: flex; }
          .gc-grid-hero { grid-template-columns: 1.05fr 0.95fr; align-items: center; padding-top: 88px; }
          .gc-hero-title { font-size: 76px; }
          .gc-title { font-size: 60px; }
          .gc-services { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .gc-booking-grid { grid-template-columns: 0.95fr 1.05fr; }
          .gc-date-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .gc-admin-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
      `}</style>

      <header className="gc-header">
        <div className="gc-container">
          <div className="gc-header-inner">
            <a href="#start">
              <div className="gc-brand">GOLDEN CUT</div>
              <div className="gc-subbrand">Fresh Haircuts & Bartshaves</div>
            </a>

            <nav className="gc-nav">
              <a href="#start">Start</a>
              <a href="#services">Leistungen</a>
              <a href="#booking">Termin buchen</a>
              <a href="#admin">Dashboard</a>
            </nav>

            <div className="gc-header-cta">
              <a href="tel:096029390044" className="gc-btn-outline">
                <Phone size={16} />
                09602 / 9390044
              </a>
              <button className="gc-btn" onClick={() => setTab('booking')}>
                <CalendarDays size={16} />
                Online buchen
              </button>
            </div>

            <button className="gc-btn-outline" onClick={() => setMobileOpen((v) => !v)} style={{ display: 'inline-flex' }}>
              <Menu size={18} />
            </button>

            {mobileOpen && (
              <div className="gc-mobile-menu">
                <div className="gc-mobile-links">
                  <a href="#start" onClick={() => setMobileOpen(false)}>Start</a>
                  <a href="#services" onClick={() => setMobileOpen(false)}>Leistungen</a>
                  <a href="#booking" onClick={() => setMobileOpen(false)}>Termin buchen</a>
                  <a href="#admin" onClick={() => setMobileOpen(false)}>Dashboard</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <section id="start">
          <div className="gc-container gc-grid-hero">
            <div>
              <SectionBadge>Barbershop Neustadt an der Waldnaab · jetzt mit echter Online-Buchung</SectionBadge>
              <h1 className="gc-hero-title">Website + Kalender + Online-Termine für GOLDEN CUT.</h1>
              <p className="gc-hero-copy">
                Kunden sehen freie Zeiten direkt online, wählen Leistung und Uhrzeit aus und senden ihre Terminanfrage ohne Anruf.
                Golden Cut meldet sich im eigenen Dashboard an und bestätigt die Termine direkt in Supabase.
              </p>
              <div className="gc-actions">
                <a href="#booking" className="gc-btn">
                  <CalendarDays size={16} />
                  Termin buchen
                </a>
                <a href="#admin" className="gc-btn-outline">
                  <ShieldCheck size={16} />
                  Dashboard öffnen
                </a>
              </div>
              <div className="gc-stat-grid">
                {[
                  { title: 'Online', text: 'freie Slots sichtbar' },
                  { title: 'Einfach', text: 'Termin in wenigen Klicks' },
                  { title: 'Kontrolliert', text: 'Bestätigung durch Golden Cut' }
                ].map((item) => (
                  <GlassCard key={item.title} className="gc-stat-card">
                    <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.03em' }}>{item.title}</div>
                    <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 14 }}>{item.text}</div>
                  </GlassCard>
                ))}
              </div>
            </div>

            <GlassCard className="gc-preview">
              <div className="gc-preview-inner">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#d7a852' }}>Live-Vorschau</div>
                    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, letterSpacing: '-.04em' }}>Online-Termin buchen</div>
                  </div>
                  <StatusPill status="pending" />
                </div>

                <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
                  <div className="gc-admin-card">
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>Leistung</div>
                    <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>{selectedService?.name}</div>
                  </div>
                  <div className="gc-admin-card">
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>Datum</div>
                    <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>{formatLongDate(selectedDateKey)}</div>
                  </div>
                  <div className="gc-admin-card">
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)' }}>Freie Uhrzeiten</div>
                    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {availableSlots.slice(0, 6).map((slot) => (
                        <span key={slot} className="gc-time-btn active" style={{ cursor: 'default' }}>{slot}</span>
                      ))}
                      {!availableSlots.length && <span style={{ fontSize: 14, color: 'rgba(255,255,255,.55)' }}>Aktuell keine freien Zeiten.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        <section id="services" className="gc-section">
          <div className="gc-container">
            <SectionBadge>Leistungen</SectionBadge>
            <h2 className="gc-title">Leistung auswählen und direkt online anfragen.</h2>
            <p className="gc-text">
              Die Leistungen werden aus Supabase geladen. Du kannst sie später direkt in der Datenbank ergänzen, umsortieren oder deaktivieren.
            </p>

            <div className="gc-services">
              {services.map((service) => (
                <button
                  key={service.id}
                  className={cls('gc-service-card', String(service.id) === String(selectedServiceId) && 'active')}
                  onClick={() => {
                    setSelectedServiceId(String(service.id));
                    setTab('booking');
                  }}
                >
                  <div className="gc-icon-circle"><Scissors size={18} /></div>
                  <div className="gc-service-title">{service.name}</div>
                  <div style={{ marginTop: 12, color: 'rgba(255,255,255,.72)', fontSize: 15, lineHeight: 1.7 }}>{service.description}</div>
                  <div className="gc-service-meta">
                    <span style={{ color: '#f2cd81' }}>{service.duration_minutes} Min.</span>
                    <span>{service.price_label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="booking" className="gc-section">
          <div className="gc-container">
            <div className="gc-tabs">
              <button className={cls('gc-tab', tab === 'booking' && 'active')} onClick={() => setTab('booking')}>Kundenseite</button>
              <button className={cls('gc-tab', tab === 'admin' && 'active')} onClick={() => setTab('admin')}>Admin-Dashboard</button>
            </div>

            {tab === 'booking' ? (
              <div className="gc-booking-grid">
                <GlassCard className="gc-panel">
                  <SectionBadge>Termin buchen</SectionBadge>
                  <h2 className="gc-title" style={{ fontSize: 48 }}>Freie Zeiten auswählen und Anfrage senden.</h2>
                  <p className="gc-text" style={{ maxWidth: 620 }}>Die Buchung wird direkt in Supabase gespeichert. Golden Cut sieht die Anfrage im Dashboard und kann sie bestätigen oder ablehnen.</p>

                  {!supabaseReady && (
                    <div className="gc-warning">
                      Supabase ist noch nicht verbunden. Trage zuerst die Werte aus <code>.env.local</code> ein und führe das SQL-Schema aus.
                    </div>
                  )}

                  <div style={{ marginTop: 32, display: 'grid', gap: 22 }}>
                    <div>
                      <label className="gc-label">Leistung</label>
                      <select className="gc-select" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
                        {services.map((service) => (
                          <option key={service.id} value={service.id} style={{ background: '#101010' }}>
                            {service.name} · {service.duration_minutes} Min.
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="gc-label">Barber</label>
                      <select className="gc-select" value={selectedBarberId} onChange={(e) => setSelectedBarberId(e.target.value)}>
                        <option value="team" style={{ background: '#101010' }}>Golden Cut Team</option>
                        {barbers.map((barber) => (
                          <option key={barber.id} value={barber.id} style={{ background: '#101010' }}>
                            {barber.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="gc-label">Datum</label>
                      <div className="gc-date-grid">
                        {nextDays.map((day) => {
                          const slots = selectedService
                            ? getAvailableSlots(day.key, selectedService.duration_minutes, selectedBarberId, appointments)
                            : [];
                          const disabled = !slots.length;
                          return (
                            <button
                              key={day.key}
                              type="button"
                              disabled={disabled}
                              onClick={() => setSelectedDateKey(day.key)}
                              className={cls('gc-date-btn', day.key === selectedDateKey && 'active')}
                            >
                              <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em' }}>{day.label}</div>
                              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{slots.length ? `${slots.length} frei` : 'ausgebucht'}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="gc-label">Uhrzeit</label>
                      <div className="gc-time-grid">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={cls('gc-time-btn', selectedTime === slot && 'active')}
                          >
                            {slot}
                          </button>
                        ))}
                        {!availableSlots.length && (
                          <div className="gc-warning" style={{ gridColumn: '1 / -1' }}>
                            Für dieses Datum ist aktuell keine passende Zeit frei.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="gc-panel">
                  <SectionBadge>Kundendaten</SectionBadge>
                  <form onSubmit={handleBook} style={{ marginTop: 20, display: 'grid', gap: 18 }}>
                    <div>
                      <label style={{ marginBottom: 8, display: 'block', color: 'rgba(255,255,255,.7)' }}>Name</label>
                      <div className="gc-field-wrap">
                        <User className="gc-field-icon" size={16} />
                        <input className="gc-field" value={customer.name} onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))} placeholder="Vor- und Nachname" />
                      </div>
                    </div>
                    <div>
                      <label style={{ marginBottom: 8, display: 'block', color: 'rgba(255,255,255,.7)' }}>Telefon</label>
                      <div className="gc-field-wrap">
                        <Phone className="gc-field-icon" size={16} />
                        <input className="gc-field" value={customer.phone} onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Telefonnummer" />
                      </div>
                    </div>
                    <div>
                      <label style={{ marginBottom: 8, display: 'block', color: 'rgba(255,255,255,.7)' }}>E-Mail</label>
                      <div className="gc-field-wrap">
                        <Mail className="gc-field-icon" size={16} />
                        <input type="email" className="gc-field" value={customer.email} onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))} placeholder="E-Mail-Adresse" />
                      </div>
                    </div>
                    <div>
                      <label style={{ marginBottom: 8, display: 'block', color: 'rgba(255,255,255,.7)' }}>Notiz (optional)</label>
                      <textarea className="gc-textarea" value={customer.note} onChange={(e) => setCustomer((prev) => ({ ...prev, note: e.target.value }))} placeholder="Zum Beispiel: bitte Seiten kürzer oder Bart mitformen" />
                    </div>

                    <div className="gc-summary">
                      <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#d7a852' }}>Zusammenfassung</div>
                      <div className="gc-summary-row"><span>Leistung</span><strong>{selectedService?.name}</strong></div>
                      <div className="gc-summary-row"><span>Dauer</span><strong>{selectedService?.duration_minutes} Min.</strong></div>
                      <div className="gc-summary-row"><span>Datum</span><strong>{formatLongDate(selectedDateKey)}</strong></div>
                      <div className="gc-summary-row"><span>Uhrzeit</span><strong>{selectedTime || 'Bitte wählen'}</strong></div>
                    </div>

                    <button className="gc-btn" type="submit">
                      <CheckCircle2 size={16} />
                      Terminanfrage absenden
                    </button>

                    {bookingMessage && <div className="gc-message">{bookingMessage}</div>}
                  </form>
                </GlassCard>
              </div>
            ) : (
              <div id="admin" style={{ display: 'grid', gap: 24 }}>
                <div className="gc-stat-boxes">
                  {[
                    { label: 'Gesamt', value: stats.total },
                    { label: 'Angefragt', value: stats.pending },
                    { label: 'Bestätigt', value: stats.confirmed },
                    { label: 'Abgelehnt', value: stats.declined }
                  ].map((item) => (
                    <GlassCard key={item.label} className="gc-stat-card">
                      <div style={{ fontSize: 13, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>{item.label}</div>
                      <div className="gc-stat-value">{item.value}</div>
                    </GlassCard>
                  ))}
                </div>

                {!adminUser ? (
                  <GlassCard className="gc-panel" style={{ maxWidth: 640 }}>
                    <SectionBadge>Admin-Login</SectionBadge>
                    <h2 className="gc-title" style={{ fontSize: 44 }}>Golden Cut meldet sich hier an.</h2>
                    <p className="gc-text">Lege den Admin-Benutzer direkt in Supabase Auth an und melde dich hier mit E-Mail und Passwort an.</p>
                    <form onSubmit={handleAdminLogin} style={{ marginTop: 24, display: 'grid', gap: 18 }}>
                      <div>
                        <label style={{ marginBottom: 8, display: 'block', color: 'rgba(255,255,255,.7)' }}>E-Mail</label>
                        <div className="gc-field-wrap">
                          <Mail className="gc-field-icon" size={16} />
                          <input type="email" className="gc-field" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@goldencut.de" />
                        </div>
                      </div>
                      <div>
                        <label style={{ marginBottom: 8, display: 'block', color: 'rgba(255,255,255,.7)' }}>Passwort</label>
                        <div className="gc-field-wrap">
                          <Lock className="gc-field-icon" size={16} />
                          <input type="password" className="gc-field" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Passwort" />
                        </div>
                      </div>
                      <button className="gc-btn" type="submit">
                        <ShieldCheck size={16} />
                        Einloggen
                      </button>
                      {adminMessage && <div className="gc-message">{adminMessage}</div>}
                    </form>
                  </GlassCard>
                ) : (
                  <GlassCard className="gc-panel">
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                      <div>
                        <SectionBadge>Golden Cut Dashboard</SectionBadge>
                        <h2 className="gc-title" style={{ fontSize: 44 }}>Neue Terminanfragen verwalten</h2>
                        <p className="gc-text" style={{ maxWidth: 720 }}>Nur eingeloggte Nutzer können Termine lesen und den Status ändern. Genau dafür ist RLS in Supabase vorgesehen.</p>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                          { key: 'all', label: 'Alle' },
                          { key: 'pending', label: 'Angefragt' },
                          { key: 'confirmed', label: 'Bestätigt' },
                          { key: 'declined', label: 'Abgelehnt' }
                        ].map((item) => (
                          <button key={item.key} className={cls('gc-tab', adminFilter === item.key && 'active')} onClick={() => setAdminFilter(item.key)}>{item.label}</button>
                        ))}
                        <button className="gc-btn-outline" onClick={handleLogout}>Logout</button>
                      </div>
                    </div>

                    {adminMessage && <div className="gc-message">{adminMessage}</div>}

                    <div style={{ marginTop: 28, display: 'grid', gap: 16 }}>
                      {!filteredAppointments.length && <div className="gc-warning">Noch keine Termine in diesem Filter.</div>}
                      {filteredAppointments.map((appointment) => (
                        <div key={appointment.id} className="gc-admin-card">
                          <div style={{ display: 'grid', gap: 18 }}>
                            <div style={{ display: 'grid', gap: 16 }}>
                              <div>
                                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.18em', color: '#d7a852' }}>Kunde</div>
                                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>{appointment.customer_name}</div>
                                <div style={{ marginTop: 4, color: 'rgba(255,255,255,.65)' }}>{appointment.customer_phone}</div>
                                <div style={{ color: 'rgba(255,255,255,.65)' }}>{appointment.customer_email}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.18em', color: '#d7a852' }}>Termin</div>
                                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>{formatLongDate(appointment.appointment_date)}</div>
                                <div style={{ marginTop: 4, color: 'rgba(255,255,255,.65)' }}>{appointment.start_time.slice(0, 5)} Uhr · {appointment.duration_minutes} Min.</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.18em', color: '#d7a852' }}>Leistung</div>
                                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>{appointment.service_name}</div>
                                <div style={{ marginTop: 4, color: 'rgba(255,255,255,.65)' }}>{appointment.barber_name || 'Golden Cut Team'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.18em', color: '#d7a852' }}>Status</div>
                                <div style={{ marginTop: 8 }}><StatusPill status={appointment.status} /></div>
                                {appointment.customer_note && <div style={{ marginTop: 10, color: 'rgba(255,255,255,.65)' }}>Notiz: {appointment.customer_note}</div>}
                              </div>
                            </div>
                            <div className="gc-admin-actions">
                              <button className="gc-btn" onClick={() => updateStatus(appointment.id, 'confirmed')}>
                                <CheckCircle2 size={16} />
                                Bestätigen
                              </button>
                              <button className="gc-btn-outline" onClick={() => updateStatus(appointment.id, 'declined')}>
                                <XCircle size={16} />
                                Ablehnen
                              </button>
                              <button className="gc-btn-outline" onClick={() => updateStatus(appointment.id, 'cancelled')}>
                                <XCircle size={16} />
                                Stornieren
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="gc-section">
          <div className="gc-container gc-benefit-grid">
            {[
              { icon: Sparkles, title: 'Kundenfreundlich', text: 'Kunden sehen freie Zeiten direkt online und müssen nicht mehr zuerst anrufen.' },
              { icon: Clock3, title: 'Weniger Aufwand', text: 'Golden Cut sammelt Anfragen zentral und bestätigt sie im eigenen Dashboard.' },
              { icon: MapPin, title: 'Eigene Lösung', text: 'Die Buchung läuft auf deiner eigenen Website und nicht über eine Fremdplattform.' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <GlassCard key={item.title} className="gc-benefit-card">
                  <div className="gc-icon-circle"><Icon size={18} /></div>
                  <div style={{ marginTop: 18, fontSize: 30, fontWeight: 700, letterSpacing: '-.04em' }}>{item.title}</div>
                  <div style={{ marginTop: 14, fontSize: 16, lineHeight: 1.8, color: 'rgba(255,255,255,.72)' }}>{item.text}</div>
                </GlassCard>
              );
            })}
          </div>
        </section>

        <div className="gc-footer-space" />
      </main>
    </div>
  );
}
