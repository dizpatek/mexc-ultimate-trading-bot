"use client";

import { Moon, Sun, Wallet, Bell, Settings, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PanicButton } from './PanicButton';

export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user, logout } = useAuth();

    const toggleTheme = () => {
        // Theme toggle functionality would go here
        document.documentElement.classList.toggle('dark');
    };

    const handleLogout = () => {
        logout();
        setIsMenuOpen(false);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">MEXC Portfolio</h1>
                </div>

                <div className="flex items-center space-x-4">
                    <PanicButton />

                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Toggle theme"
                    >
                        <Sun className="h-5 w-5 hidden dark:block" />
                        <Moon className="h-5 w-5 block dark:hidden" />
                    </button>

                    <button
                        className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden md:block"
                        aria-label="Notifications"
                    >
                        <Bell className="h-5 w-5" />
                    </button>

                    <button
                        className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden md:block"
                        aria-label="Settings"
                    >
                        <Settings className="h-5 w-5" />
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center space-x-2 focus:outline-none"
                            aria-label="User menu"
                        >
                            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                                <span className="text-sm font-bold text-primary-foreground">
                                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            </div>
                            <div className="hidden sm:flex flex-col text-left text-xs">
                                <span className="font-semibold text-foreground">{user?.username || 'User'}</span>
                                <span className="text-muted-foreground">{user?.email || 'Free Plan'}</span>
                            </div>
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
                                <div className="p-3 border-b border-border">
                                    <p className="font-medium text-foreground">{user?.username || 'User'}</p>
                                    <p className="text-sm text-muted-foreground">{user?.email || 'Free Plan'}</p>
                                </div>
                                <div className="py-1">
                                    <button className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center">
                                        <Settings className="h-4 w-4 mr-2" />
                                        Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center"
                                    >
                                        <LogOut className="h-4 w-4 mr-2" />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
