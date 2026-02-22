// ============================================================
//  src/pages/VendorForm.jsx  —  /vendor/:token
//  Public form for vendors to complete their application
// ============================================================
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const SUPABASE_URL = supabase.supabaseUrl || "";

export default function VendorForm() {
  const { token }     = useParams();
  const [vendor, setVendor]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState("form"); // form | uploading | done | invalid | already
  const [form, setForm]       = useState({
    name: "", role: "", phone: "", website: "", instagram: "", description: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    supabase.from("vendors").select("*, events(name, date, venue_name)")
      .eq("vendor_token", token).single()
      .then(({ data }) => {
        if (!data) { setStep("invalid"); setLoading(false); return; }
        if (data.form_submitted_at) { setVendor(data); setStep("already"); setLoading(false); return; }
        setVendor(data);
        setForm({
          name: data.name || "", role: data.role || "", phone: data.phone || "",
          website: data.website || "", instagram: data.instagram || "", description: data.description || "",
        });
        setLoading(false);
      });
  }, [token]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Please enter your business name"); return; }
    if (!form.role.trim()) { setError("Please enter your role or service type"); return; }
    setSaving(true); setError(null);

    try {
      let image_url = vendor.image_url || null;

      // Upload image if provided
      if (imageFile) {
        const ext  = imageFile.name.split(".").pop();
        const path = `${vendor.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("vendor-images").upload(path, imageFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("vendor-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const { error: updateErr } = await supabase.from("vendors").update({
        name:              form.name.trim(),
        role:              form.role.trim(),
        phone:             form.phone.trim(),
        website:           form.website.trim(),
        instagram:         form.instagram.trim(),
        description:       form.description.trim(),
        image_url,
        status:            "submitted",
        form_submitted_at: new Date().toISOString(),
      }).eq("vendor_token", token);

      if (updateErr) throw updateErr;
      setStep("done");
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const ev = vendor?.events;
  const eventDate = ev?.date
    ? new Date(ev.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  const S = {
    page:    { minHeight: "100vh", background: "#06060e", fontFamily: "'DM Sans',sans-serif", color: "#e2d9cc", padding: "40px 16px 60px" },
    card:    { maxWidth: 540, margin: "0 auto", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 20, overflow: "hidden" },
    field:   { width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 9, padding: "11px 14px", color: "#e2d9cc", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.2s" },
    label:   { display: "block", fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 },
    btnGold: { width: "100%", background: "linear-gradient(135deg,#c9a84c,#a8872e)", color: "#080810", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  };

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{ color: "#3a3a52", fontSize: 14 }}>Loading…</span>
  </div>;

  if (step === "invalid") return <div style={{ ...S.page, textAlign: "center" }}>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
    <h1 style={{ fontFamily: "'Playfair Display',serif", color: "#ef4444" }}>Invalid Link</h1>
    <p style={{ color: "#5a5a72" }}>This vendor application link is not valid.</p>
  </div>;

  if (step === "already") return <div style={{ ...S.page, textAlign: "center" }}>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
    <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
    <h1 style={{ fontFamily: "'Playfair Display',serif", color: "#10b981" }}>Already Submitted</h1>
    <p style={{ color: "#5a5a72" }}>Your application for <strong style={{ color: "#c9a84c" }}>{ev?.name}</strong> has already been submitted.</p>
    <p style={{ color: "#3a3a52", fontSize: 13 }}>The organiser will be in touch soon.</p>
  </div>;

  if (step === "done") return <div style={{ ...S.page, textAlign: "center" }}>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{ fontSize: 52, marginBottom: 20 }}>🎉</div>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: "#f0e8db", marginBottom: 8 }}>Application Submitted!</h1>
      <p style={{ color: "#c9a84c", fontSize: 16, marginBottom: 6 }}>{ev?.name}</p>
      {eventDate && <p style={{ color: "#5a5a72", fontSize: 14, marginBottom: 24 }}>{eventDate}</p>}
      <div style={{ background: "#0a0a14", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "20px 24px", textAlign: "left" }}>
        <div style={{ fontSize: 14, color: "#10b981", fontWeight: 600, marginBottom: 8 }}>What happens next?</div>
        <div style={{ fontSize: 13, color: "#8a8278", lineHeight: 1.8 }}>
          The organiser will review your application and send you a confirmation or update via email. Keep an eye on your inbox!
        </div>
      </div>
    </div>
  </div>;

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
        <span style={{ fontSize: 14, color: "#5a5a72", letterSpacing: "0.05em" }}>EventFlow</span>
      </div>

      <div style={S.card}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.06),transparent)", borderBottom: "1px solid #1e1e2e", padding: "28px 28px 24px" }}>
          <div style={{ fontSize: 12, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Vendor Application</div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: "#f0e8db", margin: "0 0 4px" }}>{ev?.name}</h1>
          {eventDate && <p style={{ fontSize: 13, color: "#c9a84c", margin: "0 0 2px" }}>{eventDate}</p>}
          {ev?.venue_name && <p style={{ fontSize: 13, color: "#5a5a72", margin: 0 }}>📍 {ev.venue_name}</p>}
          {vendor?.host_message && (
            <div style={{ marginTop: 16, background: "#13131f", borderLeft: "3px solid #c9a84c", borderRadius: "0 8px 8px 0", padding: "12px 14px", fontSize: 13, color: "#8a8278", lineHeight: 1.6 }}>
              {vendor.host_message}
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Profile image */}
          <div>
            <label style={S.label}>Business / Profile Photo (optional)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 72, height: 72, borderRadius: 14, background: "#13131f", border: "1px solid #1e1e2e", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {imagePreview
                  ? <img src={imagePreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="preview" />
                  : <span style={{ fontSize: 28, color: "#2e2e42" }}>🏢</span>}
              </div>
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" id="vendor-img" style={{ display: "none" }} onChange={handleImageChange} />
                <label htmlFor="vendor-img"
                  style={{ display: "inline-block", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 8, padding: "9px 16px", fontSize: 13, color: "#8a8278", cursor: "pointer" }}>
                  {imagePreview ? "Change Photo" : "Upload Photo"}
                </label>
                <div style={{ fontSize: 11, color: "#3a3a52", marginTop: 6 }}>JPG, PNG or WebP · Max 5MB</div>
              </div>
            </div>
          </div>

          {/* Business name + role */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={S.label}>Business Name *</label>
              <input style={S.field} placeholder="Your business name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onFocus={e => e.target.style.borderColor="#c9a84c"}
                onBlur={e => e.target.style.borderColor="#1e1e2e"} />
            </div>
            <div>
              <label style={S.label}>Service / Role *</label>
              <input style={S.field} placeholder="e.g. Catering, Photography" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                onFocus={e => e.target.style.borderColor="#c9a84c"}
                onBlur={e => e.target.style.borderColor="#1e1e2e"} />
            </div>
          </div>

          {/* Phone + website */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={S.label}>Phone</label>
              <input style={S.field} placeholder="021 000 0000" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                onFocus={e => e.target.style.borderColor="#c9a84c"}
                onBlur={e => e.target.style.borderColor="#1e1e2e"} />
            </div>
            <div>
              <label style={S.label}>Website</label>
              <input style={S.field} placeholder="yourbusiness.co.nz" value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                onFocus={e => e.target.style.borderColor="#c9a84c"}
                onBlur={e => e.target.style.borderColor="#1e1e2e"} />
            </div>
          </div>

          {/* Instagram */}
          <div>
            <label style={S.label}>Instagram</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#3a3a52", fontSize: 14 }}>@</span>
              <input style={{ ...S.field, paddingLeft: 28 }} placeholder="yourhandle" value={form.instagram}
                onChange={e => setForm(f => ({ ...f, instagram: e.target.value.replace(/^@/, "") }))}
                onFocus={e => e.target.style.borderColor="#c9a84c"}
                onBlur={e => e.target.style.borderColor="#1e1e2e"} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={S.label}>Tell us about your business</label>
            <textarea style={{ ...S.field, resize: "vertical" }} rows={4}
              placeholder="Describe your services, experience, what you'd offer at this event…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              onFocus={e => e.target.style.borderColor="#c9a84c"}
              onBlur={e => e.target.style.borderColor="#1e1e2e"} />
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
              {error}
            </div>
          )}

          <button style={{ ...S.btnGold, opacity: saving ? 0.6 : 1 }} onClick={handleSubmit} disabled={saving}>
            {saving ? "Submitting…" : "Submit Application →"}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "#3a3a52", margin: 0 }}>
            The organiser will review your application and contact you via email
          </p>
        </div>
      </div>
    </div>
  );
}
