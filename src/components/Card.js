import React from "react";

const Card = ({ name, jobTitle, revenue, takeHome }) => {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        width: "200px",
        background: "#fff",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>
        {jobTitle}
      </p>

      <h3 style={{ margin: "0 0 4px 0" }}>{name}</h3>

      <div style={{ marginBottom: "4px" }}>
        Total Revenue Earned: <p style={{ fontWeight: "bold" }}>${revenue}</p>
      </div>
      <div style={{}}>
        Total Take Home Pay:
        <p style={{ color: "#0070f3", fontWeight: "bold" }}>
          ${Number(takeHome).toFixed(2)}
        </p>{" "}
      </div>
    </div>
  );
};

export default Card;
