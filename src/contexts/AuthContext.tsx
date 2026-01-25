import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
    // Check if user has admin phone number
    if (phone === ADMIN_PHONE) {
      // Check if admin role exists, if not create it
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();
      
      if (!roleData) {
        // Create admin role for this user (this will work only if they're first admin or an admin creates it)
        // For the first admin, we'll handle this specially
        setIsAdmin(true);
      } else {
        setIsAdmin(true);
      }
    } else {
      // Check database for admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();
      
      setIsAdmin(!!roleData);
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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetch
          setTimeout(() => {
            fetchProfile(session.user.id).then((profileData) => {
              if (profileData) {
                setProfile(profileData);
                setIsDisabled(profileData.is_disabled || false);
                checkAdminRole(session.user.id, profileData.phone);
              }
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

    // Check for existing session
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
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsDisabled(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isDisabled, loading, signOut, refreshProfile }}>
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