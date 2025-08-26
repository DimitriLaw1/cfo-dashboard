// src/pages/PaymentStructureBreakdown.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  db,
  auth,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  onAuthStateChanged,
} from "../firebase";

const TABS = ["Payment structure", "Visual"];

/* ---------------------------------------------------
   Payment-structure tab: editable bullet list (CRUD)
---------------------------------------------------- */
function PaymentStructureList() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  // Watch auth
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
    const qRef = query(collection(db, "payment_structure"));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // newest first
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setRows(list);
        setErr("");
      },
      (e) => setErr(e?.message || "Failed to read payment structure")
    );
    return () => unsub();
  }, [user]);

  const addItem = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user) {
      setErr("Please sign in to add items.");
      return;
    }
    const clean = text.trim();
    if (!clean) return;
    try {
      await addDoc(collection(db, "payment_structure"), {
        text: clean,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      setErr(e?.message || "Failed to add item");
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditText(row.text || "");
  };

  const saveEdit = async (id) => {
    setErr("");
    if (!user) {
      setErr("Please sign in to edit items.");
      return;
    }
    const clean = (editText || "").trim();
    if (!clean) return;
    try {
      await updateDoc(doc(db, "payment_structure", id), { text: clean });
      setEditingId(null);
      setEditText("");
    } catch (e) {
      setErr(e?.message || "Failed to save item");
    }
  };

  const deleteItem = async (id) => {
    setErr("");
    if (!user) {
      setErr("Please sign in to delete items.");
      return;
    }
    try {
      await deleteDoc(doc(db, "payment_structure", id));
    } catch (e) {
      setErr(e?.message || "Failed to delete item");
    }
  };

  return (
    <div
      style={{
        maxWidth: 900,
        width: "100%",
        margin: "0 auto",
        display: "grid",
        gap: 12,
      }}
    >
      {!user && (
        <div
          style={{
            color: "#9a3412",
            background: "#fffbeb",
            padding: 8,
            borderRadius: 8,
          }}
        >
          You must be signed in to view/edit this list.
        </div>
      )}
      {err && (
        <div
          style={{
            color: "#991b1b",
            background: "#fee2e2",
            padding: 8,
            borderRadius: 8,
          }}
        >
          {err}
        </div>
      )}

      {/* Add new bullet */}
      <form
        onSubmit={addItem}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          alignItems: "start",
        }}
      >
        <textarea
          className="input"
          placeholder="Add a payment structure bullet..."
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!user}
          style={{
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            resize: "vertical",
            minHeight: 42,
          }}
        />
        <button
          className="btn primary"
          type="submit"
          disabled={!user || !text.trim()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "#0070f3",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            height: 42,
          }}
        >
          Add
        </button>
      </form>

      {/* Scrollable list area (prevents huge page height) */}
      <div
        style={{
          background: "#fafafa",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          maxHeight: "45vh",
          overflowY: "auto",
        }}
      >
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666" }}>
            {user
              ? "No bullets yet. Add your first one above."
              : "Sign in to view items."}
          </div>
        ) : (
          <ul
            style={{
              listStyle: "disc",
              paddingLeft: 22,
              margin: 0,
              display: "grid",
              gap: 8,
            }}
          >
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <li key={r.id} style={{ display: "grid", gap: 6 }}>
                  {isEditing ? (
                    <>
                      <textarea
                        className="input"
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        disabled={!user}
                        style={{
                          padding: 8,
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          resize: "vertical",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn primary"
                          onClick={() => saveEdit(r.id)}
                          disabled={!user || !editText.trim()}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "#0070f3",
                            color: "#fff",
                            border: "none",
                            fontWeight: 600,
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setEditingId(null);
                            setEditText("");
                          }}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "start",
                        justifyContent: "space-between",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ whiteSpace: "pre-wrap", flex: 1 }}>
                        {r.text}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        <button
                          className="btn"
                          onClick={() => startEdit(r)}
                          disabled={!user}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => deleteItem(r.id)}
                          disabled={!user}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #fecaca",
                            background: "#fee2e2",
                            color: "#991b1b",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Small tip for mobile */}
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Tip: This list scrolls if it gets long.
      </div>
    </div>
  );
}

/* -----------------------------
   Visual tab: image placeholder
------------------------------ */
function VisualPlaceholder() {
  return (
    <div
      style={{
        maxWidth: 900,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          border: "2px dashed #cbd5e1",
          borderRadius: 12,
          background:
            "repeating-linear-gradient(45deg, #f8fafc, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          textAlign: "center",
          padding: 16,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Visual Placeholder
          </div>
          <div style={{ fontSize: 14 }}>
            An image/diagram of the payment structure will go here.
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Page wrapper with toggled tabs
------------------------------ */
export default function PaymentStructureBreakdown() {
  const [active, setActive] = useState(TABS[0]);

  const Buttons = useMemo(
    () =>
      TABS.map((label) => (
        <button
          key={label}
          className={`pill ${active === label ? "active" : ""}`}
          onClick={() => setActive(label)}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: active === label ? "#eef2ff" : "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      )),
    [active]
  );

  return (
    <div style={{ padding: 24 }}>
      <div
        className="pill-row"
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        {Buttons}
      </div>

      {active === "Payment structure" ? (
        <PaymentStructureList />
      ) : (
        <VisualPlaceholder />
      )}
    </div>
  );
}
