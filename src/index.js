import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Login from "./Login";
import { auth, onAuthStateChanged, signOut } from "./firebase";

function AuthGate() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!user) return <Login />;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          padding: 8,
        }}
      >
        <span style={{ opacity: 0.7 }}>{user.email}</span>
        <button onClick={() => signOut(auth)}>Sign out</button>
      </div>
      <App />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<AuthGate />);
