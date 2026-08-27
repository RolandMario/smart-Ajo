"use client";

import { useState } from "react";

import Link from 'next/link'
// import { Menu, X, Download, Mail, ArrowRight, Shield, Users, Zap, Heart, CheckCircle, Smartphone } from 'lucide-react'
// import NavBar from "../components/navBar";
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
import {FaInstagram, FaTwitter, FaFacebook, FaLinkedin, FaWhatsapp} from "react-icons/fa";
import NavBar from "../components/navBar";
import Footer from "../components/footer";

export default function ContactPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    // Replace this with your actual form submission logic
    // (e.g. API route, Resend, Formspree, etc.)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // simulate
      setStatus("success");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
        <NavBar />
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-2xl">
            Have a question or want to work with Digital Smart Environment on your next project? We'd love to hear
            from you. Fill out the form or reach us through any of the channels below.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Contact Form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Send us a message
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                    placeholder="How can we help?"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg btn-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {status === "loading" ? "Sending..." : "Send Message"}
                </button>

                {status === "success" && (
                  <p className="text-sm text-green-600 font-medium">
                    Message sent successfully! We’ll get back to you soon.
                  </p>
                )}
                {status === "error" && (
                  <p className="text-sm text-red-600 font-medium">
                    Something went wrong. Please try again.
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Contact Info + Socials */}
          <div className="lg:col-span-2 space-y-6">
            {/* Physical Address & Contact Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-5">
                Get in touch
              </h2>

              <div className="space-y-5">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Our Office
                    </p>
                    <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                      1 Oguntolo Street <br />
                      Ijaiye(Mainland)<br />
                      Lagos, Nigeria
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Phone</p>
                    <a
                      href="tel:+2348012345678"
                      className="mt-1 text-sm text-gray-600 hover:text-blue-600 transition"
                    >
                      +234 706 849 7568
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <a
                      href="mailto:hello@digitalsmartenvironment.com"
                      className="mt-1 text-sm text-gray-600 hover:text-blue-600 transition"
                    >
                      hello@digitalsmartenvironment.com
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Business Hours
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Mon – Fri: 9:00 AM – 6:00 PM<br />
                      Sat: 10:00 AM – 2:00 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Handles */}
            {/* <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-5">
                Follow us
              </h2>

              <div className="space-y-3">
                <a
                  href="https://instagram.com/yourcompany"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group"
                >
                  <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center group-hover:bg-pink-100 transition">
                    <FaInstagram className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Instagram
                    </p>
                    <p className="text-xs text-gray-500">@yourcompany</p>
                  </div>
                </a>

                <a
                  href="https://twitter.com/yourcompany"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group"
                >
                  <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center group-hover:bg-sky-100 transition">
                    <FaTwitter className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">X (Twitter)</p>
                    <p className="text-xs text-gray-500">@yourcompany</p>
                  </div>
                </a>

                <a
                  href="https://facebook.com/yourcompany"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition">
                    <FaFacebook className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Facebook</p>
                    <p className="text-xs text-gray-500">/yourcompany</p>
                  </div>
                </a>

                <a
                  href="https://linkedin.com/company/yourcompany"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition">
                    <FaLinkedin className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">LinkedIn</p>
                    <p className="text-xs text-gray-500">/company/yourcompany</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/2348012345678"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                    <p className="text-xs text-gray-500">+234 801 234 5678</p>
                  </div>
                </a>
              </div>
            </div> */}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}