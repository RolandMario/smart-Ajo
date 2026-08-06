
"use client";

import { useState } from "react";
import Link from 'next/link'
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
export default function Footer() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
              <footer className="bg-ajo-surfaceSunken border-t border-ajo-line px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ajo-primary">
                  <span className="text-xl font-bold text-white">A</span>
                </div>
                <span className="text-xl font-bold text-ajo-ink">Ajo</span>
              </div>
              <p className="text-sm text-ajo-inkSoft leading-relaxed">
                Digital savings and investment platform. Save together, thrive together.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Quick Links</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <a href="/#about" className="text-ajo-inkSoft hover:text-ajo-ink transition">About</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Services</a>
                <a href="/#how-it-works" className="text-ajo-inkSoft hover:text-ajo-ink transition">How It Works</a>
                <a href="/#why-us" className="text-ajo-inkSoft hover:text-ajo-ink transition">Why Us</a>
                <Link href="/privacy-policy" className="text-ajo-inkSoft hover:text-ajo-ink transition">Privacy Policy</Link>
                <Link href="/terms-and-conditions" className="text-ajo-inkSoft hover:text-ajo-ink transition">Terms & Conditions</Link>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Services</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Create Groups</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Join Groups</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Automated Savings</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Rotating Payouts</a>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Get in Touch</h3>
              <div className="space-y-2 text-sm">
                <a href="/contact" className="flex items-center gap-2 text-ajo-inkSoft hover:text-ajo-ink transition">
                  <Mail className="h-4 w-4" />
                  rolandmario2@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-ajo-line pt-8 text-center text-sm text-ajo-inkSoft">
            <p>&copy; 2026 Ajo Digital Smart Environment. All rights reserved. <Link href="/privacy-policy" className="font-semibold hover:text-ajo-ink">Privacy Policy</Link> · <Link href="/terms-and-conditions" className="font-semibold hover:text-ajo-ink">Terms & Conditions</Link></p>
          </div>
        </div>
      </footer>
    )
}