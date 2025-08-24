// src/pages/MailingListData.jsx
import React, { useEffect, useMemo, useState } from "react";

/* =================== CONFIG =================== */

// Brand tabs + endpoints (adjust if your function names/regions differ)
const BRAND_TABS = ["HBCU Shaderoom", "PWI Shaderoom"];
const ENDPOINTS = {
  "HBCU Shaderoom":
    "https://us-central1-confession-app-d0966.cloudfunctions.net/listNewsletterContacts",
  "PWI Shaderoom":
    "https://us-central1-pwi-shaderoom.cloudfunctions.net/listNewsletterContacts",
};

// Those three options from your form (used by BOTH brands)
const PREFERENCES = [
  "📢 Job Opportunities (Brand Ambassador, Internships, etc)",
  "🎉 Events/Parties",
  "📢 News Alerts & Tea at your school",
];

// Age buckets we care about
const AGE_BUCKETS = ["17-20", "21-23", "24+", "Unknown"];

/* =================== UTILS =================== */

const fmtNum = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);

const withinLastDays = (iso, days) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const now = Date.now();
  return now - t <= days * 24 * 60 * 60 * 1000;
};

// Robust normalization/contains for OPTIONS (so commas in labels don't break matches)
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const hasPref = (rawOptions, prefLabel) => {
  const target = norm(prefLabel);
  if (Array.isArray(rawOptions)) {
    return rawOptions.some((item) => norm(item).includes(target));
  }
  return norm(rawOptions).includes(target);
};

/* =================== REUSABLE VISUALS =================== */

