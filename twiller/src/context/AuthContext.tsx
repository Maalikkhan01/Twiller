"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { auth } from "./firebase";
import axiosInstance from "@/lib/axiosInstance";

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  email: string;
  website: string;
  location: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => Promise<void>;
  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  googlesignin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser?.email) {
        setUser(null);
        localStorage.removeItem("twitter-user");
        setIsLoading(false);
        return;
      }

      if (skipNextFetch.current) {
        skipNextFetch.current = false;
        setIsLoading(false);
        return;
      }

      try {
        const res = await axiosInstance.get("/loggedinuser");
        if (res.data) {
          setUser(res.data);
          localStorage.setItem("twitter-user", JSON.stringify(res.data));
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          const newUser = {
            username: firebaseUser.email.split("@")[0],
            displayName: firebaseUser.displayName || "User",
            avatar: firebaseUser.photoURL || "https://i.pravatar.cc/150",
            email: firebaseUser.email,
          };
          const registerRes = await axiosInstance.post("/register", newUser);
          setUser(registerRes.data);
          localStorage.setItem(
            "twitter-user",
            JSON.stringify(registerRes.data),
          );
        } else {
          console.log("Failed to fetch user:", err);
        }
      } finally {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => {
    setIsLoading(true);
    try {
      skipNextFetch.current = true;
      const usercred = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const firebaseUser = usercred.user;
      const newuser = {
        username,
        displayName,
        avatar:
          firebaseUser.photoURL ||
          "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
        email: firebaseUser.email,
      };
      const res = await axiosInstance.post("/register", newuser);
      if (res.data) {
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
      }
    } catch (error) {
      skipNextFetch.current = false;
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem("twitter-user");
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
  }) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await axiosInstance.patch(
        `/userupdate/${user.email}`,
        profileData,
      );
      if (res.data) {
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const googlesignin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      alert(
        error?.response?.data?.message ||
          error.message ||
          "Google login failed",
      );
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        updateProfile,
        logout,
        isLoading,
        googlesignin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
