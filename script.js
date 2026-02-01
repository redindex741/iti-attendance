/* =======================
   Firebase imports
======================= */
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/* =======================
   Firebase instances
======================= */
const auth = window.firebaseAuth;
const db = window.firebaseDb;

/* =======================
   UI Elements
======================= */
const loginContainer = document.getElementById("loginContainer");
const appContainer = document.querySelector(".container");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginError = document.getElementById("loginError");

/* =======================
   Helpers
======================= */
function getToday() {
  const now = new Date();
  const offsetMs = 5.5 * 60 * 60 * 1000; // IST
  return new Date(now.getTime() + offsetMs)
    .toISOString()
    .slice(0, 10);
}

async function checkUserRole() {
  const user = auth.currentUser;
  if (!user) return false;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return false;

  const role = snap.data().role;
  return role === "admin" || role === "teacher";
}

async function guardStaff(action) {
  const ok = await checkUserRole();
  if (!ok) {
    alert("Permission denied");
    return;
  }
  await action();
}

/* =======================
   AUTH
======================= */
loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("email").value.trim(),
      document.getElementById("password").value.trim()
    );
    loginError.style.display = "none";
  } catch (e) {
    loginError.textContent = e.message;
    loginError.style.display = "block";
  }
};

logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginContainer.style.display = "flex";
    appContainer.style.display = "none";
    logoutBtn.style.display = "none";
    return;
  }

  const allowed = await checkUserRole();
  if (!allowed) {
    alert("Access denied. Teachers/Admins only.");
    await signOut(auth);
    return;
  }

  loginContainer.style.display = "none";
  appContainer.style.display = "block";
  logoutBtn.style.display = "inline-block";

  document.getElementById("currentDate").textContent =
    new Date().toLocaleDateString("en-IN");

  await loadTrades();
  await showStudentsList();
});

/* =======================
   TRADES
======================= */
async function loadTrades() {
  const selectors = [
    document.getElementById("tradeSelector"),
    document.getElementById("studentTrade"),
    document.getElementById("recordsTradeSelector")
  ];

  selectors.forEach(s => {
    if (!s) return;
    while (s.options.length > 1) s.remove(1);
  });

  const snap = await getDocs(collection(db, "trades"));
  snap.forEach(d => {
    selectors.forEach(s => {
      if (!s) return;
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.data().name} (${d.id})`;
      s.appendChild(opt);
    });
  });
}

window.addTrade = () =>
  guardStaff(async () => {
    const name = newTradeName.value.trim();
    const code = newTradeCode.value.trim().toUpperCase();
    if (!name || !code) return alert("Fill all fields");

    await setDoc(doc(db, "trades", code), { name, code });
    await loadTrades();
    alert("Trade added");
  });

/* =======================
   STUDENTS
======================= */
window.addStudent = () =>
  guardStaff(async () => {
    await setDoc(doc(collection(db, "students")), {
      tradeCode: studentTrade.value,
      name: newStudentName.value.trim(),
      year: newStudentYear.value,
      mobile: newStudentMobile.value.trim(),
      admission: newStudentAdmission.value.trim(),
      shift: newStudentShift.value,
      unit: newStudentUnit.value.trim()
    });
    await showStudentsList();
    alert("Student added");
  });

window.removeStudent = (id) =>
  guardStaff(async () => {
    if (!confirm("Delete this student?")) return;
    await deleteDoc(doc(db, "students", id));
    await showStudentsList();
  });

/* =======================
   ATTENDANCE
======================= */
window.markAttendance = (trade, index, status) =>
  guardStaff(async () => {
    const ref = doc(db, "attendance", `${trade}_${getToday()}`);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data().data : [];
    data[index] = status;
    await setDoc(ref, { data });
    await showStudentsList();
  });

/* =======================
   UI DISPLAY
======================= */
async function showStudentsList() {
  const trade = document.getElementById("tradeSelector").value;
  const list = document.getElementById("studentsList");
  list.innerHTML = "";

  let students = [];
  let q = trade
    ? query(collection(db, "students"), where("tradeCode", "==", trade))
    : collection(db, "students");

  const snap = await getDocs(q);
  snap.forEach(d => students.push({ id: d.id, ...d.data() }));

  const attSnap = await getDoc(
    doc(db, "attendance", `${trade}_${getToday()}`)
  );
  const att = attSnap.exists() ? attSnap.data().data : [];

  students.forEach((s, i) => {
    const li = document.createElement("li");
    li.className = "student-item " + (att[i] || "");
    li.innerHTML = `
      <b>${s.name}</b> (${s.tradeCode || ""})
      <div>
        <button onclick="markAttendance('${trade}',${i},'present')">P</button>
        <button onclick="markAttendance('${trade}',${i},'absent')">A</button>
        <button onclick="markAttendance('${trade}',${i},'leave')">L</button>
        <button onclick="removeStudent('${s.id}')">Delete</button>
      </div>`;
    list.appendChild(li);
  });
}
