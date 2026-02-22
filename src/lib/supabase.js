// ============================================================
//  lib/supabase.js
//  Drop your credentials in here, then import throughout the app
// ============================================================

import { createClient } from '@supabase/supabase-js';

// 🔑 Replace these with your actual values from:
//    Supabase Dashboard → Project Settings → API
export const SUPABASE_URL  = 'https://qjxbgilbmkdvrwtuqpje.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqeGJnaWxibWtkdnJ3dHVxcGplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTkxODIsImV4cCI6MjA4NzE5NTE4Mn0.czc4j26VJfFys55F2pXShefDOP-G2eQx6Cpmb4cucEI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce' },
});


// ============================================================
//  AUTH HELPERS
// ============================================================

/** Send a magic-link email to sign in as an organiser */
export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + '/dashboard' },
  });
  if (error) throw error;
}

/** Sign out */
export async function signOut() {
  await supabase.auth.signOut();
}

/** Get the current session synchronously from cache */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}


// ============================================================
//  EVENT HELPERS
// ============================================================

/**
 * Create a full event with all related data in one go.
 * Called at the end of the EventCreation wizard.
 */
export async function createEvent(formData, userId) {
  // 1. Generate invite slug from event name
  const { data: slugData, error: slugError } = await supabase
    .rpc('generate_invite_slug', { name: formData.name });
  if (slugError) throw slugError;

  // 2. Insert the event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      organiser_id:  userId,
      name:          formData.name,
      type:          formData.type,
      ticketing:     formData.ticketing || 'private',
      date:          formData.date,
      time:          formData.time,
      description:   formData.description,
      ticket_message: formData.ticket_message || null,
      venue_name:    formData.venue,
      venue_address: formData.address,
      capacity:      formData.capacity ? parseInt(formData.capacity) : null,
      total_budget:  formData.totalBudget ? parseFloat(formData.totalBudget) : 0,
      invite_slug:   slugData,
    })
    .select()
    .single();
  if (eventError) throw eventError;

  // 3. Insert budget categories
  const budgetRows = Object.entries(formData.budgetSplit)
    .filter(([, val]) => val)
    .map(([key, val]) => {
      const META = {
        venue:         { label: 'Venue',          icon: '🏛️', color: '#f59e0b' },
        catering:      { label: 'Catering',        icon: '🍽️', color: '#10b981' },
        entertainment: { label: 'Entertainment',   icon: '🎵', color: '#8b5cf6' },
        decorations:   { label: 'Decorations',     icon: '🌸', color: '#ec4899' },
        photography:   { label: 'Photography',     icon: '📷', color: '#3b82f6' },
        misc:          { label: 'Miscellaneous',   icon: '📦', color: '#6b7280' },
      };
      return { event_id: event.id, ...META[key], allocated: parseFloat(val), spent: 0 };
    });

  if (budgetRows.length) {
    const { error } = await supabase.from('budget_categories').insert(budgetRows);
    if (error) throw error;
  }

  // 4. Insert guests
  if (formData.guests.length) {
    const guestRows = formData.guests.map(email => ({ event_id: event.id, email }));
    const { error } = await supabase.from('guests').insert(guestRows);
    if (error) throw error;
  }

  // 5. Seed default tasks
  const DEFAULT_TASKS = [
    { text: 'Confirm venue booking',       sort_order: 1 },
    { text: 'Send invites to guest list',  sort_order: 2 },
    { text: 'Finalise catering menu',      sort_order: 3 },
    { text: 'Create event playlist',       sort_order: 4 },
    { text: 'Arrange security/staff',      sort_order: 5 },
    { text: 'Print guest list for check-in', sort_order: 6 },
  ];
  const taskRows = DEFAULT_TASKS.map(t => ({ event_id: event.id, ...t }));
  await supabase.from('tasks').insert(taskRows);

  return event;
}

