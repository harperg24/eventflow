// ============================================================
//  src/App.jsx
// ============================================================
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Auth          from "./pages/Auth";
import Home          from "./pages/Home";
import EventList     from "./pages/EventList";
import EventCreation from "./pages/EventCreation";
import Dashboard     from "./pages/Dashboard";
import RSVP          from "./pages/RSVP";
import AuthCallback    from "./pages/AuthCallback";
import CheckIn, { GuestCheckIn, EventCheckIn } from "./pages/CheckIn";
import TicketPage    from "./pages/TicketPage";
import TicketSuccess from "./pages/TicketSuccess";
import TicketView    from "./pages/TicketView";
import TicketScanner  from "./pages/TicketScanner";
import VendorForm     from "./pages/VendorForm";
import CollabAccept   from "./pages/CollabAccept";
import StaffPortal    from "./pages/StaffPortal";

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "var(--accent)", fontSize: 14 }}>
      Loading…
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Public — no auth needed */}
        <Route path="/login"         element={session ? <Navigate to="/events" replace /> : <Auth />} />
        <Route path="/e/:slug"       element={<RSVP />} />
        <Route path="/auth/callback"     element={<AuthCallback />} />
        <Route path="/checkin/:guestId"        element={<GuestCheckIn />} />
        <Route path="/checkin/event/:eventId"   element={<EventCheckIn />} />
        <Route path="/tickets/:slug"             element={<TicketPage />} />
        <Route path="/tickets/:slug/success"     element={<TicketSuccess />} />
        <Route path="/ticket/:qrToken"           element={<TicketView />} />
        <Route path="/scanner/:eventId"            element={<TicketScanner />} />
        <Route path="/vendor/:token"               element={<VendorForm />} />
        <Route path="/collab/accept/:token"        element={<CollabAccept />} />
        <Route path="/staff/:token"                 element={<StaffPortal />} />

        {/* Protected */}
        <Route path="/home"               element={<Home />} />
        <Route path="/events"              element={session ? <EventList />     : <Navigate to="/login" replace />} />
        <Route path="/create"              element={session ? <EventCreation /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/:eventId"  element={session ? <Dashboard />     : <Navigate to="/login" replace />} />

        {/* Default */}
        <Route path="*" element={<Navigate to={session ? "/events" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
