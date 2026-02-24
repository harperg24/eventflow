// ============================================================
//  Operations.jsx — Riders, Inventory, Incidents, H&S
//  Sub-tabs within the Dashboard "Operations" nav item
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ── Shared style tokens ───────────────────────────────────────
const S = {
  card: {
    background: "var(--bg2)", border: "1.5px solid var(--border)",
    borderRadius: 14, overflow: "hidden",
  },
  inp: {
    width: "100%", boxSizing: "border-box", background: "var(--bg3)",
    border: "1.5px solid var(--border)", borderRadius: 8,
    padding: "9px 12px", color: "var(--text)", fontSize: 14,
    outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
  },
  btn: {
    background: "var(--accent)", border: "none", color: "#fff",
    borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
  ghost: {
    background: "none", border: "1.5px solid var(--border)", color: "var(--text2)",
    borderRadius: 8, padding: "6px 13px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  label: {
    fontSize: 11, fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.07em",
    display: "block", marginBottom: 6,
  },
  sectionHead: {
    fontSize: 11, fontWeight: 800, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14,
  },
};

const chip = (label, active, onClick, color) => (
  <button key={label} type="button" onClick={onClick}
    style={{
      background: active ? (color || "var(--accent)") : "var(--bg3)",
      border: `1.5px solid ${active ? (color || "var(--accent)") : "var(--border)"}`,
      color: active ? "#fff" : "var(--text2)",
      borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600,
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
    }}>
    {label}
  </button>
);

// ── Empty state ────────────────────────────────────────────────
function Empty({ icon, title, desc, action, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 20px", background: "var(--bg2)",
      border: "1.5px solid var(--border)", borderRadius: 16 }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "var(--text2)", fontSize: 13, maxWidth: 340, margin: "0 auto 20px", lineHeight: 1.6 }}>{desc}</p>
      {action && (
        <button onClick={onAction} style={S.btn}>{action}</button>
      )}
    </div>
  );
}

// ============================================================
//  TAB 1: RIDERS
// ============================================================
function RiderRequirements({ requirements, onChange }) {
  const cats = [
    { key: "hospitality", label: "🍽 Hospitality", placeholder: "e.g. 2x bottles of water, rider snacks, hot meals for 4..." },
    { key: "technical",   label: "🎛 Technical",   placeholder: "e.g. 2x SM58 mics, DI box, 4-channel monitor mix..." },
    { key: "production",  label: "🎭 Production",  placeholder: "e.g. Stage dimensions 8x6m, backdrop required, lighting rig..." },
    { key: "transport",   label: "🚐 Transport",   placeholder: "e.g. Airport pickup required, hotel drop-off at 11pm..." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {cats.map(c => (
        <div key={c.key}>
          <label style={S.label}>{c.label}</label>
          <textarea
            value={requirements?.[c.key] || ""}
            onChange={e => onChange({ ...requirements, [c.key]: e.target.value })}
            rows={3} style={{ ...S.inp, resize: "vertical" }}
            placeholder={c.placeholder} />
        </div>
      ))}
    </div>
  );
}

function ShoppingListEditor({ items, onChange }) {
  const add = () => onChange([...(items || []), { name: "", qty: 1, unit: "", category: "general", done: false }]);
  const update = (i, patch) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  const cats = ["general", "food", "drinks", "technical", "production", "transport"];
  const catColors = { general: "#6b7280", food: "#f59e0b", drinks: "#3b82f6", technical: "#8b5cf6", production: "#ec4899", transport: "#10b981" };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {(items || []).map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center",
            background: item.done ? "var(--bg3)" : "var(--bg2)",
            border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 12px",
            opacity: item.done ? 0.55 : 1, transition: "all 0.15s" }}>
            <input type="checkbox" checked={item.done}
              onChange={e => update(i, { done: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }} />
            <input value={item.name} onChange={e => update(i, { name: e.target.value })}
              placeholder="Item name" style={{ ...S.inp, flex: 2, padding: "6px 10px",
                textDecoration: item.done ? "line-through" : "none" }} />
            <input type="number" min={1} value={item.qty}
              onChange={e => update(i, { qty: parseInt(e.target.value) || 1 })}
              style={{ ...S.inp, width: 60, padding: "6px 8px", textAlign: "center" }} />
            <input value={item.unit} onChange={e => update(i, { unit: e.target.value })}
              placeholder="unit" style={{ ...S.inp, width: 70, padding: "6px 8px" }} />
            <select value={item.category}
              onChange={e => update(i, { category: e.target.value })}
              style={{ ...S.inp, width: 120, padding: "6px 8px", cursor: "pointer" }}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => remove(i)} style={{ ...S.ghost, padding: "5px 9px",
              color: "#dc2626", borderColor: "rgba(220,38,38,0.2)", flexShrink: 0 }}>✕</button>
          </div>
        ))}
      </div>
      <button onClick={add} style={{ ...S.ghost, fontSize: 13 }}>+ Add item</button>
    </div>
  );
}

