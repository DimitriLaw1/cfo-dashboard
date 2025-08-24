// src/pages/ExpensesTracker.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  db,
  auth,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  onAuthStateChanged,
} from "../firebase";

// ----- Categories -----
const CATEGORIES = [
  "Technology", // domain names, 3rd-party software, etc.
  "Company Perks", // concert tickets, lunches
  "Marketing", // influencers, ads, acquisitions
  "Company Travel",
  "Dinner",
  "Camera Equipment",
  "Other",
];

// ----- Utils -----
const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));

const toDateInput = (d) => {
  const x = new Date(d);
  const y = new Date(x.getTime() - x.getTimezoneOffset() * 60000);
  return y.toISOString().slice(0, 10);
};

// ----- Simple donut chart (pure SVG, no deps) -----
function PieChart({ series, size = 220, thickness = 22 }) {
  const total = series.reduce((s, x) => s + x.value, 0);
  if (!total) {
    return (
      <div style={{ textAlign: "center", color: "#6b7280", padding: 20 }}>
        No expense data yet.
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;
  const C = 2 * Math.PI * r;

  const palette = [
    "#3b82f6",
    "#f59e0b",
    "#10b981",
    "#8b5cf6",
    "#ef4444",
    "#06b6d4",
    "#a3a3a3",
  ];

  let offset = 0;
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={thickness}
          />
          {series.map((s, i) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={palette[i % palette.length]}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text
          x={cx}
          y={cy}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="14"
          fill="#374151"
          fontWeight="600"
        >
          {fmtMoney(total)}
        </text>
      </svg>

      <div style={{ display: "grid", gap: 8 }}>
        {series.map((s, i) => (
          <div
            key={s.label}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: palette[i % palette.length],
                display: "inline-block",
              }}
            />
            <div style={{ fontSize: 14 }}>
              <strong>{s.label}</strong> — {fmtMoney(s.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Tiny bar chart for Revenue vs Expenses -----
function RevVsExp({ revenue, expenses }) {
  const max = Math.max(revenue, expenses, 1);
  const revPct = (revenue / max) * 100;
  const expPct = (expenses / max) * 100;
  const net = revenue - expenses;
  const netPositive = net >= 0;

  return (
    <div className="links-card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Revenue vs Expenses</h3>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <strong>Revenue</strong>
            <span>{fmtMoney(revenue)}</span>
          </div>
          <div
            style={{
              height: 14,
              background: "#f3f4f6",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${revPct}%`,
                height: "100%",
                background: "#10b981",
              }}
            />
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <strong>Expenses</strong>
            <span>{fmtMoney(expenses)}</span>
          </div>
          <div
            style={{
              height: 14,
              background: "#f3f4f6",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${expPct}%`,
                height: "100%",
                background: "#ef4444",
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          fontWeight: 700,
          color: netPositive ? "#065f46" : "#991b1b",
          background: netPositive ? "#ecfdf5" : "#fee2e2",
          padding: 8,
          borderRadius: 8,
          display: "inline-block",
        }}
      >
        Net: {fmtMoney(net)} {netPositive ? "✅ Profitable" : "⚠️ In the red"}
      </div>
    </div>
  );
}

export default function ExpensesTracker() {
  const [active, setActive] = useState(CATEGORIES[0]);
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]); // all expenses (all categories)
  const [cards, setCards] = useState([]); // revenue cards (for Company take-home)
  const [err, setErr] = useState("");

  // Form state
  const [draft, setDraft] = useState({
    date: toDateInput(new Date()),
    vendor: "",
    description: "",
    amount: "",
  });

  // Auth gate
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Live expenses feed (all categories -> we filter client side)
  useEffect(() => {
    if (!user) {
      setRows([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "expenses"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) =>
            (b.expenseDate?.seconds || b.createdAt?.seconds || 0) -
            (a.expenseDate?.seconds || a.createdAt?.seconds || 0)
        );
        setRows(list);
        setErr("");
      },
      (e) => setErr(e?.message || "Failed to read expenses")
    );
    return () => unsub();
  }, [user]);

  // Live company revenue feed: sum takeHome where jobTitle on the card includes "company"
  useEffect(() => {
    if (!user) {
      setCards([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "cards"),
      (snap) => {
        setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (e) => setErr(e?.message || "Failed to read revenue")
    );
    return () => unsub();
  }, [user]);

  const addExpense = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user) {
      setErr("Please sign in to add expenses.");
      return;
    }
    const amt = parseFloat(draft.amount || "0");
    if (!amt || amt <= 0) {
      setErr("Amount must be greater than 0.");
      return;
    }
    try {
      await addDoc(collection(db, "expenses"), {
        category: active,
        vendor: draft.vendor.trim(),
        description: draft.description.trim(),
        amount: amt,
        expenseDate: new Date(draft.date), // Firestore stores as Timestamp
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || "",
      });
      setDraft({
        date: toDateInput(new Date()),
        vendor: "",
        description: "",
        amount: "",
      });
    } catch (e2) {
      setErr(e2?.message || "Failed to add expense");
    }
  };

  const deleteExpense = async (id) => {
    setErr("");
    if (!user) {
      setErr("Please sign in to delete expenses.");
      return;
    }
    try {
      await deleteDoc(doc(db, "expenses", id));
    } catch (e2) {
      setErr(e2?.message || "Failed to delete expense");
    }
  };

  // Filter table by active category
  const tableRows = useMemo(
    () => rows.filter((r) => r.category === active),
    [rows, active]
  );

  const categoryTotal = useMemo(
    () => tableRows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [tableRows]
  );

  // Pie series = totals by category across ALL data
  const pieSeries = useMemo(() => {
    const byCat = new Map();
    for (const c of CATEGORIES) byCat.set(c, 0);
    for (const r of rows) {
      const cat = r.category || "Other";
      byCat.set(cat, (byCat.get(cat) || 0) + (Number(r.amount) || 0));
    }
    return Array.from(byCat.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }, [rows]);

  // Totals for the top chart
  const totalExpenses = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows]
  );

  const companyRevenue = useMemo(() => {
    // take-home where the recorded jobTitle on the card contains "company"
    return cards.reduce((sum, c) => {
      const title = String(c.jobTitle || "").toLowerCase();
      const th = Number(c.takeHome) || 0;
      return title.includes("company") ? sum + th : sum;
    }, 0);
  }, [cards]);

  // ---- Download ALL expenses CSV ----
  const downloadAllExpensesCSV = () => {
    const headers = [
      "id",
      "category",
      "date",
      "vendor",
      "description",
      "amount",
      "createdByEmail",
    ];

    const rowsAll = rows.map((r) => ({
      id: r.id || "",
      category: r.category || "",
      date: r.expenseDate?.seconds
        ? new Date(r.expenseDate.seconds * 1000).toISOString().slice(0, 10)
        : "",
      vendor: r.vendor || "",
      description: (r.description || "").replace(/\n/g, " "),
      amount:
        typeof r.amount === "number"
          ? r.amount.toFixed(2)
          : String(r.amount || ""),
      createdByEmail: r.createdByEmail || "",
    }));

    const csv = [
      headers.join(","),
      ...rowsAll.map((obj) =>
        headers.map((h) => `"${String(obj[h]).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_all_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="links-page" style={{ maxWidth: 1100 }}>
      {/* Header bar with download */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Expenses Tracker</h2>
        <button
          className="btn primary"
          onClick={downloadAllExpensesCSV}
          disabled={!user || rows.length === 0}
          title="Download ALL expenses as CSV"
        >
          Download All Expenses (CSV)
        </button>
      </div>

      {/* Auth note + errors */}
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
          You must be signed in and allowlisted to view/edit expenses.
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

      {/* Top chart: revenue (Company take-home) vs expenses */}
      <RevVsExp revenue={companyRevenue} expenses={totalExpenses} />

      {/* Category pills */}
      <div className="pill-row" style={{ marginBottom: 16 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`pill ${active === c ? "active" : ""}`}
            onClick={() => setActive(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Entry form + table */}
      <div className="links-card" style={{ marginBottom: 16 }}>
        <form onSubmit={addExpense} className="links-form">
          <input
            className="input"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Vendor (e.g., Google Domains)"
            value={draft.vendor}
            onChange={(e) =>
              setDraft((d) => ({ ...d, vendor: e.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Description (optional)"
            value={draft.description}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={draft.amount}
            onChange={(e) =>
              setDraft((d) => ({ ...d, amount: e.target.value }))
            }
            required
          />
          <button className="btn primary" type="submit" disabled={!user}>
            Add Expense
          </button>
        </form>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Date</th>
                <th style={{ width: 220, textAlign: "left" }}>Vendor</th>
                <th style={{ textAlign: "left" }}>Description</th>
                <th style={{ width: 140, textAlign: "right" }}>Amount</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.expenseDate?.seconds
                      ? new Date(
                          r.expenseDate.seconds * 1000
                        ).toLocaleDateString()
                      : ""}
                  </td>
                  <td style={{ textAlign: "left" }}>{r.vendor || "—"}</td>
                  <td style={{ textAlign: "left" }}>{r.description || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {fmtMoney(r.amount)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn danger"
                      onClick={() => deleteExpense(r.id)}
                      disabled={!user}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {tableRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: "center", color: "#666" }}
                  >
                    No expenses in this category yet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>
                  Total ({active}):
                </td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>
                  {fmtMoney(categoryTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pie chart across all categories */}
      <div className="links-card">
        <h3 style={{ marginTop: 0 }}>Spend by Category</h3>
        <PieChart series={pieSeries} />
      </div>
    </div>
  );
}
