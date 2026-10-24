/* Enrom School: dashboard with Google sign-in and daily progress (front end only, no Python needed) */

// ---------- Data ----------
const TEACHERS = {
  English:   ["Tr Jeremy", "Md Catherine", "Md Lucy"],
  Maths:     ["Mr Pascal", "Md Caroline", "Mr Njue"],
  Kiswahili: ["Mr Ngari", "Md Sharon", "Tr Lilian"]
};
const SUBJECTS = Object.keys(TEACHERS);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LOGIN_POPUP_DELAY_MS = 30000; // login popup after 30 seconds

// ---------- State ----------
let user = null;      // signed-in Google account: { uid, name, email }
let profile = null;   // grade, parent details, chosen teachers
let progress = {};    // { "2026-10-22": { date, lessons: ["English", ...] } }
let draft = null;     // details from step 1 while choosing teachers

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function levelOf(grade) {
  if (grade <= 6) return "Primary";
  if (grade <= 9) return "Junior";
  return "Senior";
}
function teacherLook(grade) {
  if (grade <= 3) return "cartoon teacher";
  if (grade <= 6) return "anime teacher";
  return "real-look teacher";
}
function initials(name) {
  return name.replace(/^(Mr|Md|Tr)\s+/, "").slice(0, 2).toUpperCase();
}
function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ---------- Timetable ----------
// Mon-Fri: 3 lessons a day. The subject order rotates by weekday. Saturday: exams.
function todaysLessons() {
  const day = new Date().getDay();
  if (day === 0 || day === 6) return [];
  return [0, 1, 2].map((i) => SUBJECTS[(i + day - 1) % 3]);
}
function teacherFor(subject) {
  return (profile && profile.teachers && profile.teachers[subject]) || TEACHERS[subject][0];
}
function joinedToday() {
  const e = progress[todayKey()];
  return e && e.lessons ? e.lessons : [];
}

// ---------- Daily progress ----------
async function recordLesson(subject) {
  const key = todayKey();
  const entry = progress[key] || { date: key, lessons: [] };
  if (!entry.lessons.includes(subject)) entry.lessons.push(subject);
  progress[key] = entry;
  renderAll();
  try {
    await Cloud.saveProgress(user.uid, entry);
  } catch (e) {
    toast("Could not save your progress. Check your internet and try again.");
  }
}

// ---------- Home ----------
function renderHome() {
  const now = new Date();
  const lessons = todaysLessons();
  const grade = profile ? Number(profile.grade) : null;
  const first = profile ? profile.name.split(" ")[0] : (user && user.name ? user.name.split(" ")[0] : null);

  $("gradeChip").textContent = grade ? "Grade " + grade + " \u00B7 " + levelOf(grade) : "Choose your grade";
  $("boardDay").textContent = DAYS[now.getDay()] + ", " + now.toLocaleDateString("en-KE", { day: "numeric", month: "long" });
  $("boardTitle").textContent = first ? "Hello, " + first : "Welcome to Enrom School";

  const list = $("boardList");
  const lessonBox = $("lessonList");
  list.innerHTML = "";
  lessonBox.innerHTML = "";

  if (lessons.length === 0) {
    const text = now.getDay() === 6 ? "Saturday is exam day. Open the Exam tab." : "No classes today. Rest well.";
    list.innerHTML = "<li>" + text + "</li>";
    lessonBox.innerHTML = '<div class="panel">' + text + "</div>";
    $("progressBox").hidden = true;
    return;
  }

  const done = joinedToday();

  lessons.forEach((subject, i) => {
    const teacher = teacherFor(subject);
    const isDone = done.includes(subject);

    const li = document.createElement("li");
    li.innerHTML = "<span>Lesson " + (i + 1) + ": " + subject + '</span><span class="who">' + teacher + (isDone ? " \u2713" : "") + "</span>";
    list.appendChild(li);

    const look = grade ? teacherLook(grade) : "AI teacher";
    const card = document.createElement("div");
    card.className = "lesson";
    card.innerHTML =
      '<div class="avatar">' + initials(teacher) + "</div>" +
      '<div class="lesson-info"><strong>' + subject + "</strong>" +
      "<span>" + teacher + " \u00B7 " + look + " \u00B7 20 min lesson, 20 min test</span></div>";
    const btn = document.createElement("button");
    btn.className = "btn btn-small" + (isDone ? " btn-quiet" : "");
    btn.textContent = isDone ? "Joined" : "Join class";
    btn.addEventListener("click", () => {
      if (!user) { openJoin("login"); return; }
      if (!profile) { openJoin("details"); return; }
      window.location.href = "classroom.html?subject=" + encodeURIComponent(subject);
    });
    card.appendChild(btn);
    lessonBox.appendChild(card);
  });

  // today's progress bar (only when signed in)
  if (user && profile) {
    $("progressBox").hidden = false;
    $("progressText").textContent = done.length + " of " + lessons.length + " lessons joined today";
    $("progressFill").style.width = Math.round((done.length / lessons.length) * 100) + "%";
  } else {
    $("progressBox").hidden = true;
  }
}

