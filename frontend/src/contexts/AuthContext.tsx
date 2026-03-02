import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isDisabled: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setRegistrationInProgress: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_PHONE = '7326937200';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  // Flag to prevent ghost-user sign-out during registration
  const registrationInProgressRef = useRef(false);

  const setRegistrationInProgress = (v: boolean) => {
    registrationInProgressRef.current = v;
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data as Profile;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  };

  const checkAdminRole = async (userId: string, phone: string) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();
      
      if (roleData) {
        setIsAdmin(true);
      } else if (phone === ADMIN_PHONE) {
        await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
        setIsDisabled(profileData.is_disabled || false);
        await checkAdminRole(user.id, profileData.phone);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only set synchronous state here — no awaits to prevent deadlocks
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch — fire and forget, no blocking
          const userId = session.user.id;
          setTimeout(() => {
            fetchProfile(userId).then((profileData) => {
              if (profileData) {
                setProfile(profileData);
                setIsDisabled(profileData.is_disabled || false);
                // Fire and forget — don't await
                checkAdminRole(userId, profileData.phone);
              } else if (!registrationInProgressRef.current) {
                // Ghost user: auth exists but no profile AND not registering
                // Add a grace period — retry once after 3 seconds before signing out
                setTimeout(() => {
                  fetchProfile(userId).then((retryData) => {
                    if (retryData) {
                      setProfile(retryData);
                      setIsDisabled(retryData.is_disabled || false);
                      checkAdminRole(userId, retryData.phone);
                    } else if (!registrationInProgressRef.current) {
                      console.warn('Ghost user detected, signing out:', userId);
                      supabase.auth.signOut();
                      setUser(null);
                      setSession(null);
                      setProfile(null);
                      setIsAdmin(false);
                      setIsDisabled(false);
                    }
                  });
                }, 3000);
              }
              setLoading(false);
            }).catch(() => {
              setLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsDisabled(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          if (profileData) {
            setProfile(profileData);
            setIsDisabled(profileData.is_disabled || false);
            checkAdminRole(session.user.id, profileData.phone);
          }
          // Don't sign out ghost users on init — let onAuthStateChange handle it
          setLoading(false);
        }).catch(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsDisabled(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isDisabled, loading, signOut, refreshProfile, setRegistrationInProgress }}>
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
