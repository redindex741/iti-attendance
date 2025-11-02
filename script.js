import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

window.onload = function() {
  const auth = window.firebaseAuth;
  const db = window.firebaseDb;

  const loginContainer = document.getElementById('loginContainer');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const appContainer = document.querySelector('.container');
  const logoutBtn = document.getElementById('logoutBtn');

  function toIsoDate(dateStr) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const m = parts[0].padStart(2, '0');
      const d = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
    return dateStr;
  }

  function getToday() {
    const now = new Date();
    const offsetMs = 5.5 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + offsetMs);
    return local.toISOString().slice(0, 10);
  }

  window.loadTrades = async function() {
    const tradeSelector = document.getElementById('tradeSelector');
    const studentTrade = document.getElementById('studentTrade');
    const recordsTradeSelector = document.getElementById('recordsTradeSelector');
    [tradeSelector, studentTrade, recordsTradeSelector].forEach(sel => {
      if (!sel) return;
      while (sel.options && sel.options.length > 1) sel.remove(1);
    });
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
    const opt = document.createElement("option");
    opt.value = value; opt.textContent = text;
    select.appendChild(opt);
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
          <th>Trade</th>
          <th>Name</th>
          <th>Mobile</th>
          <th>Admission Date</th>
          <th>Shift</th>
          <th>Unit</th>
          <th>Status</th>
        </tr>`;
      list.forEach(stu => {
        html += `<tr>
          <td>${stu.tradeCode}</td>
          <td>${stu.name}</td>
          <td>${stu.mobile}</td>
          <td>${stu.admission}</td>
          <td>${stu.shift}</td>
          <td>${stu.unit}</td>
          <td>${statusLabel}</td>
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

    if (listData.length === 0) {
      alert(`No ${status} records to export`);
      return;
    }

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

  // Include all your other functions (showStudentsList, addTrade, addStudent, etc.) here as before.

  // AUTH LOGIC - must be at end
  loginBtn.onclick = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      loginError.style.display = 'none';
    } catch (err) {
      loginError.style.display = 'block';
      loginError.textContent = err.message;
    }
  };

  logoutBtn.onclick = () => { signOut(auth); };

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      loginContainer.style.display = 'none';
      appContainer.style.display = 'block';
      logoutBtn.style.display = 'inline-block';
      document.querySelector('.navbar').style.display = 'flex';
      document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN');
      if (window.loadTrades) await window.loadTrades();
      if (window.showStudentsList) await window.showStudentsList();
    } else {
      loginContainer.style.display = 'flex';
      appContainer.style.display = 'none';
      logoutBtn.style.display = 'none';
      document.querySelector('.navbar').style.display = 'none';
    }
  });

  // Place your other business logic and UI event wiring below
};