function RidersTab({ eventId }) {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | riderObj | {}
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    supabase.from("riders").select("*").eq("event_id", eventId).order("name")
      .then(({ data }) => { setRiders(data || []); setLoading(false); });
  }, [eventId]);

  const save = async (form) => {
    const row = {
      event_id: eventId, name: form.name.trim(),
      role: form.role || null, contact: form.contact || null,
      notes: form.notes || null, requirements: form.requirements || {},
      shopping_list: form.shopping_list || [],
    };
    if (form.id) {
      const { data } = await supabase.from("riders").update(row).eq("id", form.id).select().single();
      setRiders(r => r.map(x => x.id === form.id ? data : x));
    } else {
      const { data } = await supabase.from("riders").insert(row).select().single();
      setRiders(r => [...r, data]);
    }
    setEditing(null);
  };

  const del = async (id) => {
    if (!window.confirm("Remove this rider?")) return;
    await supabase.from("riders").delete().eq("id", id);
    setRiders(r => r.filter(x => x.id !== id));
  };

  if (loading) return <div style={{ padding: 40, color: "var(--text3)", fontSize: 14, textAlign: "center" }}>Loading…</div>;

  if (editing !== null) return <RiderForm rider={editing.id ? editing : null} onSave={save} onCancel={() => setEditing(null)} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={S.sectionHead}>Riders ({riders.length})</div>
        </div>
        <button onClick={() => setEditing({})} style={S.btn}>+ Add Rider</button>
      </div>

      {riders.length === 0 && (
        <Empty icon="🎤" title="No riders yet"
          desc="Add artists, performers, or speakers. Each rider gets their own requirements, shopping list, and technical spec."
          action="+ Add First Rider" onAction={() => setEditing({})} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {riders.map(r => {
          const isOpen = expandedId === r.id;
          const itemsDone = (r.shopping_list || []).filter(x => x.done).length;
          const itemsTotal = (r.shopping_list || []).length;
          return (
            <div key={r.id} style={{ ...S.card }}>
              {/* Header row */}
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", userSelect: "none" }}
                onClick={() => setExpandedId(isOpen ? null : r.id)}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accentBg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, flexShrink: 0 }}>
                  🎤
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {r.role && <span>{r.role}</span>}
                    {r.contact && <span>📞 {r.contact}</span>}
                    {itemsTotal > 0 && (
                      <span style={{ color: itemsDone === itemsTotal ? "#059669" : "var(--text3)" }}>
                        🛒 {itemsDone}/{itemsTotal} items
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); setEditing(r); }}
                    style={S.ghost}>Edit</button>
                  <button onClick={e => { e.stopPropagation(); del(r.id); }}
                    style={{ ...S.ghost, color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}>✕</button>
                </div>
                <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: 4,
                  transition: "transform 0.2s", display: "inline-block",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ borderTop: "1.5px solid var(--border)", padding: "20px 18px",
                  display: "flex", flexDirection: "column", gap: 24 }}>

                  {/* Notes */}
                  {r.notes && (
                    <div>
                      <div style={S.label}>Notes</div>
                      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6,
                        background: "var(--bg3)", borderRadius: 8, padding: "10px 14px",
                        whiteSpace: "pre-wrap" }}>
                        {r.notes}
                      </div>
                    </div>
                  )}

                  {/* Requirements */}
                  {Object.entries(r.requirements || {}).some(([, v]) => v) && (
                    <div>
                      <div style={S.label}>Requirements</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                          ["🍽 Hospitality", r.requirements?.hospitality],
                          ["🎛 Technical",   r.requirements?.technical],
                          ["🎭 Production",  r.requirements?.production],
                          ["🚐 Transport",   r.requirements?.transport],
                        ].filter(([, v]) => v).map(([label, val]) => (
                          <div key={label} style={{ background: "var(--bg3)", borderRadius: 10,
                            padding: "12px 14px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text2)" }}>{label}</div>
                            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shopping list */}
                  {(r.shopping_list || []).length > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={S.label}>Shopping List</div>
                        <span style={{ fontSize: 11, color: itemsDone === itemsTotal && itemsTotal > 0 ? "#059669" : "var(--text3)" }}>
                          {itemsDone}/{itemsTotal} done
                        </span>
                      </div>
                      {r.shopping_list.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 0", borderBottom: "1px solid var(--border)",
                          opacity: item.done ? 0.5 : 1 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%",
                            background: item.done ? "#059669" : "var(--border)", flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, textDecoration: item.done ? "line-through" : "none",
                            color: "var(--text)" }}>
                            {item.qty} {item.unit} {item.name}
                          </span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6,
                            background: "var(--bg3)", color: "var(--text3)" }}>{item.category}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiderForm({ rider, onSave, onCancel }) {
  const [form, setForm] = useState(rider || {
    name: "", role: "", contact: "", notes: "",
    requirements: {}, shopping_list: [],
  });
  const [tab, setTab] = useState("details");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const tabs = ["details", "requirements", "shopping"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>
          {form.id ? "Edit Rider" : "New Rider"}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={S.ghost}>Cancel</button>
          <button onClick={() => form.name.trim() && onSave(form)} style={S.btn}>Save Rider</button>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg3)",
        borderRadius: 10, padding: 4, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? "var(--bg2)" : "none",
              border: tab === t ? "1.5px solid var(--border)" : "1.5px solid transparent",
              borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600,
              color: tab === t ? "var(--text)" : "var(--text3)", cursor: "pointer",
              fontFamily: "inherit", textTransform: "capitalize" }}>
            {t === "shopping" ? "Shopping List" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ ...S.card, padding: "22px 20px" }}>
        {tab === "details" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={S.label}>Artist / Performer Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                style={S.inp} placeholder="e.g. DJ Mixer, The Groove Band" autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Role</label>
                <input value={form.role || ""} onChange={e => set("role", e.target.value)}
                  style={S.inp} placeholder="e.g. Headliner, Support Act, MC" />
              </div>
              <div>
                <label style={S.label}>Contact / Manager</label>
                <input value={form.contact || ""} onChange={e => set("contact", e.target.value)}
                  style={S.inp} placeholder="Phone or email" />
              </div>
            </div>
            <div>
              <label style={S.label}>Notes</label>
              <textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)}
                rows={4} style={{ ...S.inp, resize: "vertical" }}
                placeholder="Set times, special instructions, green room requirements, allergies..." />
            </div>
          </div>
        )}

        {tab === "requirements" && (
          <RiderRequirements requirements={form.requirements} onChange={v => set("requirements", v)} />
        )}

        {tab === "shopping" && (
          <ShoppingListEditor items={form.shopping_list} onChange={v => set("shopping_list", v)} />
        )}
      </div>
    </div>
  );
}

