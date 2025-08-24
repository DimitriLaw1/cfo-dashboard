// src/pages/ImportantLinks.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  db,
  auth,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  onAuthStateChanged,
} from "../firebase";

// Show these labels in the UI:
const SUBTABS = ["Content Team", "Sales Team", "Streamer Team", "C-Suite"];

// Map UI label -> value stored in Firestore (keeps consistency with rest of app)
const TEAM_VALUE_MAP = {
  "Content Team": "Content Team",
  "Sales Team": "Sales Team",
  "Streamer Team": "Streamer Team",
  "C-Suite": "C-suite", // UI label uses S, stored key uses s
};

function TeamLinksTable({ teamKey }) {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ title: "", link: "" });
  const [user, setUser] = useState(null);
  const [err, setErr] = useState("");

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Real-time listener only when signed in
  useEffect(() => {
    if (!user) {
      setRows([]);
      return;
    }
    const qRef = query(
      collection(db, "important_links"),
      where("team", "==", teamKey)
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
      (e) => setErr(e?.message || "Failed to read links")
    );
    return () => unsub();
  }, [teamKey, user]);

  const addRow = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user) {
      setErr("Please sign in to add links.");
      return;
    }
    if (!draft.title?.trim() || !draft.link?.trim()) return;
    try {
      await addDoc(collection(db, "important_links"), {
        team: teamKey,
        title: draft.title.trim(),
        link: draft.link.trim(),
        createdAt: serverTimestamp(),
      });
      setDraft({ title: "", link: "" });
    } catch (e) {
      setErr(e?.message || "Failed to add link");
    }
  };

  const deleteRow = async (id) => {
    setErr("");
    if (!user) {
      setErr("Please sign in to delete links.");
      return;
    }
    try {
      await deleteDoc(doc(db, "important_links", id));
    } catch (e) {
      setErr(e?.message || "Failed to delete link");
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
          You must be signed in and allowlisted to view/edit links.
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

      <form onSubmit={addRow} className="links-form">
        <input
          className="input"
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
        <input
          className="input"
          placeholder="https://link..."
          value={draft.link}
          onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
        />
        <button className="btn primary" type="submit" disabled={!user}>
          Add
        </button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "45%" }}>Title</th>
              <th style={{ width: "45%" }}>Link</th>
              <th style={{ width: "10%" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  <a href={r.link} target="_blank" rel="noreferrer">
                    {r.link}
                  </a>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn danger"
                    onClick={() => deleteRow(r.id)}
                    disabled={!user}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "#666" }}>
                  {user
                    ? "No links yet. Add your first one above."
                    : "Sign in to view links."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ImportantLinks() {
  const [active, setActive] = useState(SUBTABS[0]);

  const Buttons = useMemo(
    () =>
      SUBTABS.map((label) => (
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

  const teamKey = TEAM_VALUE_MAP[active] || active;

  return (
    <div className="links-page">
      <div className="pill-row">{Buttons}</div>
      <TeamLinksTable teamKey={teamKey} />
    </div>
  );
}
