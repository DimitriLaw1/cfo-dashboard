import React, { useEffect, useMemo, useState } from "react";
import { db, collection, getDocs, onSnapshot, query } from "../firebase";
import { format, addDays, startOfDay, endOfDay } from "date-fns";

// ---- Config ----
const TARGET = 10_000; // everyone's goal

// ---- Bi-week helpers (anchored like your PaymentDistribution page) ----
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Mon, Jul 28, 2025 (bi-week #0)
const FIRST_BIWEEK_START = startOfDay(new Date(2025, 6, 28));

function getBiWeekStartFor(dateLike) {
  const d = startOfDay(new Date(dateLike));
  const diffDays = Math.floor(
    (d.getTime() - FIRST_BIWEEK_START.getTime()) / MS_PER_DAY
  );
  const periods = Math.floor(diffDays / 14);
  return addDays(FIRST_BIWEEK_START, periods * 14);
}
function getCurrentBiWeekStart() {
  return getBiWeekStartFor(new Date());
}
function biWeekFromStart(startDate) {
  const sLocal = startOfDay(new Date(startDate));
  const eLocal = endOfDay(addDays(sLocal, 13));
  return {
    start: format(sLocal, "MMM d"),
    end: format(eLocal, "MMM d, yyyy"),
    startDate: sLocal,
    endDate: eLocal,
    key: format(sLocal, "yyyy-MM-dd"),
  };
}

// ---- UI helpers ----
const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));

function Avatar({ name }) {
  const initials =
    (name || "")
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return;
}

function ProgressBar({ value, target }) {
  const pct = Math.max(0, Math.min(1, (value || 0) / (target || 1)));
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          width: "100%",
          height: 12,
          background: "#f3f4f6",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: "#0070f3",
          }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
        {fmtMoney(value)} / {fmtMoney(target)} {value > target ? "🔥" : ""}
      </div>
    </div>
  );
}

export default function SalesLeaderboard() {
  const [employees, setEmployees] = useState([]);
  const [cards, setCards] = useState([]);
  const [mode, setMode] = useState("biweek"); // 'biweek' | 'all'
  const [viewStartDate, setViewStartDate] = useState(getCurrentBiWeekStart());
  const biWeek = biWeekFromStart(viewStartDate);
  const currentStart = getCurrentBiWeekStart();

  // load employees once
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "employees"));
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // live cards (we'll filter client-side so old rows without biWeekKey still count)
  useEffect(() => {
    const qRef = query(collection(db, "cards"));
    const unsub = onSnapshot(qRef, (snap) => {
      setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Filter cards by chosen timeframe
  const filteredCards = useMemo(() => {
    if (mode === "all") return cards;
    // bi-week filter (accept both new rows w/ key AND older rows w/ biWeekStart)
    return cards.filter((c) => {
      try {
        if (c.biWeekKey) return c.biWeekKey === biWeek.key;
        if (c.biWeekStart) {
          const inferredStart = getBiWeekStartFor(new Date(c.biWeekStart));
          const inferredKey = format(inferredStart, "yyyy-MM-dd");
          return inferredKey === biWeek.key;
        }
        return false;
      } catch {
        return false;
      }
    });
  }, [cards, mode, biWeek.key]);

  // Aggregate revenue & take-home per employeeId (include employees with 0)
  const rows = useMemo(() => {
    const totalRevenueById = new Map(); // employeeId -> revenue
    const totalTakeHomeById = new Map(); // employeeId -> takeHome

    for (const c of filteredCards) {
      const id = c.employeeId;
      if (!id) continue;
      const rev = Number(c.revenue) || 0;
      const th = Number(c.takeHome) || 0;
      totalRevenueById.set(id, (totalRevenueById.get(id) || 0) + rev);
      totalTakeHomeById.set(id, (totalTakeHomeById.get(id) || 0) + th);
    }

    // include all employees (even if 0)
    const enriched = employees.map((e) => ({
      employeeId: e.id,
      name: e.name || "",
      jobTitle: e.jobTitle || "",
      totalRevenue: totalRevenueById.get(e.id) || 0,
      totalTakeHome: totalTakeHomeById.get(e.id) || 0,
    }));

    // sort desc by revenue ONLY (as requested)
    enriched.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // add rank
    return enriched.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [employees, filteredCards]);

  // bi-week nav
  const prevDisabled = viewStartDate.getTime() <= FIRST_BIWEEK_START.getTime();
  const nextDisabled = viewStartDate.getTime() >= currentStart.getTime();

  const handlePrev = () => {
    const prev = addDays(viewStartDate, -14);
    setViewStartDate(
      prev.getTime() < FIRST_BIWEEK_START.getTime() ? FIRST_BIWEEK_START : prev
    );
  };
  const handleNext = () => {
    const next = addDays(viewStartDate, 14);
    setViewStartDate(
      next.getTime() > currentStart.getTime() ? currentStart : next
    );
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        {/* Title */}
        <h2 style={{ margin: 0 }}>Sales Leaderboard</h2>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "#f3f4f6",
              borderRadius: 8,
              padding: 4,
            }}
          >
            <button
              onClick={() => setMode("biweek")}
              className="seg"
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid transparent",
                background: mode === "biweek" ? "#fff" : "transparent",
                cursor: "pointer",
              }}
            >
              Bi-week
            </button>
            <button
              onClick={() => setMode("all")}
              className="seg"
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid transparent",
                background: mode === "all" ? "#fff" : "transparent",
                cursor: "pointer",
              }}
            >
              All-time
            </button>
          </div>

          {mode === "biweek" && (
            <div
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <button
                onClick={handlePrev}
                disabled={prevDisabled}
                aria-label="Previous bi-week"
                title="Previous bi-week"
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: prevDisabled ? "#eee" : "#fff",
                  cursor: prevDisabled ? "not-allowed" : "pointer",
                }}
              >
                ◀
              </button>
              <span style={{ fontStyle: "italic" }}>
                {biWeek.start} – {biWeek.end}
              </span>
              <button
                onClick={handleNext}
                disabled={nextDisabled}
                aria-label="Next bi-week"
                title="Next bi-week"
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: nextDisabled ? "#eee" : "#fff",
                  cursor: nextDisabled ? "not-allowed" : "pointer",
                }}
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          width: "100%",
          overflowX: "auto",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={th}>Ranking</th>
              <th style={{ ...th, textAlign: "left" }}>Employee</th>
              <th style={{ ...th, minWidth: 280 }}>Progress</th>
              <th style={th}>Target</th>
              <th style={th}>Total Revenue</th>
              <th style={th}>Total Take-Home</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={tdCenter}>{r.rank}</td>
                <td style={{ ...td, display: "flex", alignItems: "center" }}>
                  <Avatar name={r.name} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.name || "Unknown"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {r.jobTitle || "—"}
                    </div>
                  </div>
                </td>
                <td style={{ ...td }}>
                  <ProgressBar value={r.totalRevenue} target={TARGET} />
                </td>
                <td style={tdCenter}>{fmtMoney(TARGET)}</td>
                <td style={{ ...tdCenter, fontWeight: 700 }}>
                  {fmtMoney(r.totalRevenue)}
                </td>
                <td style={{ ...tdCenter }}>{fmtMoney(r.totalTakeHome)}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ ...tdCenter, color: "#6b7280", padding: 24 }}
                >
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// shared cell styles
const th = {
  padding: "10px 12px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: "#6b7280",
  textAlign: "center",
};
const td = { padding: "12px", verticalAlign: "middle" };
const tdCenter = { ...td, textAlign: "center" };
