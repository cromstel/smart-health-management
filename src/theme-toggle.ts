// On page load or when changing themes, best to add inline in `head` to avoid FOUC
(function() {
  const root = document.documentElement;
  const theme = localStorage.theme;

  if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Define global functions to avoid TypeScript errors and make them accessible
  (window as any).toggleTheme = () => {
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.theme = "light";
    } else {
      root.classList.add("dark");
      localStorage.theme = "dark";
    }
  };

  (window as any).setSystemTheme = () => {
    localStorage.removeItem("theme");
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };
})();
