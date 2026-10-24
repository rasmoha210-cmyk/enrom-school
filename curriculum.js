/* Enrom School classroom: lesson auto-types on the board, then a test with instant marking. */

// Sample lessons (placeholders: replace with real Kenyan curriculum content per grade later)
const SAMPLE_LESSONS = {
  English: {
    title: "Nouns and Verbs",
    lines: [
      "A noun is a naming word. It names a person, a place or a thing.",
      "Examples: teacher, Mombasa, book.",
      "A verb is a doing word. Examples: run, read, write.",
      "In 'Wanjiku reads a book', Wanjiku is the noun and reads is the verb."
    ],
    test: [
      { q: "Which word is the verb in: 'Otieno kicks the ball'?", options: ["Otieno", "kicks", "ball", "the"], answer: 1 },
      { q: "Which word is a noun in: 'The teacher smiled'?", options: ["The", "smiled", "teacher", "a"], answer: 2 },
      { q: "Which word names a place?", options: ["Mombasa", "run", "happy", "book"], answer: 0 }
    ]
  },
  Maths: {
    title: "Multiplication",
    lines: [
      "Multiplication is repeated addition.",
      "3 x 4 means 3 + 3 + 3 + 3, which is 12.",
      "The order does not matter: 3 x 4 = 4 x 3.",
      "Any number multiplied by 1 stays the same."
    ],
    test: [
      { q: "What is 6 x 7?", options: ["36", "42", "48", "49"], answer: 1 },
      { q: "What is 9 x 3?", options: ["12", "18", "27", "21"], answer: 2 },
      { q: "Which sum equals 4 x 3?", options: ["4 + 3", "3 + 3 + 3 + 3", "4 + 4 + 3", "3 + 4 + 5"], answer: 1 }
    ]
  },
  Kiswahili: {
    title: "Salamu (Greetings)",
    lines: [
      "Habari ya asubuhi? means 'How are you this morning?'",
      "You can answer: Nzuri, asante. It means 'Fine, thank you.'",
      "Asante sana means 'Thank you very much.'",
      "Kwaheri means 'Goodbye.'"
    ],
    test: [
      { q: "What does 'Kwaheri' mean?", options: ["Welcome", "Goodbye", "Thank you", "Good morning"], answer: 1 },
      { q: "What does 'Asante' mean?", options: ["Sorry", "Please", "Thank you", "Yes"], answer: 2 },
      { q: "How do you say 'How are you this morning?'", options: ["Kwaheri", "Nzuri, asante", "Asante sana", "Habari ya asubuhi?"], answer: 3 }
    ]
  }
};

// ---------- Setup ----------
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const subject = SAMPLE_LESSONS[params.get("subject")] ? params.get("subject") : "English";
const reviseParam = params.get("grade");
const reviseGrade = reviseParam && /^([1-9]|1[0-2])$/.test(reviseParam) ? reviseParam : null;
const isRevision = !!reviseGrade;   // revising another grade: not saved to the daily timetable progress
const fallbackLesson = Object.assign({}, SAMPLE_LESSONS[subject], { source: "Sample lesson, not from the Kenyan curriculum yet" });