// ---------- Profile ----------
function renderProfile() {
  const card = $("profileCard");
  const actions = $("profileActions");
  const history = $("historyBox");
  actions.innerHTML = "";

  if (!user) {
    card.innerHTML = "<p>You are not signed in.</p><p class='hint'>Sign in with Google to save your progress every day.</p>";
    history.innerHTML = "<p class='hint'>Your daily progress will show here after you sign in.</p>";
    addButton(actions, "Sign in with Google", "btn", () => openJoin("login"));
    return;
  }

  const rows = [["Google account", user.email || user.name || "Signed in"]];
  if (profile) {
    rows.push(
      ["Name", profile.name],
      ["Grade", "Grade " + profile.grade + " (" + levelOf(Number(profile.grade)) + ")"],
      ["Parent", profile.parent],
      ["Parent email", profile.parentEmail],
      ["Parent phone", profile.parentPhone]
    );
    SUBJECTS.forEach((s) => rows.push([s + " teacher", teacherFor(s)]));
  }
  card.innerHTML = "<dl>" + rows.map(() => "<dt></dt><dd></dd>").join("") + "</dl>";
  const dts = card.querySelectorAll("dt");
  const dds = card.querySelectorAll("dd");
  rows.forEach((r, i) => { dts[i].textContent = r[0]; dds[i].textContent = r[1]; }); // textContent keeps typed text safe

  addButton(actions, profile ? "Update details" : "Finish setting up", "btn", () => openJoin("details"));
  addButton(actions, "Sign out", "btn btn-quiet", () => Cloud.signOut());

  // recent days
  const days = Object.keys(progress).sort().reverse().slice(0, 7);
  if (days.length === 0) {
    history.innerHTML = "<p class='hint'>No progress yet. Join a class on the Home tab and it will appear here.</p>";
  } else {
    history.innerHTML = "<dl></dl>";
    const dl = history.querySelector("dl");
    days.forEach((k) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = k;
      const sc = progress[k].scores || {};
      dd.textContent = (progress[k].lessons || []).map((s) => (sc[s] ? s + " (" + sc[s] + ")" : s)).join(", ") || "No lessons";
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
  }
}
function addButton(parent, text, cls, handler) {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", handler);
  parent.appendChild(b);
}

function renderAll() {
  renderHome();
  renderProfile();
}

// ---------- Tabs ----------
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("view-" + name).classList.add("active");
  document.querySelectorAll(".bar button").forEach((b) => {
    if (b.dataset.view === name) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}
document.querySelectorAll(".bar button").forEach((b) =>
  b.addEventListener("click", () => showView(b.dataset.view))
);

// ---------- Grade lists ----------
function fillGrades(select) {
  select.innerHTML = "";
  select.add(new Option("Choose a grade", ""));
  for (let g = 1; g <= 11; g++) select.add(new Option("Grade " + g + " (" + levelOf(g) + ")", g));
}
fillGrades($("fGrade"));
fillGrades($("reviseGrade"));

// Revise another grade: shows that grade's classes. Your own timetable stays the same.
function lessonCount(grade, subject) {
  const byGrade = (typeof CURRICULUM !== "undefined" && CURRICULUM[String(grade)]) || {};
  return (byGrade[subject] || []).length;
}
function renderRevise() {
  const grade = $("reviseGrade").value;
  const box = $("reviseList");
  box.innerHTML = "";
  if (!grade) return;
  SUBJECTS.forEach((subject) => {
    const n = lessonCount(grade, subject);
    const card = document.createElement("div");
    card.className = "lesson";
    const info = document.createElement("div");
    info.className = "lesson-info";
    const strong = document.createElement("strong");
    strong.textContent = "Grade " + grade + " " + subject;
    const span = document.createElement("span");
    span.textContent = n > 0 ? n + " curriculum lessons (choose any one)" : "No curriculum lessons yet: sample lesson only";
    info.appendChild(strong);
    info.appendChild(span);
    const btn = document.createElement("button");
    btn.className = "btn btn-small";
    btn.textContent = "Open class";
    btn.addEventListener("click", () => {
      if (!user) { openJoin("login"); return; }
      if (!profile) { openJoin("details"); return; }
      window.location.href = "classroom.html?subject=" + encodeURIComponent(subject) + "&grade=" + encodeURIComponent(grade);
    });
    card.appendChild(info);
    card.appendChild(btn);
    box.appendChild(card);
  });
}
$("reviseGrade").addEventListener("change", renderRevise);

// ---------- Popup ----------
function showStep(step) {
  $("stepLogin").hidden = step !== "login";
  $("stepDetails").hidden = step !== "details";
  $("stepTeachers").hidden = step !== "teachers";
}
function openJoin(step) {
  showStep(step);
  if (step === "details") {
    $("fName").value = (profile && profile.name) || (user && user.name) || "";
    $("fGrade").value = profile ? profile.grade : "";
    $("fParent").value = profile ? profile.parent : "";
    $("fParentEmail").value = profile ? profile.parentEmail : "";
    $("fParentPhone").value = profile ? profile.parentPhone : "";
  }
  $("demoNote").hidden = Cloud.isLive;
  if (!Cloud.isLive) {
    $("demoNote").textContent = "Demo mode: Google is not connected because " + Cloud.demoReason +
      " Until then, sign-in creates a test learner saved on this computer only.";
  }
  $("joinOverlay").hidden = false;
}
function closeJoin() { $("joinOverlay").hidden = true; }

document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeJoin));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeJoin(); });

