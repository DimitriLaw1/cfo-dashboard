import { db, collection, addDoc } from "./firebase";

const employees = [
  { name: "Meech", jobTitle: "CEO", team: "C-suite" },
  { name: "Nya", jobTitle: "COO", team: "C-suite" },
  { name: "Tosh", jobTitle: "Content Manager", team: "Content Team" },
  { name: "Chris", jobTitle: "Streamer", team: "Streamer Team" },
  { name: "Jesy", jobTitle: "Streaming Growth & Partnerships Lead", team: "Streamer Team" },
  { name: "Bri", jobTitle: "Sales Lead", team: "Sales Team" },
  { name: "Caylin", jobTitle: "Sales Coordinator", team: "Sales Team" },
  { name: "sales manager 3", jobTitle: "Sales Manager", team: "Sales Team" },
  { name: "Sales manager 4", jobTitle: "Sales Manager", team: "Sales Team" },
];

export const seedEmployees = async () => {
  const employeesRef = collection(db, "employees");
  try {
    for (let emp of employees) {
      await addDoc(employeesRef, emp);
    }
    console.log("✅ Seeded employees");
  } catch (err) {
    console.error("❌ Seed error", err);
  }
};