let user = null, profile = null, voiceOn = true, clock = null, aborted = false;
let teacherName = "Your teacher", gradeUsed = 0, lessonList = [], lesson = fallbackLesson;

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3600);
}
function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function teacherLook(grade) {
  if (grade <= 3) return "cartoon teacher";
  if (grade <= 6) return "anime teacher";
  return "real-look teacher";
}
function initials(name) { return name.replace(/^(Mr|Md|Tr)\s+/, "").slice(0, 2).toUpperCase(); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Lessons for this grade and subject, from curriculum.js
function curriculumList() {
  const byGrade = (typeof CURRICULUM !== "undefined" && CURRICULUM[String(gradeUsed)]) || {};
  return byGrade[subject] || [];
}
function pickLesson() {
  if (lessonList.length === 0) return fallbackLesson;
  if (isRevision) return lessonList[0];
  const day = Math.floor(Date.now() / 86400000); // a different lesson each day
  return lessonList[day % lessonList.length];
}

// Sign-in check: send people who are not signed in (or not set up) back to the home page.
Cloud.onUser(async (u) => {
  if (!u) { location.href = "index.html"; return; }
  try { profile = await Cloud.loadProfile(u.uid); } catch (e) { profile = null; }
  if (!profile) { location.href = "index.html"; return; }
  user = u;
  buildRoom();
});

function showLesson() {
  $("roomTitle").textContent = (isRevision ? "Grade " + gradeUsed + " revision: " : "") + subject + ": " + lesson.title;
  $("boardHead").textContent = lesson.title;
  $("sourceLine").textContent = "Source: " + lesson.source;
}

function buildRoom() {
  gradeUsed = Number(reviseGrade || profile.grade);
  teacherName = (profile.teachers && profile.teachers[subject]) || "Your teacher";
  lessonList = curriculumList();
  lesson = pickLesson();
  document.title = subject + " | Enrom School";
  $("tAvatar").textContent = initials(teacherName);
  $("tName").textContent = teacherName;
  $("tLook").textContent = teacherLook(gradeUsed);
  showLesson();

  // In revision mode the learner chooses which lesson to open (handy for testing every lesson).
  if (isRevision) {
    if (lessonList.length > 0) {
      const sel = $("lessonPick");
      sel.innerHTML = "";
      lessonList.forEach((l, i) => sel.add(new Option((i + 1) + ". " + l.title, i)));
      sel.addEventListener("change", () => { lesson = lessonList[Number(sel.value)]; showLesson(); });
      $("pickerBox").hidden = false;
    } else {
      toast("No Grade " + gradeUsed + " " + subject + " lessons yet, so this is the sample lesson.");
    }
  }

  const seats = $("seats");
  seats.innerHTML = "";
  const me = document.createElement("div");
  me.className = "seat";
  const av = document.createElement("div");
  av.className = "seat-avatar";
  av.textContent = profile.name.slice(0, 2).toUpperCase();
  const nm = document.createElement("div");
  nm.textContent = profile.name.split(" ")[0] + " (you)";
  me.appendChild(av);
  me.appendChild(nm);
  seats.appendChild(me);
  for (let i = 0; i < 3; i++) {
    const s = document.createElement("div");
    s.className = "seat empty";
    s.textContent = "Empty seat";
    seats.appendChild(s);
  }
}

// ---------- Saving to the learner's account ----------
async function updateToday(change) {
  if (isRevision) return; // revision does not change the daily timetable progress
  try {
    const all = await Cloud.loadProgress(user.uid);
    const key = todayKey();
    const entry = all[key] || { date: key, lessons: [] };
    entry.lessons = entry.lessons || [];
    entry.scores = entry.scores || {};
    change(entry);
    await Cloud.saveProgress(user.uid, entry);
  } catch (e) {
    toast("Could not save your progress. Check your internet.");
  }
}

// ---------- The teacher's voice ----------
const hasSpeech = "speechSynthesis" in window;
let voices = [], chosenVoice = null;

function rankVoice(v) {
  const l = v.lang.toLowerCase().replace("_", "-");
  return l === "en-ke" ? 0 : l === "en-gb" ? 1 : l === "en-us" ? 2 : 3;
}
function loadVoices() {
  if (!hasSpeech) { $("voiceStatus").textContent = "This browser cannot speak. Please use Chrome or Edge."; return; }
  voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => rankVoice(a) - rankVoice(b));
  const sel = $("voiceSelect");
  const keep = sel.value;
  sel.innerHTML = "";
  voices.forEach((v, i) => sel.add(new Option(v.name + " (" + v.lang + ")", i)));
  if (voices.length === 0) {
    chosenVoice = null;
    $("voiceStatus").textContent = "No English voice found yet. Wait a moment, or add one in Windows: Settings > Time & language > Speech.";
    return;
  }
  sel.value = keep !== "" && sel.options[Number(keep)] ? keep : "0";
  chosenVoice = voices[Number(sel.value)];
  $("voiceStatus").textContent = "Voice ready: " + chosenVoice.name + ". If you hear nothing, check the computer volume and that this browser tab is not muted.";
}
if (hasSpeech) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}
$("voiceSelect").addEventListener("change", () => { chosenVoice = voices[Number($("voiceSelect").value)] || null; });

function teacherPitch() {
  const base = /^Md /.test(teacherName) ? 1.15 : /^Mr /.test(teacherName) ? 0.85 : 1.0;
  return Math.min(2, base + (gradeUsed <= 3 ? 0.15 : 0)); // cartoon teachers sound a little higher
}
function say(text) {
  return new Promise((resolve) => {
    if (!voiceOn || aborted || !hasSpeech) { resolve(); return; }
    speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; } else { u.lang = "en-GB"; }
    u.rate = 0.95;
    u.pitch = teacherPitch();
    u.volume = 1;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    setTimeout(finish, Math.max(6000, text.length * 130)); // never get stuck waiting for the voice
  });
}
async function typeInto(el, text) {
  for (const ch of text) {
    if (aborted) { el.textContent = text; return; }
    el.textContent += ch;
    await wait(28);
  }
}
async function teach(text, el) {
  $("tAvatar").classList.add("speaking");
  await Promise.all([typeInto(el, text), say(text)]);
  $("tAvatar").classList.remove("speaking");
  if (!aborted) await wait(500);
}
function teachLine(text, parent) {
  const p = document.createElement("p");
  parent.appendChild(p);
  return teach(text, p);
}

