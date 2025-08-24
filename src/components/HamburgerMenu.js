import React from "react";

export default function HamburgerMenu({
  open,
  onClose,
  sections,
  activeSection,
  onSelect,
}) {
  return (
    <>
      {open && <div className="overlay" onClick={onClose} />}
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-header">
          <span className="drawer-title">Menu</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <nav className="drawer-nav">
          {sections.map((s) => (
            <button
              key={s}
              className={`drawer-link ${activeSection === s ? "active" : ""}`}
              onClick={() => onSelect(s)}
            >
              {s}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
