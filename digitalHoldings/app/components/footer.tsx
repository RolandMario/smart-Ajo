
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
                  <span className="text-xl font-bold text-white">D</span>
                </div>
                <span className="text-xl font-bold text-ajo-ink">Digital Smart<br />Environment</span>
              </div>
              <p className="text-sm text-ajo-inkSoft leading-relaxed">
                A forward-thinking technology company specializing in the design, development, and delivery of innovative digital solutions. Ajo is one of our flagship projects.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Quick Links</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <a href="/#about" className="text-ajo-inkSoft hover:text-ajo-ink transition">About</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Services</a>
                <a href="/#projects" className="text-ajo-inkSoft hover:text-ajo-ink transition">Projects</a>
                <a href="/#why-us" className="text-ajo-inkSoft hover:text-ajo-ink transition">Why Us</a>
                <Link href="/privacy-policy" className="text-ajo-inkSoft hover:text-ajo-ink transition">Privacy Policy</Link>
                <Link href="/terms-and-conditions" className="text-ajo-inkSoft hover:text-ajo-ink transition">Terms & Conditions</Link>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Services</h3>
              <nav className="flex flex-col space-y-2 text-sm">
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Custom Software Development</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Mobile & Web Apps</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Responsive Website Design</a>
                <a href="/#services" className="text-ajo-inkSoft hover:text-ajo-ink transition">Digital Transformation</a>
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ajo-ink">Get in Touch</h3>
              <div className="space-y-2 text-sm">
                <a href="mailto:hello@digitalsmartenvironment.com" className="flex items-center gap-2 text-ajo-inkSoft hover:text-ajo-ink transition">
                  <Mail className="h-4 w-4" />
                  hello@digitalsmartenvironment.com
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-ajo-line pt-8 text-center text-sm text-ajo-inkSoft">
            <p>&copy; 2026 Digital Smart Environment. All rights reserved. <Link href="/privacy-policy" className="font-semibold hover:text-ajo-ink">Privacy Policy</Link> · <Link href="/terms-and-conditions" className="font-semibold hover:text-ajo-ink">Terms & Conditions</Link></p>
          </div>
        </div>
      </footer>
    )
}