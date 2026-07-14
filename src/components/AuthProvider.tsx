import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, ensureUserSetup } from '../lib/supabase';
import { ActivityTracker } from '../lib/adminApi';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string, username?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Check if we're in password recovery mode
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Handle invalid refresh token errors during initialization
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('Refresh Token Not Found') ||
            error.message?.includes('refresh_token_not_found')) {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        console.error('Session initialization error:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      // Handle any unexpected errors during session initialization
      console.error('Unexpected session initialization error:', error);
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle password recovery events
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      if (event === 'TOKEN_REFRESHED' && !session) {
        // Handle failed token refresh
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Reset password recovery state when user is signed in normally
      if (session && event === 'SIGNED_IN') {
        setIsPasswordRecovery(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    // Track login activity
    ActivityTracker.trackLogin().catch(console.error);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://streammanager.com.br/',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;

    // Track login activity
    ActivityTracker.trackLogin().catch(console.error);
  };

  const signInWithDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: 'https://streammanager.com.br/',
      },
    });
    if (error) throw error;

    // Track login activity
    ActivityTracker.trackLogin().catch(console.error);
  };

  const signUp = async (email: string, password: string, fullName?: string, username?: string) => {
    // Check for affiliate code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const affiliateCode = urlParams.get('ref');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          affiliate_code: affiliateCode
        }
      }
    });
    
    if (error) {
      if (error.message.includes('User already registered')) {
        throw new Error('User already registered');
      }
      throw error;
    }

    // If signup was successful and we have user data, create profile
    if (data.user && fullName) {
      try {
        await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            username: username || null,
            role: 'customer',
            language: 'pt',
          approved: true,
          affiliate_code: affiliateCode
          });

        // If there's an affiliate code, create the referral relationship
        if (affiliateCode) {
          try {
            const { data: referralResult, error: referralError } = await supabase
              .rpc('create_affiliate_referral', {
                p_affiliate_code: affiliateCode,
                p_referred_user_id: data.user.id
              });

            if (referralError) {
              console.error('Error creating affiliate referral:', referralError);
            } else if (referralResult) {
              console.log('Affiliate referral created successfully');
            }
          } catch (affiliateError) {
            console.error('Error processing affiliate referral:', affiliateError);
          }
        }
      } catch (profileError) {
        // Profile creation error is not critical for signup
        console.error('Error creating profile:', profileError);
      }
    }
  };

  const clearLocalSession = () => {
    setSession(null);
    setUser(null);
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // ignore
    }
  };

  const signOut = async () => {
    // Track logout activity before signing out
    ActivityTracker.trackLogout().catch(console.error);

    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error: any) {
      // Ignore session-related errors — we still need to clear local state
      if (!error.message?.includes('session_not_found') &&
          !error.message?.includes('Session from session_id claim in JWT does not exist') &&
          !error.message?.includes('Invalid Refresh Token') &&
          !error.message?.includes('Auth session missing!') &&
          error.status !== 403) {
        console.error('Unexpected error during signOut:', error);
      }
    } finally {
      clearLocalSession();
    }
  };

  const value = {
    user,
    session,
    loading,
    isPasswordRecovery,
    setIsPasswordRecovery,
    signIn,
    signInWithGoogle,
    signInWithDiscord,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}