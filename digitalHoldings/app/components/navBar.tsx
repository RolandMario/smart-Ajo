
"use client";

import { useState } from "react";
import {
  MapPin,
  Phone,
  Download,
  Mail,
  Menu,
  X,
  Clock,
  MessageCircle,
} from "lucide-react";
export default function NavBar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
     <header className="sticky top-0 z-40 border-b border-ajo-line bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="/#top" className="flex items-center gap-3 font-extrabold text-ajo-ink">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ajo-primary">
              <span className="text-xl font-bold text-white">A</span>
            </div>
            <span className="text-xl">Ajo</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-ajo-inkSoft md:flex">
            <a href="/#about" className="transition hover:text-ajo-ink">About</a>
            <a href="/#services" className="transition hover:text-ajo-ink">Services</a>
            <a href="/#how-it-works" className="transition hover:text-ajo-ink">How It Works</a>
            <a href="/#why-us" className="transition hover:text-ajo-ink">Why Us</a>
            <a href="/contact" className="transition hover:text-ajo-ink">Contact</a>
            <button className="inline-flex items-center gap-2 rounded-full bg-ajo-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg">
              <Download className="h-4 w-4" />
              Download App
            </button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ajo-primary px-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:shadow-lg sm:px-5">
              <Download className="h-4 w-4" />
              Get App
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-menu-trigger"
              type="button"
              aria-label="Open navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-ajo-line bg-white">
            <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
              <div className="flex flex-col space-y-3 pt-3">
                <a href="#about" className="text-sm font-semibold text-ajo-inkSoft hover:text-ajo-ink">About</a>
                <a href="#services" className="text-sm font-semibold text-ajo-inkSoft hover:text-ajo-ink">Services</a>
                <a href="#how-it-works" className="text-sm font-semibold text-ajo-inkSoft hover:text-ajo-ink">How It Works</a>
                <a href="#why-us" className="text-sm font-semibold text-ajo-inkSoft hover:text-ajo-ink">Why Us</a>
                <a href="#contact" className="text-sm font-semibold text-ajo-inkSoft hover:text-ajo-ink">Contact</a>
              </div>
            </div>
          </nav>
        )}
      </header>
    )
}