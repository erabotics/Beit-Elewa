// Anti-clickjacking: show the page only when it is not framed inside another site.
if (window.top === window.self) {
  document.documentElement.classList.add('unframed');
} else {
  try { window.top.location = window.self.location.href; } catch (e) { /* stays hidden */ }
}
