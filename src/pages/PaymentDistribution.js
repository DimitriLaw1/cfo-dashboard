import React, { useState, useEffect, useMemo } from "react";
import Card from "../components/Card";
import Tabs from "../components/Tabs";
import {
  db,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
} from "../firebase";
import { startOfWeek, addDays, format, startOfDay, endOfDay } from "date-fns";

const teamTabs = ["Content Team", "Sales Team", "Streamer Team", "C-suite"];
const forTeamOptions = [
  "Sales Team",
  "Streamer Team",
  "C-suite",
  "Content Team",
];

// ---- Bi-week constants & helpers ----
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIRST_BIWEEK_START = startOfDay(new Date(2025, 6, 28)); // Mon, Jul 28, 2025

function getBiWeekStartFor(dateLike) {
  const d = startOfDay(new Date(dateLike));
  const diffDays = Math.floor(
    (d.getTime() - FIRST_BIWEEK_START.getTime()) / MS_PER_DAY
  );
  const periods = Math.floor(diffDays / 14);
  const start = addDays(FIRST_BIWEEK_START, periods * 14);
  return start;
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

const pct = (n, p) => +(n * p).toFixed(2);

function findByTitle(employees, titleContains, team) {
  const t = titleContains.toLowerCase();
  return employees.find(
    (e) =>
      e.team === team &&
      String(e.jobTitle || "")
        .toLowerCase()
        .includes(t)
  );
}

function isOnTeam(employee, team) {
  return String(employee.team) === team;
}

function findVideoContentLead(employees) {
  return (
    findByTitle(
      employees,
      "video content distribution lead",
      "Streamer Team"
    ) ||
    findByTitle(employees, "vp of video content distribution", "Streamer Team")
  );
}

async function addCard({
  forTeam,
  biWeekRange,
  employee,
  description,
  amount = 0,
  takeHome = 0,
  revenue = 0,
}) {
  await addDoc(collection(db, "cards"), {
    name: employee.name,
    employeeId: employee.id,
    jobTitle: employee.jobTitle,
    team: employee.team,
    forTeam,
    description,
    amount,
    revenue,
    takeHome,
    createdAt: serverTimestamp(),
    ...biWeekRange,
  });
}

// NEW: simple currency formatter for USD
const fmtCurrency = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export default function PaymentDistribution() {
  const [activeTab, setActiveTab] = useState(teamTabs[0]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    amount: "",
    forTeam: "",
  });
  const [employees, setEmployees] = useState([]);
  const [cards, setCards] = useState([]);

  const [viewStartDate, setViewStartDate] = useState(getCurrentBiWeekStart());
  const biWeek = biWeekFromStart(viewStartDate);
  const currentStart = getCurrentBiWeekStart();

  useEffect(() => {
    const fetchEmployees = async () => {
      const snap = await getDocs(collection(db, "employees"));
      setEmployees(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "cards"));
    const unsub = onSnapshot(q, (snapshot) => {
      const arr = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCards(arr);
    });
    return () => unsub();
  }, []);

  const inCurrentBiWeek = (c) => {
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
  };

  const handlePrev = () => {
    const prev = addDays(viewStartDate, -14);
    const clamped =
      prev.getTime() < FIRST_BIWEEK_START.getTime() ? FIRST_BIWEEK_START : prev;
    setViewStartDate(clamped);
  };

  const handleNext = () => {
    const next = addDays(viewStartDate, 14);
    const clamped =
      next.getTime() > currentStart.getTime() ? currentStart : next;
    setViewStartDate(clamped);
  };

  const prevDisabled = viewStartDate.getTime() <= FIRST_BIWEEK_START.getTime();
  const nextDisabled = viewStartDate.getTime() >= currentStart.getTime();

  const downloadCSV = () => {
    const rows = cards.filter(inCurrentBiWeek).map((c) => ({
      name: c.name || "",
      employeeId: c.employeeId || "",
      jobTitle: c.jobTitle || "",
      team: c.team || "",
      forTeam: c.forTeam || "",
      description: (c.description || "").replace(/\n/g, " "),
      amount:
        typeof c.amount === "number" ? c.amount.toFixed(2) : c.amount || "",
      revenue:
        typeof c.revenue === "number" ? c.revenue.toFixed(2) : c.revenue || "",
      takeHome:
        typeof c.takeHome === "number"
          ? c.takeHome.toFixed(2)
          : c.takeHome || "",
      biWeekStart: c.biWeekStart || "",
      biWeekEnd: c.biWeekEnd || "",
      biWeekKey: c.biWeekKey || "",
    }));

    const headers = Object.keys(
      rows[0] || {
        name: "",
        employeeId: "",
        jobTitle: "",
        team: "",
        forTeam: "",
        description: "",
        amount: "",
        revenue: "",
        takeHome: "",
        biWeekStart: "",
        biWeekEnd: "",
        biWeekKey: "",
      }
    );

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const filename = `cfo_all_teams_${format(
      biWeek.startDate,
      "yyyy-MM-dd"
    )}_to_${format(biWeek.endDate, "yyyy-MM-dd")}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selected = employees.find((emp) => emp.name === form.name);
    if (!selected) return;

    const amount = parseFloat(form.amount || "0");
    if (!amount || amount <= 0) return;

    const forTeam = form.forTeam;
    const biWeekRange = {
      biWeekStart: biWeek.startDate.toISOString(),
      biWeekEnd: biWeek.endDate.toISOString(),
      biWeekKey: biWeek.key,
    };

    const ceo = findByTitle(employees, "ceo", "C-suite");
    const coo = findByTitle(employees, "coo", "C-suite");
    const cfo = findByTitle(employees, "cfo", "C-suite");
    const company = findByTitle(employees, "company", "C-suite");
    const salesLead = findByTitle(employees, "sales lead", "Sales Team");
    const salesManager = findByTitle(employees, "sales manager", "Sales Team");
    const streamLead = findByTitle(
      employees,
      "streaming growth & partnerships lead",
      "Streamer Team"
    );
    const videoLead = findVideoContentLead(employees);
    const contentLead = findByTitle(
      employees,
      "vp of content operations",
      "Content Team"
    );

    const payCSuite = async (pool, note) => {
      if (ceo)
        await addCard({
          forTeam,
          biWeekRange,
          employee: ceo,
          description: note,
          takeHome: pct(pool, 0.6),
        });
      if (coo)
        await addCard({
          forTeam,
          biWeekRange,
          employee: coo,
          description: note,
          takeHome: pct(pool, 0.2),
        });
      if (cfo)
        await addCard({
          forTeam,
          biWeekRange,
          employee: cfo,
          description: note,
          takeHome: pct(pool, 0.1),
        });
      if (company)
        await addCard({
          forTeam,
          biWeekRange,
          employee: company,
          description: note,
          takeHome: pct(pool, 0.1),
        });
    };

    let submitterTake = 0;

    if (forTeam === "Sales Team") {
      const isSalesManager = salesManager && selected.id === salesManager.id;
      if (isSalesManager) {
        submitterTake = pct(amount, 0.2);
        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: submitterTake,
        });
        if (salesLead) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: salesLead,
            description: `10% from ${selected.name} (Sales Team)`,
            takeHome: pct(amount, 0.1),
          });
        }
        await payCSuite(
          pct(amount, 0.7),
          `C-suite share from ${selected.name} (Sales Team)`
        );
      } else {
        submitterTake = pct(amount, 0.3);
        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: submitterTake,
        });
        const remaining = pct(amount, 0.7);
        if (salesLead) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: salesLead,
            description: `Sales split from ${selected.name}`,
            takeHome: pct(remaining, 0.1),
          });
        }
        if (salesManager) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: salesManager,
            description: `Sales split from ${selected.name}`,
            takeHome: pct(remaining, 0.2),
          });
        }
        await payCSuite(
          pct(remaining, 0.7),
          `C-suite share from ${selected.name} (Sales Team)`
        );
      }
    } else if (forTeam === "Streamer Team") {
      const onStreamerTeam = isOnTeam(selected, "Streamer Team");
      if (onStreamerTeam) {
        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: 0,
        });
        const teamPot = pct(amount, 0.3);
        if (streamLead) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: streamLead,
            description: `Streamer team pot from ${selected.name}`,
            takeHome: pct(teamPot, 0.1),
          });
        }
        if (videoLead) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: videoLead,
            description: `Streamer team pot from ${selected.name}`,
            takeHome: pct(teamPot, 0.9),
          });
        }
        await payCSuite(
          pct(amount, 0.7),
          `C-suite share from ${selected.name} (Streamer Team)`
        );
      } else {
        submitterTake = pct(amount, 0.3);
        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: submitterTake,
        });
        const remaining = pct(amount, 0.7);
        if (streamLead) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: streamLead,
            description: `Streamer split from ${selected.name}`,
            takeHome: pct(remaining, 0.1),
          });
        }
        if (videoLead) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: videoLead,
            description: `Streamer split from ${selected.name}`,
            takeHome: pct(remaining, 0.2),
          });
        }
        await payCSuite(
          pct(remaining, 0.7),
          `C-suite share from ${selected.name} (Streamer Team)`
        );
      }
    } else if (forTeam === "Content Team") {
      const onContentTeam = isOnTeam(selected, "Content Team");
      if (onContentTeam) {
        submitterTake = pct(amount, 0.3);
        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: submitterTake,
        });
        await payCSuite(
          pct(amount, 0.7),
          `C-suite share from ${selected.name} (Content Team)`
        );
      } else {
        submitterTake = pct(amount, 0.3);
        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: submitterTake,
        });
        const remaining = pct(amount, 0.7);
        if (contentLead) {
          await addCard({
            forTeam,
            biWeekRange,
            employee: contentLead,
            description: `Content split from ${selected.name}`,
            takeHome: pct(remaining, 0.3),
          });
        }
        await payCSuite(
          pct(remaining, 0.7),
          `C-suite share from ${selected.name} (Content Team)`
        );
      }
    } else if (forTeam === "C-suite") {
      const onCSuite = isOnTeam(selected, "C-suite");
      if (onCSuite) {
        let submitterShare = 0;
        if (findByTitle(employees, "ceo", "C-suite")?.id === selected.id)
          submitterShare = pct(amount, 0.6);
        else if (findByTitle(employees, "coo", "C-suite")?.id === selected.id)
          submitterShare = pct(amount, 0.2);
        else if (findByTitle(employees, "cfo", "C-suite")?.id === selected.id)
          submitterShare = pct(amount, 0.1);
        else if (
          findByTitle(employees, "company", "C-suite")?.id === selected.id
        )
          submitterShare = pct(amount, 0.1);

        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: submitterShare,
        });

        const ceo2 = findByTitle(employees, "ceo", "C-suite");
        const coo2 = findByTitle(employees, "coo", "C-suite");
        const cfo2 = findByTitle(employees, "cfo", "C-suite");
        const company2 = findByTitle(employees, "company", "C-suite");

        if (ceo2 && selected.id !== ceo2.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: ceo2,
            description: `C-suite split from ${selected.name}`,
            takeHome: pct(amount, 0.6),
          });
        if (coo2 && selected.id !== coo2.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: coo2,
            description: `C-suite split from ${selected.name}`,
            takeHome: pct(amount, 0.2),
          });
        if (cfo2 && selected.id !== cfo2.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: cfo2,
            description: `C-suite split from ${selected.name}`,
            takeHome: pct(amount, 0.1),
          });
        if (company2 && selected.id !== company2.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: company2,
            description: `C-suite split from ${selected.name}`,
            takeHome: pct(amount, 0.1),
          });
      } else {
        submitterTake = pct(amount, 0.3);
        await addCard({
          forTeam,
          biWeekRange,
          employee: selected,
          description: form.description,
          amount,
          revenue: amount,
          takeHome: submitterTake,
        });
        await payCSuite(
          pct(amount, 0.7),
          `C-suite share from ${selected.name} (C-suite target)`
        );
      }
    }

    setForm({ name: "", description: "", amount: "", forTeam: "" });
  };

  const displayEmployees = employees.filter((e) => e.team === activeTab);

  // NEW: derive all-time revenue across ALL cards (live updates via onSnapshot)
  const allTimeRevenue = useMemo(
    () =>
      cards.reduce((sum, c) => {
        const r = Number(c.revenue);
        return sum + (isNaN(r) ? 0 : r);
      }, 0),
    [cards]
  );

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* NEW: All-time Team Revenue metric (live) */}
        <div
          style={{
            width: "100%",
            background: "#0f172a",
            color: "white",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          }}
          aria-live="polite"
        >
          <div style={{ fontWeight: 600, opacity: 0.9 }}>
            All-time Team Revenue
          </div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {fmtCurrency(allTimeRevenue)}
          </div>
        </div>

        <h2 style={{ textAlign: "center" }}>Revenue Log</h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            onClick={handlePrev}
            disabled={prevDisabled}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: prevDisabled ? "#eee" : "#fff",
              cursor: prevDisabled ? "not-allowed" : "pointer",
            }}
            aria-label="Previous bi-week"
            title="Previous bi-week"
          >
            ◀
          </button>
          <p style={{ fontStyle: "italic", margin: 0 }}>
            Bi-weekly period:{" "}
            <strong>
              {biWeek.start} – {biWeek.end}
            </strong>
          </p>
          <button
            onClick={handleNext}
            disabled={nextDisabled}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: nextDisabled ? "#eee" : "#fff",
              cursor: nextDisabled ? "not-allowed" : "pointer",
            }}
            aria-label="Next bi-week"
            title="Next bi-week"
          >
            ▶
          </button>

          <button
            onClick={downloadCSV}
            style={{
              marginLeft: 8,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #0070f3",
              background: "#0070f3",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
            title="Download ALL teams for this bi-week"
          >
            Download CSV (All teams)
          </button>
        </div>

        <Tabs
          teamTabs={teamTabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "16px",
          }}
        >
          {displayEmployees.map((emp) => {
            const matchedCards = cards.filter(
              (c) => c.employeeId === emp.id && inCurrentBiWeek(c)
            );
            const totalRevenue = matchedCards.reduce(
              (sum, c) => sum + (Number(c.revenue) || 0),
              0
            );
            const totalTakeHome = matchedCards.reduce(
              (sum, c) => sum + (Number(c.takeHome) || 0),
              0
            );

            return (
              <Card
                key={emp.id}
                name={emp.name}
                jobTitle={emp.jobTitle}
                revenue={totalRevenue}
                takeHome={totalTakeHome}
              />
            );
          })}
        </div>

        <hr
          style={{
            width: "100%",
            margin: "40px 0",
            border: "none",
            borderTop: "1px solid #ccc",
          }}
        />

        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: "500px",
            width: "100%",
            padding: "24px",
            background: "#fafafa",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ marginBottom: "16px", textAlign: "center" }}>
            Documenting your Revenue
          </h3>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>Name</label>
            <select
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
            >
              <option value="">Select</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} — {emp.jobTitle}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>
              What team are you making money for?
            </label>
            <select
              value={form.forTeam}
              onChange={(e) => setForm({ ...form, forTeam: e.target.value })}
              required
              style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
            >
              <option value="">Select team</option>
              {forTeamOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows="3"
              required
              style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>
              Dollar Amount
            </label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span
                style={{
                  padding: "8px",
                  background: "#eee",
                  borderRadius: "4px 0 0 4px",
                }}
              >
                $
              </span>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
                style={{
                  flex: 1,
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "0 4px 4px 0",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: "10px 20px",
              background: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
