import React, { useState, useEffect } from "react";
import Card from "./components/Card";
import Tabs from "./components/Tabs";
import {
  db,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
} from "./firebase";
import { startOfWeek, addDays, format } from "date-fns";

const teamTabs = ["Content Team", "Sales Team", "Streamer Team", "C-suite"];
const forTeamOptions = [
  "Sales Team",
  "Streamer Team",
  "C-suite",
  "Content Team",
];

// ---- Bi-week utilities ----
const FIRST_BIWEEK_START = new Date(2025, 6, 28); // Jul 28, 2025 (months 0-based)

function getCurrentBiWeekStart() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const secondWeekStart = addDays(weekStart, 7);
  return now.getTime() >= secondWeekStart.getTime()
    ? secondWeekStart
    : weekStart;
}

function biWeekFromStart(startDate) {
  const s = new Date(startDate);
  const e = addDays(s, 13);
  return {
    start: format(s, "MMM d"),
    end: format(e, "MMM d, yyyy"),
    startDate: s,
    endDate: e,
  };
}

// --- Helpers for role lookups & math ---
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

function titleIs(employee, target) {
  return String(employee.jobTitle || "").toLowerCase() === target.toLowerCase();
}

// Accept both the current and former title for the video lead
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

export default function App() {
  const [activeTab, setActiveTab] = useState(teamTabs[0]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    amount: "",
    forTeam: "",
  });
  const [employees, setEmployees] = useState([]);
  const [cards, setCards] = useState([]);

  // View state for navigating bi-weeks
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
      const s = new Date(c.biWeekStart);
      const e = new Date(c.biWeekEnd);
      return (
        s.getTime() >= biWeek.startDate.getTime() &&
        e.getTime() <= biWeek.endDate.getTime()
      );
    } catch {
      return false;
    }
  };

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

  const prevDisabled = viewStartDate.getTime() <= FIRST_BIWEEK_START.getTime();
  const nextDisabled = viewStartDate.getTime() >= currentStart.getTime();

  // ✅ UPDATED: export ALL teams' rows for the current bi-week (ignores activeTab)
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
    };

    // Common role refs
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

    // Helper: distribute to C-suite 60/20/10/10 from a pool
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

    // ===== SALES TEAM =====
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
    }

    // ===== STREAMER TEAM =====
    else if (forTeam === "Streamer Team") {
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
    }

    // ===== CONTENT TEAM =====
    else if (forTeam === "Content Team") {
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
    }

    // ===== C-SUITE =====
    else if (forTeam === "C-suite") {
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

        const ceo = findByTitle(employees, "ceo", "C-suite");
        const coo = findByTitle(employees, "coo", "C-suite");
        const cfo = findByTitle(employees, "cfo", "C-suite");
        const company = findByTitle(employees, "company", "C-suite");

        if (ceo && selected.id !== ceo.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: ceo,
            description: `C-suite split from ${selected.name}`,
            takeHome: pct(amount, 0.6),
          });
        if (coo && selected.id !== coo.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: coo,
            description: `C-suite split from ${selected.name}`,
            takeHome: pct(amount, 0.2),
          });
        if (cfo && selected.id !== cfo.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: cfo,
            description: `C-suite split from ${selected.name}`,
            takeHome: pct(amount, 0.1),
          });
        if (company && selected.id !== company.id)
          await addCard({
            forTeam,
            biWeekRange,
            employee: company,
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
        <h1 style={{ textAlign: "center" }}>CFO Dashboard</h1>

        {/* Bi-week nav + label + download */}
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
            title={`Download ALL teams for this bi-week`}
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
              (sum, c) => sum + (c.revenue || 0),
              0
            );
            const totalTakeHome = matchedCards.reduce(
              (sum, c) => sum + (c.takeHome || 0),
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
          <h2 style={{ marginBottom: "16px", textAlign: "center" }}>
            Documenting your Revenue
          </h2>

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
