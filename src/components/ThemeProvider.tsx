import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (e?: React.MouseEvent) => void;
  isFixLagEnabled: boolean;
  toggleFixLag: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isFixLagEnabled, setIsFixLagEnabled] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme as Theme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const savedEco = localStorage.getItem('isFixLagEnabled') === 'true';
    setIsFixLagEnabled(savedEco);
    if (savedEco) {
      document.documentElement.classList.add('fix-lag');
    } else {
      document.documentElement.classList.remove('fix-lag');
    }
  }, []);

  const toggleFixLag = () => {
    const nextEco = !isFixLagEnabled;
    setIsFixLagEnabled(nextEco);
    localStorage.setItem('isFixLagEnabled', String(nextEco));
    if (nextEco) {
      document.documentElement.classList.add('fix-lag');
    } else {
      document.documentElement.classList.remove('fix-lag');
    }
  };

  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleTheme = (e?: React.MouseEvent) => {
    const newTheme = theme === "light" ? "dark" : "light";
    
    if (!document.startViewTransition || !e) {
      applyTheme(newTheme);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    );

    document.documentElement.classList.add('theme-transition');

    const transition = document.startViewTransition(() => {
      applyTheme(newTheme);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ]
        },
        {
          duration: 400,
          easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });

    transition.finished.then(() => {
      document.documentElement.classList.remove('theme-transition');
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isFixLagEnabled, toggleFixLag }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