function Donut({ a, b, labels = ["With IG", "No IG"] }) {
  const total = a + b;
  if (!total) {
    return (
      <div style={{ textAlign: "center", color: "#6b7280" }}>
        No subscribers yet
      </div>
    );
  }
  const size = 140;
  const thickness = 14;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2;
  const C = 2 * Math.PI * r;

  const aLen = (a / total) * C;
  const bLen = (b / total) * C;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#a855f7"
            strokeWidth={thickness}
            strokeDasharray={`${aLen} ${C - aLen}`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#6366f1"
            strokeWidth={thickness}
            strokeDasharray={`${bLen} ${C - bLen}`}
            strokeDashoffset={-aLen}
          />
        </g>
        <text
          x={cx}
          y={cy}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill="#111827"
        >
          {fmtNum(total)}
        </text>
      </svg>
      <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
        <div>
          <span style={legendSwatch("#a855f7")} />
          {labels[0]} • {((a / total) * 100).toFixed(1)}%
        </div>
        <div>
          <span style={legendSwatch("#6366f1")} />
          {labels[1]} • {((b / total) * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

const legendSwatch = (bg) => ({
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: 2,
  marginRight: 6,
  background: bg,
});

// Multi-segment donut for Age distribution
function MultiDonut({ series, size = 220, thickness = 22 }) {
  const total = series.reduce((s, x) => s + x.value, 0);
  if (!total) {
    return (
      <div style={{ textAlign: "center", color: "#6b7280", padding: 20 }}>
        No age data yet.
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
  ];

  let offset = 0;
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        textAlign: "center",
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
          {new Intl.NumberFormat("en-US").format(total)}
        </text>
      </svg>

      {/* legend */}
      <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
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
              <strong>{s.label}</strong> —{" "}
              {new Intl.NumberFormat("en-US").format(s.value)} (
              {((s.value / total) * 100).toFixed(1)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Split bar like “Followers / Non-followers”
function SplitBar({ left, right, total }) {
  const L = total ? (left / total) * 100 : 0;
  const R = total ? (right / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div
          style={{
            height: 10,
            background: "#e5e7eb",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${L}%`,
              height: "100%",
              background: "#a855f7",
              display: "inline-block",
            }}
          />
          <div
            style={{
              width: `${R}%`,
              height: "100%",
              background: "#6366f1",
              display: "inline-block",
            }}
          />
        </div>
      </div>
      <div style={{ width: 60, textAlign: "right", fontWeight: 600 }}>
        {((total ? left / total : 0) * 100).toFixed(1)}%
      </div>
    </div>
  );
}

/* =================== PAGE =================== */

export default function MailingListData() {
  // Brand toggle
  const [brand, setBrand] = useState(BRAND_TABS[0]); // "HBCU Shaderoom" | "PWI Shaderoom"

  // Data/UI state
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [range, setRange] = useState("30d"); // '30d' | 'all'
  const [aud, setAud] = useState("all"); // 'all' | 'withIG' | 'noIG'

  // Pagination
  const pageSizeOptions = [10, 25, 50, 100];
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Fetch contacts for selected brand (cache-busting + debug)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const url = ENDPOINTS[brand];
        console.log("[MailingListData] fetching:", url);
        const res = await fetch(`${url}?t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${txt || ""}`.trim());
        }
        const json = await res.json();
        if (alive) {
          setContacts(json.contacts || []);
          console.log(
            "[MailingListData] loaded rows:",
            Array.isArray(json.contacts) ? json.contacts.length : 0,
            "meta:",
            json.meta || {}
          );
        }
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load mailing list");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [brand]);

  // filter by time range
  const rangeFiltered = useMemo(() => {
    if (range === "all") return contacts;
    return contacts.filter((c) => withinLastDays(c.createdAt, 30));
  }, [contacts, range]);

  // audience filter
  const filtered = useMemo(() => {
    const hasIGAttr = (c) => {
      const ig = String(c?.attributes?.INSTAGRAM || "")
        .trim()
        .toLowerCase();
      return ig && ig !== "n/a";
    };
    if (aud === "withIG") return rangeFiltered.filter(hasIGAttr);
    if (aud === "noIG") return rangeFiltered.filter((c) => !hasIGAttr(c));
    return rangeFiltered;
  }, [rangeFiltered, aud]);

  // Reset pagination when filters/data/brand change
  useEffect(() => {
    setPage(1);
  }, [range, aud, contacts, pageSize, brand]);

  // metrics
  const total = filtered.length;
  const withIG = filtered.filter((c) => {
    const ig = String(c?.attributes?.INSTAGRAM || "")
      .trim()
      .toLowerCase();
    return ig && ig !== "n/a";
  }).length;
  const noIG = total - withIG;
  const activeEmails = filtered.filter((c) => !c.emailBlacklisted).length;

  // “By preference”
  const perPref = useMemo(() => {
    return PREFERENCES.map((p) => {
      let withCnt = 0;
      let withoutCnt = 0;
      let totalCnt = 0;

      for (const c of filtered) {
        const raw = c?.attributes?.OPTIONS; // could be string/array/JSON-like
        if (hasPref(raw, p)) {
          totalCnt++;
          const ig = norm(c?.attributes?.INSTAGRAM);
          if (ig && ig !== "n/a") withCnt++;
          else withoutCnt++;
        }
      }

      return {
        label: p.replace(/^📢 |^🎉 /, ""),
        withCnt,
        withoutCnt,
        totalCnt,
      };
    });
  }, [filtered]);

  // Age distribution series
  const ageSeries = useMemo(() => {
    const counts = new Map(AGE_BUCKETS.map((a) => [a, 0]));
    for (const c of filtered) {
      const raw = String(c?.attributes?.AGE_RANGE || "").trim();
      const bucket = AGE_BUCKETS.includes(raw) ? raw : raw ? raw : "Unknown";
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }
    return AGE_BUCKETS.map((label) => ({
      label,
      value: counts.get(label) || 0,
    })).filter((s) => s.value > 0);
  }, [filtered]);

  // CSV download (filtered set)
  const downloadCSV = () => {
    const headers = [
      "email",
      "createdAt",
      "SCHOOL",
      "OPTIONS",
      "MAJOR",
      "CLASSIFICATION",
      "AGE_RANGE",
      "INSTAGRAM",
      "emailBlacklisted",
    ];
    const rows = filtered.map((c) => ({
      email: c.email || "",
      createdAt: c.createdAt || "",
      SCHOOL: c.attributes?.SCHOOL || "",
      OPTIONS: c.attributes?.OPTIONS || "",
      MAJOR: c.attributes?.MAJOR || "",
      CLASSIFICATION: c.attributes?.CLASSIFICATION || "",
      AGE_RANGE: c.attributes?.AGE_RANGE || "",
      INSTAGRAM: c.attributes?.INSTAGRAM || "",
      emailBlacklisted: String(c.emailBlacklisted || false),
    }));
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) =>
          headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mailing_list_${brand
      .replace(/\s+/g, "-")
      .toLowerCase()}_${range}_${aud}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pagedRows = filtered.slice(startIdx, endIdx);
  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Header / Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>Mailing List Analytics</h2>

        {/* Brand toggle */}
        <div
          style={{
            display: "inline-flex",
            background: "#f3f4f6",
            borderRadius: 8,
            padding: 4,
          }}
        >
          {BRAND_TABS.map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              style={chip(brand === b)}
              title={`Switch to ${b}`}
            >
              {b}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={downloadCSV} disabled={!total}>
            Download CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 12,
          marginBottom: 12,
        }}
      >
        {/* date range */}
        <div
          style={{
            display: "inline-flex",
            background: "#f3f4f6",
            borderRadius: 8,
            padding: 4,
          }}
        >
          <button onClick={() => setRange("30d")} style={chip(range === "30d")}>
            Last 30 days
          </button>
          <button onClick={() => setRange("all")} style={chip(range === "all")}>
            All time
          </button>
        </div>

        {/* audience filter */}
        <div
          style={{
            display: "inline-flex",
            background: "#f3f4f6",
            borderRadius: 8,
            padding: 4,
          }}
        >
          <button onClick={() => setAud("all")} style={chip(aud === "all")}>
            All
          </button>
          <button
            onClick={() => setAud("withIG")}
            style={chip(aud === "withIG")}
          >
            With IG
          </button>
          <button onClick={() => setAud("noIG")} style={chip(aud === "noIG")}>
            No IG
          </button>
        </div>
      </div>

      {/* Top metrics (Sign-ups + IG split + Active emails) */}
      <div
        className="links-card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
            {brand} • source: {ENDPOINTS[brand].split("//")[1].split(".")[0]}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{fmtNum(total)}</div>
          <div style={{ color: "#6b7280" }}>Subscribers</div>
        </div>

        <Donut a={withIG} b={noIG} labels={["With IG", "No IG"]} />

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {fmtNum(activeEmails)}
          </div>
          <div style={{ color: "#6b7280" }}>Active emails</div>
        </div>
      </div>

      {/* Age Distribution — KEY METRIC */}
      <div className="links-card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, textAlign: "center", width: "100%" }}>
            Age distribution
          </h3>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MultiDonut series={ageSeries} />
        </div>
      </div>

      {/* By preference */}
      <div className="links-card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0 }}>By preference</h3>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            <span style={legendSwatch("#a855f7")} /> With IG &nbsp;&nbsp;
            <span style={legendSwatch("#6366f1")} /> No IG
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {perPref.map((row) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 56px",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "left", fontWeight: 600 }}>
                {row.label}
              </div>
              <SplitBar
                left={row.withCnt}
                right={row.withoutCnt}
                total={row.totalCnt || 1}
              />
              <div
                style={{
                  textAlign: "right",
                  color: "#111827",
                  fontWeight: 700,
                }}
              >
                {((total ? row.totalCnt / total : 0) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="links-card" style={{ marginTop: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Created</th>
                <th>School</th>
                <th>Preferences</th>
                <th>Major</th>
                <th>Class.</th>
                <th>Age</th>
                <th>Instagram</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: "center", color: "#6b7280" }}
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && err && (
                <tr>
                  <td
                    colSpan={9}
                    style={{ color: "#991b1b", background: "#fee2e2" }}
                  >
                    {err}
                  </td>
                </tr>
              )}
              {!loading && !err && pagedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: "center", color: "#6b7280" }}
                  >
                    No subscribers match this filter.
                  </td>
                </tr>
              )}
              {!loading &&
                !err &&
                pagedRows.map((c) => (
                  <tr key={c.id || c.email}>
                    <td>{c.email}</td>
                    <td>
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{c.attributes?.SCHOOL || "—"}</td>
                    <td
                      style={{
                        maxWidth: 260,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.attributes?.OPTIONS || "—"}
                    </td>
                    <td>{c.attributes?.MAJOR || "—"}</td>
                    <td>{c.attributes?.CLASSIFICATION || "—"}</td>
                    <td>{c.attributes?.AGE_RANGE || "—"}</td>
                    <td>{c.attributes?.INSTAGRAM || "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      {c.emailBlacklisted ? "❌" : "✅"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <PaginationFooter
          total={total}
          pageSize={pageSize}
          setPageSize={setPageSize}
          pageSizeOptions={pageSizeOptions}
          safePage={safePage}
          totalPages={totalPages}
          startIdx={startIdx}
          endIdx={endIdx}
          canPrev={canPrev}
          canNext={canNext}
          setPage={setPage}
        />
      </div>
    </div>
  );
}

function PaginationFooter({
  total,
  pageSize,
  setPageSize,
  pageSizeOptions,
  safePage,
  totalPages,
  startIdx,
  endIdx,
  canPrev,
  canNext,
  setPage,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingTop: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#6b7280", fontSize: 14 }}>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={{
            padding: "6px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
          }}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          {total === 0
            ? "0–0 of 0"
            : `${startIdx + 1}–${endIdx} of ${fmtNum(total)}`}
        </div>
        <div style={{ display: "inline-flex", gap: 6 }}>
          <button
            onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            aria-label="Previous page"
            style={pagerBtn(!canPrev)}
            title="Previous page"
          >
            ◀
          </button>
          <button
            onClick={() =>
              canNext && setPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={!canNext}
            aria-label="Next page"
            style={pagerBtn(!canNext)}
            title="Next page"
          >
            ▶
          </button>
        </div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          Page {safePage} / {totalPages}
        </div>
      </div>
    </div>
  );
}

/* =================== STYLES =================== */

const chip = (active) => ({
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid transparent",
  background: active ? "#ffffff" : "transparent",
  cursor: "pointer",
});

const pagerBtn = (disabled) => ({
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  background: disabled ? "#f3f4f6" : "#ffffff",
  cursor: disabled ? "not-allowed" : "pointer",
});
