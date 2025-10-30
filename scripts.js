// script.js - ES Module Firebase integration

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyAy1RcvyUkexEfFAWX8De3tF01F3X2092w",
  authDomain: "iti-attendance-system-6d54a.firebaseapp.com",
  projectId: "iti-attendance-system-6d54a",
  storageBucket: "iti-attendance-system-6d54a.firebasestorage.app",
  messagingSenderId: "862789334597",
  appId: "1:862789334597:web:f9a135c682afb08662d52c"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentRole = null; // Add roles in Firestore 'users' collection for principal/teacher

// --- UI controls ---
const loginContainer = document.getElementById("loginContainer");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const appContainer = document.querySelector(".container");
const logoutBtn = document.getElementById("logoutBtn");

// --- Auth State ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginContainer.style.display = "none";
    appContainer.style.display = "block";
    logoutBtn.style.display = "inline-block";
    currentUser = user;

    // Load user role from Firestore (optional, recommended for security)
    const userDoc = await getDoc(doc(db, "users", user.uid));
    currentRole = userDoc.exists() ? userDoc.data().role : "teacher";

    document.getElementById("currentDate").textContent = new Date().toLocaleDateString("en-IN");

    await loadTrades();
    await showStudentsList();
  } else {
    loginContainer.style.display = "flex";
    appContainer.style.display = "none";
    logoutBtn.style.display = "none";
    currentUser = null;
    currentRole = null;
  }
});

loginBtn.onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginError.style.display = "none";
  } catch (err) {
    loginError.style.display = "block";
    loginError.textContent = err.message;
  }
};

logoutBtn.onclick = () => {
  signOut(auth);
};

// --- Trades ---
async function loadTrades() {
  const tradeSelector = document.getElementById('tradeSelector');
  const studentTrade = document.getElementById('studentTrade');
  const recordsTradeSelector = document.getElementById('recordsTradeSelector');
  [tradeSelector, studentTrade, recordsTradeSelector].forEach(sel => {
    while (sel.options.length > 1) sel.remove(1);
  });

  const tradesSnapshot = await getDocs(collection(db, 'trades'));
  tradesSnapshot.forEach(docSnap => {
    const trade = docSnap.data();
    addOption(tradeSelector, trade.code, `${trade.name} (${trade.code})`);
    addOption(studentTrade, trade.code, `${trade.name} (${trade.code})`);
    addOption(recordsTradeSelector, trade.code, `${trade.name} (${trade.code})`);
  });
}

function addOption(select, value, text) {
  const opt = document.createElement("option");
  opt.value = value; opt.textContent = text;
  select.appendChild(opt);
}

// --- Students/Attendance ---
async function showStudentsList() {
  const tradeCode = document.getElementById("tradeSelector").value;
  const studentsList = document.getElementById("studentsList");
  studentsList.innerHTML = "";

  if (!tradeCode) { updateSummary([]); return; }
  const studentsQuery = query(collection(db, 'students'), where('tradeCode', '==', tradeCode));
  const studentsSnapshot = await getDocs(studentsQuery);
  const students = [];
  studentsSnapshot.forEach(docSnap => students.push({ id: docSnap.id, ...docSnap.data() }));
  
  const today = getToday();
  const attendanceDoc = await getDoc(doc(db, "attendance", `${tradeCode}_${today}`));
  const attendance = attendanceDoc.exists() ? attendanceDoc.data().data : [];

  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx];
    const item = document.createElement("li");
    item.className = "student-item";
    if (attendance[idx]) item.classList.add(attendance[idx]);
    const locked = await isAttendanceLocked(tradeCode, today);

    item.innerHTML = `
      <div class="student-info">
        <div class="student-name">${student.name}</div>
        <div class="student-details">
          Year: ${student.year}, Mobile: ${student.mobile}, Admission: ${student.admission}, Shift: ${student.shift}, Unit: ${student.unit}
        </div>
      </div>
      <div class="attendance-buttons">
        <button class="attendance-btn btn-present" onclick="markAttendance('${tradeCode}',${idx},'present')" ${locked ? "disabled" : ""}>P</button>
        <button class="attendance-btn btn-absent" onclick="markAttendance('${tradeCode}',${idx},'absent')" ${locked ? "disabled" : ""}>A</button>
        <button class="attendance-btn btn-leave" onclick="markAttendance('${tradeCode}',${idx},'leave')" ${locked ? "disabled" : ""}>L</button>
        <button class="attendance-btn btn-delete" style="background:#e74c3c;color:white;margin-left:10px;" onclick="removeStudent('${student.id}')" ${locked ? 'disabled': ''}>Delete</button>
      </div>
    `;
    studentsList.appendChild(item);
  }
  updateSummary(attendance);
  document.getElementById('submitAttendance').disabled = await isAttendanceLocked(tradeCode, today);
}