// Google button
$("googleBtn").addEventListener("click", async () => {
  try {
    await Cloud.signIn(); // the result arrives in handleUser below
  } catch (e) {
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
      toast("Sign-in cancelled.");
    } else if (e.code === "auth/operation-not-supported-in-this-environment" || e.code === "auth/unauthorized-domain") {
      toast("Google sign-in needs the app opened from Live Server or a website address, not by double-clicking the file.");
    } else {
      toast("Could not sign in. Check your internet and try again.");
    }
  }
});

// Step: details
$("stepDetails").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!$("fGrade").value) { toast("Please choose your grade."); return; }
  draft = {
    name: $("fName").value.trim(),
    grade: $("fGrade").value,
    parent: $("fParent").value.trim(),
    parentEmail: $("fParentEmail").value.trim(),
    parentPhone: $("fParentPhone").value.trim()
  };
  buildTeacherPickers();
  showStep("teachers");
});

function buildTeacherPickers() {
  const box = $("teacherPickers");
  box.innerHTML = "";
  const look = teacherLook(Number(draft.grade));
  SUBJECTS.forEach((subject) => {
    const label = document.createElement("label");
    label.htmlFor = "pick-" + subject;
    label.textContent = subject + " (" + look + ")";
    const sel = document.createElement("select");
    sel.id = "pick-" + subject;
    TEACHERS[subject].forEach((t) => sel.add(new Option(t, t)));
    if (profile && profile.teachers && profile.teachers[subject]) sel.value = profile.teachers[subject];
    box.appendChild(label);
    box.appendChild(sel);
  });
}
$("backToDetails").addEventListener("click", () => showStep("details"));

// Step: teachers (saves everything)
$("stepTeachers").addEventListener("submit", async (e) => {
  e.preventDefault();
  draft.teachers = {};
  SUBJECTS.forEach((s) => { draft.teachers[s] = $("pick-" + s).value; });
  profile = draft;
  try {
    await Cloud.saveProfile(user.uid, profile);
  } catch (err) {
    toast("Could not save your details. Check your internet and try again.");
    return;
  }
  closeJoin();
  renderAll();
  showView("home");
  toast("Welcome, " + profile.name.split(" ")[0] + ". Your classes are ready.");
});

// ---------- Signed in / signed out ----------
async function handleUser(u) {
  user = u;
  profile = null;
  progress = {};
  if (u) {
    try {
      profile = await Cloud.loadProfile(u.uid);
      progress = await Cloud.loadProgress(u.uid);
    } catch (e) {
      toast("Could not load your saved data. Check your internet.");
    }
  }
  renderAll();
  if (!u) return;
  if (profile) {
    closeJoin();
    toast("Welcome back, " + profile.name.split(" ")[0] + ".");
  } else {
    openJoin("details"); // first time: collect grade, parent details, teachers
  }
}

// ---------- Other buttons ----------
$("sendFeedback").addEventListener("click", () => {
  if (!$("feedbackText").value.trim()) { toast("Write your feedback first."); return; }
  $("feedbackText").value = "";
  toast("Thank you. Feedback noted (it is not sent anywhere yet).");
});

// ---------- Start ----------
renderAll();
Cloud.onUser(handleUser);
setTimeout(() => {
  if (!user && $("joinOverlay").hidden) openJoin("login");
}, LOGIN_POPUP_DELAY_MS);