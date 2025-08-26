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
   Lightweight HTML sanitizer (allow simple formatting)
   Allowed tags: h1–h6, b, strong, i, em, u, br, p, ul, ol, li, span
   All attributes are stripped.
---------------------------------------------------- */
const ALLOWED_TAGS = new Set([
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "BR",
  "P",
  "UL",
  "OL",
  "LI",
  "SPAN",
]);

function sanitizeHtml(html = "") {
  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(String(html), "text/html");

    const clean = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.nodeValue);
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toUpperCase();
        if (!ALLOWED_TAGS.has(tag)) {
          const frag = document.createDocumentFragment();
          node.childNodes.forEach((child) => frag.appendChild(clean(child)));
          return frag;
        }
        const el = document.createElement(tag.toLowerCase());
        node.childNodes.forEach((child) => el.appendChild(clean(child)));
        return el;
      }
      return document.createTextNode("");
    };

    const outFrag = document.createDocumentFragment();
    parsed.body.childNodes.forEach((n) => outFrag.appendChild(clean(n)));
    const wrapper = document.createElement("div");
    wrapper.appendChild(outFrag);
    return wrapper.innerHTML;
  } catch {
    const div = document.createElement("div");
    div.innerText = String(html);
    return div.innerHTML;
  }
}

/* ---------------------------------------------------
   Payment-structure tab: notebook-like cells (CRUD)
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

        // ---- sort OLDEST -> NEWEST so new entries appear at the bottom ----
        list.sort((a, b) => {
          const aSec = a.createdAt?.seconds ?? 0;
          const aNano = a.createdAt?.nanoseconds ?? 0;
          const bSec = b.createdAt?.seconds ?? 0;
          const bNano = b.createdAt?.nanoseconds ?? 0;
          if (aSec !== bSec) return aSec - bSec;
          return aNano - bNano; // tie-breaker
        });

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
    const clean = (text || "").trim();
    if (!clean) return;
    try {
      await addDoc(collection(db, "payment_structure"), {
        text: clean, // raw HTML; sanitize on render
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
        maxWidth: 1000,
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

      {/* Add new cell */}
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
          placeholder="Type in the payment structure..."
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!user}
          style={{
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            resize: "vertical",
            minHeight: 52,
            fontFamily:
              "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
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
            height: 52,
          }}
        >
          Add cell
        </button>
      </form>

      {/* Notebook area (scrolls if long) */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          maxHeight: "65vh",
          overflowY: "auto",
        }}
      >
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666" }}>
            {user
              ? "No cells yet. Add your first one above."
              : "Sign in to view items."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((r, idx) => {
              const isEditing = editingId === r.id;
              const created = r.createdAt?.seconds
                ? new Date(r.createdAt.seconds * 1000)
                : null;

              return (
                <section
                  key={r.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    overflow: "hidden",
                    display: "grid",
                  }}
                >
                  {/* Cell header */}
                  <header
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom: "1px solid #e5e7eb",
                      background:
                        "linear-gradient(90deg, #eef2ff 0%, #ffffff 40%)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                      }}
                    >
                      {/* left accent bar */}
                      <div
                        style={{
                          width: 6,
                          height: 18,
                          borderRadius: 3,
                          background: "#6366f1",
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#111827",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Cell {idx + 1}
                      </div>
                      <div
                        title={
                          created ? created.toLocaleString() : "Not timestamped"
                        }
                        style={{
                          color: "#6b7280",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {created ? created.toLocaleString() : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {isEditing ? (
                        <>
                          <button
                            className="btn primary"
                            onClick={() => saveEdit(r.id)}
                            disabled={!user || !editText.trim()}
                            style={{
                              padding: "6px 10px",
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
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #d1d5db",
                              background: "#fff",
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
                        </>
                      )}
                    </div>
                  </header>

                  {/* Cell body */}
                  <div style={{ padding: 12 }}>
                    {isEditing ? (
                      <textarea
                        className="input"
                        rows={6}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        disabled={!user}
                        style={{
                          width: "100%",
                          padding: 10,
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          resize: "vertical",
                          fontFamily:
                            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          wordBreak: "break-word",
                          lineHeight: 1.5,
                        }}
                        // Convert raw \n to <br/> after sanitizing so Enter creates visible new lines
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(r.text).replace(/\n/g, "<br/>"),
                        }}
                      />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Small tip for mobile */}
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Tip: Each entry is a separate cell. Basic HTML is supported (headings
        h1–h6, &lt;b&gt;, &lt;strong&gt;, &lt;i&gt;, &lt;em&gt;, &lt;u&gt;,
        lists, &lt;br/&gt;, &lt;p&gt;).
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
        maxWidth: 1000,
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
