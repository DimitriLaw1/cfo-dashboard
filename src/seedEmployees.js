import { db, collection, addDoc } from "./firebase";

// Hardcoded employee list
const employees = [
  { name: "Meech", jobTitle: "CEO", team: "C-suite" },
  { name: "Nya", jobTitle: "COO", team: "C-suite" },
  { name: "Tosh", jobTitle: "Content Manager", team: "Content Team" },
  { name: "Chris", jobTitle: "Streamer", team: "Streamer Team" },
  { name: "Jesy", jobTitle: "Streamer", team: "Streamer Team" },
  { name: "Bri", jobTitle: "Sales Lead", team: "Sales Team" },
  { name: "Caylin", jobTitle: "Sales Coordinator", team: "Sales Team" },
  { name: "sales manager 3", jobTitle: "Sales Manager", team: "Sales Team" },
  { name: "Sales manager 4", jobTitle: "Sales Manager", team: "Sales Team" },
];

// Seed function
const seedEmployees = async () => {
  try {
    for (let emp of employees) {
      await addDoc(collection(db, "employees"), emp);
    }
    console.log("✅ Employees seeded successfully!");
  } catch (err) {
    console.error("🔥 Error seeding employees:", err);
  }
};

seedEmployees();
