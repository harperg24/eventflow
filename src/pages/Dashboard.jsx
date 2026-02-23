// ============================================================
//  Dashboard.jsx  —  wired to Supabase with real-time updates
//  Route: /dashboard/:eventId
// =============================================================
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EditEventModal from "../components/EditEventModal";
import StaffManager from "./StaffManager";
import QueueManager from "./QueueManager";
import EventSettings from "./EventSettings";
import { useAppTheme } from "./Home";
import { globalCSS, loadThemePrefs, getTheme } from "./theme";
import {
  supabase,
  fetchEvent, fetchGuests, fetchTasks, fetchBudget, updateTask, deleteTask,
  fetchVendors, fetchSongs, fetchPolls,
  toggleTask, addTask, checkInGuest,
  addSong, voteSong, vetoSong,
  createPoll, closePoll, votePoll,
  addVendor, updateVendorStatus,
  fetchExpenses, addExpense, updateExpense, deleteExpense,
  subscribeToGuests, subscribeToSongs,
  subscribeToPolls, subscribeToTasks,
  sendInvites,
} from "../lib/supabase";

// Read-only banner shown when a collaborator views a section they can't edit
function ReadOnlyBanner({ role }) {
  return (
    <div style={{ background: "rgba(90,90,114,0.08)", border: "1px solid rgba(90,90,114,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 14 }}>🔒</span>
      <span style={{ fontSize: 13, color: "var(--text2)" }}>
        You have <strong style={{ color: "var(--text2)" }}>view-only</strong> access to this section as a <strong style={{ color: "var(--text2)" }}>{(role || "").replace("_"," ")}</strong>.
      </span>
    </div>
  );
}

// Role-based access control
const ROLE_ACCESS = {
  owner:     ["overview","guests","budget","playlist","polls","vendors","collab","checklist","queue","tickets","checkin","staff","settings"],
  admin:     ["overview","guests","budget","playlist","polls","vendors","collab","checklist","queue","tickets","checkin","staff","settings"],
  ticketing: ["overview","tickets","checkin","collab"],
  check_in:  ["overview","checkin","guests","tickets"],
  view_only: ["overview","guests","budget","playlist","polls","vendors","collab","checklist","queue","tickets","checkin"],
};
const ROLE_READONLY = {
  owner: [], admin: [],
  ticketing: ["collab"],
  check_in:  ["guests","tickets","checkin"],
  view_only: ["guests","checkin","collab","tickets","budget","playlist","polls","vendors","checklist"],
};

const NAV = [
  { id: "overview",  label: "Overview",    icon: "◈" },
  { id: "guests",    label: "Guests",      icon: "◉" },
  { id: "budget",    label: "Budget",      icon: "◎" },
  { id: "playlist",  label: "Playlist",    icon: "♫" },
  { id: "polls",     label: "Polls",       icon: "◐" },
  { id: "vendors",   label: "Vendors",     icon: "◇" },
  { id: "collab",    label: "Collaborate", icon: "◈" },
  { id: "checklist", label: "Checklist",   icon: "☑" },
  { id: "queue",     label: "Queue",       icon: "↕" },
  { id: "tickets",   label: "Ticket Hub",  icon: "🎟", ticketed: true },
  { id: "checkin",   label: "Check-in",    icon: "✓" },
  { id: "staff",     label: "Staff",       icon: "⏱" },
  { id: "settings",  label: "Settings",    icon: "⚙" },
];

// Inline AttendeeTab component — shows all tickets with check-in status
function AttendeeTab({ eventId, supabase, orders, navigate }) {
  const [tickets,  setTickets]  = React.useState([]);
  const [loading,  setLoading]  = React.useState(true);
  const [search,   setSearch]   = React.useState("");

  React.useEffect(() => {
    supabase.from("tickets")
      .select("*, ticket_tiers(name), ticket_orders(buyer_name, buyer_email)")
      .eq("event_id", eventId)
      .order("created_at")
      .then(({ data }) => { setTickets(data || []); setLoading(false); });
  }, [eventId]);

  const filtered = tickets.filter(t => {
    const name  = t.ticket_orders?.buyer_name?.toLowerCase() || "";
    const email = t.ticket_orders?.buyer_email?.toLowerCase() || "";
    const num   = t.ticket_number?.toLowerCase() || "";
    const q     = search.toLowerCase();
    return !q || name.includes(q) || email.includes(q) || num.includes(q);
  });

  const checkedIn = tickets.filter(t => t.checked_in).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or ticket number…"
          style={{ flex: 1, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }} />
        <div style={{ fontSize: 13, color: "var(--text2)", flexShrink: 0 }}>
          <span style={{ color: "#10b981", fontWeight: 600 }}>{checkedIn}</span>/{tickets.length} in
        </div>
      </div>
      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 13 }}>Loading…</div>}
      <div className="card" style={{ overflow: "hidden" }}>
        {filtered.length === 0 && !loading && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No tickets found.</div>
        )}
        {filtered.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px",
            borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
            background: t.checked_in ? "rgba(16,185,129,0.03)" : "transparent" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700,
              background: t.checked_in ? "rgba(16,185,129,0.12)" : "var(--bg3)",
              border: `1.5px solid ${t.checked_in ? "#10b981" : "var(--border)"}`,
              color: t.checked_in ? "#10b981" : "var(--text3)" }}>
              {t.checked_in ? "✓" : "·"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{t.ticket_orders?.buyer_name || "—"}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.ticket_tiers?.name} · {t.ticket_number}
              </div>
            </div>
            {t.checked_in && t.checked_in_at && (
              <div style={{ fontSize: 11, color: "#10b981", flexShrink: 0 }}>
                {new Date(t.checked_in_at).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <div style={{ flexShrink: 0 }}>
              <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 5,
                background: t.checked_in ? "rgba(16,185,129,0.12)" : "var(--bg3)",
                color: t.checked_in ? "#10b981" : "var(--text3)",
                border: `1px solid ${t.checked_in ? "rgba(16,185,129,0.2)" : "var(--border)"}` }}>
                {t.checked_in ? "Scanned" : "Not yet"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const ANON_KEY = supabase.supabaseKey || "";
  const [activeNav, setActiveNav] = useState("overview");
  const [loading, setLoading] = useState(true);

  // ── State ─────────────────────────────────────────────────
  const [event,   setEvent]   = useState(null);
  const [guests,  setGuests]  = useState([]);
  const [tasks,   setTasks]   = useState([]);
  const [budget,  setBudget]  = useState([]);
  const [vendors, setVendors] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  // Spotify
  const [spotifyToken, setSpotifyToken]         = useState(null);
  const [searchOpen, setSearchOpen]             = useState(false);
  const [votedSongs, setVotedSongs]             = useState([]); // organiser tracks own votes locally
  const [nowPlaying, setNowPlaying]             = useState(null);
  // Ticketing
  const [isMobile,       setIsMobile]       = useState(window.innerWidth < 768);
  const [mobileMode,     setMobileMode]     = useState("full"); // "full" | "ticketing"
  const [hubTab,         setHubTab]         = useState("tiers"); // tiers | orders | attendees
  const [tiers,          setTiers]          = useState([]);
  const [orders,         setOrders]         = useState([]);
  const [editingTier,    setEditingTier]    = useState(null);
  const [newTier,        setNewTier]        = useState({ name: "", description: "", price: "", capacity: "" });
  const [addingTier,     setAddingTier]     = useState(false);
  const [tierError,      setTierError]      = useState(null); // full song object playing in player
  const [playerProgress, setPlayerProgress]     = useState(0);
  const [playerDuration, setPlayerDuration]     = useState(0);
  const [spotifySearch, setSpotifySearch]       = useState("");
  const [spotifyResults, setSpotifyResults]     = useState([]);
  const [spotifySearching, setSpotifySearching] = useState(false);
  const [playingPreview, setPlayingPreview]     = useState(null);
  const [previewAudio, setPreviewAudio]         = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ label: "", allocated: "", icon: "💰", color: "var(--accent)" });
  const [expenseCategory, setExpenseCategory] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "" });
  const [songs,   setSongs]   = useState([]);
  const [polls,   setPolls]   = useState([]);
  const [requests, setRequests] = useState([]);

  const [copied,   setCopied]   = useState(false);
  const [newSong,  setNewSong]  = useState({ title: "", artist: "" });
  const [newPollQ, setNewPollQ] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDue,  setNewTaskDue]  = useState("");
  const [editingTask, setEditingTask] = useState(null); // {id, text, due_date}
  const [taskFilter,  setTaskFilter]  = useState("all"); // all | pending | done
  // Check-in QR + search
  const [qrGuest,        setQrGuest]        = useState(null);
  const [checkInSearch,  setCheckInSearch]  = useState("");
  const [checkInFilter,  setCheckInFilter]  = useState("all"); // all | in | out
  const [eventQrOpen,    setEventQrOpen]    = useState(false); // guest object to show QR for
  const [qrScanning,  setQrScanning]  = useState(false);
  const [scanResult,  setScanResult]  = useState(null); // {success, name}
  const [showEdit, setShowEdit] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [editingGuest, setEditingGuest] = useState(null);
  const [showVendorModal,    setShowVendorModal]    = useState(false);
  const [editingVendor,      setEditingVendor]      = useState(null);
  const [vendorForm,         setVendorForm]         = useState({ name: "", role: "", contact: "", phone: "", notes: "", status: "pending", icon: "🏢" });
  const [vendorInviteEmail,  setVendorInviteEmail]  = useState("");
  const [vendorInviteNote,   setVendorInviteNote]   = useState("");
  const [sendingInvite,      setSendingInvite]       = useState(false);
  const [showDecisionModal,  setShowDecisionModal]  = useState(null); // vendor object
  const [decisionMessage,    setDecisionMessage]    = useState("");
  const [sendingDecision,    setSendingDecision]    = useState(false);
  const [vendorView,         setVendorView]         = useState("list"); // list | invite
  const [showPublishModal,   setShowPublishModal]   = useState(false); // "publish" | "unpublish" | null
  const [showManualVendor,   setShowManualVendor]   = useState(false);
  const [manualVendor,       setManualVendor]       = useState(null); // vendor being manually edited
  const [collaborators,      setCollaborators]      = useState([]);
  const [ownerEmail,         setOwnerEmail]         = useState("");
  const [showTransferModal,  setShowTransferModal]  = useState(false);
  const [transferTarget,     setTransferTarget]     = useState("");
  const [collabInviteEmail,  setCollabInviteEmail]  = useState("");
  const [collabInviteRole,   setCollabInviteRole]   = useState("view_only");
  const [sendingCollab,      setSendingCollab]      = useState(false);
  const [userRole,           setUserRole]           = useState("owner"); // this user's role
  const [__prefs, , __t] = useAppTheme();
  const __accent = __t.accent;

  // Permission helpers — computed from userRole (defined after userRole state)
  const allowedTabs = ROLE_ACCESS[userRole] || ROLE_ACCESS.owner;
  const enabledFeatures = event?.enabled_features || Object.keys(ROLE_ACCESS.owner[0]) || allowedTabs;
  const readOnlyTabs = ROLE_READONLY[userRole] || [];
  const canSee  = (tab) => allowedTabs.includes(tab);
  const canEdit = (tab) => !readOnlyTabs.includes(tab);
  const isReadOnly = (tab) => !canEdit(tab);
  const [deletingGuest, setDeletingGuest] = useState(null);
  const [selectedGuests, setSelectedGuests] = useState([]);

  // Mobile resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Load everything ───────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [ev, gs, ts, bd, vs, ex, ss, ps, rqRes] = await Promise.all([
          fetchEvent(eventId),
          fetchGuests(eventId),
          fetchTasks(eventId),
          fetchBudget(eventId),
          fetchVendors(eventId),
          fetchExpenses(eventId),
          fetchSongs(eventId),
          fetchPolls(eventId),
          supabase.from('guest_requests').select('*').eq('event_id', eventId).eq('status', 'pending').order('created_at', { ascending: false }),
        ]);
        setEvent(ev); setGuests(gs); setTasks(ts);
        // Load ticketing data for ticketed/hybrid events
        if (ev) {
          const [{ data: tierData }, { data: orderData }, { data: collabData }] = await Promise.all([
            supabase.from("ticket_tiers").select("*").eq("event_id", eventId).order("sort_order"),
            supabase.from("ticket_orders").select("*, ticket_tiers(name)").eq("event_id", eventId).order("created_at", { ascending: false }),
            supabase.from("event_collaborators").select("*").eq("event_id", eventId).order("created_at"),
          ]);
          setTiers(tierData || []);
          setOrders(orderData || []);
          setCollaborators(collabData || []);
          // Determine current user's role
          const { data: { user } } = await supabase.auth.getUser();
          if (user && ev.organiser_id !== user.id) {
            const myCollab = (collabData || []).find(c => c.user_id === user.id && c.status === "accepted");
            if (myCollab) setUserRole(myCollab.role);
            // Load owner email from a collaborator row that was previously owner, or use organiser_id lookup
            // Best effort: find in collabData if owner was previously a collab, else leave blank
          } else {
            setUserRole("owner");
            if (user?.email) setOwnerEmail(user.email);
          }
          // For collaborators viewing: try to get owner email from event (if stored) or a profile table
          // Fall back to showing organiser_id short-form if email unavailable
          if (ev.organiser_email) setOwnerEmail(ev.organiser_email);
        }
        setBudget(bd); setVendors(vs); setExpenses(ex); setSongs(ss); setPolls(ps);
        setRequests(rqRes?.data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  // ── Real-time subscriptions ───────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    const unsubs = [
      subscribeToGuests(eventId, setGuests),
      subscribeToSongs(eventId,  setSongs),
      subscribeToPolls(eventId,  setPolls),
      subscribeToTasks(eventId,  setTasks),
    ];

    // Real-time for join requests
    const reqCh = supabase.channel(`requests_${eventId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "guest_requests",
        filter: `event_id=eq.${eventId}`
      }, payload => {
        if (payload.new.status === "pending") {
          setRequests(rs => [payload.new, ...rs]);
        }
      }).subscribe();

    return () => { unsubs.forEach(fn => fn()); supabase.removeChannel(reqCh); };
  }, [eventId]);

  // ── Derived values ────────────────────────────────────────
  const attending   = guests.filter(g => g.status === "attending").length;
  const pending     = guests.filter(g => g.status === "pending").length;
  const declined    = guests.filter(g => g.status === "declined").length;
  const checkedIn   = guests.filter(g => g.checked_in).length;
  const totalBudget = event?.total_budget ?? 0;
  const totalSpent  = budget.reduce((s, c) => s + (c.spent || 0), 0);
  const daysUntil   = event ? Math.ceil((new Date(event.date) - new Date()) / 86400000) : "—";
  const inviteLink  = event ? `${window.location.origin}/e/${event.invite_slug}` : "";

  const copyLink = () => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ── Actions ───────────────────────────────────────────────
  // ── Checklist handlers ──────────────────────────────────────
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    const t = await addTask(eventId, newTaskText.trim(), newTaskDue || null);
    setTasks(ts => [...ts, t]);
    setNewTaskText("");
    setNewTaskDue("");
  };

  const handleUpdateTask = async () => {
    if (!editingTask?.text?.trim()) return;
    await updateTask(editingTask.id, editingTask.text.trim(), editingTask.due_date || null);
    setTasks(ts => ts.map(t => t.id === editingTask.id ? { ...t, text: editingTask.text, due_date: editingTask.due_date } : t));
    setEditingTask(null);
  };

  const handleDeleteTask = async (id) => {
    setTasks(ts => ts.filter(t => t.id !== id));
    await deleteTask(id);
  };

  const handleToggleTask = async (id, done) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done } : t)); // optimistic
    await toggleTask(id, done);
  };

  const handleCheckIn = async (guestId) => {
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, checked_in: true, checked_in_at: new Date().toISOString() } : g));
    await checkInGuest(guestId);
  };

  const handleUnCheckIn = async (guestId) => {
    setGuests(gs => gs.map(g => g.id === guestId ? { ...g, checked_in: false, checked_in_at: null } : g));
    await supabase.from("guests").update({ checked_in: false, checked_in_at: null }).eq("id", guestId);
  };

  // Event-wide QR — points to /checkin/event/:eventId, guests pick themselves
  const getEventQRUrl = () => {
    const url = window.location.origin + "/checkin/event/" + eventId;
    return "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + encodeURIComponent(url);
  };

  const handleQRCheckIn = async (guestId) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) { setScanResult({ success: false, name: "Guest not found" }); return; }
    if (guest.checked_in) { setScanResult({ success: false, name: `${guest.name} already checked in` }); return; }
    await handleCheckIn(guestId);
    setScanResult({ success: true, name: guest.name || guest.email });
    setTimeout(() => setScanResult(null), 3000);
  };

  // Generate a QR code URL for a guest using a public QR API
  const getQRUrl = (guestId) => {
    const url = window.location.origin + "/checkin/" + guestId;
    return "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(url);
  };

  const handleSendInvites = async () => {
    setInviting(true);
    setInviteResult(null);
    try {
      // Work out which guests to target
      const toInvite = selectedGuests.length
        ? guests.filter(g => selectedGuests.includes(g.id) && g.email)
        : guests.filter(g => g.email && !g.invited_at); // only uninvited when no selection

      if (!toInvite.length) {
        setInviteResult({ success: false, message: "No guests with email addresses found. Add emails to your guests first." });
        return;
      }

      // Clear invited_at first so the Edge Function always finds them
      // (guards against stale invited_at values from previous attempts)
      await supabase.from("guests")
        .update({ invited_at: null })
        .in("id", toInvite.map(g => g.id));

      const ids = toInvite.map(g => g.id);
      const result = await sendInvites(eventId, ids);
      const fresh = await fetchGuests(eventId);
      setGuests(fresh);
      setSelectedGuests([]);
      if (result.sent === 0) {
        setInviteResult({ success: false, message: result.failed?.length
          ? `Failed: ${result.failed.join(", ")}`
          : (result.message || "No invites sent — check Supabase SMTP settings.") });
      } else {
        setInviteResult({ success: true, message: `${result.sent} invite${result.sent !== 1 ? "s" : ""} sent!${result.failed?.length ? ` (${result.failed.length} failed: ${result.failed.join(", ")})` : ""}` });
      }
    } catch (err) {
      setInviteResult({ success: false, message: err.message });
    } finally {
      setInviting(false);
      setTimeout(() => setInviteResult(null), 6000);
    }
  };

    const handleAddGuest = async () => {
    if (!newGuestEmail.trim()) return;
    try {
      const { data, error } = await supabase
        .from("guests")
        .insert({ event_id: eventId, email: newGuestEmail.trim(), name: newGuestName.trim() || null, status: "pending" })
        .select().single();
      if (error) throw error;
      setGuests(gs => [...gs, data]);
      setNewGuestName("");
      setNewGuestEmail("");
    } catch (err) {
      console.error("Failed to add guest:", err.message);
    }
  };

  const handleApproveRequest = async (req) => {
    // Create a guest row for them
    const { data: guest, error } = await supabase.from("guests").insert({
      event_id: eventId,
      name:     req.name,
      email:    req.email,
      status:   "pending",
    }).select().single();
    if (error) { console.error(error); return; }
    // Mark request approved
    await supabase.from("guest_requests").update({ status: "approved" }).eq("id", req.id);
    setRequests(rs => rs.filter(r => r.id !== req.id));
    setGuests(gs => [...gs, guest]);
  };

  const handleRejectRequest = async (id) => {
    await supabase.from("guest_requests").update({ status: "rejected" }).eq("id", id);
    setRequests(rs => rs.filter(r => r.id !== id));
  };

  const handleEditGuest = async () => {
    if (!editingGuest) return;
    try {
      const { data, error } = await supabase
        .from("guests")
        .update({ name: editingGuest.name, email: editingGuest.email, status: editingGuest.status, dietary: editingGuest.dietary })
        .eq("id", editingGuest.id)
        .select().single();
      if (error) throw error;
      setGuests(gs => gs.map(g => g.id === data.id ? data : g));
      setEditingGuest(null);
    } catch (err) {
      console.error("Failed to update guest:", err.message);
    }
  };

  const handleDeleteGuest = async (id) => {
    setGuests(gs => gs.filter(g => g.id !== id));
    setDeletingGuest(null);
    await supabase.from("guests").delete().eq("id", id);
  };

  // ── Budget / Expense handlers ──────────────────────────────
  const openAddExpense = (category) => {
    setExpenseCategory(category);
    setEditingExpense(null);
    setExpenseForm({ description: "", amount: "" });
    setShowExpenseModal(true);
  };

  const openEditExpense = (expense) => {
    const cat = budget.find(c => c.id === expense.category_id);
    setExpenseCategory(cat);
    setEditingExpense(expense);
    setExpenseForm({ description: expense.description, amount: String(expense.amount) });
    setShowExpenseModal(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.description.trim() || !expenseForm.amount) return;
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    try {
      if (editingExpense) {
        const updated = await updateExpense(editingExpense.id, expenseForm.description, amount);
        setExpenses(es => es.map(e => e.id === updated.id ? updated : e));
      } else {
        const created = await addExpense(eventId, expenseCategory.id, expenseForm.description, amount);
        setExpenses(es => [created, ...es]);
      }
      // Re-fetch budget categories so spent totals update
      const fresh = await fetchBudget(eventId);
      setBudget(fresh);
      setShowExpenseModal(false);
    } catch (err) {
      console.error("Expense save error:", err.message);
    }
  };

  const handleDeleteExpense = async (expense) => {
    setExpenses(es => es.filter(e => e.id !== expense.id));
    await deleteExpense(expense.id);
    const fresh = await fetchBudget(eventId);
    setBudget(fresh);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.label.trim() || !categoryForm.allocated) return;
    try {
      const { data, error } = await supabase.from("budget_categories")
        .insert({ event_id: eventId, label: categoryForm.label.trim(), allocated: parseFloat(categoryForm.allocated), spent: 0, icon: categoryForm.icon, color: categoryForm.color })
        .select().single();
      if (error) throw error;
      setBudget(b => [...b, data]);
      setShowCategoryModal(false);
      setCategoryForm({ label: "", allocated: "", icon: "💰", color: "var(--accent)" });
    } catch (err) { console.error(err.message); }
  };

  const handleDeleteCategory = async (id) => {
    setBudget(b => b.filter(c => c.id !== id));
    setExpenses(es => es.filter(e => e.category_id !== id));
    await supabase.from("budget_categories").delete().eq("id", id);
  };

  const handleUpdateCategoryBudget = async (id, allocated) => {
    setBudget(b => b.map(c => c.id === id ? { ...c, allocated } : c));
    await supabase.from("budget_categories").update({ allocated }).eq("id", id);
  };

  // ── Spotify (client credentials — no OAuth needed) ─────────
  const getSpotifyToken = async () => {
    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=client_credentials&client_id=${import.meta.env.VITE_SPOTIFY_CLIENT_ID}&client_secret=${import.meta.env.VITE_SPOTIFY_CLIENT_SECRET}`,
      });
      const data = await res.json();
      if (data.access_token) { setSpotifyToken(data.access_token); return data.access_token; }
    } catch {}
    return null;
  };

  const searchSpotify = async (query) => {
    if (!query.trim()) { setSpotifyResults([]); return; }
    setSpotifySearching(true);
    try {
      let token = spotifyToken;
      if (!token) token = await getSpotifyToken();
      if (!token) return;
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSpotifyResults(data.tracks?.items || []);
    } catch (e) { console.error(e); }
    finally { setSpotifySearching(false); }
  };

  const addSpotifySong = async (track) => {
    try {
      const { data, error } = await supabase.from("songs").insert({
        event_id:    eventId,
        title:       track.name,
        artist:      track.artists.map(a => a.name).join(", "),
        spotify_id:  track.id,
        spotify_uri: track.uri,
        preview_url: track.preview_url,
        artwork_url: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
        duration_ms: track.duration_ms,
        added_by:    "Organiser",
      }).select().single();
      if (error) throw error;
      setSongs(s => [data, ...s].sort((a, b) => b.votes - a.votes));
      setSpotifySearch("");
      setSpotifyResults([]);
    } catch (e) { console.error(e); }
  };

  const togglePreview = (track) => {
    // For search results (not in song list) — simple toggle
    const tid = track.spotify_id || track.id;
    if (playingPreview === tid) {
      previewAudio?.pause();
      setPreviewAudio(null);
      setPlayingPreview(null);
      return;
    }
    previewAudio?.pause();
    if (!track.preview_url) return;
    const audio = new Audio(track.preview_url);
    audio.volume = 0.6;
    audio.play();
    audio.onended = () => { setPlayingPreview(null); setPreviewAudio(null); };
    setPreviewAudio(audio);
    setPlayingPreview(tid);
  };



  // Auto-advance playlist when Spotify embed finishes a track
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== "https://open.spotify.com") return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        // Spotify embed sends {type:"playback_update", payload:{isPaused, position, duration}}
        // When position >= duration and isPaused becomes true, the track ended
        if (data?.type === "playback_update") {
          const { isPaused, position, duration } = data.payload || {};
          if (isPaused && duration > 0 && position >= duration - 0.5) {
            // Advance to next song
            setNowPlaying(current => {
              if (!current) return null;
              const idx = songs.findIndex(s => s.id === current.id);
              const next = songs[idx + 1];
              return next?.spotify_id ? next : null;
            });
          }
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [songs]);

  const handleVetoSong = async (songId) => {
    setSongs(s => s.filter(x => x.id !== songId));
    await supabase.from("songs").update({ vetoed: true }).eq("id", songId);
  };

  const VENDOR_ICONS = ["🏢","🎵","📸","🌸","🍽️","🎂","🚗","💡","🎤","🎪","🎨","🍷"];

  const openAddVendor = () => {
    setEditingVendor(null);
    setVendorForm({ name: "", role: "", contact: "", phone: "", notes: "", status: "pending", icon: "🏢" });
    setShowVendorModal(true);
  };

  const openEditVendor = (v) => {
    setEditingVendor(v);
    setVendorForm({ name: v.name || "", role: v.role || "", contact: v.contact || "", phone: v.phone || "", notes: v.notes || "", status: v.status || "pending", icon: v.icon || "🏢" });
    setShowVendorModal(true);
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.name.trim()) return;
    try {
      if (editingVendor) {
        const { data, error } = await supabase.from("vendors")
          .update(vendorForm).eq("id", editingVendor.id).select().single();
        if (error) throw error;
        setVendors(vs => vs.map(v => v.id === data.id ? data : v));
      } else {
        const { data, error } = await supabase.from("vendors")
          .insert({ event_id: eventId, ...vendorForm }).select().single();
        if (error) throw error;
        setVendors(vs => [...vs, data]);
      }
      setShowVendorModal(false);
    } catch (err) {
      console.error("Vendor save error:", err.message);
    }
  };

  const handleDeleteVendor = async (id) => {
    const vendor = vendors.find(v => v.id === id);
    if (!window.confirm(`Remove ${vendor?.name || "this vendor"}?${vendor?.email ? " They will receive a rejection email." : ""}`)) return;
    // Send rejection email if they submitted a form
    if (vendor?.email && vendor?.form_submitted_at) {
      await fetch(`${FUNCTIONS_BASE}/vendor-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ vendorId: id, decision: "declined", message: "" }),
      }).catch(() => {});
    }
    setVendors(vs => vs.filter(v => v.id !== id));
    await supabase.from("vendors").delete().eq("id", id);
  };

  // ── Collaboration ────────────────────────────────────────────
  const handleSendCollabInvite = async () => {
    if (!collabInviteEmail.trim()) return;
    setSendingCollab(true);
    try {
      const { data: collab, error } = await supabase.from("event_collaborators").insert({
        event_id: eventId, email: collabInviteEmail.trim().toLowerCase(), role: collabInviteRole,
      }).select().single();
      if (error) throw error;
      setCollaborators(cs => [...cs, collab]);
      // Send invite email
      const res = await fetch(`${FUNCTIONS_BASE}/send-collab-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ collabId: collab.id }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setCollabInviteEmail(""); setCollabInviteRole("view_only");
    } catch (e) { alert("Error: " + e.message); }
    setSendingCollab(false);
  };

  const handleRemoveCollab = async (id) => {
    if (!window.confirm("Remove this collaborator?")) return;
    await supabase.from("event_collaborators").delete().eq("id", id);
    setCollaborators(cs => cs.filter(c => c.id !== id));
  };

  const handleUpdateCollabRole = async (id, role) => {
    await supabase.from("event_collaborators").update({ role }).eq("id", id);
    setCollaborators(cs => cs.map(c => c.id === id ? { ...c, role } : c));
  };

  const handleLeaveEvent = async () => {
    if (!window.confirm("Leave this event? You'll lose access and need to be re-invited.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("event_collaborators")
      .delete().eq("event_id", eventId).eq("user_id", user.id);
    navigate("/events");
  };

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestedRole, setRequestedRole] = useState("admin");
  const [requestNote, setRequestNote] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);

  const handleRequestAccess = async () => {
    setSendingRequest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Send a notification — store as a special pending collab row or use a simple note
      // We'll update the host_message field on the existing collab row as a signal
      await supabase.from("event_collaborators")
        .update({ host_message: `ACCESS REQUEST: Wants ${requestedRole}. Note: ${requestNote}` })
        .eq("event_id", eventId).eq("user_id", user.id);
      setShowRequestModal(false);
      setRequestNote("");
      alert("Request sent! The owner will be notified next time they view the Collaborate section.");
    } catch (e) { alert("Error: " + e.message); }
    setSendingRequest(false);
  };

  const handleTransferOwnership = async (collabId) => {
    if (userRole !== "owner") return; // Only the owner can transfer
    if (!window.confirm("Transfer ownership? You will become an Admin and cannot undo this without the new owner.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    const collab = collaborators.find(c => c.id === collabId);
    if (!collab) return;
    // Update event organiser_id + organiser_email
    await supabase.from("events").update({
      organiser_id:    collab.user_id,
      organiser_email: collab.email,
    }).eq("id", eventId);
    // Add current user as admin collab
    await supabase.from("event_collaborators").upsert({
      event_id: eventId, email: user?.email || "", user_id: user?.id,
      role: "admin", status: "accepted",
    });
    // Remove new owner's collab row (they're now the event owner)
    await supabase.from("event_collaborators").delete().eq("id", collabId);
    setOwnerEmail(collab.email);
    setUserRole("admin");
    setCollaborators(cs => cs.filter(c => c.id !== collabId));
    alert("Ownership transferred to " + collab.email + ". You are now an Admin.");
  };

  // ── Vendor invite ────────────────────────────────────────────
  const handleSendVendorInvite = async () => {
    if (!vendorInviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      // Create vendor row first
      const { data: newVendor, error } = await supabase.from("vendors").insert({
        event_id: eventId,
        email: vendorInviteEmail.trim(),
        name: vendorInviteEmail.split("@")[0], // placeholder name
        host_message: vendorInviteNote.trim() || null,
        status: "invited",
      }).select().single();
      if (error) throw error;

      // Send invite email
      const res = await fetch(`${FUNCTIONS_BASE}/send-vendor-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ vendorId: newVendor.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setVendors(vs => [...vs, newVendor]);
      setVendorInviteEmail("");
      setVendorInviteNote("");
      setVendorView("list");
    } catch (e) { alert("Error: " + e.message); }
    setSendingInvite(false);
  };

  const handleVendorDecision = async (decision) => {
    if (!showDecisionModal) return;
    setSendingDecision(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/vendor-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ vendorId: showDecisionModal.id, decision, message: decisionMessage }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVendors(vs => vs.map(v => v.id === showDecisionModal.id ? { ...v, status: decision, host_message: decisionMessage } : v));
      setShowDecisionModal(null);
      setDecisionMessage("");
    } catch (e) { alert("Error: " + e.message); }
    setSendingDecision(false);
  };

  const handleVendorStatus = async (id, status) => {
    setVendors(vs => vs.map(v => v.id === id ? { ...v, status } : v));
    await supabase.from("vendors").update({ status }).eq("id", id);
  };

  const handleAddSong = async () => {
    if (!newSong.title || !newSong.artist) return;
    await addSong(eventId, newSong.title, newSong.artist, "Organiser");
    setNewSong({ title: "", artist: "" });
    // real-time subscription will refresh songs automatically
  };

  const handleVoteSong = async (songId) => {
    // Host can vote unlimited — no restriction, but track locally to show visual state per session
    setSongs(ss => ss.map(s => s.id === songId ? { ...s, votes: s.votes + 1 } : s).sort((a, b) => b.votes - a.votes));
    setVotedSongs(v => [...v, songId]);
    const { data: { user } } = await supabase.auth.getUser();
    // Use a unique token per vote attempt so host isn't blocked by unique constraint
    await supabase.rpc("cast_song_vote", { p_song_id: songId, p_voter_token: "organiser-" + user?.id + "-" + Date.now() });
  };

  const playFullSong = (song) => {
    if (!song.spotify_id) return;
    // Toggle off if same song
    if (nowPlaying?.id === song.id) { setNowPlaying(null); return; }
    setNowPlaying(song);
  };

  const handleExportCSV = () => {
    const header = "Title,Artist,Votes,Spotify URI";
    const rows = songs.map(s =>
      `"${s.title.replace(/"/g,'""')}","${s.artist.replace(/"/g,'""')}",${s.votes},"${s.spotify_uri || ""}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${event?.name || "playlist"}-eventflow.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const [pollOptions, setPollOptions] = useState(["", "", ""]);
  const [pollError, setPollError] = useState(null);

  const handleCreatePoll = async () => {
    if (!newPollQ.trim()) return;
    const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) { setPollError("Add at least 2 options."); return; }
    setPollError(null);
    try {
      await createPoll(eventId, newPollQ, validOptions);
      setNewPollQ("");
      setPollOptions(["", "", ""]);
      // Refresh polls list
      const fresh = await fetchPolls(eventId);
      setPolls(fresh);
    } catch (err) {
      setPollError(err.message);
    }
  };

  const updatePollOption = (i, val) => setPollOptions(opts => opts.map((o, idx) => idx === i ? val : o));
  const addPollOption = () => setPollOptions(opts => [...opts, ""]);
  const removePollOption = (i) => setPollOptions(opts => opts.filter((_, idx) => idx !== i));

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg,#fafaf8)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", color: "var(--text3,#9b9890)", fontSize: 15 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); :root{--bg:#fafaf8}`}</style>
      Loading your event…
    </div>
  );

  if (!event) return (
    <div style={{ minHeight: "100vh", background: "var(--bg,#fafaf8)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", color: "var(--danger,#dc2626)" }}>
      Event not found.
    </div>
  );

  // ── Styles (theme-aware via CSS variables from theme.js) ──
  const css = globalCSS(__t) + `
    /* Dashboard-specific overrides */
    ::selection { background: var(--accent); color: #fff; }
    .nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:8px; cursor:pointer; transition:all 0.15s; font-size:14px; font-weight:500; color:var(--text2); border:none; background:none; width:100%; text-align:left; font-family:inherit; }
    .nav-item:hover { background:var(--bg3); color:var(--text); }
    .nav-item.active { background:var(--accentBg); color:var(--accent); font-weight:600; }
    .card { background:var(--bg2); border:1.5px solid var(--border); border-radius:var(--radius); }
    .field { background:var(--bg); border:1.5px solid var(--border); border-radius:8px; padding:10px 14px; color:var(--text); font-size:14px; outline:none; font-family:inherit; width:100%; transition:border-color 0.15s,box-shadow 0.15s; }
    .field:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accentBg); }
    .field::placeholder { color:var(--text3); }
    .btn-gold { background:var(--accent); color:#fff; border:none; padding:9px 18px; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; transition:opacity 0.15s; white-space:nowrap; display:inline-flex; align-items:center; gap:6px; }
    .btn-gold:hover:not(:disabled) { opacity:0.85; }
    .btn-gold:disabled { opacity:0.45; cursor:not-allowed; }
    .btn-ghost { background:transparent; color:var(--text2); border:1.5px solid var(--border); padding:8px 16px; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
    .btn-ghost:hover { color:var(--text); border-color:var(--text3); background:var(--bg3); }
    .tag { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
    .tag-green  { background:rgba(5,150,105,0.1);  color:#059669; }
    .tag-amber  { background:rgba(217,119,6,0.1);  color:#d97706; }
    .tag-red    { background:rgba(220,38,38,0.1);  color:#dc2626; }
    .tag-blue   { background:rgba(37,99,235,0.1);  color:#2563eb; }
    .progress-bar { height:5px; background:var(--bg3); border-radius:3px; overflow:hidden; border:1px solid var(--border); }
    .progress-fill { height:100%; border-radius:3px; transition:width 0.6s cubic-bezier(0.16,1,0.3,1); }
    .row-hover:hover { background:var(--bg3); cursor:pointer; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
    .fade-up { animation:fadeUp 0.25s ease forwards; }
    .vote-btn { opacity:0.5; transition:opacity 0.15s; background:var(--accentBg); border:none; border-radius:6px; color:var(--accent); padding:5px 10px; font-size:12px; cursor:pointer; font-family:inherit; }
    .song-row:hover .vote-btn { opacity:1; }
    .vote-btn:hover { opacity:1!important; }
    .mobile-nav-btn { display:flex; flex-direction:column; align-items:center; gap:3px; background:none; border:none; color:var(--text3); cursor:pointer; font-family:inherit; padding:8px 4px; flex:1; transition:color 0.15s; min-width:0; }
    .mobile-nav-btn.active { color:var(--accent); }
    .mobile-nav-btn span.icon { font-size:20px; }
    .mobile-nav-btn span.label { font-size:10px; letter-spacing:0.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
    .mode-pill { display:inline-flex; background:var(--bg3); border:1.5px solid var(--border); border-radius:99px; padding:3px; gap:2px; }
    .mode-pill button { border:none; border-radius:99px; padding:6px 14px; font-size:12px; font-weight:500; cursor:pointer; font-family:inherit; transition:all 0.2s; }
    .mode-pill button.active { background:var(--accent); color:#fff; }
    .mode-pill button:not(.active) { background:none; color:var(--text3); }
  `;

  // Mobile ticketing mode nav items
  const MOBILE_TICKETING_NAV = [
    { id: "checkin",  label: "Check-in", icon: "✓" },
    { id: "tickets",  label: "Tickets",  icon: "🎟" },
    { id: "guests",   label: "Guests",   icon: "◎" },
    { id: "overview", label: "Overview", icon: "⌂" },
  ];
  const MOBILE_FULL_NAV = NAV.filter(n =>
    !n.ticketed || ["ticketed","hybrid"].includes(event?.ticketing) || (n.ticketed && tiers.length > 0)
  ).slice(0, 5); // show first 5 on mobile bottom nav

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", color: "var(--text)", flexDirection: isMobile ? "column" : "row" }}>
      <style>{css}</style>

      {/* ── Mobile Header ── */}
      {isMobile && (
        <div style={{ background: "var(--bg2)", borderBottom: "1.5px solid var(--border)", padding: "12px 16px", position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => navigate("/events")} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 18, padding: 0, marginRight: 4 }}>←</button>
            <div style={{ width: 24, height: 24, background: "var(--accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{event.name}</div>
              <div style={{ fontSize: 11, color: "var(--accent)" }}>{new Date(event.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</div>
            </div>
          </div>
          <div className="mode-pill">
            <button className={mobileMode === "full" ? "active" : ""} onClick={() => setMobileMode("full")}>Full</button>
            <button className={mobileMode === "ticketing" ? "active" : ""} onClick={() => setMobileMode("ticketing")}>Door</button>
          </div>
        </div>
      )}

      {/* ── Sidebar (desktop only) ── */}
      {!isMobile && <aside style={{ width: 240, background: "var(--sidebar,var(--bg2))", borderRight: "1.5px solid var(--border)", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28, paddingLeft: 4 }}>
          <div style={{ width: 28, height: 28, background: "var(--accent)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, color:"#fff" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>EventFlow</span>
        </div>

        {/* Event mini card */}
        <div style={{ background: "var(--accentBg)", border: "1.5px solid var(--accentBorder)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 }}>{event.name}</div>
          <div style={{ fontSize: 11, color: "var(--accent)" }}>{new Date(event.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <div style={{ flex: 1, height: 3, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, ((30 - daysUntil) / 30) * 100))}%`, height: "100%", background: "var(--accent)" }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text2)" }}>{daysUntil}d</span>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.filter(n => canSee(n.id) && (event?.enabled_features ? (n.id === "overview" || event.enabled_features.includes(n.id)) : true) && (!n.ticketed || ["ticketed","hybrid"].includes(event?.ticketing) || (n.ticketed && tiers.length > 0))).map(n => (
            <button key={n.id} className={`nav-item${activeNav === n.id ? " active" : ""}`} onClick={() => setActiveNav(n.id)}>
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{n.icon}</span>
              {n.label}
              {n.id === "guests" && (
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ background: "var(--border)", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "var(--text2)" }}>{guests.length}</span>
                  {requests.length > 0 && <span style={{ background: "#ef4444", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "#fff", fontWeight: 700 }}>{requests.length}</span>}
                </span>
              )}
              {n.id === "playlist" && <span style={{ marginLeft: "auto", background: "var(--border)", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "var(--text2)" }}>{songs.length}</span>}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <button onClick={() => navigate("/events")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text2)", fontSize: 13, cursor: "pointer", padding: "8px 0", width: "100%", fontFamily: "inherit", marginBottom: 16, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>
            ← My Events
          </button>
          <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Invite Link</div>
          <a href={inviteLink} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 11, color: "var(--text2)", wordBreak: "break-all", lineHeight: 1.4, marginBottom: 8, textDecoration: "none", cursor: "pointer" }} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>/e/{event?.invite_slug}</a>
          <button className="btn-gold" onClick={copyLink} style={{ width: "100%", padding: "9px", fontSize: 12, justifyContent: "center" }}>{copied ? "✓ Copied!" : "Copy Link"}</button>
          <button onClick={() => supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text3)", fontSize: 12, cursor: "pointer", padding: "8px", width: "100%", fontFamily: "inherit", marginTop: 8, transition: "all 0.15s" }} onMouseEnter={e=>{ e.currentTarget.style.color="#dc2626"; e.currentTarget.style.borderColor="rgba(220,38,38,0.3)"; }} onMouseLeave={e=>{ e.currentTarget.style.color="var(--text3)"; e.currentTarget.style.borderColor="var(--border)"; }}>
            Sign out
          </button>
        </div>
      </aside>}

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 16px 90px" : "36px 44px", background: "var(--bg)" }}>

        {/* OVERVIEW */}
        {activeNav === "overview" && (
          <div className="fade-up">
            <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", marginBottom: 4 }}>{event.name}</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>{new Date(event.date).toLocaleDateString("en-NZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {event.time?.slice(0,5)} · {event.venue_name}</p>
              </div>
              <button onClick={() => setShowEdit(true)} className="btn-ghost" style={{ flexShrink: 0, marginTop: 4 }}>
                ✎ Edit Event
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Days Until",    value: daysUntil,                    sub: "event",               accent: "var(--accent)" },
                { label: "Attending",     value: attending,                     sub: `of ${event.capacity || "∞"}`, accent: "#10b981" },
                { label: "Pending RSVPs", value: pending,                       sub: "awaiting",            accent: "#f59e0b" },
                { label: "Budget Used",   value: `$${totalSpent.toLocaleString()}`, sub: `of $${totalBudget.toLocaleString()}`, accent: "#8b5cf6" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.accent, opacity: 0.7 }} />
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.accent, fontFamily: "inherit", marginBottom: 2 }}>{s.value}</div>
                  <div style={{ fontSize: 13, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Checklist */}
              <div className="card" style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={{ fontFamily: "inherit", fontSize: 17, fontWeight: 700 }}>Checklist</h2>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{tasks.filter(t => t.done).length}/{tasks.length}</span>
                </div>
                <div style={{ height: 3, background: "var(--bg3)", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ width: tasks.length ? `${(tasks.filter(t=>t.done).length/tasks.length)*100}%` : "0%", height: "100%", background: "linear-gradient(90deg,var(--accent),var(--success,#059669))", transition: "width 0.4s" }} />
                </div>
                {tasks.slice(0, 6).map(t => (
                  <div key={t.id} className="row-hover" onClick={() => handleToggleTask(t.id, !t.done)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 8 }}>
                    <div style={{ width: 18, height: 18, border: `1.5px solid ${t.done ? "var(--accent)" : "var(--text3)"}`, borderRadius: 5, background: t.done ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--bg)", flexShrink: 0, transition: "all 0.2s" }}>
                      {t.done ? "✓" : ""}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: t.done ? "var(--text3)" : "var(--text)", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                    {t.due_date && <span style={{ fontSize: 11, color: "var(--text3)" }}>{new Date(t.due_date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</span>}
                  </div>
                ))}
              </div>

              {/* RSVP */}
              <div className="card" style={{ padding: "22px 24px" }}>
                <h2 style={{ fontFamily: "inherit", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>RSVP Breakdown</h2>
                <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "Attending", count: attending, color: "#10b981" },
                    { label: "Pending",   count: pending,   color: "#f59e0b" },
                    { label: "Declined",  count: declined,  color: "#ef4444" },
                  ].map(r => (
                    <div key={r.label} style={{ flex: 1, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: r.color, fontFamily: "inherit" }}>{r.count}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{r.label}</div>
                    </div>
                  ))}
                </div>
                {event.capacity && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>
                      <span>Capacity</span><span>{attending}/{event.capacity}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min((attending/event.capacity)*100,100)}%`, background: "linear-gradient(90deg,#10b981,#059669)" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Budget strip */}
            <div className="card" style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ fontFamily: "inherit", fontSize: 17, fontWeight: 700 }}>Budget Snapshot</h2>
                <button className="btn-ghost" onClick={() => setActiveNav("budget")}>View Details →</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>
                <span>Total Spent</span><span style={{ color: "var(--accent)" }}>${totalSpent.toLocaleString()} / ${totalBudget.toLocaleString()}</span>
              </div>
              <div className="progress-bar" style={{ height: 8, marginBottom: 16 }}>
                <div className="progress-fill" style={{ width: totalBudget ? `${Math.min((totalSpent/totalBudget)*100,100)}%` : "0%", background: "linear-gradient(90deg,var(--accent),var(--warning,#d97706))" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${budget.length},1fr)`, gap: 10 }}>
                {budget.map(c => {
                  const pct = c.allocated ? Math.round((c.spent/c.allocated)*100) : 0;
                  return (
                    <div key={c.id} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{c.icon}</div>
                      <div style={{ height: 40, background: "var(--bg3)", borderRadius: 5, overflow: "hidden", display: "flex", flexDirection: "column-reverse", marginBottom: 4 }}>
                        <div style={{ height: `${pct}%`, background: c.color, opacity: 0.8, transition: "height 0.6s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text2)" }}>{c.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* GUESTS */}
        {activeNav === "guests" && (
          <div className="fade-up">
            {isReadOnly("guests") && <ReadOnlyBanner role={userRole} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Guest List</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>{attending} attending · {pending} pending · {declined} declined</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {selectedGuests.length > 0 && (
                  <span style={{ fontSize: 13, color: "var(--accent)" }}>{selectedGuests.length} selected</span>
                )}
                <button className="btn-ghost" onClick={() => setSelectedGuests([])} style={{ display: selectedGuests.length ? "block" : "none", padding: "10px 16px", fontSize: 13 }}>
                  Clear
                </button>
                {canEdit("guests") && <button className="btn-gold" onClick={handleSendInvites} disabled={inviting} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {inviting ? "Sending…" : selectedGuests.length > 0 ? `✉ Send to ${selectedGuests.length}` : "✉ Send Uninvited"}
                </button>}
              </div>
            </div>
            {inviteResult && (
              <div style={{ background: inviteResult.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${inviteResult.success ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: inviteResult.success ? "#10b981" : "#ef4444" }}>
                {inviteResult.success ? "✓" : "⚠"} {inviteResult.message}
              </div>
            )}
            {/* Requests inbox */}
            {requests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", animation: "pulse 2s infinite" }}>{requests.length}</div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Join Requests</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {requests.map(req => (
                    <div key={req.id} style={{ background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 12, padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: req.message ? 10 : 0 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{req.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text2)" }}>
                            {req.email}
                            {req.phone && <span> · {req.phone}</span>}
                            <span style={{ marginLeft: 8, color: "var(--text3)" }}>{new Date(req.created_at).toLocaleDateString("en-NZ")}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button onClick={() => handleRejectRequest(req.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "7px 14px", color: "#ef4444", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(239,68,68,0.1)"}>
                            Decline
                          </button>
                          <button onClick={() => handleApproveRequest(req)} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "7px 14px", color: "#10b981", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(16,185,129,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(16,185,129,0.1)"}>
                            Approve
                          </button>
                        </div>
                      </div>
                      {req.message && (
                        <div style={{ fontSize: 13, color: "#7a7268", fontStyle: "italic", borderLeft: "2px solid rgba(201,168,76,0.2)", paddingLeft: 12, lineHeight: 1.6 }}>
                          "{req.message}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add guest form */}
            <div className="card" style={{ padding: "18px 22px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Name</div>
                <input className="field" placeholder="Guest name" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email</div>
                <input className="field" type="email" placeholder="guest@email.com" value={newGuestEmail} onChange={e => setNewGuestEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddGuest()} />
              </div>
              {canEdit("guests") && <button className="btn-gold" onClick={handleAddGuest} disabled={!newGuestEmail.trim()}>Add Guest</button>}
            </div>

            <div className="card">
              <div style={{ display: "grid", gridTemplateColumns: "36px 2fr 2fr 1fr 1fr auto", padding: "12px 20px", borderBottom: "1.5px solid var(--border)", alignItems: "center" }}>
                <input type="checkbox"
                  checked={selectedGuests.length === guests.filter(g => g.email).length && guests.filter(g => g.email).length > 0}
                  onChange={e => setSelectedGuests(e.target.checked ? guests.filter(g => g.email).map(g => g.id) : [])}
                  style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }}
                />
                {["Name", "Email", "Status", "Invited"].map(h => (
                  <div key={h} style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</div>
                ))}
                <div />
              </div>
              {guests.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--text3)", fontSize: 14 }}>No guests yet — add someone above.</div>
              )}
              {guests.map((g, i) => (
                <div key={g.id} style={{ display: "grid", gridTemplateColumns: "36px 2fr 2fr 1fr 1fr auto", padding: "12px 20px", borderBottom: i < guests.length - 1 ? "1px solid #0f0f1a" : "none", alignItems: "center", gap: 8, background: selectedGuests.includes(g.id) ? "rgba(201,168,76,0.03)" : "transparent" }}>
                  <input type="checkbox"
                    checked={selectedGuests.includes(g.id)}
                    disabled={!g.email}
                    onChange={e => setSelectedGuests(sel => e.target.checked ? [...sel, g.id] : sel.filter(id => id !== g.id))}
                    style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: g.email ? "pointer" : "not-allowed", opacity: g.email ? 1 : 0.3 }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{g.name || <span style={{ color: "var(--text3)" }}>No name</span>}</div>
                  <div style={{ fontSize: 13, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.email || <span style={{ color: "var(--text3)" }}>—</span>}</div>
                  <span className={`tag ${g.status === "attending" ? "tag-green" : g.status === "pending" ? "tag-amber" : "tag-red"}`}>{g.status}</span>
                  <div>
                    {g.invited_at
                      ? <span className="tag" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", fontSize: 11 }} title={`Sent ${new Date(g.invited_at).toLocaleDateString("en-NZ")}`}>✓ Sent</span>
                      : g.email
                        ? <span className="tag" style={{ background: "var(--bg3)", color: "var(--text3)", fontSize: 11 }}>Not sent</span>
                        : <span style={{ fontSize: 12, color: "#2a2a38" }}>No email</span>
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditingGuest({ ...g })} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 6, padding: "5px 10px", color: "var(--text2)", fontSize: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>Edit</button>
                    <button onClick={() => setDeletingGuest(g.id)} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 6, padding: "5px 10px", color: "var(--text2)", fontSize: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#ef4444"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUDGET */}
        {activeNav === "budget" && (
          <div className="fade-up">
            {isReadOnly("budget") && <ReadOnlyBanner role={userRole} />}
            <style>{`
              .ef-field { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s; }
              .ef-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); } .ef-field::placeholder { color: var(--text3); }
              .ef-label { display: block; font-size: 11px; color: #5a5a72; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; font-family: var(--font,'Plus Jakarta Sans',sans-serif); }
              .bm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; backdrop-filter: blur(6px); }
              .bm-modal { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 18px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; box-shadow: 0 32px 80px rgba(0,0,0,0.6); animation: modalIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
              .bm-modal-wide { max-width: 560px; }
              @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
              .bm-swatch { width: 28px; height: 28px; border-radius: 7px; border: 2px solid transparent; cursor: pointer; transition: transform 0.15s; }
              .bm-swatch:hover { transform: scale(1.15); }
              .bm-swatch.sel { border-color: var(--text); transform: scale(1.1); }
              .bm-icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 2px solid transparent; background: var(--bg3); font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
              .bm-icon-btn:hover { border-color: rgba(201,168,76,0.3); background: rgba(201,168,76,0.05); }
              .bm-icon-btn.sel { border-color: var(--accent); background: var(--accentBg); }
            `}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Budget</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>
                  ${totalSpent.toLocaleString()} spent of ${totalBudget.toLocaleString()} · <span style={{ color: totalBudget - totalSpent < 0 ? "#ef4444" : "#10b981" }}>${Math.abs(totalBudget - totalSpent).toLocaleString()} {totalBudget - totalSpent < 0 ? "over" : "remaining"}</span>
                </p>
              </div>
              <button className="btn-gold" onClick={() => { setCategoryForm({ label: "", allocated: "", icon: "💰", color: "var(--accent)" }); setShowCategoryModal(true); }}>
                + Category
              </button>
            </div>

            {/* Summary card — donut + stats */}
            <div className="card" style={{ padding: "22px 24px", marginBottom: 20, display: "flex", gap: 28, alignItems: "center" }}>
              {/* SVG Donut */}
              <div style={{ flexShrink: 0 }}>
                {(() => {
                  const r = 54, cx = 64, cy = 64, stroke = 14;
                  const circ = 2 * Math.PI * r;
                  let offset = 0;
                  const slices = budget.filter(c => (c.spent || 0) > 0);
                  return (
                    <svg width={128} height={128} style={{ transform: "rotate(-90deg)" }}>
                      {/* Track */}
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
                      {slices.length === 0 && (
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
                      )}
                      {slices.map((c, i) => {
                        const pct = totalSpent > 0 ? (c.spent / totalSpent) : 0;
                        const dash = pct * circ;
                        const el = (
                          <circle key={c.id} cx={cx} cy={cy} r={r} fill="none"
                            stroke={c.color || "var(--accent)"}
                            strokeWidth={stroke}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="butt"
                          />
                        );
                        offset += dash;
                        return el;
                      })}
                      {/* Centre label */}
                      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="600"
                        style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px`, fontFamily: "inherit" }}>
                        {totalBudget > 0 ? `${Math.round((totalSpent/totalBudget)*100)}%` : "—"}
                      </text>
                      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text2)" fontSize="10"
                        style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px`, fontFamily: "inherit" }}>
                        used
                      </text>
                    </svg>
                  );
                })()}
              </div>

              {/* Legend */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {budget.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color || "var(--accent)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "#b0a898" }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>${(c.spent || 0).toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>/ ${(c.allocated || 0).toLocaleString()}</span>
                  </div>
                ))}
                {budget.length === 0 && <p style={{ fontSize: 13, color: "var(--text3)" }}>No categories yet</p>}
              </div>
            </div>

            {/* Category rows */}
            {budget.map(c => {
              const spent = c.spent || 0;
              const pct   = c.allocated ? (spent / c.allocated) * 100 : 0;
              const over  = spent > c.allocated;
              const catExpenses = expenses.filter(e => e.category_id === c.id);
              return (
                <div key={c.id} className="card" style={{ marginBottom: 12, overflow: "hidden" }}>
                  {/* Row header */}
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{c.icon}</div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{c.label}</span>
                      <span style={{ fontSize: 13, color: over ? "#ef4444" : "var(--text2)" }}>
                        ${spent.toLocaleString()} <span style={{ color: "var(--text3)" }}>/ ${(c.allocated || 0).toLocaleString()}</span>
                      </span>
                      <span className={`tag ${over ? "tag-red" : pct >= 80 ? "tag-amber" : "tag-green"}`}>
                        {over ? "Over" : `${Math.round(pct)}%`}
                      </span>
                      <button className="btn-ghost" onClick={() => openAddExpense(c)}
                        style={{ padding: "5px 12px", fontSize: 12, color: "var(--accent)", borderColor: "var(--accentBorder)" }}>
                        + Log
                      </button>
                      <button className="btn-ghost" onClick={() => handleDeleteCategory(c.id)}
                        style={{ padding: "5px 9px", fontSize: 12, color: "var(--text3)" }}>✕</button>
                    </div>
                    {/* Progress bar with coloured fill matching category colour */}
                    <div style={{ height: 5, background: "var(--bg2)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: over ? "#ef4444" : (c.color || "var(--accent)"), borderRadius: 99, transition: "width 0.4s" }} />
                    </div>
                  </div>

                  {/* Expense line items */}
                  {catExpenses.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                      {catExpenses.map((e, i) => (
                        <div key={e.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 20px 9px 54px",
                          background: i % 2 === 0 ? "var(--bg3)" : "var(--bg2)",
                          borderBottom: i < catExpenses.length - 1 ? "1px solid var(--border)" : "none"
                        }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: c.color || "var(--accent)", flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, color: "var(--text2)" }}>{e.description}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>${parseFloat(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <button className="btn-ghost" onClick={() => openEditExpense(e)}
                            style={{ padding: "3px 7px", fontSize: 11, color: "var(--text2)" }}>✎</button>
                          <button className="btn-ghost" onClick={() => handleDeleteExpense(e)}
                            style={{ padding: "3px 7px", fontSize: 11, color: "var(--text3)" }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {budget.length === 0 && (
              <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text3)", fontSize: 14 }}>
                No budget categories yet — add one to start tracking.
              </div>
            )}
          </div>
        )}

        {/* EXPENSE MODAL */}
        {showExpenseModal && expenseCategory && (
          <div className="bm-overlay" onClick={() => setShowExpenseModal(false)}>
            <div className="bm-modal" onClick={e => e.stopPropagation()}>
              <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{expenseCategory.icon}</span>
                  <div>
                    <h2 style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                      {editingExpense ? "Edit Expense" : "Log Expense"}
                    </h2>
                    <p style={{ fontSize: 12, color: "var(--text2)" }}>{expenseCategory.label}</p>
                  </div>
                </div>
                <button onClick={() => setShowExpenseModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--text)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>×</button>
              </div>
              <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="ef-label">Description</label>
                  <input className="ef-field" placeholder="e.g. Deposit payment" value={expenseForm.description}
                    onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleSaveExpense()} autoFocus />
                </div>
                <div>
                  <label className="ef-label">Amount (NZD)</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--accent)", fontWeight: 500, fontSize: 14, pointerEvents: "none" }}>$</span>
                    <input className="ef-field" type="number" min="0" step="0.01" placeholder="0.00"
                      value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && handleSaveExpense()}
                      style={{ paddingLeft: 26 }} />
                  </div>
                </div>
                {expenseCategory.allocated > 0 && (
                  <div style={{ background: "var(--bg3)", borderRadius: 9, padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>
                    Budget: <span style={{ color: "var(--text)" }}>${(expenseCategory.spent || 0).toLocaleString()}</span> spent of <span style={{ color: "var(--accent)" }}>${expenseCategory.allocated.toLocaleString()}</span> allocated
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button className="btn-ghost" onClick={() => setShowExpenseModal(false)} style={{ flex: 1 }}>Cancel</button>
                  <button className="btn-gold" onClick={handleSaveExpense}
                    disabled={!expenseForm.description.trim() || !expenseForm.amount}
                    style={{ flex: 2 }}>
                    {editingExpense ? "Save Changes" : "Log Expense"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NEW CATEGORY MODAL */}
        {showCategoryModal && (
          <div className="bm-overlay" onClick={() => setShowCategoryModal(false)}>
            <div className="bm-modal bm-modal-wide" onClick={e => e.stopPropagation()}>
              <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>New Category</h2>
                  <p style={{ fontSize: 12, color: "var(--text2)" }}>Add a budget category to track expenses against.</p>
                </div>
                <button onClick={() => setShowCategoryModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--text)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>×</button>
              </div>
              <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Icon picker */}
                <div>
                  <label className="ef-label">Icon</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["💰","🎵","📸","🌸","🍽️","🎂","🚗","💡","🎤","🎪","🎨","🍷","🏨","✈️","🎭","👗"].map(icon => (
                      <button key={icon} className={`bm-icon-btn${categoryForm.icon === icon ? " sel" : ""}`}
                        onClick={() => setCategoryForm(f => ({ ...f, icon }))}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colour picker */}
                <div>
                  <label className="ef-label">Colour</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["var(--accent)","#8b5cf6","#10b981","#3b82f6","#ef4444","#f59e0b","#ec4899","#06b6d4","#84cc16","#f97316"].map(col => (
                      <button key={col} className={`bm-swatch${categoryForm.color === col ? " sel" : ""}`}
                        style={{ background: col }}
                        onClick={() => setCategoryForm(f => ({ ...f, color: col }))} />
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="ef-label">Category Name</label>
                    <input className="ef-field" placeholder="e.g. Catering" value={categoryForm.label}
                      onChange={e => setCategoryForm(f => ({ ...f, label: e.target.value }))} autoFocus />
                  </div>
                  <div>
                    <label className="ef-label">Budget Allocated (NZD)</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--accent)", fontWeight: 500, fontSize: 14, pointerEvents: "none" }}>$</span>
                      <input className="ef-field" type="number" min="0" step="0.01" placeholder="0.00"
                        value={categoryForm.allocated}
                        onChange={e => setCategoryForm(f => ({ ...f, allocated: e.target.value }))}
                        style={{ paddingLeft: 26 }} />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {categoryForm.label && (
                  <div style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{categoryForm.icon}</div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{categoryForm.label}</span>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: categoryForm.color }} />
                    {categoryForm.allocated && <span style={{ fontSize: 13, color: "var(--text2)" }}>${parseFloat(categoryForm.allocated || 0).toLocaleString()}</span>}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button className="btn-ghost" onClick={() => setShowCategoryModal(false)} style={{ flex: 1 }}>Cancel</button>
                  <button className="btn-gold" onClick={handleSaveCategory}
                    disabled={!categoryForm.label.trim() || !categoryForm.allocated}
                    style={{ flex: 2 }}>
                    Add Category
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PLAYLIST */}
        {activeNav === "playlist" && (
          <div className="fade-up">
            {isReadOnly("playlist") && <ReadOnlyBanner role={userRole} />}
            <style>{`
              .sp-field { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 9px; padding: 11px 14px; color: var(--text); font-size: 14px; outline: none; font-family: var(--font,'Plus Jakarta Sans',sans-serif); width: 100%; box-sizing: border-box; transition: border-color 0.2s; }
              .sp-field:focus { border-color: #1db954; box-shadow: 0 0 0 3px rgba(29,185,84,0.1); }
              .sp-field::placeholder { color: var(--text3); }
              .sp-result { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 9px; transition: background 0.15s; }
              .sp-result:hover { background: var(--bg3); }
              .sp-play { width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(29,185,84,0.15); color: #1db954; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
              .sp-play:hover, .sp-play.playing { background: rgba(29,185,84,0.28); }
              .sp-add { background: rgba(29,185,84,0.12); border: 1px solid rgba(29,185,84,0.2); color: #1db954; border-radius: 7px; padding: 5px 12px; font-size: 12px; cursor: pointer; font-family: var(--font,'Plus Jakarta Sans',sans-serif); transition: all 0.15s; white-space: nowrap; }
              .sp-add:hover { background: rgba(29,185,84,0.22); }
              .sp-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(29,185,84,0.1); border: 1px solid rgba(29,185,84,0.2); color: #1db954; border-radius: 5px; padding: 2px 7px; font-size: 10px; font-weight: 500; }
              .voted-badge { display: inline-flex; align-items: center; background: var(--accentBg); border: 1.5px solid var(--accentBorder); color: var(--accent); border-radius: 5px; padding: 3px 8px; font-size: 11px; }
              @keyframes playerIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
            `}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Playlist</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>
                  {songs.length} song{songs.length !== 1 ? "s" : ""} · guests vote · top tracks make the cut
                </p>
              </div>
              {songs.length > 0 && (
                <button onClick={handleExportCSV}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--bg3)", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 9, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
                  ↓ Export CSV
                </button>
              )}
            </div>

            {/* Spotify iframe player */}
            {nowPlaying?.spotify_id && (
              <div style={{ marginBottom: 16, borderRadius: 14, overflow: "hidden", animation: "playerIn 0.2s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px 6px" }}>
                  <span style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Now Playing</span>
                  <button onClick={() => setNowPlaying(null)}
                    style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 16, cursor: "pointer", padding: "0 2px", transition: "color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.color="var(--text)"}
                    onMouseLeave={e => e.currentTarget.style.color="var(--text3)"}>×</button>
                </div>
                <iframe
                  src={`https://open.spotify.com/embed/track/${nowPlaying.spotify_id}?utm_source=generator&theme=0&autoplay=1`}
                  width="100%" height="80" frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  style={{ borderRadius: 12, display: "block" }}
                />
              </div>
            )}

            {/* Spotify search — collapsible */}
            <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
              {/* Search trigger row */}
              <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                onClick={() => { setSearchOpen(o => !o); if (searchOpen) { setSpotifySearch(""); setSpotifyResults([]); } }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.24-3.021-1.86-6.821-2.28-11.29-1.24-.418.1-.84-.16-.94-.579-.1-.421.16-.84.58-.941 4.9-1.12 9.1-.64 12.48 1.44.37.24.489.72.249 1.08zm1.47-3.27c-.301.47-.94.62-1.41.33-3.461-2.13-8.731-2.75-12.82-1.51-.511.16-1.05-.121-1.211-.63-.16-.51.121-1.05.631-1.21 4.671-1.42 10.47-.72 14.45 1.72.47.29.62.94.33 1.41l.031-.01zm.13-3.4c-4.15-2.461-11-2.69-14.96-1.49-.63.19-1.3-.16-1.49-.79-.19-.63.16-1.3.79-1.49 4.56-1.38 12.14-1.11 16.93 1.72.56.33.74 1.06.4 1.62-.33.56-1.06.74-1.62.4l-.05.03z"/></svg>
                <span style={{ fontSize: 12, color: "#1db954", flex: 1, letterSpacing: "0.07em", textTransform: "uppercase" }}>Search Spotify</span>
                <span style={{ fontSize: 11, color: "var(--text3)", transition: "transform 0.2s", display: "block", transform: searchOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </div>

              {searchOpen && (
                <div style={{ padding: "0 20px 16px" }}>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
                    <input className="sp-field" placeholder="Search songs, artists, albums…"
                      value={spotifySearch}
                      style={{ paddingLeft: 38 }}
                      autoFocus
                      onChange={e => { setSpotifySearch(e.target.value); searchSpotify(e.target.value); }} />
                  </div>

                  {spotifySearching && <div style={{ padding: "10px 4px", fontSize: 13, color: "var(--text2)" }}>Searching…</div>}
                  {spotifyResults.map(track => {
                    const alreadyAdded = songs.some(s => s.spotify_id === track.id);
                    const isPlaying    = playingPreview === track.id;
                    return (
                      <div key={track.id} className="sp-result">
                        <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--bg2)" }}>
                          {track.album?.images?.[2] && <img src={track.album.images[2].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artists.map(a => a.name).join(", ")} · {track.album?.name}</div>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0 }}>
                          {Math.floor(track.duration_ms/60000)}:{String(Math.floor((track.duration_ms%60000)/1000)).padStart(2,"0")}
                        </span>
                        {track.preview_url && (
                          <button className={`sp-play${isPlaying ? " playing" : ""}`} onClick={() => togglePreview(track)} title={isPlaying ? "Stop" : "30s preview"}>
                            {isPlaying ? "■" : "▶"}
                          </button>
                        )}
                        {alreadyAdded
                          ? <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>✓ Added</span>
                          : <button className="sp-add" onClick={() => addSpotifySong(track)}>+ Add</button>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Song list */}
            <div className="card" style={{ overflow: "hidden" }}>
              {songs.length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontSize: 14 }}>
                  Search and add songs above — guests can also suggest and vote from the RSVP page.
                </div>
              )}
              {songs.map((s, i) => {
                const isPlaying  = playingPreview === (s.spotify_id || s.id);
                const isActive   = nowPlaying?.id === s.id;
                const mins = s.duration_ms ? Math.floor(s.duration_ms/60000) : null;
                const secs = s.duration_ms ? String(Math.floor((s.duration_ms%60000)/1000)).padStart(2,"0") : null;
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < songs.length - 1 ? "1px solid var(--border)" : "none", background: isActive ? "rgba(29,185,84,0.04)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg3)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>

                    {/* Rank */}
                    <div style={{ width: 24, textAlign: "center", fontSize: 12, fontWeight: 700, color: i === 0 ? "var(--accent)" : i === 1 ? "#6a6a7a" : "var(--text3)", flexShrink: 0 }}>{i + 1}</div>

                    {/* Artwork — click to play */}
                    <div onClick={() => playFullSong(s)}
                      style={{ width: 44, height: 44, borderRadius: 7, overflow: "hidden", background: "var(--bg3)", flexShrink: 0, position: "relative", cursor: s.spotify_id ? "pointer" : "default" }}>
                      {s.artwork_url
                        ? <img src={s.artwork_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 18 }}>♪</div>
                      }
                      {nowPlaying?.id === s.id && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(29,185,84,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#fff", fontSize: 14 }}>♫</span>
                        </div>
                      )}
                      {s.spotify_id && nowPlaying?.id !== s.id && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background="rgba(0,0,0,0.5)"}
                          onMouseLeave={e => e.currentTarget.style.background="rgba(0,0,0,0)"}>
                          <span style={{ color: "#fff", fontSize: 12, opacity: 0 }} className="play-hover">▶</span>
                        </div>
                      )}
                    </div>

                    {/* Title / artist */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                        {s.title}
                        {s.spotify_id && <span className="sp-badge">Spotify</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.artist} · added by {s.added_by}
                      </div>
                    </div>

                    {/* Duration */}
                    {mins !== null && <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0 }}>{mins}:{secs}</span>}

                    {/* Play button (if preview available) */}
                    {s.spotify_id && (
                      <button className={`sp-play${nowPlaying?.id === s.id ? " playing" : ""}`} onClick={() => playFullSong(s)}
                        title={nowPlaying?.id === s.id ? "Close player" : "Play in Spotify"} style={{ width: 28, height: 28, fontSize: 10 }}>
                        {nowPlaying?.id === s.id ? "■" : "▶"}
                      </button>
                    )}

                    {/* Votes — host can vote unlimited */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", minWidth: 22, textAlign: "right" }}>{s.votes}</span>
                      <button className="vote-btn" onClick={() => handleVoteSong(s.id)} title="Vote (host — unlimited)">▲</button>
                    </div>

                    {/* Remove */}
                    <button onClick={() => handleVetoSong(s.id)}
                      style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 16, cursor: "pointer", padding: "0 2px", transition: "color 0.15s", flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}
                      title="Remove song">×</button>
                  </div>
                );
              })}
            </div>

            {/* CSV export hint */}
            {songs.length > 0 && (
              <div style={{ marginTop: 12, padding: "11px 16px", background: "var(--bg2)", border: "1px solid #1a1a2a", borderRadius: 10, fontSize: 12, color: "var(--text3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Export the playlist as a CSV to import into Spotify, Apple Music, or any playlist tool.</span>
                <button onClick={handleExportCSV}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", whiteSpace: "nowrap", marginLeft: 12 }}>
                  ↓ Download CSV
                </button>
              </div>
            )}
          </div>
        )}

        {/* POLLS */}
        {activeNav === "polls" && (
          <div className="fade-up">
            {isReadOnly("polls") && <ReadOnlyBanner role={userRole} />}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Polls</h1>
              <p style={{ color: "var(--text2)", fontSize: 14 }}>Ask guests anything · live results</p>
            </div>
            <div className="card" style={{ padding: "22px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 16 }}>Create a Poll</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Question</div>
                <input className="field" placeholder="Ask your guests something..." value={newPollQ} onChange={e => setNewPollQ(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Options</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input className="field" placeholder={`Option ${i + 1}`} value={opt} onChange={e => updatePollOption(i, e.target.value)} style={{ flex: 1 }} />
                      {pollOptions.length > 2 && (
                        <button onClick={() => removePollOption(i)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 18, cursor: "pointer", padding: "0 4px", transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addPollOption} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 13, cursor: "pointer", marginTop: 8, padding: "4px 0", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text2)"}>+ Add option</button>
              </div>
              {pollError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>⚠ {pollError}</div>}
              {canEdit("polls") && <button className="btn-gold" onClick={handleCreatePoll} style={{ width: "100%" }}>Create Poll</button>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {polls.map(poll => {
                const options = poll.poll_options || [];
                const total = options.reduce((s, o) => s + (o.votes || 0), 0);
                const winner = [...options].sort((a, b) => b.votes - a.votes)[0];
                return (
                  <div key={poll.id} className="card" style={{ padding: "22px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{poll.question}</div>
                        <div style={{ fontSize: 12, color: "var(--text2)" }}>{total} votes</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className={`tag ${poll.status === "open" ? "tag-green" : "tag-blue"}`}>{poll.status}</span>
                        {poll.status === "open" && <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => closePoll(poll.id)}>Close</button>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {options.map(opt => {
                        const pct = total ? Math.round((opt.votes / total) * 100) : 0;
                        const isWinner = winner && opt.id === winner.id && poll.status === "closed";
                        return (
                          <div key={opt.id}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                              <span style={{ color: isWinner ? "var(--accent)" : "#8a8a9a" }}>{opt.label}{isWinner ? " ✦" : ""}</span>
                              <span style={{ color: "var(--text2)" }}>{opt.votes} · {pct}%</span>
                            </div>
                            <div className="progress-bar" style={{ height: 6 }}>
                              <div className="progress-fill" style={{ width: `${pct}%`, background: isWinner ? "linear-gradient(90deg,var(--accent),var(--warning,#d97706))" : "var(--bg3)" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VENDORS */}
        {activeNav === "vendors" && (
          <div className="fade-up">
            {isReadOnly("vendors") && <ReadOnlyBanner role={userRole} />}
            <style>{`
              .vd-field { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s; }
              .vd-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); } .vd-field::placeholder { color: var(--text3); }
              .vd-label { display: block; font-size: 11px; color: #5a5a72; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 6px; }
              .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }
              .status-submitted { background: rgba(129,140,248,0.12); color: #818cf8; border: 1px solid rgba(129,140,248,0.25); }
              .status-invited   { background: rgba(245,158,11,0.12);  color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }
              .status-confirmed { background: rgba(16,185,129,0.12);  color: #10b981; border: 1px solid rgba(16,185,129,0.25); }
              .status-declined  { background: rgba(239,68,68,0.1);    color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
              .status-pending   { background: rgba(90,90,114,0.15);   color: #5a5a72; border: 1px solid rgba(90,90,114,0.25); }
            `}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Vendors</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>
                  {vendors.length} supplier{vendors.length !== 1 ? "s" : ""} ·{" "}
                  {vendors.filter(v => v.status === "submitted").length > 0 && (
                    <span style={{ color: "#818cf8" }}>{vendors.filter(v => v.status === "submitted").length} awaiting review · </span>
                  )}
                  {vendors.filter(v => v.status === "confirmed").length} confirmed
                </p>
              </div>
              {canEdit("vendors") && <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => { setManualVendor({ name: "", role: "", email: "", phone: "", website: "", instagram: "", description: "" }); setShowManualVendor(true); }}>
                  + Add Manually
                </button>
                <button className="btn-gold" onClick={() => setVendorView(v => v === "invite" ? "list" : "invite")}>
                  {vendorView === "invite" ? "← Back" : "+ Invite Vendor"}
                </button>
              </div>}
            </div>

            {/* Invite panel */}
            {vendorView === "invite" && (
              <div style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "24px", marginBottom: 24 }}>
                <h3 style={{ fontFamily: "inherit", fontSize: 18, marginBottom: 4 }}>Invite a Vendor</h3>
                <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>They'll receive a link to complete their application form.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label className="vd-label">Vendor Email *</label>
                    <input className="vd-field" type="email" placeholder="vendor@example.com"
                      value={vendorInviteEmail} onChange={e => setVendorInviteEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="vd-label">Message to Vendor (optional)</label>
                    <textarea className="vd-field" rows={3} style={{ resize: "vertical" }}
                      placeholder="Add a personal note — this will appear in the invitation email and on the form…"
                      value={vendorInviteNote} onChange={e => setVendorInviteNote(e.target.value)} />
                  </div>
                  <button className="btn-gold" disabled={!vendorInviteEmail.trim() || sendingInvite}
                    onClick={handleSendVendorInvite}
                    style={{ opacity: sendingInvite ? 0.6 : 1 }}>
                    {sendingInvite ? "Sending…" : "Send Invitation →"}
                  </button>
                </div>
              </div>
            )}

            {/* Vendor list */}
            {vendors.length === 0 && vendorView === "list" && (
              <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--text3)", fontSize: 14 }}>
                No vendors yet — invite your first supplier above.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {vendors.map(v => (
                <div key={v.id} className="card" style={{ padding: "20px 22px", border: v.status === "submitted" ? "1px solid rgba(129,140,248,0.3)" : undefined }}>

                  {/* Top row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {v.image_url
                        ? <img src={v.image_url} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", border: "1.5px solid var(--border)" }} alt={v.name} />
                        : <div style={{ width: 44, height: 44, background: "var(--bg3)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1.5px solid var(--border)" }}>{v.icon || "🏢"}</div>}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{v.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text2)" }}>{v.role}</div>
                      </div>
                    </div>
                    <span className={`status-pill status-${v.status || "pending"}`}>
                      {v.status === "submitted" ? "📋 Review" : v.status || "pending"}
                    </span>
                  </div>

                  {/* Contact */}
                  {(v.email || v.contact) && <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 3 }}>✉ {v.email || v.contact}</div>}
                  {v.phone    && <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 3 }}>📞 {v.phone}</div>}
                  {v.website  && <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 3 }}>🌐 {v.website}</div>}
                  {v.instagram && <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 3 }}>📸 @{v.instagram}</div>}
                  {v.description && (
                    <div style={{ fontSize: 12, color: "var(--text2)", background: "var(--bg3)", borderRadius: 6, padding: "8px 10px", marginTop: 8, lineHeight: 1.5 }}>
                      {v.description.length > 120 ? v.description.slice(0, 120) + "…" : v.description}
                    </div>
                  )}

                  {/* Invited / submitted timestamps */}
                  {v.form_submitted_at && (
                    <div style={{ fontSize: 11, color: "#818cf8", marginTop: 8 }}>
                      Form submitted {new Date(v.form_submitted_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  {v.invited_at && !v.form_submitted_at && (
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 8 }}>
                      Invited {new Date(v.invited_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid #0f0f1a" }}>
                    {v.status === "submitted" ? (
                      <>
                        <button className="btn-gold" style={{ flex: 1, padding: "8px", fontSize: 12 }}
                          onClick={() => { setShowDecisionModal(v); setDecisionMessage(""); }}>
                          Review →
                        </button>
                      </>
                    ) : v.status === "confirmed" || v.status === "declined" ? (
                      <>
                        <button className="btn-ghost" style={{ flex: 1, padding: "7px", fontSize: 12 }}
                          onClick={() => { setShowDecisionModal(v); setDecisionMessage(v.host_message || ""); }}>
                          Change Decision
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-ghost" style={{ flex: 1, padding: "7px", fontSize: 12 }}
                          onClick={() => { setManualVendor({ ...v }); setShowManualVendor(true); }}>✎ Edit</button>
                        {(v.email || v.contact) && v.status === "invited" && (
                          <button className="btn-ghost" style={{ padding: "7px 12px", fontSize: 12 }}
                            onClick={async () => {
                              await fetch(`${FUNCTIONS_BASE}/send-vendor-invite`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", apikey: ANON_KEY },
                                body: JSON.stringify({ vendorId: v.id }),
                              });
                              alert("Invite resent!");
                            }}>↩ Resend</button>
                        )}
                      </>
                    )}
                    <button className="btn-ghost" style={{ padding: "7px 12px", fontSize: 12, color: "#ef4444" }}
                      onClick={() => handleDeleteVendor(v.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VENDOR EDIT MODAL (existing vendors) */}
        {showVendorModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, backdropFilter: "blur(6px)" }}
            onClick={() => setShowVendorModal(false)}>
            <style>{`
              .vm-field { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px; outline: none; font-family: inherit; width: 100%; box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s; }
              .vm-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); } .vm-field::placeholder { color: var(--text3); }
              .vm-field::placeholder { color: var(--text3); }
              .vm-label { display: block; font-size: 11px; color: #5a5a72; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; font-family: var(--font,'Plus Jakarta Sans',sans-serif); }
              .vm-icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 2px solid transparent; background: var(--bg3); font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
              .vm-icon-btn:hover { border-color: rgba(201,168,76,0.3); }
              .vm-icon-btn.sel { border-color: var(--accent); background: var(--accentBg); }
            `}</style>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "modalIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}>
              <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                    {editingVendor ? "Edit Vendor" : "Add Vendor"}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text2)" }}>Supplier contact and booking details</p>
                </div>
                <button onClick={() => setShowVendorModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
              </div>
              <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="vm-label">Icon</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {VENDOR_ICONS.map(icon => (
                      <button key={icon} className={`vm-icon-btn${vendorForm.icon === icon ? " sel" : ""}`}
                        onClick={() => setVendorForm(f => ({ ...f, icon }))}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><label className="vm-label">Name *</label><input className="vm-field" placeholder="e.g. Sound Co." value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
                  <div><label className="vm-label">Role</label><input className="vm-field" placeholder="e.g. AV / Catering" value={vendorForm.role} onChange={e => setVendorForm(f => ({ ...f, role: e.target.value }))} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><label className="vm-label">Email</label><input className="vm-field" placeholder="contact@vendor.com" value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} /></div>
                  <div><label className="vm-label">Phone</label><input className="vm-field" placeholder="021 000 0000" value={vendorForm.phone} onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div><label className="vm-label">Notes</label><textarea className="vm-field" placeholder="Notes…" rows={3} value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical" }} /></div>
                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button className="btn-ghost" onClick={() => setShowVendorModal(false)} style={{ flex: 1 }}>Cancel</button>
                  <button className="btn-gold" onClick={handleSaveVendor} disabled={!vendorForm.name.trim()} style={{ flex: 2 }}>
                    {editingVendor ? "Save Changes" : "Add Vendor"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VENDOR DECISION MODAL */}
        {showDecisionModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, backdropFilter: "blur(6px)" }}
            onClick={() => setShowDecisionModal(null)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 500, boxShadow: "0 32px 80px rgba(0,0,0,0.6)", padding: 28 }}>

              {/* Vendor summary */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20, paddingBottom: 20, borderBottom: "1.5px solid var(--border)" }}>
                {showDecisionModal.image_url
                  ? <img src={showDecisionModal.image_url} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} alt="" />
                  : <div style={{ width: 56, height: 56, background: "var(--bg3)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{showDecisionModal.icon || "🏢"}</div>}
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontFamily: "inherit", fontSize: 20, margin: "0 0 2px" }}>{showDecisionModal.name}</h2>
                  <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 4 }}>{showDecisionModal.role}</div>
                  {showDecisionModal.email && <div style={{ fontSize: 12, color: "var(--text2)" }}>✉ {showDecisionModal.email}</div>}
                  {showDecisionModal.phone && <div style={{ fontSize: 12, color: "var(--text2)" }}>📞 {showDecisionModal.phone}</div>}
                  {showDecisionModal.website && <div style={{ fontSize: 12, color: "var(--text2)" }}>🌐 {showDecisionModal.website}</div>}
                  {showDecisionModal.instagram && <div style={{ fontSize: 12, color: "var(--text2)" }}>📸 @{showDecisionModal.instagram}</div>}
                </div>
                <button onClick={() => setShowDecisionModal(null)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
              </div>

              {showDecisionModal.description && (
                <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
                  {showDecisionModal.description}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Message to vendor (optional)
                </label>
                <textarea
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "11px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", resize: "vertical" }}
                  rows={3} placeholder="Add a personal message — it'll be included in the decision email…"
                  value={decisionMessage} onChange={e => setDecisionMessage(e.target.value)} />
              </div>

              <button onClick={() => { setShowDecisionModal(null); setManualVendor({ ...showDecisionModal }); setShowManualVendor(true); }}
                style={{ width: "100%", background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: "9px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", marginBottom: 10 }}>
                ✎ Edit vendor details
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => handleVendorDecision("declined")} disabled={sendingDecision}
                  style={{ flex: 1, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", opacity: sendingDecision ? 0.6 : 1 }}>
                  ✕ Decline
                </button>
                <button onClick={() => handleVendorDecision("confirmed")} disabled={sendingDecision}
                  style={{ flex: 2, background: "linear-gradient(135deg,#10b981,#059669)", border: "none", color: "#fff", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", opacity: sendingDecision ? 0.6 : 1 }}>
                  {sendingDecision ? "Sending…" : "✓ Confirm Vendor"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CHECK-IN */}
        {/* ── CHECKLIST ── */}
        {/* ── TICKETS ── */}
        {/* ── QUEUE ── */}
        {activeNav === "queue" && (
          <QueueManager eventId={eventId} />
        )}

        {/* ── TICKET HUB ── */}
        {activeNav === "tickets" && (
          <div className="fade-up">
            <style>{`
              .tier-card { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 14px; padding: 20px 22px; transition: border-color 0.15s; }
              .tier-card:hover { border-color: var(--accent); }
              .tf { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 9px; padding: 10px 13px; color: var(--text); font-size: 13px; outline: none; font-family: var(--font,'Plus Jakarta Sans',sans-serif); width: 100%; box-sizing: border-box; transition: border-color 0.2s; }
              .tf:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); } .tf::placeholder { color: var(--text3); }
              .hub-tab { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: var(--font,'Plus Jakarta Sans',sans-serif); transition: all 0.15s; }
              .hub-tab.active { background: var(--accentBg); color: var(--accent); }
              .hub-tab:not(.active) { background: none; color: #5a5a72; }
              .hub-tab:not(.active):hover { color: var(--text); }
            `}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Ticket Hub</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>
                  {orders.filter(o => o.status === "paid").reduce((s,o) => s + o.quantity, 0)} sold ·{" "}
                  ${(orders.filter(o => o.status === "paid").reduce((s,o) => s + o.total_amount, 0) / 100).toFixed(2)} revenue
                </p>
              </div>
              <button
                onClick={() => setShowPublishModal(event?.published ? "unpublish" : "publish")}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 18px",
                  borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)",
                  fontSize: 14, fontWeight: 700, transition: "all 0.2s",
                  background: event?.published
                    ? "rgba(16,185,129,0.12)" : "var(--accent)",
                  color: event?.published ? "#10b981" : "var(--bg)",
                  boxShadow: event?.published ? "none" : "0 4px 20px rgba(201,168,76,0.3)",
                }}>
                <span style={{ fontSize: 16 }}>{event?.published ? "✓" : "▶"}</span>
                {event?.published ? "Live" : "Go Live →"}
              </button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 10, padding: 4 }}>
              {[
                { id: "tiers",     label: "Tiers" },
                { id: "orders",    label: "Orders" },
                { id: "attendees", label: "Attendees" },
              ].map(t => (
                <button key={t.id} onClick={() => setHubTab(t.id)}
                  style={{ flex: 1, border: "none", borderRadius: 7, padding: "8px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s",
                    background: hubTab === t.id ? "var(--accentBg)" : "none",
                    color: hubTab === t.id ? "var(--accent)" : "var(--text2)" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── TIERS ── */}
            {hubTab === "tiers" && (
              <div>
                {event?.published && (
                  <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, color: "#10b981", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {window.location.origin}/tickets/{event?.invite_slug}
                    </span>
                    <button onClick={() => navigator.clipboard.writeText(window.location.origin + "/tickets/" + event?.invite_slug)}
                      style={{ background: "none", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", borderRadius: 7, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", flexShrink: 0 }}>
                      Copy
                    </button>
                  </div>
                )}
                {!event?.published && (
                  <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontSize: 13, color: "#f59e0b" }}>
                    ⚠ Toggle Published above to make the ticket page live.
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  {canEdit("tickets") && <button onClick={() => setAddingTier(true)} className="btn-gold">+ Add Tier</button>}
                </div>
                {tiers.length === 0 && !addingTier && (
                  <div style={{ textAlign: "center", padding: "48px", color: "var(--text3)", fontSize: 14 }}>No ticket tiers yet.</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {tiers.map(tier => (
                    <div key={tier.id} className="tier-card">
                      {editingTier?.id === tier.id ? (
                        <div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Name</div><input className="tf" value={editingTier.name} onChange={e => setEditingTier(t => ({ ...t, name: e.target.value }))} /></div>
                            <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Price (NZD)</div><input className="tf" type="number" value={(editingTier.price / 100).toFixed(2)} onChange={e => setEditingTier(t => ({ ...t, price: Math.round(parseFloat(e.target.value || 0) * 100) }))} /></div>
                            <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Description</div><input className="tf" value={editingTier.description || ""} onChange={e => setEditingTier(t => ({ ...t, description: e.target.value }))} /></div>
                            <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Capacity</div><input className="tf" type="number" value={editingTier.capacity || ""} onChange={e => setEditingTier(t => ({ ...t, capacity: e.target.value ? parseInt(e.target.value) : null }))} /></div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn-gold" style={{ padding: "8px 16px", fontSize: 12 }} onClick={async () => {
                              await supabase.from("ticket_tiers").update({ name: editingTier.name, description: editingTier.description, price: editingTier.price, capacity: editingTier.capacity }).eq("id", editingTier.id);
                              setTiers(ts => ts.map(t => t.id === editingTier.id ? { ...t, ...editingTier } : t));
                              setEditingTier(null);
                            }}>Save</button>
                            <button onClick={() => setEditingTier(null)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{tier.name}</div>
                            {tier.description && <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>{tier.description}</div>}
                            <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                              <span style={{ color: "var(--accent)", fontWeight: 600 }}>${(tier.price / 100).toFixed(2)}</span>
                              <span style={{ color: "var(--text2)" }}>{tier.sold} sold</span>
                              {tier.capacity && <span style={{ color: tier.capacity - tier.sold <= 0 ? "#ef4444" : "var(--text2)" }}>{Math.max(0, tier.capacity - tier.sold)} left</span>}
                            </div>
                          </div>
                          {tier.capacity && (
                            <div style={{ width: 60 }}>
                              <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100,(tier.sold/tier.capacity)*100)}%`, background: tier.sold >= tier.capacity ? "#ef4444" : "#10b981", borderRadius: 99 }} />
                              </div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setEditingTier({ ...tier })} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 7, padding: "5px 10px", color: "var(--text2)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>Edit</button>
                            <button onClick={async () => { await supabase.from("ticket_tiers").delete().eq("id", tier.id); setTiers(ts => ts.filter(t => t.id !== tier.id)); }}
                              style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 7, padding: "5px 10px", color: "var(--text2)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>×</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {addingTier && (
                    <div className="tier-card" style={{ borderColor: "var(--text3)" }}>
                      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12, fontWeight: 500 }}>New Tier</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Name *</div><input className="tf" placeholder="e.g. General Admission" value={newTier.name} onChange={e => setNewTier(t => ({ ...t, name: e.target.value }))} /></div>
                        <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Price NZD *</div><input className="tf" type="number" placeholder="25.00" value={newTier.price} onChange={e => setNewTier(t => ({ ...t, price: e.target.value }))} /></div>
                        <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Description</div><input className="tf" placeholder="What's included?" value={newTier.description} onChange={e => setNewTier(t => ({ ...t, description: e.target.value }))} /></div>
                        <div><div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>Capacity</div><input className="tf" type="number" placeholder="100" value={newTier.capacity} onChange={e => setNewTier(t => ({ ...t, capacity: e.target.value }))} /></div>
                      </div>
                      {tierError && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{tierError}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-gold" style={{ padding: "8px 16px", fontSize: 12 }} onClick={async () => {
                          if (!newTier.name.trim() || !newTier.price) { setTierError("Name and price required"); return; }
                          const { data, error } = await supabase.from("ticket_tiers").insert({
                            event_id: eventId, name: newTier.name.trim(),
                            description: newTier.description.trim() || null,
                            price: Math.round(parseFloat(newTier.price) * 100),
                            capacity: newTier.capacity ? parseInt(newTier.capacity) : null,
                            sort_order: tiers.length,
                          }).select().single();
                          if (error) { setTierError(error.message); return; }
                          setTiers(ts => [...ts, data]);
                          setNewTier({ name: "", description: "", price: "", capacity: "" });
                          setAddingTier(false); setTierError(null);
                        }}>Add Tier</button>
                        <button onClick={() => { setAddingTier(false); setTierError(null); }} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ORDERS ── */}
            {hubTab === "orders" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Revenue", value: "$" + (orders.filter(o=>o.status==="paid").reduce((s,o)=>s+o.total_amount,0)/100).toFixed(2), color: "var(--accent)" },
                    { label: "Sold",    value: orders.filter(o=>o.status==="paid").reduce((s,o)=>s+o.quantity,0), color: "#10b981" },
                    { label: "Orders",  value: orders.filter(o=>o.status==="paid").length, color: "#818cf8" },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "inherit" }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="card" style={{ overflow: "hidden" }}>
                  {orders.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "var(--text3)", fontSize: 14 }}>No orders yet.</div>}
                  {orders.map((o, i) => (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < orders.length-1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{o.buyer_name}</div>
                        <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.buyer_email} · {o.quantity}× {o.ticket_tiers?.name}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>${(o.total_amount/100).toFixed(2)}</div>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, flexShrink: 0,
                        background: o.status==="paid" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: o.status==="paid" ? "#10b981" : "#ef4444",
                        border: `1px solid ${o.status==="paid" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ATTENDEES ── */}
            {hubTab === "attendees" && (
              <AttendeeTab eventId={eventId} supabase={supabase} orders={orders} navigate={navigate} />
            )}
          </div>
        )}

        {/* ── COLLABORATE ── */}
        {activeNav === "collab" && (
          <div className="fade-up">
            <style>{`
              .role-select { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 8px; padding: 7px 10px; color: var(--text); font-size: 13px; font-weight: 500; outline: none; cursor: pointer; font-family: inherit; transition: border-color 0.15s; } .role-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); }
            `}</style>

            {/* My-role banner for non-owners */}
            {userRole !== "owner" && userRole !== "admin" && (() => {
              const roleColors = { ticketing: "var(--accent)", check_in: "#10b981", view_only: "var(--text2)" };
              const col = roleColors[userRole] || "var(--text2)";
              return (
                <div style={{ background: `${col}0d`, border: `1px solid ${col}30`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>🤝</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: col, marginBottom: 2 }}>
                      You're a collaborator — {userRole.replace("_"," ")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>
                      You can view this section but cannot invite or manage collaborators.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowRequestModal(true)}
                      style={{ background: "none", border: `1px solid ${col}40`, color: col, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", fontWeight: 600 }}>
                      Request Access ↑
                    </button>
                    <button onClick={handleLeaveEvent}
                      style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                      Leave
                    </button>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Collaborate</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>
                  {collaborators.filter(c => c.status === "accepted").length} active · {collaborators.filter(c => c.status === "invited").length} pending invite
                </p>
              </div>
            </div>

            {/* Role legend */}
            <div style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, fontWeight: 600 }}>Permission Tiers</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                {[
                  { role: "admin",     label: "Admin",     color: "#818cf8", desc: "Full access, can invite others" },
                  { role: "ticketing", label: "Ticketing", color: "var(--accent)", desc: "Ticket tiers, orders & sales" },
                  { role: "check_in",  label: "Check-in",  color: "#10b981", desc: "Scanner & guest arrivals" },
                  { role: "view_only", label: "View Only", color: "var(--text2)", desc: "Read-only across all sections" },
                ].map(r => (
                  <div key={r.role} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text2)" }}> — {r.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Owner card — same row style as collaborators */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Owner</div>
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px" }}>
                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accentBg)", border: "1.5px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                    {ownerEmail ? ownerEmail[0].toUpperCase() : "👑"}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {ownerEmail || "Event Owner"}
                      {userRole === "owner" && <span style={{ fontSize: 11, color: "var(--text2)", marginLeft: 6 }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>Full control · Cannot be removed</div>
                  </div>
                  {/* Owner badge with tooltip */}
                  <span
                    title="Owner: Full control over this event. Can transfer ownership, manage all collaborators, and cannot be removed."
                    style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--accentBg)", color: "var(--accent)", border: "1px solid rgba(201,168,76,0.25)", fontWeight: 600, cursor: "help", whiteSpace: "nowrap" }}>
                    👑 Owner
                  </span>
                  {/* Transfer ownership button — owner only */}
                  {userRole === "owner" && collaborators.some(c => c.status === "accepted" && c.user_id) && (
                    <button
                      style={{ background: "none", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", whiteSpace: "nowrap" }}
                      onClick={() => {
                        const first = collaborators.find(c => c.status === "accepted" && c.user_id);
                        setTransferTarget(first?.id || "");
                        setShowTransferModal(true);
                      }}>
                      Transfer 👑
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Collaborator list */}
            {collaborators.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Collaborators</div>
                <div className="card" style={{ overflow: "hidden" }}>
                  {collaborators.map((c, i) => {
                    const roleColors = { admin: "#818cf8", ticketing: "var(--accent)", check_in: "#10b981", view_only: "var(--text2)" };
                    const col = roleColors[c.role] || "var(--text2)";
                    return (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < collaborators.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg3)", border: `1.5px solid ${c.status === "accepted" ? col : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                          {c.status === "accepted" ? "●" : "○"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>
                          <div style={{ fontSize: 11, color: c.status === "accepted" ? "var(--text2)" : "#f59e0b" }}>
                            {c.status === "accepted" ? `Joined ${new Date(c.accepted_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}` : "Invite pending"}
                          </div>
                        </div>
                        {(userRole === "owner" || userRole === "admin") ? (
                          <select className="role-select" value={c.role}
                            onChange={e => handleUpdateCollabRole(c.id, e.target.value)}>
                            <option value="admin">Admin</option>
                            <option value="ticketing">Ticketing</option>
                            <option value="check_in">Check-in</option>
                            <option value="view_only">View Only</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: `${col}18`, color: col, border: `1px solid ${col}40`, fontWeight: 600 }}>
                            {c.role.replace("_", " ")}
                          </span>
                        )}
                        {/* Access request badge */}
                        {(userRole === "owner" || userRole === "admin") && c.host_message?.startsWith("ACCESS REQUEST:") && (
                          <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", cursor: "pointer", whiteSpace: "nowrap" }}
                            title={c.host_message} onClick={() => alert(c.host_message)}>
                            ⚡ Request
                          </span>
                        )}
                        {(userRole === "owner" || userRole === "admin") && (
                          <button onClick={() => handleRemoveCollab(c.id)}
                            style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#ef4444", cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Invite form */}
            {(userRole === "owner" || userRole === "admin") && (
              <div style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "22px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Invite Collaborator</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>They'll receive an email with a link to accept.</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <input
                    style={{ flex: 1, background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}
                    type="email" placeholder="collaborator@email.com"
                    value={collabInviteEmail} onChange={e => setCollabInviteEmail(e.target.value)} />
                  <select className="role-select"
                    value={collabInviteRole} onChange={e => setCollabInviteRole(e.target.value)}
                    style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 12px", fontSize: 13 }}>
                    <option value="admin">Admin</option>
                    <option value="ticketing">Ticketing</option>
                    <option value="check_in">Check-in</option>
                    <option value="view_only">View Only</option>
                  </select>
                </div>
                <button className="btn-gold" disabled={!collabInviteEmail.trim() || sendingCollab}
                  onClick={handleSendCollabInvite}
                  style={{ width: "100%", opacity: sendingCollab ? 0.6 : 1 }}>
                  {sendingCollab ? "Sending…" : "Send Invite →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STAFF ── */}
        {activeNav === "staff" && (
          <StaffManager eventId={eventId} />
        )}

        {/* ── SETTINGS ── */}
        {activeNav === "settings" && (
          <EventSettings eventId={eventId} event={event} setEvent={setEvent} />
        )}

        {/* ── CHECKLIST ── */}
        {activeNav === "checklist" && (
          <div className="fade-up">
            {isReadOnly("checklist") && <ReadOnlyBanner role={userRole} />}
            <style>{`
              .task-row { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--border); transition: background 0.15s; }
              .task-row:last-child { border-bottom: none; }
              .task-row:hover { background: var(--bg3); }
              .task-row:hover .task-actions { opacity: 1; }
              .task-actions { opacity: 0; display: flex; gap: 6px; transition: opacity 0.15s; }
              .cl-field { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px; outline: none; font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s; }
              .cl-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); } .cl-field::placeholder { color: var(--text3); }
            `}</style>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Checklist</h1>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>
                  {tasks.filter(t => t.done).length} of {tasks.length} done
                </p>
              </div>
              {/* Filter tabs */}
              <div style={{ display: "flex", gap: 6 }}>
                {["all", "pending", "done"].map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    style={{ background: taskFilter === f ? "var(--accentBg)" : "transparent", border: `1px solid ${taskFilter === f ? "rgba(201,168,76,0.3)" : "var(--border)"}`, color: taskFilter === f ? "var(--accent)" : "var(--text2)", borderRadius: 7, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", textTransform: "capitalize", transition: "all 0.15s" }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>
                <span>Progress</span>
                <span style={{ color: "var(--accent)" }}>{tasks.length ? Math.round((tasks.filter(t=>t.done).length/tasks.length)*100) : 0}%</span>
              </div>
              <div style={{ height: 6, background: "var(--bg3)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: tasks.length ? `${(tasks.filter(t=>t.done).length/tasks.length)*100}%` : "0%", background: "linear-gradient(90deg,var(--accent),var(--success,#059669))", borderRadius: 99, transition: "width 0.4s" }} />
              </div>
            </div>

            {/* Add task */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input className="cl-field" placeholder="Add a checklist item…" value={newTaskText}
                  style={{ flex: 1 }}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddTask()} />
                <input className="cl-field" type="date" value={newTaskDue}
                  style={{ width: 150 }}
                  onChange={e => setNewTaskDue(e.target.value)} />
                {canEdit("checklist") && <button className="btn-gold" onClick={handleAddTask}>Add</button>}
              </div>
            </div>

            {/* Task list */}
            <div className="card" style={{ overflow: "hidden" }}>
              {tasks.filter(t =>
                taskFilter === "all" ? true :
                taskFilter === "done" ? t.done : !t.done
              ).length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontSize: 14 }}>
                  {taskFilter === "done" ? "Nothing completed yet." : taskFilter === "pending" ? "All done! 🎉" : "No checklist items yet — add one above."}
                </div>
              )}
              {tasks
                .filter(t => taskFilter === "all" ? true : taskFilter === "done" ? t.done : !t.done)
                .map(t => (
                  <div key={t.id} className="task-row">
                    {/* Checkbox */}
                    <div onClick={() => handleToggleTask(t.id, !t.done)}
                      style={{ width: 20, height: 20, border: `1.5px solid ${t.done ? "var(--accent)" : "var(--text3)"}`, borderRadius: 5, background: t.done ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--bg)", flexShrink: 0, cursor: "pointer", transition: "all 0.2s" }}>
                      {t.done ? "✓" : ""}
                    </div>

                    {/* Text / edit inline */}
                    {editingTask?.id === t.id ? (
                      <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
                        <input className="cl-field" value={editingTask.text} autoFocus
                          style={{ flex: 1 }}
                          onChange={e => setEditingTask(et => ({ ...et, text: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") handleUpdateTask(); if (e.key === "Escape") setEditingTask(null); }} />
                        <input className="cl-field" type="date" value={editingTask.due_date || ""}
                          style={{ width: 140 }}
                          onChange={e => setEditingTask(et => ({ ...et, due_date: e.target.value }))} />
                        {canEdit("checklist") && <button className="btn-gold" style={{ padding: "8px 14px", fontSize: 12 }} onClick={handleUpdateTask}>Save</button>}
                        <button onClick={() => setEditingTask(null)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 14, color: t.done ? "var(--text3)" : "var(--text)", textDecoration: t.done ? "line-through" : "none", transition: "all 0.2s" }}>{t.text}</span>
                        {t.due_date && (
                          <span style={{ fontSize: 11, color: new Date(t.due_date) < new Date() && !t.done ? "#ef4444" : "var(--text3)", flexShrink: 0 }}>
                            {new Date(t.due_date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        <div className="task-actions">
                          <button onClick={() => setEditingTask({ id: t.id, text: t.text, due_date: t.due_date || "" })}
                            style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 6, padding: "4px 10px", color: "var(--text2)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
                            Edit
                          </button>
                          <button onClick={() => handleDeleteTask(t.id)}
                            style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 6, padding: "4px 10px", color: "var(--text2)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
                            ×
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── CHECK-IN ── */}
        {activeNav === "checkin" && (() => {
          const q = checkInSearch.toLowerCase();
          const attending_guests = guests.filter(g => g.status === "attending");
          const filtered = attending_guests.filter(g =>
            !q ||
            (g.name  || "").toLowerCase().includes(q) ||
            (g.email || "").toLowerCase().includes(q) ||
            (g.phone || "").toLowerCase().includes(q)
          );
          const notIn = filtered.filter(g => !g.checked_in);
          const inGuests = filtered.filter(g => g.checked_in);

          const GuestRow = ({ g }) => (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background="var(--bg3)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: g.checked_in ? "rgba(16,185,129,0.15)" : "var(--bg3)", border: `1.5px solid ${g.checked_in ? "#10b981" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, transition: "all 0.2s" }}>
                {(g.name || g.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: g.checked_in ? "#5a8a72" : "var(--text)" }}>{g.name || g.email}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.email && <span>{g.email}</span>}
                  {g.phone && <span>· {g.phone}</span>}
                  {g.dietary && g.dietary !== "None" && <span>· 🍃 {g.dietary}</span>}
                  {g.checked_in && g.checked_in_at && <span style={{ color: "#10b981" }}>· ✓ {new Date(g.checked_in_at).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
              </div>
              <button onClick={() => setQrGuest(g)}
                style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 7, padding: "5px 10px", color: "var(--text3)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="var(--text2)"; e.currentTarget.style.color="var(--text2)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text3)"; }}>
                QR
              </button>
              {g.checked_in ? (
                <button onClick={() => canEdit("checkin") && handleUnCheckIn(g.id)}
                  style={{ background: "rgba(16,185,129,0.1)", border: "1.5px solid #10b981", borderRadius: 8, padding: "7px 14px", color: "#10b981", cursor: canEdit("checkin") ? "pointer" : "default", fontSize: 13, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", fontWeight: 500, transition: "all 0.2s", flexShrink: 0 }}
                  onMouseEnter={e => { if(canEdit("checkin")){ e.currentTarget.style.background="rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}}
                  onMouseLeave={e => { e.currentTarget.style.background="rgba(16,185,129,0.1)"; e.currentTarget.style.borderColor="#10b981"; e.currentTarget.style.color="#10b981"; }}
                  title="Undo check-in">
                  ✓ In
                </button>
              ) : (
                <button onClick={() => handleCheckIn(g.id)}
                  style={{ background: "transparent", border: "1.5px solid var(--border)", borderRadius: 8, padding: "7px 14px", color: "var(--text2)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", fontWeight: 500, transition: "all 0.2s", flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#10b981"; e.currentTarget.style.color="#10b981"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="var(--text3)"; e.currentTarget.style.color="var(--text2)"; }}>
                  Check in
                </button>
              )}
            </div>
          );

          return (
            <div className="fade-up">
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Check-in</h1>
                  <p style={{ color: "var(--text2)", fontSize: 14 }}>{checkedIn} of {attending} checked in tonight</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["ticketed","hybrid"].includes(event?.ticketing) && (
                    <button onClick={() => navigate("/scanner/" + eventId)}
                      style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accentBg)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--accent)", borderRadius: 9, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", fontWeight: 600 }}>
                      🎟 Ticket Scanner
                    </button>
                  )}
                  <button onClick={() => setEventQrOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg3)", border: "1.5px solid var(--border)", color: "var(--text)", borderRadius: 9, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#10b981"; e.currentTarget.style.color="#10b981"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text)"; }}>
                    📷 Event QR Code
                  </button>
                </div>
              </div>

              {/* Scan flash */}
              {scanResult && (
                <div style={{ marginBottom: 16, padding: "14px 18px", background: scanResult.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${scanResult.success ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{scanResult.success ? "✓" : "⚠"}</span>
                  <span style={{ fontSize: 14, color: scanResult.success ? "#10b981" : "#ef4444", fontWeight: 500 }}>
                    {scanResult.success ? `${scanResult.name} checked in!` : scanResult.name}
                  </span>
                </div>
              )}

              {/* Progress */}
              <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
                  <span>Checked in</span>
                  <span style={{ color: "#10b981", fontWeight: 600 }}>{checkedIn} / {attending}</span>
                </div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: attending ? `${(checkedIn/attending)*100}%` : "0%", background: "linear-gradient(90deg,#10b981,#059669)" }} />
                </div>
              </div>

              {/* Search + filter */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
                  <input value={checkInSearch} onChange={e => setCheckInSearch(e.target.value)}
                    placeholder="Search by name, email, phone…"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px 10px 38px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }} />
                </div>
                {["all","in","out"].map(f => (
                  <button key={f} onClick={() => setCheckInFilter(f)}
                    style={{ background: checkInFilter === f ? "rgba(16,185,129,0.12)" : "transparent", border: `1px solid ${checkInFilter === f ? "rgba(16,185,129,0.3)" : "var(--border)"}`, color: checkInFilter === f ? "#10b981" : "var(--text2)", borderRadius: 7, padding: "9px 14px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s", textTransform: "capitalize" }}>
                    {f === "in" ? "✓ In" : f === "out" ? "Not in" : "All"}
                  </button>
                ))}
              </div>

              {/* Not yet checked in */}
              {checkInFilter !== "in" && (
                <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
                  {notIn.length === 0
                    ? <div style={{ padding: "28px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                        {checkInSearch ? "No matches." : "Everyone is checked in! 🎉"}
                      </div>
                    : notIn.map(g => <GuestRow key={g.id} g={g} />)
                  }
                </div>
              )}

              {/* Checked in section */}
              {checkInFilter !== "out" && inGuests.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
                    Checked in · {inGuests.length}
                  </div>
                  <div className="card" style={{ overflow: "hidden" }}>
                    {inGuests.map(g => <GuestRow key={g.id} g={g} />)}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Event QR Modal — one QR for all guests to scan */}
        {eventQrOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
            onClick={() => setEventQrOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 20, padding: "36px 32px", textAlign: "center", maxWidth: 340, width: "100%" }}>
              <div style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{event?.name}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 24 }}>Guests scan this to check themselves in</div>
              <div style={{ background: "#fff", borderRadius: 14, padding: 14, display: "inline-block", marginBottom: 20 }}>
                <img src={getEventQRUrl()} alt="Event QR" width="220" height="220" />
              </div>
              <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>
                Print this and display it at the entrance, or show guests on screen.
              </p>
              <button onClick={() => window.print()}
                style={{ width: "100%", background: "var(--accentBg)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--accent)", borderRadius: 9, padding: "11px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", marginBottom: 10 }}>
                🖨 Print QR Code
              </button>
              <button onClick={() => setEventQrOpen(false)}
                style={{ width: "100%", background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 9, padding: "10px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Individual guest QR Modal */}
        {qrGuest && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
            onClick={() => setQrGuest(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 18, padding: "32px", textAlign: "center", maxWidth: 320, width: "100%" }}>
              <div style={{ fontFamily: "inherit", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{qrGuest.name || qrGuest.email}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 24 }}>Individual QR for this guest</div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "inline-block", marginBottom: 20 }}>
                <img src={getQRUrl(qrGuest.id)} alt="QR Code" width="180" height="180" />
              </div>
              {qrGuest.checked_in ? (
                <div style={{ fontSize: 13, color: "#10b981", marginBottom: 16 }}>✓ Already checked in</div>
              ) : (
                <button onClick={() => { handleCheckIn(qrGuest.id); setQrGuest(g => ({ ...g, checked_in: true })); }}
                  style={{ width: "100%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", borderRadius: 9, padding: "11px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", marginBottom: 12 }}>
                  ✓ Mark as Checked In
                </button>
              )}
              <button onClick={() => setQrGuest(null)}
                style={{ width: "100%", background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 9, padding: "10px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Close
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── TRANSFER OWNERSHIP MODAL ── */}
      {showTransferModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
          onClick={() => setShowTransferModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 20, width: "100%", maxWidth: 440, padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>👑</div>
            <h2 style={{ fontFamily: "inherit", fontSize: 20, textAlign: "center", margin: "0 0 6px" }}>Transfer Ownership</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              You will become an Admin. This cannot be undone without the new owner's cooperation.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Transfer to</label>
              <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                style={{ width: "100%", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                {collaborators.filter(c => c.status === "accepted" && c.user_id).map(c => (
                  <option key={c.id} value={c.id}>{c.email} ({c.role.replace("_"," ")})</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowTransferModal(false)}
                style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: 12, fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Cancel
              </button>
              <button onClick={async () => { setShowTransferModal(false); await handleTransferOwnership(transferTarget); }}
                disabled={!transferTarget}
                style={{ flex: 2, background: "var(--accent)", border: "none", color: "var(--bg)", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST ACCESS MODAL ── */}
      {showRequestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
          onClick={() => setShowRequestModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 20, width: "100%", maxWidth: 440, padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <h2 style={{ fontFamily: "inherit", fontSize: 20, margin: "0 0 6px" }}>Request Higher Access</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>The event owner will see your request in the Collaborate section.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Requesting Role</label>
              <select value={requestedRole} onChange={e => setRequestedRole(e.target.value)}
                style={{ width: "100%", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                <option value="admin">Admin — Full access</option>
                <option value="ticketing">Ticketing — Tickets & sales</option>
                <option value="check_in">Check-in — Guest arrivals</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Note (optional)</label>
              <textarea value={requestNote} onChange={e => setRequestNote(e.target.value)}
                placeholder="Explain why you need higher access…"
                style={{ width: "100%", boxSizing: "border-box", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", resize: "vertical" }}
                rows={3} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowRequestModal(false)}
                style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: 12, fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Cancel
              </button>
              <button onClick={handleRequestAccess} disabled={sendingRequest}
                style={{ flex: 2, background: "var(--accent)", border: "none", color: "var(--bg)", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", opacity: sendingRequest ? 0.6 : 1 }}>
                {sendingRequest ? "Sending…" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── TRANSFER OWNERSHIP MODAL ── */}
      {showTransferModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
          onClick={() => setShowTransferModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 20, width: "100%", maxWidth: 440, padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>👑</div>
            <h2 style={{ fontFamily: "inherit", fontSize: 20, textAlign: "center", margin: "0 0 6px" }}>Transfer Ownership</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              You will become an Admin. This cannot be undone without the new owner's cooperation.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Transfer to</label>
              <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                style={{ width: "100%", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                {collaborators.filter(c => c.status === "accepted" && c.user_id).map(c => (
                  <option key={c.id} value={c.id}>{c.email} ({c.role.replace("_"," ")})</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowTransferModal(false)}
                style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: 12, fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Cancel
              </button>
              <button onClick={async () => { setShowTransferModal(false); await handleTransferOwnership(transferTarget); }}
                disabled={!transferTarget}
                style={{ flex: 2, background: "var(--accent)", border: "none", color: "var(--bg)", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST ACCESS MODAL ── */}
      {showRequestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
          onClick={() => setShowRequestModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 20, width: "100%", maxWidth: 440, padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <h2 style={{ fontFamily: "inherit", fontSize: 20, margin: "0 0 6px" }}>Request Higher Access</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>The event owner will see your request in the Collaborate section.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Requesting Role</label>
              <select value={requestedRole} onChange={e => setRequestedRole(e.target.value)}
                style={{ width: "100%", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                <option value="admin">Admin — Full access</option>
                <option value="ticketing">Ticketing — Tickets & sales</option>
                <option value="check_in">Check-in — Guest arrivals</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Note (optional)</label>
              <textarea value={requestNote} onChange={e => setRequestNote(e.target.value)}
                placeholder="Explain why you need higher access…"
                style={{ width: "100%", boxSizing: "border-box", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "10px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", resize: "vertical" }}
                rows={3} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowRequestModal(false)}
                style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: 12, fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                Cancel
              </button>
              <button onClick={handleRequestAccess} disabled={sendingRequest}
                style={{ flex: 2, background: "var(--accent)", border: "none", color: "var(--bg)", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", opacity: sendingRequest ? 0.6 : 1 }}>
                {sendingRequest ? "Sending…" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PUBLISH MODAL ── */}
      {showPublishModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
          onClick={() => setShowPublishModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", border: `1px solid ${showPublishModal === "publish" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 20, width: "100%", maxWidth: 480, padding: "32px", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

            {showPublishModal === "publish" ? (
              <>
                <div style={{ fontSize: 40, textAlign: "center", marginBottom: 16 }}>🚀</div>
                <h2 style={{ fontFamily: "inherit", fontSize: 22, textAlign: "center", marginBottom: 8, color: "var(--text)" }}>Go Live?</h2>
                <p style={{ fontSize: 14, color: "var(--text2)", textAlign: "center", marginBottom: 24, lineHeight: 1.7 }}>
                  This will make your ticket page publicly accessible. Anyone with the link can purchase tickets.
                </p>
                <div style={{ background: "var(--bg3)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "16px 18px", marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, fontWeight: 600 }}>Your ticket link</div>
                  <div style={{ fontSize: 13, color: "var(--text)", wordBreak: "break-all", marginBottom: 12 }}>
                    {window.location.origin}/tickets/{event?.invite_slug}
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/tickets/${event?.invite_slug}`)}
                    style={{ background: "none", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", borderRadius: 7, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                    Copy Link
                  </button>
                </div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--text)" }}>Next steps:</strong> Share this link via social media, email, or add it to your event pages. Tickets will flow straight into your Sales tab.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowPublishModal(false)}
                    style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: 12, fontSize: 14, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                    Cancel
                  </button>
                  <button onClick={async () => {
                    setEvent(e => ({ ...e, published: true }));
                    await supabase.from("events").update({ published: true }).eq("id", eventId);
                    setShowPublishModal(false);
                  }}
                    style={{ flex: 2, background: "linear-gradient(135deg,#10b981,#059669)", border: "none", color: "#fff", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                    Go Live →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, textAlign: "center", marginBottom: 16 }}>⏸</div>
                <h2 style={{ fontFamily: "inherit", fontSize: 22, textAlign: "center", marginBottom: 8, color: "var(--text)" }}>Take Offline?</h2>
                <p style={{ fontSize: 14, color: "var(--text2)", textAlign: "center", marginBottom: 24, lineHeight: 1.7 }}>
                  The ticket page will no longer be accessible. Existing orders are unaffected.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowPublishModal(false)}
                    style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: 12, fontSize: 14, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                    Cancel
                  </button>
                  <button onClick={async () => {
                    setEvent(e => ({ ...e, published: false }));
                    await supabase.from("events").update({ published: false }).eq("id", eventId);
                    setShowPublishModal(false);
                  }}
                    style={{ flex: 2, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                    Take Offline
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MANUAL VENDOR MODAL ── */}
      {showManualVendor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(6px)" }}
          onClick={() => setShowManualVendor(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "28px", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "inherit", fontSize: 20, margin: 0 }}>
                {manualVendor?.id ? "Edit Vendor Details" : "Add Vendor Manually"}
              </h2>
              <button onClick={() => setShowManualVendor(false)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 22, cursor: "pointer", padding: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "name",        label: "Business Name *", placeholder: "e.g. Sound Co." },
                { key: "role",        label: "Service / Role",  placeholder: "e.g. Catering" },
                { key: "email",       label: "Email",           placeholder: "vendor@example.com" },
                { key: "phone",       label: "Phone",           placeholder: "021 000 0000" },
                { key: "website",     label: "Website",         placeholder: "yourbusiness.co.nz" },
                { key: "instagram",   label: "Instagram",       placeholder: "@handle" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</label>
                  <input
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "11px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}
                    placeholder={placeholder}
                    value={manualVendor?.[key] || ""}
                    onChange={e => setManualVendor(v => ({ ...v, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Description</label>
                <textarea
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "11px 14px", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", resize: "vertical" }}
                  rows={3} placeholder="About their services…"
                  value={manualVendor?.description || ""}
                  onChange={e => setManualVendor(v => ({ ...v, description: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button onClick={() => setShowManualVendor(false)}
                  style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--text2)", borderRadius: 10, padding: 12, fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                  Cancel
                </button>
                <button disabled={!manualVendor?.name?.trim()} onClick={async () => {
                  if (!manualVendor?.name?.trim()) return;
                  if (manualVendor.id) {
                    const { data } = await supabase.from("vendors").update({
                      name: manualVendor.name, role: manualVendor.role, email: manualVendor.email,
                      phone: manualVendor.phone, website: manualVendor.website,
                      instagram: manualVendor.instagram, description: manualVendor.description,
                    }).eq("id", manualVendor.id).select().single();
                    setVendors(vs => vs.map(v => v.id === manualVendor.id ? { ...v, ...data } : v));
                  } else {
                    const { data } = await supabase.from("vendors").insert({
                      event_id: eventId, name: manualVendor.name, role: manualVendor.role,
                      email: manualVendor.email, phone: manualVendor.phone,
                      website: manualVendor.website, instagram: manualVendor.instagram,
                      description: manualVendor.description, status: "confirmed",
                    }).select().single();
                    setVendors(vs => [...vs, data]);
                  }
                  setShowManualVendor(false);
                }}
                  style={{ flex: 2, background: "var(--accent)", border: "none", color: "var(--bg)", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)" }}>
                  {manualVendor?.id ? "Save Changes" : "Add Vendor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Nav ── */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg2)", borderTop: "1.5px solid var(--border)", display: "flex", zIndex: 50, padding: "4px 0 env(safe-area-inset-bottom,0)" }}>
          {(mobileMode === "ticketing"
            ? MOBILE_TICKETING_NAV
            : MOBILE_FULL_NAV
          ).map(n => (
            <button key={n.id} className={`mobile-nav-btn${activeNav === n.id ? " active" : ""}`}
              onClick={() => setActiveNav(n.id)}>
              <span className="icon">{n.icon}</span>
              <span className="label">{n.label}</span>
            </button>
          ))}
          {mobileMode === "ticketing" && tiers.length > 0 && (
            <button className="mobile-nav-btn"
              onClick={() => navigate("/scanner/" + eventId)}
              style={{ color: "var(--accent)", flex: 1 }}>
              <span className="icon">📷</span>
              <span className="label">Scanner</span>
            </button>
          )}
        </div>
      )}

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, backdropFilter: "blur(6px)" }} onClick={() => setEditingGuest(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 460, boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
            <h2 style={{ fontFamily: "inherit", fontSize: 20, fontWeight: 700, marginBottom: 20, color: "var(--text)" }}>Edit Guest</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Name</div>
                <input className="field" value={editingGuest.name || ""} onChange={e => setEditingGuest(g => ({ ...g, name: e.target.value }))} placeholder="Guest name" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email</div>
                <input className="field" type="email" value={editingGuest.email || ""} onChange={e => setEditingGuest(g => ({ ...g, email: e.target.value }))} placeholder="guest@email.com" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Status</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["pending", "attending", "declined"].map(s => (
                    <button key={s} onClick={() => setEditingGuest(g => ({ ...g, status: s }))} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1.5px solid ${editingGuest.status === s ? (s === "attending" ? "#10b981" : s === "declined" ? "#ef4444" : "var(--accent)") : "var(--border)"}`, background: editingGuest.status === s ? (s === "attending" ? "rgba(16,185,129,0.1)" : s === "declined" ? "rgba(239,68,68,0.08)" : "var(--accentBg)") : "transparent", color: editingGuest.status === s ? (s === "attending" ? "#10b981" : s === "declined" ? "#ef4444" : "var(--accent)") : "var(--text2)", fontSize: 13, cursor: "pointer", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", transition: "all 0.15s", textTransform: "capitalize" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Dietary Requirements</div>
                <input className="field" value={editingGuest.dietary || ""} onChange={e => setEditingGuest(g => ({ ...g, dietary: e.target.value }))} placeholder="e.g. Vegetarian, Gluten-free" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setEditingGuest(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-gold" onClick={handleEditGuest} style={{ flex: 2 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Guest Confirm */}
      {deletingGuest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, backdropFilter: "blur(6px)" }} onClick={() => setDeletingGuest(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 400, boxShadow: "0 32px 80px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>🗑️</div>
            <h2 style={{ fontFamily: "inherit", fontSize: 20, marginBottom: 10, color: "var(--text)" }}>Remove this guest?</h2>
            <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>They'll be removed from the guest list and won't receive future invites.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setDeletingGuest(null)} style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleDeleteGuest(deletingGuest)} style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 10, padding: "10px", fontFamily: "var(--font,'Plus Jakarta Sans',sans-serif)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEdit && event && (
        <EditEventModal
          event={event}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => setEvent(updated)}
        />
      )}
    </div>
  );
}