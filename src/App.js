import React, { useState } from "react";
import "./App.css";
import HamburgerMenu from "./components/HamburgerMenu";

// Pages
import PaymentDistribution from "./pages/PaymentDistribution";
import SalesLeaderboard from "./pages/SalesLeaderboard";
import ImportantLinks from "./pages/ImportantLinks";
import StreamerDatabase from "./pages/StreamerDatabase";
import MailingListData from "./pages/MailingListData";
import PaymentStructureBreakdown from "./pages/PaymentStructureBreakdown";
import ExpensesTracker from "./pages/ExpensesTracker";

const SECTIONS = [
  "Document your Revenue",
  "Sales Leaderboard",
  "Important Links",
  "Streamer database",
  "Mailing List Data",
  "Payment structure Breakdown",
  "Expenses tracker",
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTIONS[0]);

  const renderPage = () => {
    switch (activeSection) {
      case "Document your Revenue":
        return <PaymentDistribution />;
      case "Sales Leaderboard":
        return <SalesLeaderboard />;
      case "Important Links":
        return <ImportantLinks />;
      case "Streamer database":
        return <StreamerDatabase />;
      case "Mailing List Data":
        return <MailingListData />;
      case "Payment structure Breakdown":
        return <PaymentStructureBreakdown />;
      case "Expenses tracker":
        return <ExpensesTracker />;
      default:
        return <PaymentDistribution />;
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="hamburger-btn"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        <h1 className="app-title">{activeSection}</h1>
      </header>

      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        sections={SECTIONS}
        activeSection={activeSection}
        onSelect={(s) => {
          setActiveSection(s);
          setMenuOpen(false);
        }}
      />

      <main className="app-main">{renderPage()}</main>
    </div>
  );
}