$("testVoiceBtn").addEventListener("click", async () => {
  if (!hasSpeech) { toast("This browser cannot speak. Please use Chrome or Edge."); return; }
  if (voices.length === 0) loadVoices();
  speechSynthesis.cancel();
  voiceOn = true;
  $("voiceBtn").textContent = "Voice: on";
  $("voiceBtn").setAttribute("aria-pressed", "true");
  $("tAvatar").classList.add("speaking");
  await say("Hello. I am " + teacherName + ", your " + subject + " teacher. Can you hear me?");
  $("tAvatar").classList.remove("speaking");
});

$("voiceBtn").addEventListener("click", () => {
  voiceOn = !voiceOn;
  $("voiceBtn").textContent = "Voice: " + (voiceOn ? "on" : "off");
  $("voiceBtn").setAttribute("aria-pressed", String(voiceOn));
  if (!voiceOn && hasSpeech) speechSynthesis.cancel();
});
window.addEventListener("beforeunload", () => { if (hasSpeech) speechSynthesis.cancel(); });

// ---------- Lesson ----------
function startClock() {
  let secs = 20 * 60;
  clearInterval(clock);
  clock = setInterval(() => {
    secs = Math.max(0, secs - 1);
    $("roomTimer").textContent = String(Math.floor(secs / 60)).padStart(2, "0") + ":" + String(secs % 60).padStart(2, "0");
    if (secs === 0) { clearInterval(clock); toast("Lesson time is over."); }
  }, 1000);
}

$("startBtn").addEventListener("click", async () => {
  if (!user) return;
  $("startBtn").hidden = true;
  $("pickerBox").hidden = true;
  $("skipBtn").hidden = false;
  aborted = false;
  startClock();
  const taught = lesson.title;
  updateToday((e) => { if (!e.lessons.includes(subject)) e.lessons.push(subject); });
  const box = $("boardText");
  box.innerHTML = "";
  await teachLine("Hello " + profile.name.split(" ")[0] + ". I am " + teacherName + ". Today we are learning about " + taught + ".", box);
  for (const line of lesson.lines) await teachLine(line, box);
  aborted = false;
  $("skipBtn").hidden = true;
  $("testBtn").hidden = false;
  $("askBox").hidden = false;
  toast("Lesson finished. Start the test when you are ready.");
});

$("skipBtn").addEventListener("click", () => {
  aborted = true;
  if (hasSpeech) speechSynthesis.cancel();
});

// ---------- Test with instant marking ----------
$("testBtn").addEventListener("click", () => {
  $("testBtn").hidden = true;
  $("askBox").hidden = true; // no asking during the test
  clearInterval(clock);
  aborted = false;
  runTest();
});

async function runTest() {
  const box = $("boardText");
  $("boardHead").textContent = "Test: " + lesson.title;
  let correct = 0;

  for (let i = 0; i < lesson.test.length; i++) {
    const item = lesson.test[i];
    box.innerHTML = "";
    const q = document.createElement("p");
    box.appendChild(q);
    $("tAvatar").classList.add("speaking");
    await Promise.all([
      typeInto(q, "Question " + (i + 1) + " of " + lesson.test.length + ": " + item.q),
      say("Question " + (i + 1) + ". " + item.q)
    ]);
    $("tAvatar").classList.remove("speaking");

    const picked = await new Promise((resolve) => {
      item.options.forEach((text, idx) => {
        const b = document.createElement("button");
        b.className = "opt";
        b.textContent = text;
        b.addEventListener("click", () => resolve({ idx: idx, btn: b }), { once: true });
        box.appendChild(b);
      });
    });

    if (hasSpeech) speechSynthesis.cancel();
    const buttons = box.querySelectorAll(".opt");
    buttons.forEach((b) => { b.disabled = true; });
    buttons[item.answer].classList.add("right");
    const isRight = picked.idx === item.answer;
    if (isRight) correct++; else picked.btn.classList.add("wrong");
    const fb = document.createElement("p");
    fb.textContent = isRight ? "Correct!" : "Not quite. The answer is " + item.options[item.answer] + ".";
    box.appendChild(fb);
    await Promise.all([say(fb.textContent), wait(1800)]);
  }

  const total = lesson.test.length;
  box.innerHTML = "";
  const result = document.createElement("p");
  result.textContent = "You scored " + correct + " out of " + total + ".";
  box.appendChild(result);
  const back = document.createElement("a");
  back.href = "index.html";
  back.className = "btn";
  back.textContent = "Back to my classes";
  box.appendChild(back);
  say(result.textContent);
  if (isRevision) {
    toast("Revision score " + correct + "/" + total + " (not saved to your daily progress).");
  } else {
    await updateToday((e) => { e.scores[subject] = correct + "/" + total; });
    toast("Your score has been saved.");
  }
}