/** Fetch a single event by its ID (for the dashboard) */
export async function fetchEvent(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch a single event by its invite slug (for the RSVP page) */
export async function fetchEventBySlug(slug) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('invite_slug', slug)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch all events for the current organiser */
export async function fetchMyEvents(userId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('organiser_id', userId)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}


// ============================================================
//  GUESTS
// ============================================================

export async function fetchGuests(eventId) {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function addGuest(eventId, email) {
  const { data, error } = await supabase
    .from('guests')
    .insert({ event_id: eventId, email })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGuestStatus(guestId, status, dietary = null) {
  const updates = { status };
  if (dietary) updates.dietary = dietary;
  const { error } = await supabase.from('guests').update(updates).eq('id', guestId);
  if (error) throw error;
}

export async function checkInGuest(guestId) {
  const { error } = await supabase
    .from('guests')
    .update({ checked_in: true, checked_in_at: new Date().toISOString() })
    .eq('id', guestId);
  if (error) throw error;
}

/** Guests RSVP via their personal invite token */
export async function rsvpByToken(token, status, name, dietary) {
  const { data, error } = await supabase
    .from('guests')
    .update({ status, name, dietary })
    .eq('invite_token', token)
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ============================================================
//  TASKS
// ============================================================

export async function fetchTasks(eventId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function toggleTask(taskId, done) {
  const { error } = await supabase.from('tasks').update({ done }).eq('id', taskId);
  if (error) throw error;
}

export async function addTask(eventId, text, dueDate = null) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ event_id: eventId, text, due_date: dueDate })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId, text, dueDate = null) {
  const { error } = await supabase
    .from('tasks')
    .update({ text, due_date: dueDate || null })
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}


// ============================================================
//  BUDGET
// ============================================================

export async function fetchBudget(eventId) {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('event_id', eventId);
  if (error) throw error;
  return data;
}

export async function updateSpend(categoryId, spent) {
  const { error } = await supabase
    .from('budget_categories')
    .update({ spent })
    .eq('id', categoryId);
  if (error) throw error;
}

export async function fetchExpenses(eventId) {
  const { data, error } = await supabase
    .from('budget_expenses')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addExpense(eventId, categoryId, description, amount) {
  const { data, error } = await supabase
    .from('budget_expenses')
    .insert({ event_id: eventId, category_id: categoryId, description, amount })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateExpense(id, description, amount) {
  const { data, error } = await supabase
    .from('budget_expenses')
    .update({ description, amount })
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('budget_expenses').delete().eq('id', id);
  if (error) throw error;
}


// ============================================================
//  VENDORS
// ============================================================

export async function fetchVendors(eventId) {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function addVendor(eventId, vendor) {
  const { data, error } = await supabase
    .from('vendors')
    .insert({ event_id: eventId, ...vendor })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVendorStatus(vendorId, status) {
  const { error } = await supabase.from('vendors').update({ status }).eq('id', vendorId);
  if (error) throw error;
}


// ============================================================
//  PLAYLIST / SONGS
// ============================================================

export async function fetchSongs(eventId) {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('event_id', eventId)
    .eq('vetoed', false)
    .order('votes', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addSong(eventId, title, artist, addedBy = 'Organiser', spotifyMeta = {}) {
  const { data, error } = await supabase
    .from('songs')
    .insert({
      event_id:    eventId,
      title,
      artist,
      added_by:    addedBy,
      spotify_id:  spotifyMeta.spotify_id  || null,
      spotify_uri: spotifyMeta.spotify_uri || null,
      preview_url: spotifyMeta.preview_url || null,
      artwork_url: spotifyMeta.artwork_url || null,
      duration_ms: spotifyMeta.duration_ms || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function voteSong(songId, voterToken) {
  const { error } = await supabase.rpc('cast_song_vote', {
    p_song_id:     songId,
    p_voter_token: voterToken,
  });
  if (error) throw error;
}

export async function vetoSong(songId) {
  const { error } = await supabase.from('songs').update({ vetoed: true }).eq('id', songId);
  if (error) throw error;
}


// ============================================================
//  POLLS
// ============================================================

export async function fetchPolls(eventId) {
  const { data, error } = await supabase
    .from('polls')
    .select('*, poll_options(*)')
    .eq('event_id', eventId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function createPoll(eventId, question, options) {
  const { data: poll, error } = await supabase
    .from('polls')
    .insert({ event_id: eventId, question })
    .select()
    .single();
  if (error) throw error;

  const optionRows = options.map(label => ({ poll_id: poll.id, label }));
  await supabase.from('poll_options').insert(optionRows);
  return poll;
}

export async function votePoll(optionId, voterToken) {
  const { error } = await supabase.rpc('cast_poll_vote', {
    p_option_id:   optionId,
    p_voter_token: voterToken,
  });
  if (error) throw error;
}

export async function closePoll(pollId) {
  const { error } = await supabase.from('polls').update({ status: 'closed' }).eq('id', pollId);
  if (error) throw error;
}


// ============================================================
//  REALTIME SUBSCRIPTIONS
//  Usage: const unsub = subscribeToGuests(eventId, (guests) => setGuests(guests))
//         // call unsub() on component unmount
// ============================================================

export function subscribeToGuests(eventId, callback) {
  const channel = supabase
    .channel(`guests:${eventId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'guests',
      filter: `event_id=eq.${eventId}`,
    }, () => fetchGuests(eventId).then(callback))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToSongs(eventId, callback) {
  const channel = supabase
    .channel(`songs:${eventId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'songs',
      filter: `event_id=eq.${eventId}`,
    }, () => fetchSongs(eventId).then(callback))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToPolls(eventId, callback) {
  const channel = supabase
    .channel(`polls:${eventId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'poll_options',
    }, () => fetchPolls(eventId).then(callback))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToTasks(eventId, callback) {
  const channel = supabase
    .channel(`tasks:${eventId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'tasks',
      filter: `event_id=eq.${eventId}`,
    }, () => fetchTasks(eventId).then(callback))
    .subscribe();
  return () => supabase.removeChannel(channel);
}



// ============================================================
//  EMAIL INVITES — uses Supabase auth admin via Edge Function
//  Fires through your already-connected SMTP, no extras needed
// ============================================================
export async function sendInvites(eventId, guestIds = []) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/send-invites`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey":        SUPABASE_ANON,
      },
      body: JSON.stringify({ eventId, guestIds }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to send invites");
  }
  return res.json();
}
