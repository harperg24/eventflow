// ============================================================
//  Dashboard.jsx  —  wired to Supabase with real-time updates
//  Route: /dashboard/:eventId
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EditEventModal from "../components/EditEventModal";
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

const NAV = [
  { id: "overview",  label: "Overview",  icon: "◈" },
  { id: "guests",    label: "Guests",    icon: "◉" },
  { id: "budget",    label: "Budget",    icon: "◎" },
  { id: "playlist",  label: "Playlist",  icon: "♫" },
  { id: "polls",     label: "Polls",     icon: "◐" },
  { id: "vendors",   label: "Vendors",   icon: "◇" },
  { id: "checklist", label: "Checklist", icon: "☑" },
  { id: "checkin",   label: "Check-in",  icon: "✓" },
];

export default function Dashboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();
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
  const [nowPlaying, setNowPlaying]             = useState(null); // full song object playing in player
  const [playerProgress, setPlayerProgress]     = useState(0);
  const [playerDuration, setPlayerDuration]     = useState(0);
  const [spotifySearch, setSpotifySearch]       = useState("");
  const [spotifyResults, setSpotifyResults]     = useState([]);
  const [spotifySearching, setSpotifySearching] = useState(false);
  const [playingPreview, setPlayingPreview]     = useState(null);
  const [previewAudio, setPreviewAudio]         = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ label: "", allocated: "", icon: "💰", color: "#c9a84c" });
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
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState({ name: "", role: "", contact: "", phone: "", notes: "", status: "pending", icon: "🏢" });
  const [deletingGuest, setDeletingGuest] = useState(null);
  const [selectedGuests, setSelectedGuests] = useState([]);

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
      setCategoryForm({ label: "", allocated: "", icon: "💰", color: "#c9a84c" });
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
    setVendors(vs => vs.filter(v => v.id !== id));
    await supabase.from("vendors").delete().eq("id", id);
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
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#c9a84c", fontSize: 15 }}>
      <style>{'@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400&display=swap")'}</style>
      Loading your event…
    </div>
  );

  if (!event) return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#ef4444" }}>
      Event not found.
    </div>
  );

  // ── Styles ────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::selection { background: #c9a84c; color: #080810; }
    ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #2a2a38; border-radius: 2px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 9px; cursor: pointer; transition: all 0.18s; font-size: 14px; color: #5a5a72; border: none; background: none; width: 100%; text-align: left; }
    .nav-item:hover { color: #c9a84c; background: rgba(201,168,76,0.06); }
    .nav-item.active { color: #c9a84c; background: rgba(201,168,76,0.1); font-weight: 500; }
    .card { background: #0f0f1a; border: 1px solid #1e1e2e; border-radius: 14px; }
    .field { background: #13131f; border: 1px solid #1e1e2e; border-radius: 9px; padding: 11px 14px; color: #e2d9cc; font-size: 14px; outline: none; font-family: 'DM Sans'; width: 100%; transition: border-color 0.2s; }
    .field:focus { border-color: #c9a84c; box-shadow: 0 0 0 3px rgba(201,168,76,0.08); }
    .field::placeholder { color: #2e2e42; }
    .btn-gold { background: linear-gradient(135deg,#c9a84c,#a8872e); color: #080810; border: none; padding: 10px 20px; border-radius: 8px; font-family: 'DM Sans'; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn-gold:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(201,168,76,0.25); }
    .btn-ghost { background: transparent; color: #5a5a72; border: 1px solid #1e1e2e; padding: 8px 16px; border-radius: 8px; font-family: 'DM Sans'; font-size: 13px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn-ghost:hover { color: #e2d9cc; border-color: #3a3a52; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
    .tag-green  { background: rgba(16,185,129,0.12); color: #10b981; }
    .tag-amber  { background: rgba(245,158,11,0.12);  color: #f59e0b; }
    .tag-red    { background: rgba(239,68,68,0.1);    color: #ef4444; }
    .tag-blue   { background: rgba(59,130,246,0.12);  color: #60a5fa; }
    .progress-bar { height: 5px; background: #1a1a28; border-radius: 3px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 3px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }
    .row-hover:hover { background: rgba(201,168,76,0.03); cursor: pointer; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    .fade-up { animation: fadeUp 0.3s ease forwards; }
    .vote-btn { opacity: 0.4; transition: opacity 0.15s; background: rgba(201,168,76,0.15); border: none; border-radius: 6px; color: #c9a84c; padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: 'DM Sans'; }
    .song-row:hover .vote-btn { opacity: 1; }
    .vote-btn:hover { opacity: 1 !important; background: rgba(201,168,76,0.25); }
  `;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080810", fontFamily: "'DM Sans', sans-serif", color: "#e2d9cc" }}>
      <style>{css}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, background: "#0a0a14", borderRight: "1px solid #141420", padding: "28px 16px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28, paddingLeft: 4 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✦</div>
          <span style={{ fontFamily: "'Playfair Display'", fontSize: 18 }}>EventFlow</span>
        </div>

        {/* Event mini card */}
        <div style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.08),transparent)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 }}>{event.name}</div>
          <div style={{ fontSize: 11, color: "#c9a84c" }}>{new Date(event.date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <div style={{ flex: 1, height: 3, background: "#1e1e2e", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, ((30 - daysUntil) / 30) * 100))}%`, height: "100%", background: "linear-gradient(90deg,#c9a84c,#a8872e)" }} />
            </div>
            <span style={{ fontSize: 10, color: "#5a5a72" }}>{daysUntil}d</span>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(n => (
            <button key={n.id} className={`nav-item${activeNav === n.id ? " active" : ""}`} onClick={() => setActiveNav(n.id)}>
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{n.icon}</span>
              {n.label}
              {n.id === "guests" && (
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ background: "#1e1e2e", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "#5a5a72" }}>{guests.length}</span>
                  {requests.length > 0 && <span style={{ background: "#ef4444", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "#fff", fontWeight: 700 }}>{requests.length}</span>}
                </span>
              )}
              {n.id === "playlist" && <span style={{ marginLeft: "auto", background: "#1e1e2e", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "#5a5a72" }}>{songs.length}</span>}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <button onClick={() => navigate("/events")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5a5a72", fontSize: 13, cursor: "pointer", padding: "8px 0", width: "100%", fontFamily: "DM Sans, sans-serif", marginBottom: 16, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#c9a84c"} onMouseLeave={e=>e.currentTarget.style.color="#5a5a72"}>
            ← My Events
          </button>
          <div style={{ fontSize: 11, color: "#3a3a52", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Invite Link</div>
          <a href={inviteLink} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 8, padding: "9px 12px", fontSize: 11, color: "#5a5a72", wordBreak: "break-all", lineHeight: 1.4, marginBottom: 8, textDecoration: "none", cursor: "pointer" }} onMouseEnter={e=>e.currentTarget.style.borderColor="#c9a84c"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1e1e2e"}>/e/{event?.invite_slug}</a>
          <button className="btn-gold" onClick={copyLink} style={{ width: "100%", padding: "9px", fontSize: 12 }}>{copied ? "✓ Copied!" : "Copy Link"}</button>
          <button onClick={() => supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "1px solid #1e1e2e", borderRadius: 8, color: "#3a3a52", fontSize: 12, cursor: "pointer", padding: "8px", width: "100%", fontFamily: "DM Sans, sans-serif", marginTop: 8, transition: "all 0.15s" }} onMouseEnter={e=>{ e.currentTarget.style.color="#ef4444"; e.currentTarget.style.borderColor="rgba(239,68,68,0.3)"; }} onMouseLeave={e=>{ e.currentTarget.style.color="#3a3a52"; e.currentTarget.style.borderColor="#1e1e2e"; }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "36px 40px" }}>

        {/* OVERVIEW */}
        {activeNav === "overview" && (
          <div className="fade-up">
            <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 30, fontWeight: 700, marginBottom: 4 }}>{event.name}</h1>
                <p style={{ color: "#5a5a72", fontSize: 14 }}>{new Date(event.date).toLocaleDateString("en-NZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {event.time?.slice(0,5)} · {event.venue_name}</p>
              </div>
              <button onClick={() => setShowEdit(true)} style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 9, padding: "9px 18px", color: "#c9a84c", fontFamily: "'DM Sans',sans-serif", fontSize: 13, cursor: "pointer", transition: "all 0.2s", flexShrink: 0, marginTop: 4 }} onMouseEnter={e=>e.currentTarget.style.background="rgba(201,168,76,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(201,168,76,0.1)"}>
                ✎ Edit Event
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Days Until",    value: daysUntil,                    sub: "event",               accent: "#c9a84c" },
                { label: "Attending",     value: attending,                     sub: `of ${event.capacity || "∞"}`, accent: "#10b981" },
                { label: "Pending RSVPs", value: pending,                       sub: "awaiting",            accent: "#f59e0b" },
                { label: "Budget Used",   value: `$${totalSpent.toLocaleString()}`, sub: `of $${totalBudget.toLocaleString()}`, accent: "#8b5cf6" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.accent, opacity: 0.7 }} />
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.accent, fontFamily: "'Playfair Display'", marginBottom: 2 }}>{s.value}</div>
                  <div style={{ fontSize: 13, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#3a3a52" }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Checklist */}
              <div className="card" style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 17, fontWeight: 700 }}>Checklist</h2>
                  <span style={{ fontSize: 12, color: "#5a5a72" }}>{tasks.filter(t => t.done).length}/{tasks.length}</span>
                </div>
                <div style={{ height: 3, background: "#1a1a28", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ width: tasks.length ? `${(tasks.filter(t=>t.done).length/tasks.length)*100}%` : "0%", height: "100%", background: "linear-gradient(90deg,#c9a84c,#10b981)", transition: "width 0.4s" }} />
                </div>
                {tasks.slice(0, 6).map(t => (
                  <div key={t.id} className="row-hover" onClick={() => handleToggleTask(t.id, !t.done)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 8 }}>
                    <div style={{ width: 18, height: 18, border: `1.5px solid ${t.done ? "#c9a84c" : "#2e2e42"}`, borderRadius: 5, background: t.done ? "#c9a84c" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#080810", flexShrink: 0, transition: "all 0.2s" }}>
                      {t.done ? "✓" : ""}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: t.done ? "#3a3a52" : "#e2d9cc", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                    {t.due_date && <span style={{ fontSize: 11, color: "#3a3a52" }}>{new Date(t.due_date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</span>}
                  </div>
                ))}
              </div>

              {/* RSVP */}
              <div className="card" style={{ padding: "22px 24px" }}>
                <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>RSVP Breakdown</h2>
                <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "Attending", count: attending, color: "#10b981" },
                    { label: "Pending",   count: pending,   color: "#f59e0b" },
                    { label: "Declined",  count: declined,  color: "#ef4444" },
                  ].map(r => (
                    <div key={r.label} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: r.color, fontFamily: "'Playfair Display'" }}>{r.count}</div>
                      <div style={{ fontSize: 11, color: "#5a5a72", marginTop: 2 }}>{r.label}</div>
                    </div>
                  ))}
                </div>
                {event.capacity && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5a5a72", marginBottom: 6 }}>
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
                <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 17, fontWeight: 700 }}>Budget Snapshot</h2>
                <button className="btn-ghost" onClick={() => setActiveNav("budget")}>View Details →</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5a5a72", marginBottom: 8 }}>
                <span>Total Spent</span><span style={{ color: "#c9a84c" }}>${totalSpent.toLocaleString()} / ${totalBudget.toLocaleString()}</span>
              </div>
              <div className="progress-bar" style={{ height: 8, marginBottom: 16 }}>
                <div className="progress-fill" style={{ width: totalBudget ? `${Math.min((totalSpent/totalBudget)*100,100)}%` : "0%", background: "linear-gradient(90deg,#c9a84c,#f59e0b)" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${budget.length},1fr)`, gap: 10 }}>
                {budget.map(c => {
                  const pct = c.allocated ? Math.round((c.spent/c.allocated)*100) : 0;
                  return (
                    <div key={c.id} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{c.icon}</div>
                      <div style={{ height: 40, background: "#13131f", borderRadius: 5, overflow: "hidden", display: "flex", flexDirection: "column-reverse", marginBottom: 4 }}>
                        <div style={{ height: `${pct}%`, background: c.color, opacity: 0.8, transition: "height 0.6s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#5a5a72" }}>{c.label}</div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Guest List</h1>
                <p style={{ color: "#5a5a72", fontSize: 14 }}>{attending} attending · {pending} pending · {declined} declined</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {selectedGuests.length > 0 && (
                  <span style={{ fontSize: 13, color: "#c9a84c" }}>{selectedGuests.length} selected</span>
                )}
                <button className="btn-ghost" onClick={() => setSelectedGuests([])} style={{ display: selectedGuests.length ? "block" : "none", padding: "10px 16px", fontSize: 13 }}>
                  Clear
                </button>
                <button className="btn-gold" onClick={handleSendInvites} disabled={inviting} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {inviting ? "Sending…" : selectedGuests.length > 0 ? `✉ Send to ${selectedGuests.length}` : "✉ Send Uninvited"}
                </button>
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
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#e2d9cc" }}>Join Requests</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {requests.map(req => (
                    <div key={req.id} style={{ background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 12, padding: "16px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: req.message ? 10 : 0 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#e2d9cc", marginBottom: 3 }}>{req.name}</div>
                          <div style={{ fontSize: 12, color: "#5a5a72" }}>
                            {req.email}
                            {req.phone && <span> · {req.phone}</span>}
                            <span style={{ marginLeft: 8, color: "#3a3a52" }}>{new Date(req.created_at).toLocaleDateString("en-NZ")}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button onClick={() => handleRejectRequest(req.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "7px 14px", color: "#ef4444", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(239,68,68,0.1)"}>
                            Decline
                          </button>
                          <button onClick={() => handleApproveRequest(req)} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "7px 14px", color: "#10b981", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(16,185,129,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(16,185,129,0.1)"}>
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
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Name</div>
                <input className="field" placeholder="Guest name" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email</div>
                <input className="field" type="email" placeholder="guest@email.com" value={newGuestEmail} onChange={e => setNewGuestEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddGuest()} />
              </div>
              <button className="btn-gold" onClick={handleAddGuest} disabled={!newGuestEmail.trim()}>Add Guest</button>
            </div>

            <div className="card">
              <div style={{ display: "grid", gridTemplateColumns: "36px 2fr 2fr 1fr 1fr auto", padding: "12px 20px", borderBottom: "1px solid #141420", alignItems: "center" }}>
                <input type="checkbox"
                  checked={selectedGuests.length === guests.filter(g => g.email).length && guests.filter(g => g.email).length > 0}
                  onChange={e => setSelectedGuests(e.target.checked ? guests.filter(g => g.email).map(g => g.id) : [])}
                  style={{ accentColor: "#c9a84c", width: 15, height: 15, cursor: "pointer" }}
                />
                {["Name", "Email", "Status", "Invited"].map(h => (
                  <div key={h} style={{ fontSize: 11, color: "#3a3a52", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</div>
                ))}
                <div />
              </div>
              {guests.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "#3a3a52", fontSize: 14 }}>No guests yet — add someone above.</div>
              )}
              {guests.map((g, i) => (
                <div key={g.id} style={{ display: "grid", gridTemplateColumns: "36px 2fr 2fr 1fr 1fr auto", padding: "12px 20px", borderBottom: i < guests.length - 1 ? "1px solid #0f0f1a" : "none", alignItems: "center", gap: 8, background: selectedGuests.includes(g.id) ? "rgba(201,168,76,0.03)" : "transparent" }}>
                  <input type="checkbox"
                    checked={selectedGuests.includes(g.id)}
                    disabled={!g.email}
                    onChange={e => setSelectedGuests(sel => e.target.checked ? [...sel, g.id] : sel.filter(id => id !== g.id))}
                    style={{ accentColor: "#c9a84c", width: 15, height: 15, cursor: g.email ? "pointer" : "not-allowed", opacity: g.email ? 1 : 0.3 }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{g.name || <span style={{ color: "#3a3a52" }}>No name</span>}</div>
                  <div style={{ fontSize: 13, color: "#5a5a72", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.email || <span style={{ color: "#3a3a52" }}>—</span>}</div>
                  <span className={`tag ${g.status === "attending" ? "tag-green" : g.status === "pending" ? "tag-amber" : "tag-red"}`}>{g.status}</span>
                  <div>
                    {g.invited_at
                      ? <span className="tag" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", fontSize: 11 }} title={`Sent ${new Date(g.invited_at).toLocaleDateString("en-NZ")}`}>✓ Sent</span>
                      : g.email
                        ? <span className="tag" style={{ background: "rgba(255,255,255,0.04)", color: "#3a3a52", fontSize: 11 }}>Not sent</span>
                        : <span style={{ fontSize: 12, color: "#2a2a38" }}>No email</span>
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditingGuest({ ...g })} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 6, padding: "5px 10px", color: "#5a5a72", fontSize: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "'DM Sans',sans-serif" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a84c"; e.currentTarget.style.color = "#c9a84c"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e2e"; e.currentTarget.style.color = "#5a5a72"; }}>Edit</button>
                    <button onClick={() => setDeletingGuest(g.id)} style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 6, padding: "5px 10px", color: "#5a5a72", fontSize: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "'DM Sans',sans-serif" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#ef4444"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e2e"; e.currentTarget.style.color = "#5a5a72"; }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUDGET */}
        {activeNav === "budget" && (
          <div className="fade-up">
            <style>{`
              .ef-field { background: #13131f; border: 1px solid #1e1e2e; border-radius: 9px; padding: 11px 14px; color: #e2d9cc; font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif; width: 100%; box-sizing: border-box; transition: border-color 0.2s; }
              .ef-field:focus { border-color: #c9a84c; box-shadow: 0 0 0 3px rgba(201,168,76,0.08); }
              .ef-field::placeholder { color: #2e2e42; }
              .ef-label { display: block; font-size: 11px; color: #5a5a72; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; font-family: 'DM Sans', sans-serif; }
              .bm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; backdrop-filter: blur(6px); }
              .bm-modal { background: #0a0a14; border: 1px solid #1e1e2e; border-radius: 18px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; box-shadow: 0 32px 80px rgba(0,0,0,0.6); animation: modalIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
              .bm-modal-wide { max-width: 560px; }
              @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
              .bm-swatch { width: 28px; height: 28px; border-radius: 7px; border: 2px solid transparent; cursor: pointer; transition: transform 0.15s; }
              .bm-swatch:hover { transform: scale(1.15); }
              .bm-swatch.sel { border-color: #e2d9cc; transform: scale(1.1); }
              .bm-icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 2px solid transparent; background: #13131f; font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
              .bm-icon-btn:hover { border-color: rgba(201,168,76,0.3); background: rgba(201,168,76,0.05); }
              .bm-icon-btn.sel { border-color: #c9a84c; background: rgba(201,168,76,0.12); }
            `}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Budget</h1>
                <p style={{ color: "#5a5a72", fontSize: 14 }}>
                  ${totalSpent.toLocaleString()} spent of ${totalBudget.toLocaleString()} · <span style={{ color: totalBudget - totalSpent < 0 ? "#ef4444" : "#10b981" }}>${Math.abs(totalBudget - totalSpent).toLocaleString()} {totalBudget - totalSpent < 0 ? "over" : "remaining"}</span>
                </p>
              </div>
              <button className="btn-gold" onClick={() => { setCategoryForm({ label: "", allocated: "", icon: "💰", color: "#c9a84c" }); setShowCategoryModal(true); }}>
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
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a2e" strokeWidth={stroke} />
                      {slices.length === 0 && (
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e2e" strokeWidth={stroke} />
                      )}
                      {slices.map((c, i) => {
                        const pct = totalSpent > 0 ? (c.spent / totalSpent) : 0;
                        const dash = pct * circ;
                        const el = (
                          <circle key={c.id} cx={cx} cy={cy} r={r} fill="none"
                            stroke={c.color || "#c9a84c"}
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
                      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2d9cc" fontSize="13" fontWeight="600"
                        style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px`, fontFamily: "DM Sans" }}>
                        {totalBudget > 0 ? `${Math.round((totalSpent/totalBudget)*100)}%` : "—"}
                      </text>
                      <text x={cx} y={cy + 10} textAnchor="middle" fill="#5a5a72" fontSize="10"
                        style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px`, fontFamily: "DM Sans" }}>
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
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color || "#c9a84c", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "#b0a898" }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: "#5a5a72" }}>${(c.spent || 0).toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: "#3a3a52" }}>/ ${(c.allocated || 0).toLocaleString()}</span>
                  </div>
                ))}
                {budget.length === 0 && <p style={{ fontSize: 13, color: "#3a3a52" }}>No categories yet</p>}
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
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#13131f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{c.icon}</div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#e2d9cc" }}>{c.label}</span>
                      <span style={{ fontSize: 13, color: over ? "#ef4444" : "#8a8278" }}>
                        ${spent.toLocaleString()} <span style={{ color: "#2e2e42" }}>/ ${(c.allocated || 0).toLocaleString()}</span>
                      </span>
                      <span className={`tag ${over ? "tag-red" : pct >= 80 ? "tag-amber" : "tag-green"}`}>
                        {over ? "Over" : `${Math.round(pct)}%`}
                      </span>
                      <button className="btn-ghost" onClick={() => openAddExpense(c)}
                        style={{ padding: "5px 12px", fontSize: 12, color: "#c9a84c", borderColor: "rgba(201,168,76,0.25)" }}>
                        + Log
                      </button>
                      <button className="btn-ghost" onClick={() => handleDeleteCategory(c.id)}
                        style={{ padding: "5px 9px", fontSize: 12, color: "#3a3a52" }}>✕</button>
                    </div>
                    {/* Progress bar with coloured fill matching category colour */}
                    <div style={{ height: 5, background: "#0f0f1a", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: over ? "#ef4444" : (c.color || "#c9a84c"), borderRadius: 99, transition: "width 0.4s" }} />
                    </div>
                  </div>

                  {/* Expense line items */}
                  {catExpenses.length > 0 && (
                    <div style={{ borderTop: "1px solid #0d0d1a" }}>
                      {catExpenses.map((e, i) => (
                        <div key={e.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 20px 9px 54px",
                          background: i % 2 === 0 ? "#060610" : "#070712",
                          borderBottom: i < catExpenses.length - 1 ? "1px solid #0a0a16" : "none"
                        }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: c.color || "#c9a84c", flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, color: "#8a8278" }}>{e.description}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#e2d9cc" }}>${parseFloat(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <button className="btn-ghost" onClick={() => openEditExpense(e)}
                            style={{ padding: "3px 7px", fontSize: 11, color: "#5a5a72" }}>✎</button>
                          <button className="btn-ghost" onClick={() => handleDeleteExpense(e)}
                            style={{ padding: "3px 7px", fontSize: 11, color: "#3a3a52" }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {budget.length === 0 && (
              <div className="card" style={{ padding: 48, textAlign: "center", color: "#3a3a52", fontSize: 14 }}>
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
                    <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 20, fontWeight: 700, color: "#e2d9cc", marginBottom: 2 }}>
                      {editingExpense ? "Edit Expense" : "Log Expense"}
                    </h2>
                    <p style={{ fontSize: 12, color: "#5a5a72" }}>{expenseCategory.label}</p>
                  </div>
                </div>
                <button onClick={() => setShowExpenseModal(false)} style={{ background: "none", border: "none", color: "#3a3a52", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#e2d9cc"} onMouseLeave={e=>e.currentTarget.style.color="#3a3a52"}>×</button>
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
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#c9a84c", fontWeight: 500, fontSize: 14, pointerEvents: "none" }}>$</span>
                    <input className="ef-field" type="number" min="0" step="0.01" placeholder="0.00"
                      value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && handleSaveExpense()}
                      style={{ paddingLeft: 26 }} />
                  </div>
                </div>
                {expenseCategory.allocated > 0 && (
                  <div style={{ background: "#13131f", borderRadius: 9, padding: "10px 14px", fontSize: 12, color: "#5a5a72" }}>
                    Budget: <span style={{ color: "#e2d9cc" }}>${(expenseCategory.spent || 0).toLocaleString()}</span> spent of <span style={{ color: "#c9a84c" }}>${expenseCategory.allocated.toLocaleString()}</span> allocated
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
                  <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 20, fontWeight: 700, color: "#e2d9cc", marginBottom: 2 }}>New Category</h2>
                  <p style={{ fontSize: 12, color: "#5a5a72" }}>Add a budget category to track expenses against.</p>
                </div>
                <button onClick={() => setShowCategoryModal(false)} style={{ background: "none", border: "none", color: "#3a3a52", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#e2d9cc"} onMouseLeave={e=>e.currentTarget.style.color="#3a3a52"}>×</button>
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
                    {["#c9a84c","#8b5cf6","#10b981","#3b82f6","#ef4444","#f59e0b","#ec4899","#06b6d4","#84cc16","#f97316"].map(col => (
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
                      <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#c9a84c", fontWeight: 500, fontSize: 14, pointerEvents: "none" }}>$</span>
                      <input className="ef-field" type="number" min="0" step="0.01" placeholder="0.00"
                        value={categoryForm.allocated}
                        onChange={e => setCategoryForm(f => ({ ...f, allocated: e.target.value }))}
                        style={{ paddingLeft: 26 }} />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {categoryForm.label && (
                  <div style={{ background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{categoryForm.icon}</div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#e2d9cc" }}>{categoryForm.label}</span>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: categoryForm.color }} />
                    {categoryForm.allocated && <span style={{ fontSize: 13, color: "#5a5a72" }}>${parseFloat(categoryForm.allocated || 0).toLocaleString()}</span>}
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
            <style>{`
              .sp-field { background: #13131f; border: 1px solid #1e1e2e; border-radius: 9px; padding: 11px 14px; color: #e2d9cc; font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif; width: 100%; box-sizing: border-box; transition: border-color 0.2s; }
              .sp-field:focus { border-color: #1db954; box-shadow: 0 0 0 3px rgba(29,185,84,0.1); }
              .sp-field::placeholder { color: #2e2e42; }
              .sp-result { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 9px; transition: background 0.15s; }
              .sp-result:hover { background: rgba(255,255,255,0.03); }
              .sp-play { width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(29,185,84,0.15); color: #1db954; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
              .sp-play:hover, .sp-play.playing { background: rgba(29,185,84,0.28); }
              .sp-add { background: rgba(29,185,84,0.12); border: 1px solid rgba(29,185,84,0.2); color: #1db954; border-radius: 7px; padding: 5px 12px; font-size: 12px; cursor: pointer; font-family: 'DM Sans',sans-serif; transition: all 0.15s; white-space: nowrap; }
              .sp-add:hover { background: rgba(29,185,84,0.22); }
              .sp-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(29,185,84,0.1); border: 1px solid rgba(29,185,84,0.2); color: #1db954; border-radius: 5px; padding: 2px 7px; font-size: 10px; font-weight: 500; }
              .voted-badge { display: inline-flex; align-items: center; background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.2); color: #c9a84c; border-radius: 5px; padding: 3px 8px; font-size: 11px; }
              @keyframes playerIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
            `}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Playlist</h1>
                <p style={{ color: "#5a5a72", fontSize: 14 }}>
                  {songs.length} song{songs.length !== 1 ? "s" : ""} · guests vote · top tracks make the cut
                </p>
              </div>
              {songs.length > 0 && (
                <button onClick={handleExportCSV}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "#13131f", border: "1px solid #1e1e2e", color: "#8a8278", borderRadius: 9, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#c9a84c"; e.currentTarget.style.color="#c9a84c"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#1e1e2e"; e.currentTarget.style.color="#8a8278"; }}>
                  ↓ Export CSV
                </button>
              )}
            </div>

            {/* Spotify iframe player */}
            {nowPlaying?.spotify_id && (
              <div style={{ marginBottom: 16, borderRadius: 14, overflow: "hidden", animation: "playerIn 0.2s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px 6px" }}>
                  <span style={{ fontSize: 11, color: "#3a3a52", letterSpacing: "0.06em", textTransform: "uppercase" }}>Now Playing</span>
                  <button onClick={() => setNowPlaying(null)}
                    style={{ background: "none", border: "none", color: "#3a3a52", fontSize: 16, cursor: "pointer", padding: "0 2px", transition: "color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.color="#e2d9cc"}
                    onMouseLeave={e => e.currentTarget.style.color="#3a3a52"}>×</button>
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
                <span style={{ fontSize: 11, color: "#3a3a52", transition: "transform 0.2s", display: "block", transform: searchOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </div>

              {searchOpen && (
                <div style={{ padding: "0 20px 16px" }}>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#3a3a52", fontSize: 13, pointerEvents: "none" }}>🔍</span>
                    <input className="sp-field" placeholder="Search songs, artists, albums…"
                      value={spotifySearch}
                      style={{ paddingLeft: 38 }}
                      autoFocus
                      onChange={e => { setSpotifySearch(e.target.value); searchSpotify(e.target.value); }} />
                  </div>

                  {spotifySearching && <div style={{ padding: "10px 4px", fontSize: 13, color: "#5a5a72" }}>Searching…</div>}
                  {spotifyResults.map(track => {
                    const alreadyAdded = songs.some(s => s.spotify_id === track.id);
                    const isPlaying    = playingPreview === track.id;
                    return (
                      <div key={track.id} className="sp-result">
                        <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "#0f0f1a" }}>
                          {track.album?.images?.[2] && <img src={track.album.images[2].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#e2d9cc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                          <div style={{ fontSize: 11, color: "#5a5a72", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artists.map(a => a.name).join(", ")} · {track.album?.name}</div>
                        </div>
                        <span style={{ fontSize: 11, color: "#3a3a52", flexShrink: 0 }}>
                          {Math.floor(track.duration_ms/60000)}:{String(Math.floor((track.duration_ms%60000)/1000)).padStart(2,"0")}
                        </span>
                        {track.preview_url && (
                          <button className={`sp-play${isPlaying ? " playing" : ""}`} onClick={() => togglePreview(track)} title={isPlaying ? "Stop" : "30s preview"}>
                            {isPlaying ? "■" : "▶"}
                          </button>
                        )}
                        {alreadyAdded
                          ? <span style={{ fontSize: 11, color: "#3a3a52", whiteSpace: "nowrap" }}>✓ Added</span>
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
                <div style={{ padding: "40px", textAlign: "center", color: "#3a3a52", fontSize: 14 }}>
                  Search and add songs above — guests can also suggest and vote from the RSVP page.
                </div>
              )}
              {songs.map((s, i) => {
                const isPlaying  = playingPreview === (s.spotify_id || s.id);
                const isActive   = nowPlaying?.id === s.id;
                const mins = s.duration_ms ? Math.floor(s.duration_ms/60000) : null;
                const secs = s.duration_ms ? String(Math.floor((s.duration_ms%60000)/1000)).padStart(2,"0") : null;
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < songs.length - 1 ? "1px solid #0a0a14" : "none", background: isActive ? "rgba(29,185,84,0.04)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>

                    {/* Rank */}
                    <div style={{ width: 24, textAlign: "center", fontSize: 12, fontWeight: 700, color: i === 0 ? "#c9a84c" : i === 1 ? "#6a6a7a" : "#3a3a52", flexShrink: 0 }}>{i + 1}</div>

                    {/* Artwork — click to play */}
                    <div onClick={() => playFullSong(s)}
                      style={{ width: 44, height: 44, borderRadius: 7, overflow: "hidden", background: "#13131f", flexShrink: 0, position: "relative", cursor: s.spotify_id ? "pointer" : "default" }}>
                      {s.artwork_url
                        ? <img src={s.artwork_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#2e2e42", fontSize: 18 }}>♪</div>
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
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#e2d9cc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                        {s.title}
                        {s.spotify_id && <span className="sp-badge">Spotify</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#5a5a72", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.artist} · added by {s.added_by}
                      </div>
                    </div>

                    {/* Duration */}
                    {mins !== null && <span style={{ fontSize: 11, color: "#3a3a52", flexShrink: 0 }}>{mins}:{secs}</span>}

                    {/* Play button (if preview available) */}
                    {s.spotify_id && (
                      <button className={`sp-play${nowPlaying?.id === s.id ? " playing" : ""}`} onClick={() => playFullSong(s)}
                        title={nowPlaying?.id === s.id ? "Close player" : "Play in Spotify"} style={{ width: 28, height: 28, fontSize: 10 }}>
                        {nowPlaying?.id === s.id ? "■" : "▶"}
                      </button>
                    )}

                    {/* Votes — host can vote unlimited */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c", minWidth: 22, textAlign: "right" }}>{s.votes}</span>
                      <button className="vote-btn" onClick={() => handleVoteSong(s.id)} title="Vote (host — unlimited)">▲</button>
                    </div>

                    {/* Remove */}
                    <button onClick={() => handleVetoSong(s.id)}
                      style={{ background: "none", border: "none", color: "#2e2e42", fontSize: 16, cursor: "pointer", padding: "0 2px", transition: "color 0.15s", flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                      onMouseLeave={e => e.currentTarget.style.color = "#2e2e42"}
                      title="Remove song">×</button>
                  </div>
                );
              })}
            </div>

            {/* CSV export hint */}
            {songs.length > 0 && (
              <div style={{ marginTop: 12, padding: "11px 16px", background: "#0a0a14", border: "1px solid #1a1a2a", borderRadius: 10, fontSize: 12, color: "#3a3a52", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Export the playlist as a CSV to import into Spotify, Apple Music, or any playlist tool.</span>
                <button onClick={handleExportCSV}
                  style={{ background: "none", border: "none", color: "#c9a84c", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", marginLeft: 12 }}>
                  ↓ Download CSV
                </button>
              </div>
            )}
          </div>
        )}

        {/* POLLS */}
        {activeNav === "polls" && (
          <div className="fade-up">
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Polls</h1>
              <p style={{ color: "#5a5a72", fontSize: 14 }}>Ask guests anything · live results</p>
            </div>
            <div className="card" style={{ padding: "22px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#e2d9cc", marginBottom: 16 }}>Create a Poll</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Question</div>
                <input className="field" placeholder="Ask your guests something..." value={newPollQ} onChange={e => setNewPollQ(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Options</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input className="field" placeholder={`Option ${i + 1}`} value={opt} onChange={e => updatePollOption(i, e.target.value)} style={{ flex: 1 }} />
                      {pollOptions.length > 2 && (
                        <button onClick={() => removePollOption(i)} style={{ background: "none", border: "none", color: "#3a3a52", fontSize: 18, cursor: "pointer", padding: "0 4px", transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="#3a3a52"}>×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addPollOption} style={{ background: "none", border: "none", color: "#5a5a72", fontSize: 13, cursor: "pointer", marginTop: 8, padding: "4px 0", fontFamily: "'DM Sans',sans-serif", transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#c9a84c"} onMouseLeave={e=>e.currentTarget.style.color="#5a5a72"}>+ Add option</button>
              </div>
              {pollError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 12 }}>⚠ {pollError}</div>}
              <button className="btn-gold" onClick={handleCreatePoll} style={{ width: "100%" }}>Create Poll</button>
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
                        <div style={{ fontSize: 12, color: "#5a5a72" }}>{total} votes</div>
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
                              <span style={{ color: isWinner ? "#c9a84c" : "#8a8a9a" }}>{opt.label}{isWinner ? " ✦" : ""}</span>
                              <span style={{ color: "#5a5a72" }}>{opt.votes} · {pct}%</span>
                            </div>
                            <div className="progress-bar" style={{ height: 6 }}>
                              <div className="progress-fill" style={{ width: `${pct}%`, background: isWinner ? "linear-gradient(90deg,#c9a84c,#f59e0b)" : "#2a2a3a" }} />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Vendors</h1>
                <p style={{ color: "#5a5a72", fontSize: 14 }}>{vendors.length} supplier{vendors.length !== 1 ? "s" : ""} · {vendors.filter(v => v.status === "confirmed").length} confirmed</p>
              </div>
              <button className="btn-gold" onClick={openAddVendor}>+ Add Vendor</button>
            </div>
            {vendors.length === 0 && (
              <div className="card" style={{ padding: "48px", textAlign: "center", color: "#3a3a52", fontSize: 14 }}>No vendors yet — add your first supplier.</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {vendors.map(v => (
                <div key={v.id} className="card" style={{ padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, background: "#13131f", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{v.icon || "🏢"}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{v.name}</div>
                        <div style={{ fontSize: 12, color: "#5a5a72" }}>{v.role}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select
                        value={v.status}
                        onChange={e => handleVendorStatus(v.id, e.target.value)}
                        style={{ background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 6, color: v.status === "confirmed" ? "#10b981" : v.status === "cancelled" ? "#ef4444" : "#c9a84c", fontSize: 12, padding: "3px 6px", cursor: "pointer" }}
                      >
                        <option value="pending">pending</option>
                        <option value="confirmed">confirmed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </div>
                  </div>
                  {v.contact && <div style={{ fontSize: 13, color: "#5a5a72", marginBottom: 3 }}>✉ {v.contact}</div>}
                  {v.phone   && <div style={{ fontSize: 13, color: "#5a5a72", marginBottom: 3 }}>📞 {v.phone}</div>}
                  {v.notes   && <div style={{ fontSize: 12, color: "#5a5a72", background: "#13131f", borderRadius: 6, padding: "7px 10px", marginTop: 8 }}>{v.notes}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid #0f0f1a" }}>
                    <button className="btn-ghost" onClick={() => openEditVendor(v)} style={{ flex: 1, padding: "7px", fontSize: 12 }}>✎ Edit</button>
                    <button className="btn-ghost" onClick={() => handleDeleteVendor(v.id)} style={{ padding: "7px 12px", fontSize: 12, color: "#ef4444" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VENDOR MODAL */}
        {showVendorModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, backdropFilter: "blur(6px)" }}
            onClick={() => setShowVendorModal(false)}>
            <style>{`
              .vm-field { background: #13131f; border: 1px solid #1e1e2e; border-radius: 9px; padding: 11px 14px; color: #e2d9cc; font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif; width: 100%; box-sizing: border-box; transition: border-color 0.2s; }
              .vm-field:focus { border-color: #c9a84c; box-shadow: 0 0 0 3px rgba(201,168,76,0.08); }
              .vm-field::placeholder { color: #2e2e42; }
              .vm-label { display: block; font-size: 11px; color: #5a5a72; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; font-family: 'DM Sans', sans-serif; }
              .vm-icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 2px solid transparent; background: #13131f; font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
              .vm-icon-btn:hover { border-color: rgba(201,168,76,0.3); }
              .vm-icon-btn.sel { border-color: #c9a84c; background: rgba(201,168,76,0.1); }
            `}</style>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "modalIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}>

              {/* Header */}
              <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 20, fontWeight: 700, color: "#e2d9cc", marginBottom: 2 }}>
                    {editingVendor ? "Edit Vendor" : "Add Vendor"}
                  </h2>
                  <p style={{ fontSize: 12, color: "#5a5a72" }}>Supplier contact and booking details</p>
                </div>
                <button onClick={() => setShowVendorModal(false)} style={{ background: "none", border: "none", color: "#3a3a52", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#e2d9cc"} onMouseLeave={e=>e.currentTarget.style.color="#3a3a52"}>×</button>
              </div>

              <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Icon picker */}
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
                  <div>
                    <label className="vm-label">Name *</label>
                    <input className="vm-field" placeholder="e.g. Sound Co." value={vendorForm.name}
                      onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                  </div>
                  <div>
                    <label className="vm-label">Role</label>
                    <input className="vm-field" placeholder="e.g. AV / Catering" value={vendorForm.role}
                      onChange={e => setVendorForm(f => ({ ...f, role: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="vm-label">Email</label>
                    <input className="vm-field" placeholder="contact@vendor.com" value={vendorForm.contact}
                      onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} />
                  </div>
                  <div>
                    <label className="vm-label">Phone</label>
                    <input className="vm-field" placeholder="021 000 0000" value={vendorForm.phone}
                      onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="vm-label">Status</label>
                  <select className="vm-field" value={vendorForm.status}
                    onChange={e => setVendorForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="vm-label">Notes</label>
                  <textarea className="vm-field" placeholder="Contract terms, requirements, contacts…" rows={3}
                    value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ resize: "vertical" }} />
                </div>

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

        {/* CHECK-IN */}
        {/* ── CHECKLIST ── */}
        {activeNav === "checklist" && (
          <div className="fade-up">
            <style>{`
              .task-row { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-bottom: 1px solid #0a0a14; transition: background 0.15s; }
              .task-row:last-child { border-bottom: none; }
              .task-row:hover { background: rgba(255,255,255,0.02); }
              .task-row:hover .task-actions { opacity: 1; }
              .task-actions { opacity: 0; display: flex; gap: 6px; transition: opacity 0.15s; }
              .cl-field { background: #13131f; border: 1px solid #1e1e2e; border-radius: 9px; padding: 10px 14px; color: #e2d9cc; font-size: 14px; outline: none; font-family: 'DM Sans',sans-serif; transition: border-color 0.2s; }
              .cl-field:focus { border-color: #c9a84c; box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
              .cl-field::placeholder { color: #2e2e42; }
            `}</style>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Checklist</h1>
                <p style={{ color: "#5a5a72", fontSize: 14 }}>
                  {tasks.filter(t => t.done).length} of {tasks.length} done
                </p>
              </div>
              {/* Filter tabs */}
              <div style={{ display: "flex", gap: 6 }}>
                {["all", "pending", "done"].map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)}
                    style={{ background: taskFilter === f ? "rgba(201,168,76,0.15)" : "transparent", border: `1px solid ${taskFilter === f ? "rgba(201,168,76,0.3)" : "#1e1e2e"}`, color: taskFilter === f ? "#c9a84c" : "#5a5a72", borderRadius: 7, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", textTransform: "capitalize", transition: "all 0.15s" }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5a5a72", marginBottom: 8 }}>
                <span>Progress</span>
                <span style={{ color: "#c9a84c" }}>{tasks.length ? Math.round((tasks.filter(t=>t.done).length/tasks.length)*100) : 0}%</span>
              </div>
              <div style={{ height: 6, background: "#1a1a28", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: tasks.length ? `${(tasks.filter(t=>t.done).length/tasks.length)*100}%` : "0%", background: "linear-gradient(90deg,#c9a84c,#10b981)", borderRadius: 99, transition: "width 0.4s" }} />
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
                <button className="btn-gold" onClick={handleAddTask}>Add</button>
              </div>
            </div>

            {/* Task list */}
            <div className="card" style={{ overflow: "hidden" }}>
              {tasks.filter(t =>
                taskFilter === "all" ? true :
                taskFilter === "done" ? t.done : !t.done
              ).length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: "#3a3a52", fontSize: 14 }}>
                  {taskFilter === "done" ? "Nothing completed yet." : taskFilter === "pending" ? "All done! 🎉" : "No checklist items yet — add one above."}
                </div>
              )}
              {tasks
                .filter(t => taskFilter === "all" ? true : taskFilter === "done" ? t.done : !t.done)
                .map(t => (
                  <div key={t.id} className="task-row">
                    {/* Checkbox */}
                    <div onClick={() => handleToggleTask(t.id, !t.done)}
                      style={{ width: 20, height: 20, border: `1.5px solid ${t.done ? "#c9a84c" : "#2e2e42"}`, borderRadius: 5, background: t.done ? "#c9a84c" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#080810", flexShrink: 0, cursor: "pointer", transition: "all 0.2s" }}>
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
                        <button className="btn-gold" style={{ padding: "8px 14px", fontSize: 12 }} onClick={handleUpdateTask}>Save</button>
                        <button onClick={() => setEditingTask(null)} style={{ background: "none", border: "none", color: "#5a5a72", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 14, color: t.done ? "#3a3a52" : "#e2d9cc", textDecoration: t.done ? "line-through" : "none", transition: "all 0.2s" }}>{t.text}</span>
                        {t.due_date && (
                          <span style={{ fontSize: 11, color: new Date(t.due_date) < new Date() && !t.done ? "#ef4444" : "#3a3a52", flexShrink: 0 }}>
                            {new Date(t.due_date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        <div className="task-actions">
                          <button onClick={() => setEditingTask({ id: t.id, text: t.text, due_date: t.due_date || "" })}
                            style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 6, padding: "4px 10px", color: "#5a5a72", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#c9a84c"; e.currentTarget.style.color="#c9a84c"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="#1e1e2e"; e.currentTarget.style.color="#5a5a72"; }}>
                            Edit
                          </button>
                          <button onClick={() => handleDeleteTask(t.id)}
                            style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 6, padding: "4px 10px", color: "#5a5a72", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="#1e1e2e"; e.currentTarget.style.color="#5a5a72"; }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: "1px solid #0a0a14", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: g.checked_in ? "rgba(16,185,129,0.15)" : "#13131f", border: `1.5px solid ${g.checked_in ? "#10b981" : "#1e1e2e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, transition: "all 0.2s" }}>
                {(g.name || g.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: g.checked_in ? "#5a8a72" : "#e2d9cc" }}>{g.name || g.email}</div>
                <div style={{ fontSize: 11, color: "#3a3a52", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.email && <span>{g.email}</span>}
                  {g.phone && <span>· {g.phone}</span>}
                  {g.dietary && g.dietary !== "None" && <span>· 🍃 {g.dietary}</span>}
                  {g.checked_in && g.checked_in_at && <span style={{ color: "#10b981" }}>· ✓ {new Date(g.checked_in_at).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
              </div>
              <button onClick={() => setQrGuest(g)}
                style={{ background: "none", border: "1px solid #1e1e2e", borderRadius: 7, padding: "5px 10px", color: "#3a3a52", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#5a5a72"; e.currentTarget.style.color="#5a5a72"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#1e1e2e"; e.currentTarget.style.color="#3a3a52"; }}>
                QR
              </button>
              {g.checked_in ? (
                <button onClick={() => handleUnCheckIn(g.id)}
                  style={{ background: "rgba(16,185,129,0.1)", border: "1.5px solid #10b981", borderRadius: 8, padding: "7px 14px", color: "#10b981", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, transition: "all 0.2s", flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background="rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="rgba(16,185,129,0.1)"; e.currentTarget.style.borderColor="#10b981"; e.currentTarget.style.color="#10b981"; }}
                  title="Undo check-in">
                  ✓ In
                </button>
              ) : (
                <button onClick={() => handleCheckIn(g.id)}
                  style={{ background: "transparent", border: "1.5px solid #2e2e42", borderRadius: 8, padding: "7px 14px", color: "#5a5a72", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, transition: "all 0.2s", flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#10b981"; e.currentTarget.style.color="#10b981"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#2e2e42"; e.currentTarget.style.color="#5a5a72"; }}>
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
                  <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Check-in</h1>
                  <p style={{ color: "#5a5a72", fontSize: 14 }}>{checkedIn} of {attending} checked in tonight</p>
                </div>
                <button onClick={() => setEventQrOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "#13131f", border: "1px solid #1e1e2e", color: "#e2d9cc", borderRadius: 9, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#10b981"; e.currentTarget.style.color="#10b981"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#1e1e2e"; e.currentTarget.style.color="#e2d9cc"; }}>
                  📷 Event QR Code
                </button>
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
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5a5a72", marginBottom: 8 }}>
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
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#3a3a52", fontSize: 13, pointerEvents: "none" }}>🔍</span>
                  <input value={checkInSearch} onChange={e => setCheckInSearch(e.target.value)}
                    placeholder="Search by name, email, phone…"
                    style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 9, padding: "10px 14px 10px 38px", color: "#e2d9cc", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
                </div>
                {["all","in","out"].map(f => (
                  <button key={f} onClick={() => setCheckInFilter(f)}
                    style={{ background: checkInFilter === f ? "rgba(16,185,129,0.12)" : "transparent", border: `1px solid ${checkInFilter === f ? "rgba(16,185,129,0.3)" : "#1e1e2e"}`, color: checkInFilter === f ? "#10b981" : "#5a5a72", borderRadius: 7, padding: "9px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s", textTransform: "capitalize" }}>
                    {f === "in" ? "✓ In" : f === "out" ? "Not in" : "All"}
                  </button>
                ))}
              </div>

              {/* Not yet checked in */}
              {checkInFilter !== "in" && (
                <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
                  {notIn.length === 0
                    ? <div style={{ padding: "28px", textAlign: "center", color: "#3a3a52", fontSize: 13 }}>
                        {checkInSearch ? "No matches." : "Everyone is checked in! 🎉"}
                      </div>
                    : notIn.map(g => <GuestRow key={g.id} g={g} />)
                  }
                </div>
              )}

              {/* Checked in section */}
              {checkInFilter !== "out" && inGuests.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: "#3a3a52", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
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
            <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 20, padding: "36px 32px", textAlign: "center", maxWidth: 340, width: "100%" }}>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{event?.name}</div>
              <div style={{ fontSize: 12, color: "#5a5a72", marginBottom: 24 }}>Guests scan this to check themselves in</div>
              <div style={{ background: "#fff", borderRadius: 14, padding: 14, display: "inline-block", marginBottom: 20 }}>
                <img src={getEventQRUrl()} alt="Event QR" width="220" height="220" />
              </div>
              <p style={{ fontSize: 12, color: "#3a3a52", marginBottom: 20 }}>
                Print this and display it at the entrance, or show guests on screen.
              </p>
              <button onClick={() => window.print()}
                style={{ width: "100%", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#c9a84c", borderRadius: 9, padding: "11px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }}>
                🖨 Print QR Code
              </button>
              <button onClick={() => setEventQrOpen(false)}
                style={{ width: "100%", background: "none", border: "1px solid #1e1e2e", color: "#5a5a72", borderRadius: 9, padding: "10px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Individual guest QR Modal */}
        {qrGuest && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24, backdropFilter: "blur(8px)" }}
            onClick={() => setQrGuest(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 18, padding: "32px", textAlign: "center", maxWidth: 320, width: "100%" }}>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{qrGuest.name || qrGuest.email}</div>
              <div style={{ fontSize: 12, color: "#5a5a72", marginBottom: 24 }}>Individual QR for this guest</div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "inline-block", marginBottom: 20 }}>
                <img src={getQRUrl(qrGuest.id)} alt="QR Code" width="180" height="180" />
              </div>
              {qrGuest.checked_in ? (
                <div style={{ fontSize: 13, color: "#10b981", marginBottom: 16 }}>✓ Already checked in</div>
              ) : (
                <button onClick={() => { handleCheckIn(qrGuest.id); setQrGuest(g => ({ ...g, checked_in: true })); }}
                  style={{ width: "100%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", borderRadius: 9, padding: "11px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: 12 }}>
                  ✓ Mark as Checked In
                </button>
              )}
              <button onClick={() => setQrGuest(null)}
                style={{ width: "100%", background: "none", border: "1px solid #1e1e2e", color: "#5a5a72", borderRadius: 9, padding: "10px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Close
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, backdropFilter: "blur(6px)" }} onClick={() => setEditingGuest(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 460, boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
            <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#e2d9cc" }}>Edit Guest</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Name</div>
                <input className="field" value={editingGuest.name || ""} onChange={e => setEditingGuest(g => ({ ...g, name: e.target.value }))} placeholder="Guest name" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email</div>
                <input className="field" type="email" value={editingGuest.email || ""} onChange={e => setEditingGuest(g => ({ ...g, email: e.target.value }))} placeholder="guest@email.com" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Status</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["pending", "attending", "declined"].map(s => (
                    <button key={s} onClick={() => setEditingGuest(g => ({ ...g, status: s }))} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1.5px solid ${editingGuest.status === s ? (s === "attending" ? "#10b981" : s === "declined" ? "#ef4444" : "#c9a84c") : "#1e1e2e"}`, background: editingGuest.status === s ? (s === "attending" ? "rgba(16,185,129,0.1)" : s === "declined" ? "rgba(239,68,68,0.08)" : "rgba(201,168,76,0.1)") : "transparent", color: editingGuest.status === s ? (s === "attending" ? "#10b981" : s === "declined" ? "#ef4444" : "#c9a84c") : "#5a5a72", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s", textTransform: "capitalize" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Dietary Requirements</div>
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
          <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 16, padding: "28px 32px", width: "100%", maxWidth: 400, boxShadow: "0 32px 80px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>🗑️</div>
            <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 20, marginBottom: 10, color: "#e2d9cc" }}>Remove this guest?</h2>
            <p style={{ color: "#5a5a72", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>They'll be removed from the guest list and won't receive future invites.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setDeletingGuest(null)} style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleDeleteGuest(deletingGuest)} style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 10, padding: "10px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Remove</button>
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
