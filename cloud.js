/*
  Cloud layer: sign-in and saving.
  - Real mode: Firebase Authentication (Google) + Firestore, when firebase-config.js has your settings.
  - Demo mode: no Google; a fake learner is saved in this browser only.
  The rest of the app only talks to "Cloud", so nothing else changes when you switch modes.
*/
const Cloud = (function () {
  let demoReason = "";
  if (typeof FIREBASE_CONFIG === "undefined") {
    demoReason = "firebase-config.js did not load or has a typing mistake in it (press F12 and look in the Console for a red error).";
  } else if (!FIREBASE_CONFIG) {
    demoReason = "firebase-config.js still says null. Paste your Firebase settings into it and save the file.";
  } else if (typeof firebase === "undefined") {
    demoReason = "the Firebase scripts did not load. Check your internet connection and that index.html still has the three gstatic.com script lines.";
  }
  const live = demoReason === "";
  if (!live) console.warn("Enrom School is in demo mode because " + demoReason);
  let auth = null, db = null;
  const listeners = [];

  if (live) {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
  }

  // ----- demo storage helpers -----
  const DEMO_KEY = "enromDemoStore";
  function demoRead() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || {}; } catch (e) { return {}; }
  }
  function demoWrite(s) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function toUser(u) {
    return u ? { uid: u.uid, name: u.displayName || "", email: u.email || "" } : null;
  }
  function notify(u) { listeners.forEach((cb) => cb(u)); }

  return {
    isLive: !!live,
    demoReason: demoReason,

    // Calls cb(user or null) now and whenever sign-in state changes.
    onUser(cb) {
      listeners.push(cb);
      if (live) {
        if (listeners.length === 1) auth.onAuthStateChanged((u) => notify(toUser(u)));
      } else {
        cb(demoRead().user || null);
      }
    },

    signIn() {
      if (live) {
        return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      }
      const s = demoRead();
      s.user = { uid: "demo-learner", name: "Demo Learner", email: "demo@example.com" };
      demoWrite(s);
      notify(s.user);
      return Promise.resolve();
    },

    signOut() {
      if (live) return auth.signOut();
      const s = demoRead();
      delete s.user;
      demoWrite(s);
      notify(null);
      return Promise.resolve();
    },

    // ----- learner details (grade, parent, teachers) -----
    async loadProfile(uid) {
      if (live) {
        const d = await db.collection("users").doc(uid).get();
        return d.exists ? (d.data().profile || null) : null;
      }
      const s = demoRead();
      return (s.profiles && s.profiles[uid]) || null;
    },
    async saveProfile(uid, profile) {
      if (live) return db.collection("users").doc(uid).set({ profile: profile }, { merge: true });
      const s = demoRead();
      s.profiles = s.profiles || {};
      s.profiles[uid] = profile;
      demoWrite(s);
    },

    // ----- daily progress: one record per day, keyed by date (YYYY-MM-DD) -----
    async loadProgress(uid) {
      if (live) {
        const snap = await db.collection("users").doc(uid).collection("progress").get();
        const out = {};
        snap.forEach((d) => { out[d.id] = d.data(); });
        return out;
      }
      const s = demoRead();
      return (s.progress && s.progress[uid]) || {};
    },
    async saveProgress(uid, entry) {
      if (live) return db.collection("users").doc(uid).collection("progress").doc(entry.date).set(entry);
      const s = demoRead();
      s.progress = s.progress || {};
      s.progress[uid] = s.progress[uid] || {};
      s.progress[uid][entry.date] = entry;
      demoWrite(s);
    }
  };
})();