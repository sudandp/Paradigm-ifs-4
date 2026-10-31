import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Plus, 
  X, 
  Users, 
  ShieldCheck, 
  Cake, 
  Building,
  ChevronRight,
  Filter
} from 'lucide-react';

export interface FacilityEvent {
  id: string;
  title: string;
  category: 'client_meeting' | 'audit' | 'training' | 'holiday' | 'celebration';
  date: string; // YYYY-MM-DD
  time: string;
  location: string;
  attendees: string;
  description?: string;
}

const DEFAULT_EVENTS: FacilityEvent[] = [
  {
    id: 'EVT-01',
    title: 'Monthly Joint Site Steering Committee',
    category: 'client_meeting',
    date: '2026-10-28',
    time: '11:00 AM - 12:30 PM',
    location: 'iTowers Exente (Clubhouse Conf Room)',
    attendees: 'MC President, VP Ops, Facility Executive',
    description: 'Review SLA scorecard, diesel generator log reconciliations, and water tanker receipts.'
  },
  {
    id: 'EVT-02',
    title: 'Fire Hydrant & High-Rise Pressure Test Audit',
    category: 'audit',
    date: '2026-10-29',
    time: '10:00 AM - 01:00 PM',
    location: 'Southwall Residency (Towers A & B)',
    attendees: 'Fire Safety Officer & MEP Team',
    description: 'Statutory dry riser and jockey pump pressure maintenance inspection.'
  },
  {
    id: 'EVT-03',
    title: 'Electrical Safety & HT Substation Toolbox Talk',
    category: 'training',
    date: '2026-10-30',
    time: '08:30 AM - 09:30 AM',
    location: 'Sobha Silicon Oasis',
    attendees: 'All Electricians & Shift Incharges',
    description: 'Refresher training on Lockout-Tagout (LOTO) procedures and rubber insulating mat checks.'
  },
  {
    id: 'EVT-04',
    title: 'Diwali (Deepavali) Gazetted Holiday',
    category: 'holiday',
    date: '2026-11-01',
    time: 'All Day',
    location: 'Corporate & Regional Offices',
    attendees: 'All Employees (Essential Duty Rostered)',
    description: 'Official festival holiday. 24x7 site security and MEP skeletal crew on duty.'
  },
  {
    id: 'EVT-05',
    title: 'Praveen Guard Supervisor - 5 Year Service Anniversary',
    category: 'celebration',
    date: '2026-10-29',
    time: '05:00 PM',
    location: 'Southwall Security Cabin',
    attendees: 'Site Operations Team',
    description: 'Recognizing 5 years of dedication with company appreciation award certificate.'
  }
];

export const EventsCalendarWidget: React.FC<{
  departmentFilter?: string;
}> = () => {
  const [events, setEvents] = useState<FacilityEvent[]>(() => {
    try {
      const saved = localStorage.getItem('paradigm_facility_events');
      return saved ? JSON.parse(saved) : DEFAULT_EVENTS;
    } catch {
      return DEFAULT_EVENTS;
    }
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'client_meeting' | 'audit' | 'training' | 'holiday'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const saveEvents = (newEvents: FacilityEvent[]) => {
    setEvents(newEvents);
    try {
      localStorage.setItem('paradigm_facility_events', JSON.stringify(newEvents));
    } catch (e) {
      console.warn('Failed to save events to localStorage', e);
    }
  };

  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'client_meeting' as FacilityEvent['category'],
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM - 11:30 AM',
    location: 'iTowers Exente',
    attendees: 'Facility Manager & Team',
    description: ''
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    const created: FacilityEvent = {
      id: `EVT-${Date.now().toString().slice(-4)}`,
      ...newEvent
    };

    saveEvents([...events, created]);
    setIsAddOpen(false);
    setNewEvent({
      title: '',
      category: 'client_meeting',
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM - 11:30 AM',
      location: 'iTowers Exente',
      attendees: 'Facility Manager & Team',
      description: ''
    });
  };

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => activeFilter === 'all' || e.category === activeFilter)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, activeFilter]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006B3F] text-white flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Operations & Events Calendar
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006B3F]">
                Upcoming
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client reviews, compliance audits, toolbox talks, and celebrations.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006B3F] hover:bg-[#005230] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Event</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 sm:px-5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
        {(['all', 'client_meeting', 'audit', 'training', 'holiday'] as const).map(flt => (
          <button
            key={flt}
            onClick={() => setActiveFilter(flt)}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap capitalize transition-all ${
              activeFilter === flt
                ? 'bg-[#006B3F] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {flt === 'client_meeting' ? 'Client Reviews' : flt}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[420px] flex-1">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">No events found in this category.</p>
          </div>
        ) : (
          filteredEvents.map(evt => {
            const eventDate = new Date(evt.date);
            const dayNum = eventDate.getDate();
            const monthStr = eventDate.toLocaleString('default', { month: 'short' }).toUpperCase();
            const weekday = eventDate.toLocaleString('default', { weekday: 'short' });

            return (
              <div 
                key={evt.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex items-start gap-3.5"
              >
                {/* Date Badge */}
                <div className="w-13 h-14 rounded-xl bg-emerald-50/90 border border-emerald-200 flex flex-col items-center justify-center flex-shrink-0 text-[#006B3F] shadow-2xs">
                  <span className="text-[10px] font-bold tracking-wider leading-none text-emerald-800">
                    {monthStr}
                  </span>
                  <span className="text-lg font-black leading-tight">
                    {dayNum}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium leading-none">
                    {weekday}
                  </span>
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {evt.category === 'client_meeting' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                        Client Review
                      </span>
                    )}
                    {evt.category === 'audit' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                        Audit & Inspection
                      </span>
                    )}
                    {evt.category === 'training' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Training
                      </span>
                    )}
                    {evt.category === 'holiday' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                        Holiday
                      </span>
                    )}
                    {evt.category === 'celebration' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Cake className="w-3 h-3" /> Milestone
                      </span>
                    )}

                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {evt.time}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {evt.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-700 truncate">{evt.location}</span>
                  </div>

                  {evt.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {evt.description}
                    </p>
                  )}

                  <div className="text-[11px] text-slate-400 pt-1">
                    Participants: <span className="text-slate-600 font-medium">{evt.attendees}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Event Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Schedule New Facility Event
              </h3>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Client Steering Committee, Electrical Audit"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newEvent.category}
                    onChange={e => setNewEvent({ ...newEvent, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  >
                    <option value="client_meeting">Client Review Meeting</option>
                    <option value="audit">Statutory Audit / Inspection</option>
                    <option value="training">Toolbox Talk / Training</option>
                    <option value="holiday">Holiday / Gazetted Off</option>
                    <option value="celebration">Milestone / Birthday</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newEvent.date}
                    onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Time Span</label>
                  <input
                    type="text"
                    value={newEvent.time}
                    placeholder="e.g. 10:00 AM - 11:30 AM"
                    onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Site / Location</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    placeholder="e.g. iTowers Exente Clubhouse"
                    onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attendees</label>
                <input
                  type="text"
                  value={newEvent.attendees}
                  placeholder="e.g. Facility Manager, Society President, MEP Supervisor"
                  onChange={e => setNewEvent({ ...newEvent, attendees: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Agenda</label>
                <textarea
                  rows={3}
                  value={newEvent.description}
                  placeholder="Key topics to discuss, documents needed..."
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#006B3F] text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#006B3F] text-white font-semibold shadow-xs hover:bg-[#005230]"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