async function markAttendance(tradeCode, idx, status) {
  const today = getToday();
  const attendanceRef = doc(db, "attendance", `${tradeCode}_${today}`);
  const attendanceDoc = await getDoc(attendanceRef);
  let attendance = attendanceDoc.exists() ? attendanceDoc.data().data : [];
  attendance[idx] = status;
  await setDoc(attendanceRef, { data: attendance });
  await showStudentsList();
}

async function removeStudent(studentId) {
  if (!confirm("Are you sure you want to delete this student? This cannot be undone.")) return;
  await deleteDoc(doc(db, "students", studentId));
  await showStudentsList();
}

async function isAttendanceLocked(tradeCode, day) {
  const lockDoc = await getDoc(doc(db, "attendanceLocks", `${tradeCode}_${day}`));
  return lockDoc.exists() ? lockDoc.data().locked : false;
}

async function submitAttendance() {
  const tradeCode = document.getElementById("tradeSelector").value;
  const today = getToday();
  await setDoc(doc(db, "attendanceLocks", `${tradeCode}_${today}`), { locked: true });
  alert("Attendance submitted and locked for today!");
  await showStudentsList();
}

function getToday() {
  return new Date().toISOString().slice(0,10);
}

function updateSummary(attendance) {
  document.getElementById("totalStudents").textContent = attendance.length;
  document.getElementById("totalPresent").textContent = attendance.filter(x => x === "present").length;
  document.getElementById("totalAbsent").textContent = attendance.filter(x => x === "absent").length;
  document.getElementById("totalLeave").textContent = attendance.filter(x => x === "leave").length;
}

// --- You need to similarly update addTrade(), addStudent(), showRecords(), etc. to use Firestore instead of localStorage ---
// To allow modular Firebase code, use only 'type="module"' for JS scripts in your HTML

window.showAddTradeForm = function() { document.getElementById('addTradePopup').style.display = 'block'; }
window.showAddStudentForm = function() { document.getElementById('addStudentPopup').style.display = 'block'; }
window.closePopup = function() {
  document.getElementById('addTradePopup').style.display = 'none';
  document.getElementById('addStudentPopup').style.display = 'none';
  ["newTradeName","newTradeCode","newStudentName","newStudentMobile",
   "newStudentAdmission","newStudentUnit","newStudentShift","newStudentYear"].forEach(id=>{
      const el=document.getElementById(id);if(el)el.value='';
   });
}

// Example for adding trade
window.addTrade = async function() {
  const tradeName = document.getElementById("newTradeName").value.trim();
  const tradeCode = document.getElementById("newTradeCode").value.trim().toUpperCase();
  if (!tradeName || !tradeCode) { alert('Please fill all fields'); return; }
  await setDoc(doc(db, "trades", tradeCode), { name: tradeName, code: tradeCode });
  closePopup();
  await loadTrades();
  alert('Trade added successfully');
}

// Example for adding student
window.addStudent = async function() {
  const tradeCode = document.getElementById("studentTrade").value;
  const studentName = document.getElementById("newStudentName").value.trim();
  const studentYear = document.getElementById("newStudentYear").value;
  const studentMobile = document.getElementById("newStudentMobile").value.trim();
  const studentAdmission = document.getElementById("newStudentAdmission").value.trim();
  const studentShift = document.getElementById("newStudentShift").value;
  const studentUnit = document.getElementById("newStudentUnit").value.trim();
  if (!tradeCode || !studentName || !studentMobile || !studentAdmission || !studentShift || !studentUnit || !studentYear)
    { alert('Please fill all required fields'); return; }
  await setDoc(doc(collection(db, "students")), {
    tradeCode,
    name: studentName,
    year: studentYear,
    mobile: studentMobile,
    admission: studentAdmission,
    shift: studentShift,
    unit: studentUnit
  });
  closePopup();
  await showStudentsList();
  alert('Student added successfully');
};

window.toggleReports = function() {
  const attendanceSection = document.getElementById('attendanceSection');
  const recordsSection = document.getElementById('recordsSection');
  if (recordsSection.style.display === 'none') {
    recordsSection.style.display = 'block';
    attendanceSection.style.display = 'none';
  } else {
    recordsSection.style.display = 'none';
    attendanceSection.style.display = 'block';
  }
}

// For records viewing and other advanced features, implement similar Firestore queries.

