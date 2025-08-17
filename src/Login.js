import React, { useState } from "react";
import { auth, signInWithEmailAndPassword } from "./firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");

  const styles = {
    form: { maxWidth: 380, margin: "80px auto", padding: 16 },
    input: {
      width: "100%",
      marginBottom: 10,
      padding: 12,
      fontSize: 16, // prevent iOS zoom; consistent height
      boxSizing: "border-box",
      lineHeight: 1.25,
      WebkitAppearance: "none", // normalize iOS
      appearance: "none",
    },
    row: { display: "flex", gap: 8, marginBottom: 10 },
    toggleBtn: {
      padding: "12px 14px",
      fontSize: 16,
      borderRadius: 8,
      border: "1px solid #ccc",
      background: "#f4f4f5",
      cursor: "pointer",
      lineHeight: 1.2,
      WebkitAppearance: "none",
      appearance: "none",
      minHeight: 44, // touch target
    },
    submit: {
      width: "100%",
      display: "block",
      padding: "14px 16px",
      fontSize: 16,
      fontWeight: 600,
      borderRadius: 8,
      border: "1px solid #0070f3",
      background: "#0070f3",
      color: "#fff",
      cursor: "pointer",
      lineHeight: 1.2,
      WebkitAppearance: "none", // normalize iOS default button styling
      appearance: "none",
      minHeight: 44, // ensures it isn't skinny on mobile
      touchAction: "manipulation", // snappier tap
    },
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (e) {
      setErr(e?.message || "Login failed");
    }
  };

  return (
    <form onSubmit={submit} style={styles.form}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>
        CFO Dashboard Login
      </h2>

      <label>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={styles.input}
      />

      <label>Password</label>
      <div style={styles.row}>
        <input
          type={show ? "text" : "password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
          style={styles.input}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={styles.toggleBtn}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}

      <button style={styles.submit} type="submit">
        Sign in
      </button>
    </form>
  );
}
