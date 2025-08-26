// src/pages/StreamerDatabase.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  db,
  auth,
  storage, // <-- we use the Storage instance you export
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  onAuthStateChanged,
} from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const TABS = ["Main Streamers", "Special Guest", "Pending", "Announcements"];
const TAB_TO_GROUP = {
  "Main Streamers": "main",
  "Special Guest": "guest",
  Pending: "pending",
};

const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ----------------------------------------
   TIME HELPERS (ET display)
----------------------------------------- */

// Convert "HH:MM" (24h) -> "h:mm AM/PM"
function to12h(hhmm) {
  if (!hhmm) return "";
  const [hStr, m] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/* ----------------------------------------
   AVAILABILITY RENDERING/EDITING HELPERS
----------------------------------------- */

// Summary like: "Mon 6:00 PM–7:00 PM ET, Wed 8:00 PM ET"
function AvailabilitySummary({ availability = {}, availabilityTimes = {} }) {
  const items = dayKeys
    .filter((k) => availability?.[k])
    .map((k, idx) => {
      const t = availabilityTimes?.[k] || {};
      const start = to12h(t.start || "");
      const end = to12h(t.end || "");
      const timeStr =
        start && end
          ? `${start}–${end}`
          : start
          ? `${start}`
          : end
          ? `${end}`
          : "";
      return `${dayLabels[idx]}${timeStr ? " " + timeStr : ""}`;
    });

  return (
    <div style={{ color: items.length ? "#111827" : "#6b7280" }}>
      {items.length ? `${items.join(", ")} ET` : "—"}
    </div>
  );
}

// Checkboxes for days + time inputs (user should enter ET)
function AvailabilityEditor({
  value = {},
  times = {},
  onChange, // (nextAvailability, nextTimes) => void
  disabled,
}) {
  const availability = value || {};
  const availabilityTimes = times || {};

  const toggleDay = (key, checked) => {
    const next = { ...availability, [key]: checked };
    const nextTimes = { ...availabilityTimes };
    if (!checked) {
      delete nextTimes[key];
    } else if (!nextTimes[key]) {
      nextTimes[key] = { start: "", end: "" };
    }
    onChange(next, nextTimes);
  };

  const setTime = (key, field, val) => {
    const nextTimes = {
      ...availabilityTimes,
      [key]: { ...(availabilityTimes[key] || {}), [field]: val },
    };
    onChange(availability, nextTimes);
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
        All times below are interpreted/stored as{" "}
        <strong>ET (America/New_York)</strong>.
      </div>
      {dayKeys.map((k, i) => (
        <div
          key={k}
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto 1fr 1fr",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            checked={!!availability[k]}
            disabled={disabled}
            onChange={(e) => toggleDay(k, e.target.checked)}
            aria-label={`Available on ${dayLabels[i]}`}
          />
          <span style={{ minWidth: 28 }}>{dayLabels[i]}</span>
          <input
            type="time"
            disabled={disabled || !availability[k]}
            value={availabilityTimes?.[k]?.start || ""}
            onChange={(e) => setTime(k, "start", e.target.value)}
            placeholder="Start"
            style={{
              padding: "6px 8px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
            }}
          />
          <input
            type="time"
            disabled={disabled || !availability[k]}
            value={availabilityTimes?.[k]?.end || ""}
            onChange={(e) => setTime(k, "end", e.target.value)}
            placeholder="End"
            style={{
              padding: "6px 8px",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------
   AVATAR (circle)
----------------------------------------- */
function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}
function Avatar({ src, name }) {
  const fallback = initialsOf(name);
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#f3f4f6",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #e5e7eb",
        flexShrink: 0,
      }}
      title={name || ""}
    >
      {src ? (
        <img
          src={src}
          alt={name || "avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>
          {fallback || "—"}
        </span>
      )}
    </div>
  );
}

/* ---------------------------
   STREAMERS TABLE (CRUD)
---------------------------- */
function StreamersTable({ groupKey }) {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [addingOpen, setAddingOpen] = useState(false);

  // DRAFT FOR ADD
  const [draft, setDraft] = useState({
    photoFile: null, // <-- photo upload
    name: "",
    email: "",
    handle: "",
    availability: {
      mon: false,
      tue: false,
      wed: false,
      thu: false,
      fri: false,
      sat: false,
      sun: false,
    },
    availabilityTimes: {},
  });

  // DRAFT FOR EDIT
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Live query
  useEffect(() => {
    if (!user) {
      setRows([]);
      return;
    }
    const qRef = query(
      collection(db, "streamers"),
      where("group", "==", groupKey)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setRows(list);
        setErr("");
      },
      (e) => setErr(e?.message || "Failed to read streamers")
    );
    return () => unsub();
  }, [groupKey, user]);

  const resetDraft = () =>
    setDraft({
      photoFile: null,
      name: "",
      email: "",
      handle: "",
      availability: {
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false,
      },
      availabilityTimes: {},
    });

  // Upload helper
  async function uploadAvatar(docId, file) {
    const path = `streamers/${docId}/avatar_${Date.now()}_${file.name}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
  }

  // ADD
  const addRow = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user) {
      setErr("Please sign in to add streamers.");
      return;
    }
    if (!draft.name.trim()) {
      setErr("Name is required.");
      return;
    }

    // sanitize
    const emailClean = (draft.email || "").trim();
    const handleClean = (draft.handle || "").trim();

    // keep only non-empty times
    const timesIn = draft.availabilityTimes || {};
    const timesClean = {};
    dayKeys.forEach((d) => {
      const t = timesIn[d] || {};
      const start = typeof t.start === "string" ? t.start : "";
      const end = typeof t.end === "string" ? t.end : "";
      if (start !== "" || end !== "") timesClean[d] = { start, end };
    });

    try {
      const docRef = await addDoc(collection(db, "streamers"), {
        group: groupKey,
        name: draft.name.trim(),
        email: emailClean || null,
        handle: handleClean || null,
        photoURL: null, // fill after upload
        availability: draft.availability || {},
        availabilityTimes: timesClean,
        createdAt: serverTimestamp(),
      });

      if (draft.photoFile) {
        const url = await uploadAvatar(docRef.id, draft.photoFile);
        await updateDoc(doc(db, "streamers", docRef.id), { photoURL: url });
      }

      resetDraft();
      setAddingOpen(false);
    } catch (e) {
      console.error("addRow error:", e?.code, e?.message, e);
      setErr(e?.message || "Failed to add streamer");
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditDraft({
      name: row.name || "",
      email: row.email || "",
      handle: row.handle || "",
      photoURL: row.photoURL || null,
      newPhotoFile: null, // for replacement upload
      availability: { ...(row.availability || {}) },
      availabilityTimes: { ...(row.availabilityTimes || {}) },
    });
  };

  // SAVE EDIT
  const saveEdit = async (id) => {
    setErr("");
    if (!user) {
      setErr("Please sign in to edit streamers.");
      return;
    }
    if (!editDraft.name?.trim()) {
      setErr("Name is required.");
      return;
    }

    const emailClean = (editDraft.email || "").trim();
    const handleClean = (editDraft.handle || "").trim();

    const timesIn = editDraft.availabilityTimes || {};
    const timesClean = {};
    dayKeys.forEach((d) => {
      const t = timesIn[d] || {};
      const start = typeof t.start === "string" ? t.start : "";
      const end = typeof t.end === "string" ? t.end : "";
      if (start !== "" || end !== "") timesClean[d] = { start, end };
    });

    try {
      let nextPhotoURL = editDraft.photoURL || null;
      if (editDraft.newPhotoFile) {
        nextPhotoURL = await uploadAvatar(id, editDraft.newPhotoFile);
      }

      await updateDoc(doc(db, "streamers", id), {
        name: editDraft.name.trim(),
        email: emailClean || null,
        handle: handleClean || null,
        photoURL: nextPhotoURL,
        availability: editDraft.availability || {},
        availabilityTimes: timesClean,
      });

      setEditingId(null);
      setEditDraft({});
    } catch (e) {
      console.error("saveEdit error:", e?.code, e?.message, e);
      setErr(e?.message || "Failed to save changes");
    }
  };

  const deleteRow = async (id) => {
    setErr("");
    if (!user) {
      setErr("Please sign in to delete streamers.");
      return;
    }
    try {
      await deleteDoc(doc(db, "streamers", id));
    } catch (e) {
      setErr(e?.message || "Failed to delete");
    }
  };

  return (
    <div className="links-card">
      {!user && (
        <div
          style={{
            marginBottom: 10,
            color: "#9a3412",
            background: "#fffbeb",
            padding: 8,
            borderRadius: 8,
          }}
        >
          You must be signed in to view/edit this table.
        </div>
      )}

      {err && (
        <div
          style={{
            marginBottom: 10,
            color: "#991b1b",
            background: "#fee2e2",
            padding: 8,
            borderRadius: 8,
          }}
        >
          {err}
        </div>
      )}

      {/* Add new row */}
      <details open={addingOpen} style={{ marginBottom: 12 }}>
        <summary
          style={{ cursor: "pointer", fontWeight: 600 }}
          onClick={() => setAddingOpen((v) => !v)}
        >
          Add Entry
        </summary>
        <form onSubmit={addRow} style={{ marginTop: 10 }}>
          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
          >
            {/* Photo upload */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                style={{ fontWeight: 600, display: "block", marginBottom: 6 }}
              >
                Profile Photo (circle)
              </label>
              <input
                type="file"
                accept="image/*"
                disabled={!user}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    photoFile: e.target.files?.[0] || null,
                  }))
                }
              />
              <div style={{ marginTop: 8 }}>
                <Avatar
                  src={
                    draft.photoFile
                      ? URL.createObjectURL(draft.photoFile)
                      : null
                  }
                  name={draft.name}
                />
              </div>
            </div>

            <input
              className="input"
              placeholder="Full name"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              disabled={!user}
              required
            />
            <input
              className="input"
              placeholder="Contact email"
              value={draft.email}
              onChange={(e) =>
                setDraft((d) => ({ ...d, email: e.target.value }))
              }
              disabled={!user}
              type="email"
            />
            <input
              className="input"
              placeholder="Social handle (@username or link)"
              value={draft.handle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, handle: e.target.value }))
              }
              disabled={!user}
            />

            <div
              style={{
                gridColumn: "1 / -1",
                padding: 8,
                background: "#f9fafb",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Availability (ET)
              </div>
              <AvailabilityEditor
                value={draft.availability}
                times={draft.availabilityTimes}
                disabled={!user}
                onChange={(nextAvail, nextTimes) =>
                  setDraft((d) => ({
                    ...d,
                    availability: nextAvail,
                    availabilityTimes: nextTimes,
                  }))
                }
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn primary" type="submit" disabled={!user}>
              Add
            </button>
            <button
              className="btn"
              type="button"
              style={{ marginLeft: 8 }}
              onClick={resetDraft}
              disabled={!user}
            >
              Reset
            </button>
          </div>
        </form>
      </details>

      {/* Table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th style={{ width: 80 }}>Photo</th> {/* new column */}
              <th style={{ width: 220 }}>Name</th>
              <th style={{ width: 320 }}>Availability (Mon–Sun, ET)</th>
              <th style={{ width: 280 }}>Contact Email</th>
              <th style={{ width: 260 }}>Social Handle</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id}>
                  <td>{idx + 1}</td>

                  {/* PHOTO */}
                  <td>
                    {isEditing ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Avatar
                          src={
                            editDraft.newPhotoFile
                              ? URL.createObjectURL(editDraft.newPhotoFile)
                              : editDraft.photoURL
                          }
                          name={editDraft.name}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!user}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              newPhotoFile: e.target.files?.[0] || null,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <Avatar src={r.photoURL} name={r.name} />
                    )}
                  </td>

                  {/* NAME */}
                  <td>
                    {isEditing ? (
                      <input
                        className="input"
                        placeholder="Full name"
                        value={editDraft.name || ""}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, name: e.target.value }))
                        }
                        disabled={!user}
                      />
                    ) : (
                      r.name || "—"
                    )}
                  </td>

                  {/* AVAILABILITY */}
                  <td>
                    {isEditing ? (
                      <AvailabilityEditor
                        value={editDraft.availability}
                        times={editDraft.availabilityTimes}
                        onChange={(nextAvail, nextTimes) =>
                          setEditDraft((d) => ({
                            ...d,
                            availability: nextAvail,
                            availabilityTimes: nextTimes,
                          }))
                        }
                        disabled={!user}
                      />
                    ) : (
                      <AvailabilitySummary
                        availability={r.availability}
                        availabilityTimes={r.availabilityTimes}
                      />
                    )}
                  </td>

                  {/* EMAIL */}
                  <td>
                    {isEditing ? (
                      <input
                        className="input"
                        type="email"
                        value={editDraft.email || ""}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, email: e.target.value }))
                        }
                        disabled={!user}
                      />
                    ) : (
                      r.email || "—"
                    )}
                  </td>

                  {/* HANDLE */}
                  <td>
                    {isEditing ? (
                      <input
                        className="input"
                        value={editDraft.handle || ""}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            handle: e.target.value,
                          }))
                        }
                        disabled={!user}
                      />
                    ) : (
                      r.handle || "—"
                    )}
                  </td>

                  {/* ACTIONS */}
                  <td style={{ textAlign: "right" }}>
                    {isEditing ? (
                      <>
                        <button
                          className="btn primary"
                          onClick={() => saveEdit(r.id)}
                          disabled={!user}
                        >
                          Save
                        </button>
                        <button
                          className="btn"
                          style={{ marginLeft: 8 }}
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft({});
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn"
                          onClick={() => startEdit(r)}
                          disabled={!user}
                        >
                          Edit
                        </button>
                        <button
                          className="btn danger"
                          style={{ marginLeft: 8 }}
                          onClick={() => deleteRow(r.id)}
                          disabled={!user}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#666" }}>
                  {user
                    ? "No entries yet. Add your first one above."
                    : "Sign in to view entries."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------
   ANNOUNCEMENTS (CRUD)
---------------------------- */
function Announcements() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setRows([]);
      return;
    }
    const qRef = query(collection(db, "streamer_announcements"));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setRows(list);
        setErr("");
      },
      (e) => setErr(e?.message || "Failed to read announcements")
    );
    return () => unsub();
  }, [user]);

  const addAnnouncement = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user) {
      setErr("Please sign in to post announcements.");
      return;
    }
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, "streamer_announcements"), {
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      setErr(e?.message || "Failed to add announcement");
    }
  };

  const deleteAnnouncement = async (id) => {
    setErr("");
    if (!user) {
      setErr("Please sign in to delete announcements.");
      return;
    }
    try {
      await deleteDoc(doc(db, "streamer_announcements", id));
    } catch (e) {
      setErr(e?.message || "Failed to delete announcement");
    }
  };

  return (
    <div className="links-card">
      {!user && (
        <div
          style={{
            marginBottom: 10,
            color: "#9a3412",
            background: "#fffbeb",
            padding: 8,
            borderRadius: 8,
          }}
        >
          You must be signed in to view/edit announcements.
        </div>
      )}

      {err && (
        <div
          style={{
            marginBottom: 10,
            color: "#991b1b",
            background: "#fee2e2",
            padding: 8,
            borderRadius: 8,
          }}
        >
          {err}
        </div>
      )}

      <form
        onSubmit={addAnnouncement}
        className="links-form"
        style={{ alignItems: "stretch" }}
      >
        <textarea
          className="input"
          placeholder="Company text announcement (launch dates, monthly plans, milestones, etc.)"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!user}
        />
        <button
          className="btn primary"
          type="submit"
          disabled={!user || !text.trim()}
        >
          Post
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666" }}>
            {user ? "No announcements yet." : "Sign in to view announcements."}
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
                gap: 12,
              }}
            >
              <div style={{ whiteSpace: "pre-wrap" }}>{r.text}</div>
              <button
                className="btn danger"
                onClick={() => deleteAnnouncement(r.id)}
                disabled={!user}
                title="Delete announcement"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------------------
   PAGE WRAPPER WITH TABS
---------------------------- */
export default function StreamerDatabase() {
  const [active, setActive] = useState(TABS[0]);

  const Buttons = useMemo(
    () =>
      TABS.map((label) => (
        <button
          key={label}
          className={`pill ${active === label ? "active" : ""}`}
          onClick={() => setActive(label)}
        >
          {label}
        </button>
      )),
    [active]
  );

  const groupKey = TAB_TO_GROUP[active];

  return (
    <div className="links-page" style={{ padding: 24 }}>
      <div className="pill-row">{Buttons}</div>
      {active === "Announcements" ? (
        <Announcements />
      ) : (
        <StreamersTable groupKey={groupKey} />
      )}
    </div>
  );
}
