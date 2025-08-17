import React, { useState } from "react";
import { auth, signInWithEmailAndPassword } from "./firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");

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
    <form
      onSubmit={submit}
      style={{ maxWidth: 380, margin: "80px auto", padding: 16 }}
    >
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>
        CFO Dashboard Login
      </h2>
      <label>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{ width: "100%", marginBottom: 10, padding: 8 }}
      />
      <label>Password</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type={show ? "text" : "password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
          style={{ flex: 1, padding: 8 }}
        />
        <button type="button" onClick={() => setShow((s) => !s)}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}
      <button style={{ width: "100%", padding: 10 }} type="submit">
        Sign in
      </button>
    </form>
  );
}