// ---------- Ask the teacher (talks to the Python backend) ----------
// Start the backend from the enrom-school folder with:  python backend/app.py
const IS_LOCAL_PAGE = ["localhost", "127.0.0.1", ""].includes(location.hostname);
const CFG = typeof ENROM_CONFIG !== "undefined" ? ENROM_CONFIG : { TEACHER_API_LOCAL: "http://127.0.0.1:8000", TEACHER_API_ONLINE: "" };
const TEACHER_API = IS_LOCAL_PAGE ? CFG.TEACHER_API_LOCAL : CFG.TEACHER_API_ONLINE; // empty = use the built-in answers
let asking = false;

function fetchWithTimeout(url, options, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  return fetch(url, Object.assign({}, options, { signal: ctl.signal })).finally(() => clearTimeout(timer));
}

async function checkBrain() {
  const el = $("brainStatus");
  if (!TEACHER_API) {
    el.textContent = "Teacher brain: simple built-in mode. Answers come from the lesson. The full AI teacher is not connected in this online test.";
    return;
  }
  try {
    const r = await fetchWithTimeout(TEACHER_API + "/health", {}, 4000);
    const d = await r.json();
    el.textContent = d.mode === "ai"
      ? "Teacher brain: connected to the AI teacher."
      : "Teacher brain: running in offline mode. It answers from the lesson only, until the AI key is added.";
  } catch (e) {
    el.textContent = "Teacher brain: the Python backend is not running, so the simple built-in mode is used. To start the full one, in VS Code run: python backend/app.py";
  }
}

// Simple built-in answers (same idea as the Python offline teacher), used when no backend is reachable.
const STOP_WORDS = new Set(("a an the is are was were be been am do does did can could should would will shall of to in on at by for with " +
  "from and or but if so as that this these those it its i me my you your we our they them what why how when where who whom which whose " +
  "please tell about explain mean means meaning again more much many some any there here").split(" "));
const GREETING_WORDS = ["hello", "hi", "hey", "habari", "jambo", "good", "morning", "afternoon"];
function wordsOf(text) {
  const out = new Set();
  (text.toLowerCase().match(/[a-z0-9']+/g) || []).forEach((word) => {
    if (STOP_WORDS.has(word)) return;
    out.add(word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word);
  });
  return out;
}
function localAnswer(question) {
  const name = profile.name.split(" ")[0];
  const q = wordsOf(question);
  if (q.size > 0 && Array.from(q).every((w) => GREETING_WORDS.includes(w))) {
    return "Hello " + name + "! Ask me anything about today's lesson on " + lesson.title + ".";
  }
  const scored = lesson.lines.map((line) => {
    const lw = wordsOf(line);
    let n = 0;
    q.forEach((w) => { if (lw.has(w)) n++; });
    return { n: n, line: line };
  }).sort((a, b) => b.n - a.n);
  if (scored.length > 0 && scored[0].n > 0) {
    let answer = "Good question, " + name + ". Here is what we learned: " + scored[0].line;
    if (scored.length > 1 && scored[1].n > 0) answer += " Also: " + scored[1].line;
    return answer;
  }
  return "That is a good thing to wonder about, " + name + ", but for now I can only help with today's lesson on " +
    lesson.title + ". Here is a key point: " + lesson.lines[0];
}

async function askTeacher() {
  const input = $("askInput");
  const question = input.value.trim();
  if (!question || asking) return;
  asking = true;
  $("askBtn").disabled = true;
  input.value = "";

  const log = $("askLog");
  const q = document.createElement("p");
  q.className = "ask-q";
  q.textContent = "You: " + question;
  log.appendChild(q);
  const a = document.createElement("p");
  a.className = "ask-a";
  a.textContent = teacherName + " is thinking...";
  log.appendChild(a);

  let answer = null;
  if (TEACHER_API) {
    try {
      const r = await fetchWithTimeout(TEACHER_API + "/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question,
          grade: gradeUsed,
          subject: subject,
          teacher: teacherName,
          learnerName: profile.name.split(" ")[0],
          lesson: { title: lesson.title, source: lesson.source, outcomes: lesson.outcomes || [], lines: lesson.lines }
        })
      }, 30000);
      const d = await r.json();
      answer = r.ok ? d.answer : (d.error || "Sorry, I could not answer that.");
    } catch (e) {
      answer = null; // backend not reachable: use the built-in answer below
    }
  }
  if (answer === null) answer = localAnswer(question);

  a.textContent = "";
  $("tAvatar").classList.add("speaking");
  await Promise.all([typeInto(a, teacherName + ": " + answer), say(answer)]);
  $("tAvatar").classList.remove("speaking");
  asking = false;
  $("askBtn").disabled = false;
  input.focus();
}
$("askBtn").addEventListener("click", askTeacher);
$("askInput").addEventListener("keydown", (e) => { if (e.key === "Enter") askTeacher(); });
checkBrain();