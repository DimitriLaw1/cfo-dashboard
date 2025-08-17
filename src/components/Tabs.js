import React from "react";

const Tabs = ({ teamTabs, activeTab, setActiveTab }) => {
  return (
    <div
      style={{
        marginBottom: "24px",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        justifyContent: "center",
      }}
    >
      {teamTabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            padding: "10px 16px",
            backgroundColor: activeTab === tab ? "#0070f3" : "#eaeaea",
            color: activeTab === tab ? "#fff" : "#333",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
