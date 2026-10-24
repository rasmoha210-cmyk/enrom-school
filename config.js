/*
  Settings for where the Python "teacher brain" lives.

  - TEACHER_API_LOCAL: used when you open the site on your own computer (Live Server).
  - TEACHER_API_ONLINE: used on a hosted site (Netlify, a phone). Leave it empty ("") for now.
    While it is empty, the classroom uses its simple built-in answers on the hosted site.
    Later, when the backend is hosted online, put its https address here, for example:
    "https://enrom-teacher.onrender.com"
*/
const ENROM_CONFIG = {
  TEACHER_API_LOCAL: "http://127.0.0.1:8000",
  TEACHER_API_ONLINE: ""
};