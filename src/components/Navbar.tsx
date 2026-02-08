import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const isWizard = location.pathname === '/wizard';
  const baseUrl = import.meta.env.BASE_URL;

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src={`${baseUrl}logo.svg`}
              alt="HookWizard"
              className="w-9 h-9 rounded-xl shadow-sm group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-lg gradient-brand-text">
              HookWizard
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {!isWizard && (
              <Link to="/wizard">
                <Button variant="ghost" size="sm">
                  Launch App
                </Button>
              </Link>
            )}

            <ConnectButton />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="rounded-full"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
