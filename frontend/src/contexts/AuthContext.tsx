import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authApi, getToken, getStoredUser, setStoredUser, removeToken } from '@/lib/api';

interface Profile {
  id: string;
  user_id: string;
  phone: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  email: string | null;
  dob: string | null;
  is_disabled?: boolean;
  is_admin?: boolean;
}

interface User {
  id: string;
  user_id: string;
}

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  profile: Profile | null;
  isAdmin: boolean;
  isDisabled: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setRegistrationInProgress: (v: boolean) => void;
  setUserAndProfile: (user: User, profile: Profile, token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const registrationInProgressRef = useRef(false);

  const setRegistrationInProgress = (v: boolean) => {
    registrationInProgressRef.current = v;
  };

  const setUserAndProfile = (newUser: User, newProfile: Profile, token: string) => {
    setUser(newUser);
    setProfile(newProfile);
    setSession({ access_token: token });
    setIsAdmin(newProfile.is_admin || false);
    setIsDisabled(newProfile.is_disabled || false);
    setStoredUser(newProfile);
  };

  const fetchProfile = async () => {
    try {
      const token = getToken();
      if (!token) {
        return null;
      }

      const data = await authApi.getMe();
      return data as Profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    const profileData = await fetchProfile();
    if (profileData) {
      setProfile(profileData);
      setIsAdmin(profileData.is_admin || false);
      setIsDisabled(profileData.is_disabled || false);
      setStoredUser(profileData);
      setUser({ id: profileData.id, user_id: profileData.user_id });
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        setSession({ access_token: token });

        // Try to get stored user first for quick load
        const storedUser = getStoredUser();
        if (storedUser) {
          setProfile(storedUser);
          setUser({ id: storedUser.id, user_id: storedUser.user_id });
          setIsAdmin(storedUser.is_admin || false);
          setIsDisabled(storedUser.is_disabled || false);
        }

        // Fetch fresh profile from server
        const profileData = await fetchProfile();
        if (profileData) {
          setProfile(profileData);
          setUser({ id: profileData.id, user_id: profileData.user_id });
          setIsAdmin(profileData.is_admin || false);
          setIsDisabled(profileData.is_disabled || false);
          setStoredUser(profileData);
        } else if (!registrationInProgressRef.current) {
          // Token invalid, clear auth
          removeToken();
          setUser(null);
          setSession(null);
          setProfile(null);
          setIsAdmin(false);
          setIsDisabled(false);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (!registrationInProgressRef.current) {
          removeToken();
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      removeToken();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      setIsDisabled(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      isAdmin, 
      isDisabled, 
      loading, 
      signOut, 
      refreshProfile, 
      setRegistrationInProgress,
      setUserAndProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
