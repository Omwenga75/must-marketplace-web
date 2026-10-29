"use client";

import React, { useState } from "react";
import {
  Phone,
  Mail,
  Clock,
  Calendar,
  MapPin,
  Send,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setSubmitted(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-16 space-y-8 sm:space-y-12">
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Contact Us
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          Have a question, feedback, or need help with a transaction? Reach out to the MUST
          Marketplace team anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Contact Info Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Get in Touch
            </h2>
            <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <a
                href="tel:+254111307585"
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Direct Hotline</p>
                  <p className="font-semibold text-slate-900 dark:text-white">+254 111 307 585</p>
                </div>
              </a>

              <a
                href="mailto:must.marketplace@gmail.com"
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400 font-medium">Email Support</p>
                  <p className="font-semibold text-slate-900 dark:text-white truncate">must.marketplace@gmail.com</p>
                </div>
              </a>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Support Availability</p>
                  <p className="font-semibold text-slate-900 dark:text-white">24/7, Sunday – Monday</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Location</p>
                  <p className="font-semibold text-slate-900 dark:text-white">Meru University of Science and Technology</p>
                </div>
              </div>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Campus Security Notice</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              For your safety, always meet buyers and sellers in daylight hours at high-traffic campus zones like the Library Foyer, Student Center, or Gate A. Never pay prior to physical inspection.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Message Sent Successfully
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                  Thank you for reaching out. A team member or admin will review your inquiry and follow up shortly.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: "", email: "", subject: "", message: "" });
                  }}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Send Us a Message
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Brian Mwenda"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email or Student Reg No
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. brian@must.ac.ke"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Account verification or seller listing inquiry"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="How can we help you today?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Message</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
