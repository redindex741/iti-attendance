window.showRecords = async function() {
  const tradeCode = document.getElementById('recordsTradeSelector').value;
  const date = document.getElementById('recordsDateSelector').value;
  const attendanceDoc = await getDoc(doc(db, "attendance", `${tradeCode}_${date}`));
  const attendance = attendanceDoc.exists() ? attendanceDoc.data().data : [];

  let studentsQuery;
  if (!tradeCode) {
    // "All Trades" selected: fetch ALL students
    studentsQuery = collection(db, 'students');
  } else {
    // Specific trade: filter
    studentsQuery = query(collection(db, 'students'), where('tradeCode', '==', tradeCode));
  }
  const studentsSnapshot = await getDocs(studentsQuery);
  const students = [];
  studentsSnapshot.forEach(docSnap => students.push({ id: docSnap.id, ...docSnap.data() }));

  let present = [], absent = [], leave = [];
  for (let i = 0; i < students.length; i++) {
    const status = attendance[i];
    const student = students[i];
    if (status === "present") present.push({ ...student, status });
    else if (status === "absent") absent.push({ ...student, status });
    else if (status === "leave") leave.push({ ...student, status });
  }

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
