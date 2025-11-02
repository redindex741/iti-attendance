import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const auth = window.firebaseAuth;
const db = window.firebaseDb;

// UI elements (always outside functions)
const loginContainer = document.getElementById('loginContainer');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const appContainer = document.querySelector('.container');
const logoutBtn = document.getElementById('logoutBtn');

// Utility
function toIsoDate(dateStr) { if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/'); if (parts.length === 3) {
  const m = parts[0].padStart(2, '0'); const d = parts[1].padStart(2, '0'); const y = parts[2];
  return `${y}-${m}-${d}`; } return dateStr; }
function getToday() { const now = new Date(); const offsetMs = 5.5 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs); return local.toISOString().slice(0, 10); }

// Expose all required functions on window
window.showAddTradeForm = function() {
  document.getElementById('addTradePopup').style.display = 'flex';
};
window.showAddStudentForm = function() {
  document.getElementById('addStudentPopup').style.display = 'flex';
};
window.closePopup = function() {
  document.getElementById('addTradePopup').style.display = 'none';
  document.getElementById('addStudentPopup').style.display = 'none';
  document.getElementById('removeTradePopup').style.display = 'none';
};
window.toggleReports = function() {
  const recSec = document.getElementById('recordsSection');
  recSec.style.display = recSec.style.display === 'block' ? 'none' : 'block';
};
window.showRemoveTradeForm = async function() {
  document.getElementById('removeTradePopup').style.display = 'flex';
  const select = document.getElementById('removeTradeSelector');
  select.innerHTML = '<option value="">Choose Trade</option>';
  const tradesSnapshot = await getDocs(collection(db, 'trades'));
  tradesSnapshot.forEach(docSnap => {
    const trade = docSnap.data();
    const opt = document.createElement("option");
    opt.value = docSnap.id; opt.textContent = `${trade.name} (${trade.code})`;
    select.appendChild(opt); });
};
window.removeTrade = async function() {
  const tradeCode = document.getElementById('removeTradeSelector').value;
  if (!tradeCode) return alert('Please select a trade to remove.');
  if (!confirm("Are you sure you want to delete this trade and ALL students/attendance for it?")) return;
  await deleteDoc(doc(db, "trades", tradeCode));
  const studentsQuery = query(collection(db, "students"), where("tradeCode", "==", tradeCode));
  const studentsSnapshot = await getDocs(studentsQuery);
  for (const studentDoc of studentsSnapshot.docs) { await deleteDoc(doc(db, "students", studentDoc.id)); }
  const attendanceSnapshot = await getDocs(collection(db, "attendance"));
  for (const attDoc of attendanceSnapshot.docs) { if (attDoc.id.startsWith(tradeCode + "_")) { await deleteDoc(doc(db, "attendance", attDoc.id)); } }
  window.closePopup(); await window.loadTrades(); alert('Trade & related data removed.');
};
window.addTrade = async function() {
  const tradeName = document.getElementById("newTradeName").value.trim();
  const tradeCode = document.getElementById("newTradeCode").value.trim().toUpperCase();
  if (!tradeName || !tradeCode) return alert('Please fill all fields');
  await setDoc(doc(collection(db, "trades"), tradeCode), { name: tradeName, code: tradeCode });
  window.closePopup(); await window.loadTrades(); alert('Trade added');
};
window.addStudent = async function() {
  const tradeCode = document.getElementById("studentTrade").value;
  const studentName = document.getElementById("newStudentName").value.trim();
  const studentYear = document.getElementById("newStudentYear").value;
  const studentMobile = document.getElementById("newStudentMobile").value.trim();
  const studentAdmission = document.getElementById("newStudentAdmission").value.trim();
  const studentShift = document.getElementById("newStudentShift").value;
  const studentUnit = document.getElementById("newStudentUnit").value.trim();
  if (!tradeCode || !studentName || !studentMobile || !studentAdmission || !studentShift || !studentUnit || !studentYear) return alert('Please fill all required fields');
  await setDoc(doc(collection(db, "students")), {
    tradeCode, name: studentName, year: studentYear, mobile: studentMobile, admission: studentAdmission, shift: studentShift, unit: studentUnit });
  window.closePopup(); await window.showStudentsList(); alert('Student added');
};
window.loadTrades = async function() {
  const tradeSelector = document.getElementById('tradeSelector');
  const studentTrade = document.getElementById('studentTrade');
  const recordsTradeSelector = document.getElementById('recordsTradeSelector');
  [tradeSelector, studentTrade, recordsTradeSelector].forEach(sel => { if (!sel) return;
    while (sel.options && sel.options.length > 1) sel.remove(1); });
  const tradesSnapshot = await getDocs(collection(db, 'trades'));
  tradesSnapshot.forEach(docSnap => {
    const trade = docSnap.data();
    addOption(tradeSelector, trade.code, `${trade.name} (${trade.code})`);
    addOption(studentTrade, trade.code, `${trade.name} (${trade.code})`);
    addOption(recordsTradeSelector, trade.code, `${trade.name} (${trade.code})`);
  });
};
function addOption(select, value, text) {
  if (!select) return;
  const opt = document.createElement("option"); opt.value = value; opt.textContent = text; select.appendChild(opt);
}
window.showStudentsList = async function() {
  const tradeCode = document.getElementById("tradeSelector").value;
  const studentsList = document.getElementById("studentsList");
  studentsList.innerHTML = "";

  let students = [];
  if (!tradeCode) {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    studentsSnapshot.forEach(docSnap => students.push({ id: docSnap.id, ...docSnap.data() }));
    const attendanceSnapshot = await getDocs(collection(db, "attendance"));
    const today = getToday();
    const attendanceMap = {};
    attendanceSnapshot.forEach(docSnap => { if (docSnap.id.endsWith("_" + today)) {
      const trade = docSnap.id.split("_")[0]; attendanceMap[trade] = docSnap.data().data || [];
    } });
    students.forEach(student => {
      const arr = attendanceMap[student.tradeCode] || [];
      student.status = arr.length ? arr[students.indexOf(student)] || "" : "";
    });
    updateSummary(students.map(s => s.status));
    studentsList.innerHTML = "<li>Select a trade to view students.</li>";
    return;
  }

  const studentsQuery = query(collection(db, 'students'), where('tradeCode', '==', tradeCode));
  const studentsSnapshot = await getDocs(studentsQuery);
  studentsSnapshot.forEach(docSnap => students.push({ id: docSnap.id, ...docSnap.data() }));

  const attendanceDoc = await getDoc(doc(db, "attendance", `${tradeCode}_${getToday()}`));
  const attendance = attendanceDoc.exists() ? attendanceDoc.data().data : [];
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const item = document.createElement("li");
    item.className = "student-item";
    if (attendance[i]) item.classList.add(attendance[i]);
    item.innerHTML = `
      <div class="student-info">
        <div class="student-name">${student.name}</div>
        <div class="student-details">
          Year: ${student.year}, Mobile: ${student.mobile}, Admission: ${student.admission}, Shift: ${student.shift}, Unit: ${student.unit}
        </div>
      </div>
      <div class="attendance-buttons">
        <button class="attendance-btn btn-present" onclick="window.markAttendance('${tradeCode}',${i},'present')">P</button>
        <button class="attendance-btn btn-absent" onclick="window.markAttendance('${tradeCode}',${i},'absent')">A</button>
        <button class="attendance-btn btn-leave" onclick="window.markAttendance('${tradeCode}',${i},'leave')">L</button>
        <button class="attendance-btn btn-delete" style="background:#e74c3c;color:white;margin-left:10px;" onclick="window.removeStudent('${student.id}')">Delete</button>
      </div>
    `;
    studentsList.appendChild(item);
  }
  updateSummary(attendance);
};
window.markAttendance = async function(tradeCode, idx, status) {
  const today = getToday();
  const attendanceRef = doc(db, "attendance", `${tradeCode}_${today}`);
  const attendanceDoc = await getDoc(attendanceRef);
  let attendance = attendanceDoc.exists() ? attendanceDoc.data().data : [];
  attendance[idx] = status;
  await setDoc(attendanceRef, { data: attendance });
  await window.showStudentsList();
};
window.removeStudent = async function(studentId) {
  if (!confirm("Are you sure you want to delete this student?")) return;
  await deleteDoc(doc(db, "students", studentId));
  await window.showStudentsList();
};
window.submitAttendance = async function() {
  const tradeCode = document.getElementById("tradeSelector").value;
  const today = getToday();
  const items = Array.from(document.querySelectorAll("#studentsList .student-item"));
  const attendance = items.map(item =>
    item.classList.contains("present")
      ? "present"
      : item.classList.contains("absent")
      ? "absent"
      : item.classList.contains("leave")
      ? "leave"
      : ""
  );
  await setDoc(doc(db, "attendance", `${tradeCode}_${today}`), { data: attendance });
  alert("Attendance submitted!");
  await window.showStudentsList();
};
function updateSummary(attendanceArr) {
  document.getElementById("totalStudents").textContent = attendanceArr.length;
  document.getElementById("totalPresent").textContent = attendanceArr.filter(x => x === "present").length;
  document.getElementById("totalAbsent").textContent = attendanceArr.filter(x => x === "absent").length;
  document.getElementById("totalLeave").textContent = attendanceArr.filter(x => x === "leave").length;
}
window.showRecords = async function() {
  const tradeCode = document.getElementById('recordsTradeSelector').value;
  const rawDate = document.getElementById('recordsDateSelector').value;
  const date = toIsoDate(rawDate);

  let students = [];
  if (!tradeCode) {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    studentsSnapshot.forEach(docSnap => students.push({ id: docSnap.id, ...docSnap.data() }));
    const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
    const attendanceMap = {};
    attendanceSnapshot.forEach(docSnap => {
      if (docSnap.id.endsWith('_' + date)) {
        const trade = docSnap.id.split('_')[0];
        attendanceMap[trade] = docSnap.data().data || [];
      }
    });
    students.forEach(student => {
      const attendanceForTrade = attendanceMap[student.tradeCode] || [];
      student.status = attendanceForTrade.length > 0 ? attendanceForTrade[students.indexOf(student)] || "" : "";
    });
  } else {
    const studentsQuery = query(collection(db, 'students'), where('tradeCode', '==', tradeCode));
    const studentsSnapshot = await getDocs(studentsQuery);
    studentsSnapshot.forEach(docSnap => students.push({ id: docSnap.id, ...docSnap.data() }));
    const attendanceDoc = await getDoc(doc(db, "attendance", `${tradeCode}_${date}`));
    const attendance = attendanceDoc.exists() ? attendanceDoc.data().data : [];
    for (let i = 0; i < students.length; i++) {
      students[i].status = attendance[i] || "";
    }
  }
  let present = students.filter(s => s.status === "present");
  let absent = students.filter(s => s.status === "absent");
  let leave = students.filter(s => s.status === "leave");
  window.lastReportData = {present, absent, leave};
  function makeTable(list, statusLabel) {
    if (list.length === 0) return `<strong>${statusLabel}</strong><br><em>No students</em><br>`;
    let html = `<strong>${statusLabel}</strong><table border="1" cellspacing="0" cellpadding="4" style="margin-bottom:18px;">
      <tr style="background:#eee;">
        <th>Trade</th> <th>Name</th> <th>Mobile</th> <th>Admission Date</th> <th>Shift</th> <th>Unit</th> <th>Status</th>
      </tr>`;
    list.forEach(stu => {
      html += `<tr>
        <td>${stu.tradeCode}</td> <td>${stu.name}</td> <td>${stu.mobile}</td> <td>${stu.admission}</td>
        <td>${stu.shift}</td> <td>${stu.unit}</td> <td>${statusLabel}</td>
      </tr>`;
    });
    html += `</table>`;
    return html;
  }
  document.getElementById('recordsTable').innerHTML =
    makeTable(present, "Present") +
    makeTable(absent, "Absent") +
    makeTable(leave, "Leave");
};
window.downloadPdf = function(status) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const data = window.lastReportData || {present:[], absent:[], leave:[]};
  const listData = data[status] || [];
  if (listData.length === 0) { alert(`No ${status} records to export`); return; }
  const columns = [
    { header: 'Trade', dataKey: 'tradeCode' },
    { header: 'Name', dataKey: 'name' },
    { header: 'Mobile', dataKey: 'mobile' },
    { header: 'Admission Date', dataKey: 'admission' },
    { header: 'Shift', dataKey: 'shift' },
    { header: 'Unit', dataKey: 'unit' },
    { header: 'Status', dataKey: 'status' },
  ];
  doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)} Attendance Report`, 14, 15);
  doc.autoTable({
    startY: 20,
    head: [columns.map(col => col.header)],
    body: listData.map(row => columns.map(col => row[col.dataKey])),
    theme: 'striped'
  });
  doc.save(`${status}_attendance_report.pdf`);
};

// AUTH
loginBtn.onclick = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  try { await signInWithEmailAndPassword(auth, email, password); loginError.style.display = 'none'; }
  catch (err) { loginError.style.display = 'block'; loginError.textContent = err.message; }
};
logoutBtn.onclick = () => { signOut(auth); };
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginContainer.style.display = 'none';
    appContainer.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    document.querySelector('.navbar').style.display = 'flex';
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN');
    await window.loadTrades();
    await window.showStudentsList();
  } else {
    loginContainer.style.display = 'flex';
    appContainer.style.display = 'none';
    logoutBtn.style.display = 'none';
    document.querySelector('.navbar').style.display = 'none';
  }
};
