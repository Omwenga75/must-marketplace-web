"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { ref, get, set, update } from "firebase/database";
import { auth, database } from "@/lib/firebase/config";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (
    fullName: string,
    email: string,
    pass: string,
    isSeller?: boolean,
    location?: string,
    phone?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginAsDemoUser: (role: "buyer" | "seller" | "admin") => void;
  refreshUserData: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialCachedUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const isExplicitLogout = sessionStorage.getItem("must_explicit_logout") === "true";
    if (isExplicitLogout) return null;

    const demo = localStorage.getItem("must_demo_session");
    if (demo) return JSON.parse(demo);

    const active = localStorage.getItem("must_active_user");
    if (active) return JSON.parse(active);

    const activeUid = localStorage.getItem("must_active_uid");
    if (activeUid) {
      const cached = localStorage.getItem(`must_user_${activeUid}`);
      if (cached) return JSON.parse(cached);
    }
  } catch {}
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Always start null/loading on both server & client to prevent hydration mismatch.
  // Cache is restored in useEffect below (client-only).
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load user profile from Server API, Firebase, or local storage
  const fetchUserProfile = async (uid: string, fallbackEmail?: string) => {
    let profile: User | null = null;
    const emailLower = (fallbackEmail || "").toLowerCase().trim();
    const savedName = emailLower ? localStorage.getItem(`must_name_for_${emailLower}`) : null;
    const authDisplayName = auth?.currentUser?.displayName;

    // 1. First, check persistent server API (backed by data/users.json)
    if (typeof window !== "undefined") {
      try {
        const query = uid ? `id=${encodeURIComponent(uid)}` : `email=${encodeURIComponent(emailLower)}`;
        const res = await fetch(`/api/users?${query}`);
        if (res.ok) {
          const apiUser = await res.json();
          if (apiUser && (apiUser.id || apiUser.email)) {
            profile = {
              ...apiUser,
              id: uid || apiUser.id,
              seller: Boolean(apiUser.seller || apiUser.isSeller),
              isSeller: Boolean(apiUser.seller || apiUser.isSeller),
            };
          }
        }

        // Secondary check by email if found by id didn't match
        if (!profile && emailLower) {
          const resEmail = await fetch(`/api/users?email=${encodeURIComponent(emailLower)}`);
          if (resEmail.ok) {
            const apiUser = await resEmail.json();
            if (apiUser && (apiUser.id || apiUser.email)) {
              profile = {
                ...apiUser,
                id: uid || apiUser.id,
                seller: Boolean(apiUser.seller || apiUser.isSeller),
                isSeller: Boolean(apiUser.seller || apiUser.isSeller),
              };
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch user profile from /api/users:", err);
      }
    }

    // 2. Check Firebase Realtime Database
    if (database) {
      try {
        const snap = await get(ref(database, `users/${uid}`));
        if (snap.exists()) {
          const val = snap.val();
          let resolvedName = val.fullName;
          const isEmailLike =
            !resolvedName ||
            resolvedName.includes("@") ||
            (emailLower && resolvedName.toLowerCase() === emailLower.split("@")[0]);

          if (isEmailLike) {
            if (authDisplayName && !authDisplayName.includes("@")) {
              resolvedName = authDisplayName;
            } else if (profile?.fullName && !profile.fullName.includes("@")) {
              resolvedName = profile.fullName;
            } else if (savedName) {
              resolvedName = savedName;
            }
          }

          const isSeller = Boolean(val.seller || val.isSeller || profile?.seller || profile?.isSeller);

          profile = {
            id: uid,
            fullName: resolvedName || profile?.fullName || "MUST Student",
            email: val.email || fallbackEmail || profile?.email || "",
            phone: val.phone || profile?.phone || null,
            location: val.location || profile?.location || "Main Gate",
            profileImageUrl: val.profileImageUrl || profile?.profileImageUrl || null,
            seller: isSeller,
            isSeller: isSeller,
            admin: Boolean(val.admin || val.isAdmin || profile?.admin || profile?.isAdmin),
            isAdmin: Boolean(val.admin || val.isAdmin || profile?.admin || profile?.isAdmin),
            memberSince: val.memberSince || profile?.memberSince || String(Date.now()),
            activeListings: val.activeListings || profile?.activeListings || 0,
            soldItems: val.soldItems || profile?.soldItems || 0,
            likes: val.likes || profile?.likes || 0,
          };
        }
      } catch (err) {
        console.warn("Could not fetch user profile from Firebase:", err);
      }
    }

    // 3. Check local cache
    if (!profile) {
      const cached = localStorage.getItem(`must_user_${uid}`);
      if (cached) {
        try {
          profile = JSON.parse(cached);
          if (profile) {
            const isEmailLike =
              !profile.fullName ||
              profile.fullName.includes("@") ||
              (emailLower && profile.fullName.toLowerCase() === emailLower.split("@")[0]);

            if (isEmailLike) {
              if (authDisplayName && !authDisplayName.includes("@")) {
                profile.fullName = authDisplayName;
              } else if (savedName) {
                profile.fullName = savedName;
              }
            }
          }
        } catch {}
      }
    }

    // 4. Fallback profile creation
    if (!profile) {
      const initialName =
        authDisplayName && !authDisplayName.includes("@")
          ? authDisplayName
          : savedName || (emailLower === "omwengajane@gmail.com" ? "Mary Wanjiku" : "MUST Student");
      const isKnownSeller = emailLower === "omwengajane@gmail.com";
      profile = {
        id: uid,
        fullName: initialName,
        email: fallbackEmail || "",
        phone: isKnownSeller ? "+254 711 000 222" : null,
        location: "Main Gate",
        profileImageUrl: null,
        seller: isKnownSeller,
        isSeller: isKnownSeller,
        admin: fallbackEmail?.toLowerCase().includes("admin") || false,
        isAdmin: fallbackEmail?.toLowerCase().includes("admin") || false,
        memberSince: String(Date.now()),
        activeListings: isKnownSeller ? 1 : 0,
        soldItems: 0,
        likes: 0,
      };
    }

    if (profile) {
      // Keep server API synchronized
      if (typeof window !== "undefined") {
        try {
          fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...profile, id: uid }),
          }).catch(() => {});
        } catch {}
      }

      if (database) {
        try {
          await set(ref(database, `users/${uid}`), profile);
        } catch {}
      }

      localStorage.setItem(`must_user_${uid}`, JSON.stringify(profile));
      localStorage.setItem("must_active_user", JSON.stringify(profile));
      localStorage.setItem("must_active_uid", uid);
      setUser(profile);
    }
  };

  useEffect(() => {
    // Restore session immediately from cache on client mount
    const cached = getInitialCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
      if (cached.id) {
        localStorage.setItem("must_active_uid", cached.id);
        localStorage.setItem("must_active_user", JSON.stringify(cached));
      }
    }

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        localStorage.setItem("must_active_uid", fUser.uid);
        await fetchUserProfile(fUser.uid, fUser.email || "");
      } else {
        const demo = localStorage.getItem("must_demo_session");
        const isExplicitLogout = sessionStorage.getItem("must_explicit_logout") === "true";
        if (isExplicitLogout && !demo) {
          localStorage.removeItem("must_active_user");
          localStorage.removeItem("must_active_uid");
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    sessionStorage.removeItem("must_explicit_logout");
    localStorage.removeItem("must_demo_session");
    if (!auth) throw new Error("Firebase Auth not initialized");
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    localStorage.setItem("must_active_uid", cred.user.uid);
    await fetchUserProfile(cred.user.uid, cred.user.email || "");
  };

  const register = async (
    fullName: string,
    email: string,
    pass: string,
    isSeller: boolean = false,
    location: string = "Main Gate",
    phone: string = ""
  ) => {
    localStorage.removeItem("must_demo_session");
    if (!auth) throw new Error("Firebase Auth not initialized");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Cache the registered full name by email
    localStorage.setItem(`must_name_for_${trimmedEmail}`, trimmedName);

    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);

    // Save display name in Firebase Auth
    try {
      await updateProfile(cred.user, { displayName: trimmedName });
    } catch (e) {
      console.warn("Could not update auth displayName:", e);
    }

    const newUser: User = {
      id: cred.user.uid,
      fullName: trimmedName,
      email: trimmedEmail,
      phone: phone.trim() ? phone.trim() : null,
      location: location || "Main Gate",
      profileImageUrl: null,
      seller: isSeller,
      isSeller: isSeller,
      admin: trimmedEmail.includes("admin"),
      isAdmin: trimmedEmail.includes("admin"),
      memberSince: String(Date.now()),
      activeListings: 0,
      soldItems: 0,
      likes: 0,
    };

    // 1. Centralized server API
    if (typeof window !== "undefined") {
      try {
        await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser),
        });
      } catch (e) {
        console.warn("Failed to save registered user to /api/users:", e);
      }
    }

    if (database) {
      try {
        await set(ref(database, `users/${cred.user.uid}`), newUser);
      } catch (err) {
        console.warn("Failed to set user in DB:", err);
      }
    }

    localStorage.setItem(`must_user_${cred.user.uid}`, JSON.stringify(newUser));

    // Do NOT log in immediately upon registration. Sign out so user must log in from login page
    try {
      await fbSignOut(auth);
    } catch {}
    setUser(null);
    setFirebaseUser(null);
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const isSeller = Boolean(
      updates.isSeller ?? updates.seller ?? user.isSeller ?? user.seller
    );
    const updated: User = {
      ...user,
      ...updates,
      seller: isSeller,
      isSeller: isSeller,
    };
    setUser(updated);
    localStorage.setItem(`must_user_${user.id}`, JSON.stringify(updated));

    if (updates.fullName) {
      if (auth?.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: updates.fullName });
        } catch {}
      }
      if (user.email) {
        localStorage.setItem(`must_name_for_${user.email.toLowerCase()}`, updates.fullName);
      }
    }

    localStorage.setItem("must_active_user", JSON.stringify(updated));

    // 1. Update centralized server API
    if (typeof window !== "undefined") {
      try {
        fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            ...updates,
            seller: isSeller,
            isSeller: isSeller,
          }),
        }).catch(() => {});
      } catch {}
    }

    // 2. Update Firebase Realtime Database
    if (database && user.id) {
      try {
        await update(ref(database, `users/${user.id}`), {
          ...updates,
          seller: isSeller,
          isSeller: isSeller,
        });
      } catch (err) {
        console.warn("Error updating user in DB:", err);
      }
    }
  };

  const logout = async () => {
    sessionStorage.setItem("must_explicit_logout", "true");
    localStorage.removeItem("must_demo_session");
    localStorage.removeItem("must_active_user");
    localStorage.removeItem("must_active_uid");
    localStorage.removeItem("must_saved_login");

    if (auth) {
      try {
        await fbSignOut(auth);
      } catch {}
    }
    setUser(null);
    setFirebaseUser(null);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Firebase Auth not initialized");
    await sendPasswordResetEmail(auth, email);
  };

  const loginAsDemoUser = (role: "buyer" | "seller" | "admin") => {
    const demoProfiles: Record<"buyer" | "seller" | "admin", User> = {
      buyer: {
        id: "demo_buyer_123",
        fullName: "Ian Kiprop",
        email: "ian.kiprop@student.must.ac.ke",
        phone: "+254 712 345 678",
        location: "California Hostels",
        profileImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400",
        seller: false,
        isSeller: false,
        admin: false,
        isAdmin: false,
        memberSince: "1704067200000",
        activeListings: 0,
        soldItems: 0,
        likes: 12,
      },
      seller: {
        id: "demo_seller_456",
        fullName: "James Mutua (Seller)",
        email: "james.mutua@student.must.ac.ke",
        phone: "+254 712 345 678",
        location: "Nchiru",
        profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400",
        seller: true,
        isSeller: true,
        admin: false,
        isAdmin: false,
        memberSince: "1698796800000",
        activeListings: 4,
        soldItems: 11,
        likes: 45,
      },
      admin: {
        id: "demo_admin_789",
        fullName: "MUST Admin",
        email: "admin@must.ac.ke",
        phone: "+254 700 000 001",
        location: "Administration Block",
        profileImageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400",
        seller: true,
        isSeller: true,
        admin: true,
        isAdmin: true,
        memberSince: "1672531200000",
        activeListings: 0,
        soldItems: 0,
        likes: 99,
      },
    };

    const chosen = demoProfiles[role];
    sessionStorage.removeItem("must_explicit_logout");
    localStorage.setItem("must_demo_session", JSON.stringify(chosen));
    localStorage.setItem("must_active_user", JSON.stringify(chosen));
    localStorage.setItem("must_active_uid", chosen.id);
    setUser(chosen);
  };

  const refreshUserData = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id, user.email);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        login,
        register,
        logout,
        resetPassword,
        loginAsDemoUser,
        refreshUserData,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