// ============================================================
//  TAB 2: INVENTORY
// ============================================================
const INV_CATS = ["audio", "lighting", "staging", "furniture", "catering", "safety", "misc"];
const INV_CAT_COLORS = {
  audio: "#8b5cf6", lighting: "#f59e0b", staging: "#3b82f6",
  furniture: "#10b981", catering: "#f97316", safety: "#ef4444", misc: "#6b7280",
};
const INV_STATUSES = ["available", "in use", "damaged", "missing"];
const INV_STATUS_COLORS = { available: "#059669", "in use": "#3b82f6", damaged: "#f59e0b", missing: "#dc2626" };

function InventoryTab({ eventId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("inventory_items").select("*").eq("event_id", eventId).order("name")
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, [eventId]);

  const save = async (form) => {
    const row = {
      event_id: eventId, name: form.name.trim(),
      category: form.category || "misc",
      quantity: parseInt(form.quantity) || 1,
      unit: form.unit || null,
      status: form.status || "available",
      location: form.location || null,
      serial: form.serial || null,
      notes: form.notes || null,
    };
    if (form.id) {
      const { data } = await supabase.from("inventory_items").update(row).eq("id", form.id).select().single();
      setItems(r => r.map(x => x.id === form.id ? data : x));
    } else {
      const { data } = await supabase.from("inventory_items").insert(row).select().single();
      setItems(r => [...r, data]);
    }
    setEditing(null);
  };

  const del = async (id) => {
    if (!window.confirm("Remove this item?")) return;
    await supabase.from("inventory_items").delete().eq("id", id);
    setItems(r => r.filter(x => x.id !== id));
  };

  const updateStatus = async (id, status) => {
    await supabase.from("inventory_items").update({ status }).eq("id", id);
    setItems(r => r.map(x => x.id === id ? { ...x, status } : x));
  };

  const filtered = items.filter(x =>
    (filter === "all" || x.category === filter) &&
    (!search || x.name.toLowerCase().includes(search.toLowerCase()) || (x.location || "").toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div style={{ padding: 40, color: "var(--text3)", fontSize: 14, textAlign: "center" }}>Loading…</div>;
  if (editing !== null) return <InventoryForm item={editing.id ? editing : null} onSave={save} onCancel={() => setEditing(null)} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={S.sectionHead}>Inventory ({items.length} items)</div>
        <button onClick={() => setEditing({})} style={S.btn}>+ Add Item</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {chip("All", filter === "all", () => setFilter("all"))}
        {INV_CATS.map(c => chip(c.charAt(0).toUpperCase() + c.slice(1), filter === c, () => setFilter(c), INV_CAT_COLORS[c]))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        style={{ ...S.inp, marginBottom: 16 }} placeholder="Search items or locations…" />

      {items.length === 0 && (
        <Empty icon="📦" title="No inventory yet"
          desc="Track equipment, furniture, tech gear, and anything else needed for your event."
          action="+ Add First Item" onAction={() => setEditing({})} />
      )}

      {filtered.length === 0 && items.length > 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)", fontSize: 14 }}>
          No items match your filter.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {filtered.map(item => (
          <div key={item.id} style={{ ...S.card, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                  {item.quantity} {item.unit || "×"} ·{" "}
                  <span style={{ color: INV_CAT_COLORS[item.category] || "var(--text3)" }}>{item.category}</span>
                  {item.location && <> · 📍 {item.location}</>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button onClick={() => setEditing(item)} style={{ ...S.ghost, padding: "4px 8px", fontSize: 11 }}>Edit</button>
                <button onClick={() => del(item.id)}
                  style={{ ...S.ghost, padding: "4px 8px", fontSize: 11, color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}>✕</button>
              </div>
            </div>
            {/* Status selector */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {INV_STATUSES.map(s => (
                <button key={s} onClick={() => updateStatus(item.id, s)}
                  style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                    background: item.status === s ? `${INV_STATUS_COLORS[s]}18` : "var(--bg3)",
                    border: `1.5px solid ${item.status === s ? INV_STATUS_COLORS[s] : "var(--border)"}`,
                    color: item.status === s ? INV_STATUS_COLORS[s] : "var(--text3)" }}>
                  {s}
                </button>
              ))}
            </div>
            {item.serial && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>S/N: {item.serial}</div>}
            {item.notes && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6, lineHeight: 1.5 }}>{item.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState(item || { name: "", category: "misc", quantity: 1, unit: "", status: "available", location: "", serial: "", notes: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>{form.id ? "Edit Item" : "Add Item"}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={S.ghost}>Cancel</button>
          <button onClick={() => form.name.trim() && onSave(form)} style={S.btn}>Save Item</button>
        </div>
      </div>
      <div style={{ ...S.card, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={S.label}>Item Name *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)}
            style={S.inp} placeholder="e.g. Shure SM58, 6x Round Tables" autoFocus />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)}
              style={{ ...S.inp, cursor: "pointer" }}>
              {INV_CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Quantity</label>
            <input type="number" min={1} value={form.quantity} onChange={e => set("quantity", e.target.value)}
              style={S.inp} />
          </div>
          <div>
            <label style={S.label}>Unit</label>
            <input value={form.unit} onChange={e => set("unit", e.target.value)}
              style={S.inp} placeholder="e.g. pcs, m, kg" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Location / Storage</label>
            <input value={form.location} onChange={e => set("location", e.target.value)}
              style={S.inp} placeholder="e.g. Van 2, Storage room B" />
          </div>
          <div>
            <label style={S.label}>Serial / Asset Number</label>
            <input value={form.serial} onChange={e => set("serial", e.target.value)}
              style={S.inp} placeholder="Optional" />
          </div>
        </div>
        <div>
          <label style={S.label}>Initial Status</label>
          <div style={{ display: "flex", gap: 6 }}>
            {INV_STATUSES.map(s => chip(s, form.status === s, () => set("status", s), INV_STATUS_COLORS[s]))}
          </div>
        </div>
        <div>
          <label style={S.label}>Notes</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            rows={3} style={{ ...S.inp, resize: "vertical" }} placeholder="Condition, supplier, hire company, special handling..." />
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  TAB 3: INCIDENT REPORTS
// ============================================================
const INCIDENT_TYPES = ["injury", "near miss", "property damage", "security", "medical", "fire", "other"];
const INCIDENT_SEVERITY = { low: "#10b981", medium: "#f59e0b", high: "#f97316", critical: "#dc2626" };

function IncidentsTab({ eventId, event }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    supabase.from("incident_reports").select("*").eq("event_id", eventId).order("occurred_at", { ascending: false })
      .then(({ data }) => { setIncidents(data || []); setLoading(false); });
  }, [eventId]);

  const save = async (form) => {
    const row = {
      event_id: eventId,
      type: form.type, severity: form.severity,
      description: form.description,
      location: form.location || null,
      people_involved: form.people_involved || null,
      action_taken: form.action_taken || null,
      reported_by: form.reported_by || null,
      occurred_at: form.occurred_at || new Date().toISOString(),
      follow_up_required: form.follow_up_required || false,
      follow_up_notes: form.follow_up_notes || null,
    };
    if (form.id) {
      const { data } = await supabase.from("incident_reports").update(row).eq("id", form.id).select().single();
      setIncidents(r => r.map(x => x.id === form.id ? data : x));
    } else {
      const { data } = await supabase.from("incident_reports").insert(row).select().single();
      setIncidents(r => [data, ...r]);
    }
    setEditing(null);
  };

  const del = async (id) => {
    if (!window.confirm("Delete this incident report?")) return;
    await supabase.from("incident_reports").delete().eq("id", id);
    setIncidents(r => r.filter(x => x.id !== id));
  };

  if (loading) return <div style={{ padding: 40, color: "var(--text3)", fontSize: 14, textAlign: "center" }}>Loading…</div>;
  if (editing !== null) return <IncidentForm incident={editing.id ? editing : null} event={event} onSave={save} onCancel={() => setEditing(null)} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={S.sectionHead}>Incident Reports ({incidents.length})</div>
        </div>
        <button onClick={() => setEditing({})} style={{ ...S.btn, background: "#dc2626" }}>+ Log Incident</button>
      </div>

      {incidents.length === 0 && (
        <Empty icon="📋" title="No incidents logged"
          desc="Log any incidents, near-misses, injuries, or safety events during your event. All reports are timestamped and stored."
          action="+ Log First Incident" onAction={() => setEditing({})} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {incidents.map(inc => {
          const isOpen = expanded === inc.id;
          return (
            <div key={inc.id} style={{ ...S.card, borderLeft: `4px solid ${INCIDENT_SEVERITY[inc.severity] || "#6b7280"}` }}>
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : inc.id)}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: INCIDENT_SEVERITY[inc.severity], marginBottom: 2 }}>
                    {inc.severity} · {inc.type}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    {inc.description?.slice(0, 80)}{inc.description?.length > 80 ? "…" : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                    {new Date(inc.occurred_at).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {inc.location && <> · 📍 {inc.location}</>}
                    {inc.reported_by && <> · Reported by {inc.reported_by}</>}
                    {inc.follow_up_required && <span style={{ color: "#f59e0b", marginLeft: 6 }}>⚠ Follow-up required</span>}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); setEditing(inc); }} style={S.ghost}>Edit</button>
                  <button onClick={e => { e.stopPropagation(); del(inc.id); }}
                    style={{ ...S.ghost, color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}>✕</button>
                </div>
              </div>
              {isOpen && (
                <div style={{ borderTop: "1.5px solid var(--border)", padding: "16px 18px",
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    ["People Involved", inc.people_involved],
                    ["Action Taken", inc.action_taken],
                    ["Follow-up Notes", inc.follow_up_notes],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label} style={{ gridColumn: "span 1" }}>
                      <div style={S.label}>{label}</div>
                      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IncidentForm({ incident, event, onSave, onCancel }) {
  const [form, setForm] = useState(incident || {
    type: "other", severity: "low", description: "", location: event?.venue_name || "",
    people_involved: "", action_taken: "", reported_by: "", follow_up_required: false,
    follow_up_notes: "", occurred_at: new Date().toISOString().slice(0, 16),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>{form.id ? "Edit Incident Report" : "Log Incident"}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={S.ghost}>Cancel</button>
          <button onClick={() => form.description.trim() && onSave(form)}
            style={{ ...S.btn, background: "#dc2626" }}>Save Report</button>
        </div>
      </div>

      <div style={{ ...S.card, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Type + Severity */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={S.label}>Incident Type</label>
            <select value={form.type} onChange={e => set("type", e.target.value)}
              style={{ ...S.inp, cursor: "pointer" }}>
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Severity</label>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(INCIDENT_SEVERITY).map(([s, col]) => chip(s, form.severity === s, () => set("severity", s), col))}
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={S.label}>Description *</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)}
            rows={4} style={{ ...S.inp, resize: "vertical" }} autoFocus
            placeholder="Describe what happened, when, and how. Be specific." />
        </div>

        {/* When + Where + Who */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Date & Time</label>
            <input type="datetime-local" value={form.occurred_at?.slice(0, 16)} onChange={e => set("occurred_at", e.target.value)}
              style={S.inp} />
          </div>
          <div>
            <label style={S.label}>Location</label>
            <input value={form.location} onChange={e => set("location", e.target.value)}
              style={S.inp} placeholder="e.g. Stage left, Car park" />
          </div>
          <div>
            <label style={S.label}>Reported By</label>
            <input value={form.reported_by} onChange={e => set("reported_by", e.target.value)}
              style={S.inp} placeholder="Name or role" />
          </div>
        </div>

        {/* People involved + action */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>People Involved</label>
            <textarea value={form.people_involved} onChange={e => set("people_involved", e.target.value)}
              rows={3} style={{ ...S.inp, resize: "vertical" }} placeholder="Names, roles, contact details" />
          </div>
          <div>
            <label style={S.label}>Immediate Action Taken</label>
            <textarea value={form.action_taken} onChange={e => set("action_taken", e.target.value)}
              rows={3} style={{ ...S.inp, resize: "vertical" }} placeholder="First aid, evacuation, notified management…" />
          </div>
        </div>

        {/* Follow up */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: form.follow_up_required ? 10 : 0 }}>
            <input type="checkbox" checked={form.follow_up_required}
              onChange={e => set("follow_up_required", e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#f59e0b", cursor: "pointer" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Follow-up required</span>
          </label>
          {form.follow_up_required && (
            <textarea value={form.follow_up_notes} onChange={e => set("follow_up_notes", e.target.value)}
              rows={2} style={{ ...S.inp, resize: "vertical" }}
              placeholder="Describe what follow-up is needed and by when" />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  TAB 4: HEALTH & SAFETY
// ============================================================
function HSTab({ eventId, event }) {
  const [plans, setPlans] = useState([]);
  const [inductions, setInductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [inductionTab, setInductionTab] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("hs_plans").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      supabase.from("hs_inductions").select("*").eq("event_id", eventId).order("completed_at", { ascending: false }),
    ]).then(([{ data: p }, { data: i }]) => {
      setPlans(p || []); setInductions(i || []); setLoading(false);
    });
  }, [eventId]);

  const savePlan = async (form) => {
    const row = {
      event_id: eventId, title: form.title.trim(),
      venue: form.venue || event?.venue_name || null,
      organiser: form.organiser || null, date: form.date || event?.date || null,
      expected_attendance: form.expected_attendance || null,
      first_aid_personnel: form.first_aid_personnel || null,
      first_aid_location: form.first_aid_location || null,
      emergency_assembly: form.emergency_assembly || null,
      emergency_contacts: form.emergency_contacts || null,
      hazards: form.hazards || [],
      warden_plan: form.warden_plan || null,
      communication_plan: form.communication_plan || null,
      special_requirements: form.special_requirements || null,
    };
    if (form.id) {
      const { data } = await supabase.from("hs_plans").update(row).eq("id", form.id).select().single();
      setPlans(r => r.map(x => x.id === form.id ? data : x));
    } else {
      const { data } = await supabase.from("hs_plans").insert(row).select().single();
      setPlans(r => [data, ...r]);
    }
    setEditingPlan(null);
  };

  const saveInduction = async (form) => {
    const row = {
      event_id: eventId, name: form.name.trim(), role: form.role || null,
      organisation: form.organisation || null,
      confirmed_briefing: form.confirmed_briefing || false,
      confirmed_hazards: form.confirmed_hazards || false,
      confirmed_emergency: form.confirmed_emergency || false,
      confirmed_ppe: form.confirmed_ppe || false,
      signature: form.signature || null,
      completed_at: new Date().toISOString(),
    };
    const { data } = await supabase.from("hs_inductions").insert(row).select().single();
    setInductions(r => [data, ...r]);
    setInductionTab(false);
  };

  const delPlan = async (id) => {
    if (!window.confirm("Delete this H&S plan?")) return;
    await supabase.from("hs_plans").delete().eq("id", id);
    setPlans(r => r.filter(x => x.id !== id));
  };
  const delInduction = async (id) => {
    if (!window.confirm("Delete this induction record?")) return;
    await supabase.from("hs_inductions").delete().eq("id", id);
    setInductions(r => r.filter(x => x.id !== id));
  };

  if (loading) return <div style={{ padding: 40, color: "var(--text3)", fontSize: 14, textAlign: "center" }}>Loading…</div>;
  if (editingPlan !== null) return <HSPlanForm plan={editingPlan.id ? editingPlan : null} event={event} onSave={savePlan} onCancel={() => setEditingPlan(null)} />;
  if (viewingPlan !== null) return <HSPlanView plan={viewingPlan} onBack={() => setViewingPlan(null)} onEdit={() => { setEditingPlan(viewingPlan); setViewingPlan(null); }} />;
  if (inductionTab) return <InductionForm event={event} onSave={saveInduction} onCancel={() => setInductionTab(false)} />;

  return (
    <div>
      {/* H&S Plans */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={S.sectionHead}>H&S Plans ({plans.length})</div>
          <button onClick={() => setEditingPlan({})} style={S.btn}>+ New H&S Plan</button>
        </div>
        {plans.length === 0 && (
          <Empty icon="🦺" title="No H&S plans yet"
            desc="Create a structured health & safety plan for your event, covering hazards, emergency procedures, and first aid arrangements."
            action="+ Create Plan" onAction={() => setEditingPlan({})} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plans.map(p => (
            <div key={p.id} style={{ ...S.card, padding: "15px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                🦺
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                  {p.date && <>{new Date(p.date).toLocaleDateString("en-NZ")} · </>}
                  {p.venue && <>{p.venue} · </>}
                  {(p.hazards || []).length} hazard{(p.hazards || []).length !== 1 ? "s" : ""} identified
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setViewingPlan(p)} style={{ ...S.ghost, color: "var(--accent)", borderColor: "var(--accentBg)" }}>View</button>
                <button onClick={() => setEditingPlan(p)} style={S.ghost}>Edit</button>
                <button onClick={() => delPlan(p.id)} style={{ ...S.ghost, color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inductions */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={S.sectionHead}>Safety Inductions ({inductions.length})</div>
          </div>
          <button onClick={() => setInductionTab(true)} style={S.btn}>+ New Induction</button>
        </div>
        {inductions.length === 0 && (
          <Empty icon="📝" title="No inductions yet"
            desc="Run in-app safety inductions for staff, crew, and volunteers. Each person confirms they've been briefed on hazards and emergency procedures."
            action="+ Start Induction" onAction={() => setInductionTab(true)} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {inductions.map(ind => (
            <div key={ind.id} style={{ ...S.card, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 20 }}>✅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{ind.name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>
                  {ind.role && <>{ind.role}{ind.organisation ? ` · ${ind.organisation}` : ""} · </>}
                  {new Date(ind.completed_at).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[["Briefed", ind.confirmed_briefing], ["Hazards", ind.confirmed_hazards], ["Emergency", ind.confirmed_emergency], ["PPE", ind.confirmed_ppe]].map(([l, v]) => (
                  <span key={l} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, fontWeight: 700,
                    background: v ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.08)",
                    border: `1px solid ${v ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.2)"}`,
                    color: v ? "#059669" : "#dc2626" }}>
                    {v ? "✓" : "✗"} {l}
                  </span>
                ))}
              </div>
              {ind.signature && <div style={{ fontSize: 12, color: "var(--text3)", fontStyle: "italic" }}>Signed</div>}
              <button onClick={() => delInduction(ind.id)} style={{ ...S.ghost, padding: "4px 8px", color: "#dc2626", borderColor: "rgba(220,38,38,0.2)", fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HSPlanForm({ plan, event, onSave, onCancel }) {
  const [form, setForm] = useState(plan || {
    title: event?.name ? `${event.name} — H&S Plan` : "",
    venue: event?.venue_name || "", organiser: "", date: event?.date || "",
    expected_attendance: "", first_aid_personnel: "", first_aid_location: "",
    emergency_assembly: "", emergency_contacts: "", warden_plan: "",
    communication_plan: "", special_requirements: "",
    hazards: [],
  });
  const [tab, setTab] = useState("overview");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addHazard = () => set("hazards", [...(form.hazards || []), { hazard: "", likelihood: "low", severity: "low", controls: "" }]);
  const updateHazard = (i, patch) => set("hazards", (form.hazards || []).map((h, idx) => idx === i ? { ...h, ...patch } : h));
  const removeHazard = (i) => set("hazards", (form.hazards || []).filter((_, idx) => idx !== i));

  const sections = ["overview", "emergency", "hazards", "wardens"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>{form.id ? "Edit H&S Plan" : "New H&S Plan"}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={S.ghost}>Cancel</button>
          <button onClick={() => form.title.trim() && onSave(form)} style={S.btn}>Save Plan</button>
        </div>
      </div>

      {/* Section nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg3)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {sections.map(s => (
          <button key={s} onClick={() => setTab(s)}
            style={{ background: tab === s ? "var(--bg2)" : "none",
              border: tab === s ? "1.5px solid var(--border)" : "1.5px solid transparent",
              borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600,
              color: tab === s ? "var(--text)" : "var(--text3)", cursor: "pointer", fontFamily: "inherit",
              textTransform: "capitalize" }}>
            {s === "emergency" ? "Emergency" : s === "wardens" ? "Wardens & Comms" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ ...S.card, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "overview" && (
          <>
            <div>
              <label style={S.label}>Plan Title *</label>
              <input value={form.title} onChange={e => set("title", e.target.value)} style={S.inp} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><label style={S.label}>Venue</label><input value={form.venue} onChange={e => set("venue", e.target.value)} style={S.inp} /></div>
              <div><label style={S.label}>Organiser</label><input value={form.organiser} onChange={e => set("organiser", e.target.value)} style={S.inp} /></div>
              <div><label style={S.label}>Date</label><input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={S.inp} /></div>
            </div>
            <div><label style={S.label}>Expected Attendance</label><input value={form.expected_attendance} onChange={e => set("expected_attendance", e.target.value)} style={S.inp} placeholder="e.g. 500 general public" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={S.label}>First Aid Personnel</label><textarea value={form.first_aid_personnel} onChange={e => set("first_aid_personnel", e.target.value)} rows={3} style={{ ...S.inp, resize: "vertical" }} placeholder="Names, qualifications, ratios (e.g. 1:50)" /></div>
              <div><label style={S.label}>First Aid Location</label><textarea value={form.first_aid_location} onChange={e => set("first_aid_location", e.target.value)} rows={3} style={{ ...S.inp, resize: "vertical" }} placeholder="Where first aid kits and AED are located" /></div>
            </div>
            <div><label style={S.label}>Special Requirements / Conditions</label><textarea value={form.special_requirements} onChange={e => set("special_requirements", e.target.value)} rows={3} style={{ ...S.inp, resize: "vertical" }} placeholder="Any other specific H&S conditions for this event" /></div>
          </>
        )}

        {tab === "emergency" && (
          <>
            <div><label style={S.label}>Emergency Assembly Point</label><textarea value={form.emergency_assembly} onChange={e => set("emergency_assembly", e.target.value)} rows={3} style={{ ...S.inp, resize: "vertical" }} placeholder="Describe the assembly point location(s) and how to get there" /></div>
            <div><label style={S.label}>Emergency Contacts</label><textarea value={form.emergency_contacts} onChange={e => set("emergency_contacts", e.target.value)} rows={5} style={{ ...S.inp, resize: "vertical" }} placeholder={"e.g.\nEvent Manager: Jane Smith — 021 000 000\nVenue Security: 021 111 111\nAmbulance / Fire / Police: 111\nPoison Control: 0800 764 766"} /></div>
          </>
        )}

        {tab === "hazards" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "var(--text2)" }}>{(form.hazards || []).length} hazard{(form.hazards || []).length !== 1 ? "s" : ""} identified</div>
              <button onClick={addHazard} style={{ ...S.ghost, fontSize: 13 }}>+ Add Hazard</button>
            </div>
            {(form.hazards || []).length === 0 && (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text3)", fontSize: 13 }}>
                No hazards added yet. Click + Add Hazard to begin your risk register.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(form.hazards || []).map((h, i) => (
                <div key={i} style={{ background: "var(--bg3)", borderRadius: 10, padding: "14px", border: "1.5px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <input value={h.hazard} onChange={e => updateHazard(i, { hazard: e.target.value })}
                      style={{ ...S.inp, flex: 1 }} placeholder="Hazard description (e.g. Crowd crush near stage)" />
                    <button onClick={() => removeHazard(i)} style={{ ...S.ghost, color: "#dc2626", borderColor: "rgba(220,38,38,0.2)", flexShrink: 0 }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Likelihood</label>
                      <div style={{ display: "flex", gap: 5 }}>
                        {["low", "medium", "high"].map(l => chip(l, h.likelihood === l, () => updateHazard(i, { likelihood: l }), l === "low" ? "#10b981" : l === "medium" ? "#f59e0b" : "#dc2626"))}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Severity</label>
                      <div style={{ display: "flex", gap: 5 }}>
                        {["low", "medium", "high"].map(l => chip(l, h.severity === l, () => updateHazard(i, { severity: l }), l === "low" ? "#10b981" : l === "medium" ? "#f59e0b" : "#dc2626"))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Control Measures</label>
                    <textarea value={h.controls} onChange={e => updateHazard(i, { controls: e.target.value })}
                      rows={2} style={{ ...S.inp, resize: "vertical" }}
                      placeholder="What steps are taken to eliminate or reduce this hazard?" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "wardens" && (
          <>
            <div><label style={S.label}>Warden Plan</label><textarea value={form.warden_plan} onChange={e => set("warden_plan", e.target.value)} rows={5} style={{ ...S.inp, resize: "vertical" }} placeholder={"Names and zones for each warden\ne.g.\nHead Warden: John Smith (red vest)\nZone A (main stage): Sarah Jones\nZone B (bar): Mike Williams"} /></div>
            <div><label style={S.label}>Communication Plan</label><textarea value={form.communication_plan} onChange={e => set("communication_plan", e.target.value)} rows={4} style={{ ...S.inp, resize: "vertical" }} placeholder="How will staff communicate during an incident? (radios, channels, code words)" /></div>
          </>
        )}
      </div>
    </div>
  );
}

function HSPlanView({ plan, onBack, onEdit }) {
  const riskLevel = (likelihood, severity) => {
    const score = { low: 1, medium: 2, high: 3 };
    const s = score[likelihood] * score[severity];
    if (s >= 6) return { label: "HIGH", color: "#dc2626" };
    if (s >= 3) return { label: "MEDIUM", color: "#f59e0b" };
    return { label: "LOW", color: "#10b981" };
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ ...S.ghost, fontSize: 13 }}>← Back</button>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>{plan.title}</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={S.ghost}>🖨 Print</button>
          <button onClick={onEdit} style={S.btn}>Edit Plan</button>
        </div>
      </div>

      <div style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 16,
        padding: "32px 36px", maxWidth: 800, fontFamily: "inherit" }}>

        {/* Header */}
        <div style={{ borderBottom: "2px solid var(--accent)", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
            color: "var(--accent)", marginBottom: 6 }}>Health & Safety Plan</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 14 }}>{plan.title}</h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              ["Venue", plan.venue],
              ["Organiser", plan.organiser],
              ["Date", plan.date ? new Date(plan.date).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }) : null],
              ["Expected Attendance", plan.expected_attendance],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text3)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        {[
          ["🩺 First Aid", [["Personnel", plan.first_aid_personnel], ["Location", plan.first_aid_location]]],
          ["🚨 Emergency Procedures", [["Assembly Point", plan.emergency_assembly], ["Emergency Contacts", plan.emergency_contacts]]],
          ["📡 Wardens & Communication", [["Warden Plan", plan.warden_plan], ["Communication Plan", plan.communication_plan]]],
        ].map(([heading, rows]) => rows.some(([, v]) => v) && (
          <div key={heading} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 8 }}>
              {heading}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.filter(([, v]) => v).map(([label, val]) => (
                <div key={label} style={{ background: "var(--bg3)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Hazard register */}
        {(plan.hazards || []).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>⚠ Hazard Register</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg3)" }}>
                  {["Hazard", "Likelihood", "Severity", "Risk", "Controls"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.hazards.map((h, i) => {
                  const risk = riskLevel(h.likelihood, h.severity);
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--text)", fontWeight: 600 }}>{h.hazard}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text2)", textTransform: "capitalize" }}>{h.likelihood}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text2)", textTransform: "capitalize" }}>{h.severity}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 5,
                          background: `${risk.color}18`, border: `1px solid ${risk.color}40`, color: risk.color }}>
                          {risk.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text2)", lineHeight: 1.5 }}>{h.controls}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {plan.special_requirements && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>📋 Special Requirements</div>
            <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "12px 14px", fontSize: 13,
              lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--text)" }}>{plan.special_requirements}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function InductionForm({ event, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "", role: "", organisation: "",
    confirmed_briefing: false, confirmed_hazards: false,
    confirmed_emergency: false, confirmed_ppe: false, signature: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const allConfirmed = form.confirmed_briefing && form.confirmed_hazards && form.confirmed_emergency && form.confirmed_ppe;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Safety Induction</h2>
        <button onClick={onCancel} style={S.ghost}>Cancel</button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ ...S.card, padding: "28px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Event name banner */}
          <div style={{ background: "var(--accentBg)", border: "1.5px solid var(--accent)", borderRadius: 10,
            padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>
              {event?.name || "Event"} — Safety Induction
            </div>
            {event?.venue_name && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{event.venue_name}</div>}
          </div>

          {/* Personal details */}
          <div>
            <label style={S.label}>Full Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} style={S.inp} autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={S.label}>Role / Position</label><input value={form.role} onChange={e => set("role", e.target.value)} style={S.inp} placeholder="e.g. Stage crew, Security" /></div>
            <div><label style={S.label}>Organisation</label><input value={form.organisation} onChange={e => set("organisation", e.target.value)} style={S.inp} placeholder="Company or team" /></div>
          </div>

          {/* Confirmations */}
          <div style={{ background: "var(--bg3)", borderRadius: 12, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              I confirm that I have been briefed on the following:
            </div>
            {[
              ["confirmed_briefing",  "Site safety briefing and house rules"],
              ["confirmed_hazards",   "Key hazards on site and how to avoid them"],
              ["confirmed_emergency", "Emergency procedures, exit routes, and assembly point"],
              ["confirmed_ppe",       "Required PPE and where to obtain it if needed"],
            ].map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--accent)", cursor: "pointer", marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{label}</span>
              </label>
            ))}
          </div>

          {/* Signature */}
          <div>
            <label style={S.label}>Signature (type your full name)</label>
            <input value={form.signature} onChange={e => set("signature", e.target.value)}
              style={{ ...S.inp, fontStyle: "italic", fontSize: 16 }}
              placeholder="Type your full name as signature" />
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
              By typing your name you confirm you understand and agree to the above.
            </div>
          </div>

          {!allConfirmed && (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.3)",
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
              ⚠ Please check all four boxes above before submitting.
            </div>
          )}

          <button
            onClick={() => form.name.trim() && form.signature.trim() && allConfirmed && onSave(form)}
            disabled={!form.name.trim() || !form.signature.trim() || !allConfirmed}
            style={{ ...S.btn, padding: "13px", fontSize: 15,
              opacity: (!form.name.trim() || !form.signature.trim() || !allConfirmed) ? 0.4 : 1,
              cursor: (!form.name.trim() || !form.signature.trim() || !allConfirmed) ? "not-allowed" : "pointer" }}>
            ✅ Complete Induction
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  MAIN EXPORT — tabbed Operations module
// ============================================================
const OPS_TABS = [
  { id: "riders",    label: "Riders",     icon: "🎤" },
  { id: "inventory", label: "Inventory",  icon: "📦" },
  { id: "incidents", label: "Incidents",  icon: "📋" },
  { id: "hs",        label: "H&S",        icon: "🦺" },
];

export default function Operations({ eventId, event }) {
  const [tab, setTab] = useState("riders");

  return (
    <div className="fade-up">

      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 4 }}>
          Operations
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 14, margin: 0 }}>
          Riders, inventory, incidents, and health & safety
        </p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg2)",
        border: "1.5px solid var(--border)", borderRadius: 12, padding: 5, width: "fit-content" }}>
        {OPS_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: tab === t.id ? "var(--bg3)" : "none",
              border: tab === t.id ? "1.5px solid var(--border)" : "1.5px solid transparent",
              borderRadius: 9, padding: "8px 18px", fontSize: 13, fontWeight: 600,
              color: tab === t.id ? "var(--text)" : "var(--text3)",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 7, transition: "all 0.12s",
              boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "riders"    && <RidersTab    eventId={eventId} event={event} />}
      {tab === "inventory" && <InventoryTab eventId={eventId} event={event} />}
      {tab === "incidents" && <IncidentsTab eventId={eventId} event={event} />}
      {tab === "hs"        && <HSTab        eventId={eventId} event={event} />}
    </div>
  );
}
