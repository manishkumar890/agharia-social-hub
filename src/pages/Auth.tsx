import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { safeNormalize, safeStorage, compatFetch } from '@/lib/polyfills';
import sambalpuriPattern from '@/assets/sambalpuri-pattern.jpg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Phone, Shield, ArrowRight, Loader2, Mail, Lock, User, Camera, Eye, EyeOff, KeyRound, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AvatarCropDialog from '@/components/AvatarCropDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Validation schemas
const phoneSchema = z.string()
  .length(10, 'Phone number must be exactly 10 digits')
  .regex(/^\d+$/, 'Phone number must contain only digits');

const otpSchema = z.string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d+$/, 'OTP must contain only digits');

const emailSchema = z.string()
  .email('Please enter a valid email address');

const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters');

const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

const OTP_REQUEST_TIMEOUT_MS = 25000;
const LOGIN_REQUEST_TIMEOUT_MS = 20000;
const LOGIN_RETRY_COUNT = 1;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isLikelyNetworkError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to send a request to the edge function') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('timed out') ||
    normalized.includes('aborted') ||
    normalized.includes('the operation was aborted') ||
    normalized.includes('load failed') ||
    normalized.includes('fetch') ||
    normalized.includes('network')
  );
};

const getOtpRequestErrorMessage = (error: unknown, fallbackMessage: string) => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return isLikelyNetworkError(message)
    ? 'Network issue while sending OTP. Please check your internet connection and try again.'
    : message;
};

const getApiBaseConfig = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  return {
    supabaseUrl,
    supabaseKey,
    baseHeaders: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  };
};

const fetchWithTimeout = async (input: string, init: RequestInit & { headers?: Record<string, string> }, timeoutMs: number) => {
  return compatFetch(input, {
    method: init.method || 'GET',
    headers: (init.headers || {}) as Record<string, string>,
    body: init.body as string | undefined,
    timeoutMs,
  });
};

const resolveEmailFromIdentifier = async (identifier: string, isPhone: boolean): Promise<string | null> => {
  const { supabaseUrl, baseHeaders } = getApiBaseConfig();
  const column = isPhone ? 'phone' : 'username';

  for (var attempt = 0; attempt <= LOGIN_RETRY_COUNT; attempt++) {
    try {
      const query = new URLSearchParams({
        select: 'email',
        [column]: 'eq.' + identifier,
        limit: '1',
      });

      const response = await compatFetch(
        supabaseUrl + '/rest/v1/profiles?' + query.toString(),
        {
          method: 'GET',
          headers: {
            ...baseHeaders,
            Accept: 'application/json',
          },
          timeoutMs: LOGIN_REQUEST_TIMEOUT_MS,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Identifier lookup failed');
      }

      const rows = (await response.json()) as Array<{ email: string | null }>;
      return (rows && rows[0] && rows[0].email) || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Identifier lookup failed';
      if (!isLikelyNetworkError(message) || attempt === LOGIN_RETRY_COUNT) {
        throw error;
      }
      await sleep(600);
    }
  }

  return null;
};

const signInWithPasswordFallback = async (email: string, password: string) => {
  const { supabaseUrl, baseHeaders } = getApiBaseConfig();

  for (var attempt = 0; attempt <= LOGIN_RETRY_COUNT; attempt++) {
    try {
      const response = await compatFetch(
        supabaseUrl + '/auth/v1/token?grant_type=password',
        {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ email: email, password: password }),
          timeoutMs: LOGIN_REQUEST_TIMEOUT_MS,
        }
      );

      const bodyText = await response.text();
      var payload: any = {};
      try { payload = bodyText ? JSON.parse(bodyText) : {}; } catch { payload = {}; }

      if (!response.ok) {
        const description = payload.error_description || payload.msg || payload.message || 'Login failed';
        return { error: new Error(description) };
      }

      if (!payload.access_token || !payload.refresh_token) {
        return { error: new Error('Login response is missing session tokens') };
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });

      if (setSessionError) {
        return { error: setSessionError };
      }

      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      if (!isLikelyNetworkError(message) || attempt === LOGIN_RETRY_COUNT) {
        return { error: error instanceof Error ? error : new Error('Login failed') };
      }
      await sleep(600);
    }
  }

  return { error: new Error('Login failed') };
};

// Use raw fetch with AbortController + retry for reliable OTP on all browsers
const invokeFunctionWithTimeout = async <TData = any>(
  functionName: string,
  body: unknown,
  timeoutMs = OTP_REQUEST_TIMEOUT_MS,
  maxRetries = 2
): Promise<{ data: TData | null; error: Error | null }> => {
  const { supabaseUrl, baseHeaders } = getApiBaseConfig();
  const url = supabaseUrl + '/functions/v1/' + functionName;
  var lastError: Error | null = null;

  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await compatFetch(url, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify(body),
        timeoutMs: timeoutMs,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        var errorMessage = 'Request failed';
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          errorMessage = errorBody || errorMessage;
        }
        // Don't retry non-network server errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return { data: null, error: new Error(errorMessage) };
        }
        lastError = new Error(errorMessage);
      } else {
        const data = await response.json();
        return { data: data as TData, error: null };
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error('Request timed out. Please try again.');
      } else {
        lastError = err instanceof Error ? err : new Error('Failed to send request. Please try again.');
      }
    }

    // Wait before retrying (exponential backoff: 1s, 2s)
    if (attempt < maxRetries) {
      await sleep((attempt + 1) * 1000);
    }
  }

  return { data: null, error: lastError };
};

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login' | 'forgot'>('login');
  
  // Registration state
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regAvatar, setRegAvatar] = useState<File | null>(null);
  const [regAvatarPreview, setRegAvatarPreview] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [regOtp, setRegOtp] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  
  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Forgot password state
  const [forgotStep, setForgotStep] = useState<'phone' | 'otp' | 'newPassword'>('phone');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotUserId, setForgotUserId] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  
  // OTP state
  const [resendTimer, setResendTimer] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otpRequestError, setOtpRequestError] = useState<string | null>(null);
  const [lookupFallbackOpen, setLookupFallbackOpen] = useState(false);

  // If device was previously marked incompatible, redirect immediately
  useEffect(() => {
    if (safeStorage.getItem('device_incompatible') === 'true') {
      window.location.href = 'https://aghariasamaj.netlify.app';
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const MAX_AVATAR_SIZE_MB = 5;
  const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        toast.error(`Image size must be less than ${MAX_AVATAR_SIZE_MB}MB. Selected: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
      setCropDialogOpen(true);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    setRegAvatar(croppedFile);
    setRegAvatarPreview(URL.createObjectURL(croppedFile));
    setCropDialogOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  };

  // Registration Step 1: Submit form and send OTP
  const handleRegisterSubmit = async () => {
    // Validate all fields
    const usernameResult = usernameSchema.safeParse(regUsername);
    if (!usernameResult.success) {
      toast.error(usernameResult.error.errors[0].message);
      return;
    }

    const emailResult = emailSchema.safeParse(regEmail);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      return;
    }

    const passwordResult = passwordSchema.safeParse(regPassword);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.errors[0].message);
      return;
    }

    const phoneResult = phoneSchema.safeParse(regPhone);
    if (!phoneResult.success) {
      toast.error(phoneResult.error.errors[0].message);
      return;
    }

    if (!regFullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (!regAvatar) {
      toast.error('Please upload a profile picture');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setDemoOtp(null);
    setOtpRequestError(null);

    try {
      // Check if username already exists
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', regUsername.toLowerCase())
        .maybeSingle();

      if (existingUsername) {
        toast.error('Username already taken');
        setIsLoading(false);
        return;
      }

      // Check if email already exists
      const { data: existingEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', regEmail.toLowerCase())
        .maybeSingle();

      if (existingEmail) {
        toast.error('Email already registered');
        setIsLoading(false);
        return;
      }

      // Check if phone already exists
      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', regPhone)
        .maybeSingle();

      if (existingPhone) {
        toast.error('Phone number already registered');
        setIsLoading(false);
        return;
      }

      // Send OTP to phone
      const { data, error } = await invokeFunctionWithTimeout<{ message?: string; otp?: string; error?: string }>('send-otp', {
        phone: regPhone,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.otp) {
        setDemoOtp(data.otp);
      }

      toast.success(data?.message || 'OTP sent successfully!');
      setOtpRequestError(null);
      setRegStep('otp');
      setResendTimer(60);
    } catch (error: unknown) {
      console.error('Registration Error:', error);
      const errorMessage = getOtpRequestErrorMessage(error, 'Failed to send OTP');
      setOtpRequestError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Registration Step 2: Verify OTP and create account
  const handleRegisterVerifyOtp = async () => {
    const otpResult = otpSchema.safeParse(regOtp);
    if (!otpResult.success) {
      toast.error(otpResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await invokeFunctionWithTimeout<{ success?: boolean; error?: string; isNewUser?: boolean; userId?: string; email?: string; password?: string }>('verify-otp', {
        phone: regPhone, otp: regOtp
      });

      if (verifyError) throw verifyError;
      if (verifyData?.error) throw new Error(verifyData.error);

      // Create the auth user with email/password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            phone: regPhone,
            username: regUsername.toLowerCase(),
            full_name: regFullName
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!signUpData.user) {
        throw new Error('Failed to create account');
      }

      // Upload avatar if provided
      let avatarUrl: string | null = null;
      if (regAvatar) {
        const fileExt = regAvatar.name.split('.').pop();
        const fileName = `${signUpData.user.id}/avatar.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, regAvatar, { upsert: true });

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrlData.publicUrl;
        }
      }

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: signUpData.user.id,
        phone: regPhone,
        email: regEmail.toLowerCase(),
        username: regUsername.toLowerCase(),
        full_name: regFullName.trim(),
        avatar_url: avatarUrl
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Even if profile fails, auth user was created
      }

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: regEmail,
        password: regPassword
      });

      if (signInError) {
        console.error('Auto sign-in error:', signInError);
        toast.success('Account created! Please login.');
        setAuthMode('login');
        resetRegistration();
      } else {
        toast.success('Welcome! Account created successfully.');
        navigate('/');
      }
    } catch (error: unknown) {
      console.error('Registration Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple Login - just credentials, no OTP
  const handleLoginSubmit = async () => {
    if (!loginIdentifier.trim()) {
      toast.error('Please enter your username, email, or phone number');
      return;
    }

    const pwResult = passwordSchema.safeParse(loginPassword);
    if (!pwResult.success) {
      toast.error(pwResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    // 15-second overall timeout — if login doesn't finish, show compatibility popup
    const LOGIN_TIMEOUT = 15000;
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      setIsLoading(false);
      setLookupFallbackOpen(true);
    }, LOGIN_TIMEOUT);

    try {
      const identifier = safeNormalize(loginIdentifier, 'NFKC').trim().toLowerCase();
      const password = safeNormalize(loginPassword, 'NFKC');
      const isEmail = identifier.includes('@');
      const isPhone = /^\d{10}$/.test(identifier);

      let email = identifier;

      if (!isEmail) {
        try {
          const resolvedEmail = await resolveEmailFromIdentifier(identifier, isPhone);

          if (didTimeout) return;

          if (!resolvedEmail) {
            clearTimeout(timeoutId);
            toast.error('User not found. Please check your username, email, or phone number.');
            return;
          }

          email = resolvedEmail;
        } catch (lookupError) {
          if (didTimeout) return;
          clearTimeout(timeoutId);
          console.error('Profile lookup error:', lookupError);
          const message = lookupError instanceof Error ? lookupError.message : 'Unable to connect.';

          if (isLikelyNetworkError(message)) {
            setLookupFallbackOpen(true);
          } else {
            toast.error('Unable to verify username. Please try again.');
          }
          return;
        }
      }

      if (didTimeout) return;

      // Primary login via SDK
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (didTimeout) return;
      clearTimeout(timeoutId);

      if (signInError) {
        const message = signInError.message || 'Login failed';

        // Fallback for Android/WebView devices that intermittently fail fetch/auth handshake
        if (isLikelyNetworkError(message)) {
          const fallback = await signInWithPasswordFallback(email, password);

          if (fallback.error) {
            const fallbackMessage = fallback.error.message || 'Login failed';
            if (isLikelyNetworkError(fallbackMessage)) {
              setLookupFallbackOpen(true);
            } else {
              toast.error(fallbackMessage);
            }
            return;
          }
        } else {
          toast.error('Invalid credentials. Please check your password.');
          return;
        }
      }

      toast.success('Welcome back!');
      navigate('/');
    } catch (error: unknown) {
      if (didTimeout) return;
      clearTimeout(timeoutId);
      console.error('Login Error:', error);
      const msg = error instanceof Error ? error.message : '';
      if (isLikelyNetworkError(msg)) {
        setLookupFallbackOpen(true);
      } else {
        toast.error(msg || 'Login failed. Please try again.');
      }
    } finally {
      if (!didTimeout) {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    }
  };

  // Forgot Password Step 1: Send OTP to phone
  const handleForgotSendOtp = async () => {
    const phoneResult = phoneSchema.safeParse(forgotPhone);
    if (!phoneResult.success) {
      toast.error(phoneResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    setDemoOtp(null);
    setOtpRequestError(null);

    try {
      // Find user by phone
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, email')
        .eq('phone', forgotPhone)
        .maybeSingle();

      if (!profile) {
        toast.error('No account found with this phone number');
        setIsLoading(false);
        return;
      }

      setForgotUserId(profile.user_id);
      setForgotEmail(profile.email || '');

      // Send OTP
      const { data, error } = await invokeFunctionWithTimeout<{ message?: string; otp?: string; error?: string }>('send-otp', {
        phone: forgotPhone,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.otp) {
        setDemoOtp(data.otp);
      }

      toast.success('OTP sent to your phone');
      setOtpRequestError(null);
      setForgotStep('otp');
      setResendTimer(60);
    } catch (error: unknown) {
      console.error('Forgot Password Error:', error);
      const errorMessage = getOtpRequestErrorMessage(error, 'Failed to send OTP');
      setOtpRequestError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Step 2: Verify OTP
  const handleForgotVerifyOtp = async () => {
    const otpResult = otpSchema.safeParse(forgotOtp);
    if (!otpResult.success) {
      toast.error(otpResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await invokeFunctionWithTimeout<{ success?: boolean; error?: string }>('verify-otp', {
        phone: forgotPhone, otp: forgotOtp
      });

      if (verifyError) throw verifyError;
      if (verifyData?.error) throw new Error(verifyData.error);

      toast.success('OTP verified! Set your new password');
      setForgotStep('newPassword');
    } catch (error: unknown) {
      console.error('OTP Verification Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid OTP';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Step 3: Set new password
  const handleForgotSetPassword = async () => {
    const pwResult = passwordSchema.safeParse(forgotNewPassword);
    if (!pwResult.success) {
      toast.error(pwResult.error.errors[0].message);
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Use the reset-password edge function with compatibility wrapper
      const { data, error } = await invokeFunctionWithTimeout<{ error?: string }>('reset-password', {
        userId: forgotUserId,
        newPassword: forgotNewPassword,
        phone: forgotPhone,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Password reset successfully! Please login with your new password.');
      resetForgotPassword();
      setAuthMode('login');
    } catch (error: unknown) {
      console.error('Password Reset Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async (phone: string) => {
    setIsLoading(true);
    setDemoOtp(null);
    setOtpRequestError(null);

    try {
      const { data, error } = await invokeFunctionWithTimeout<{ message?: string; otp?: string; error?: string }>('send-otp', {
        phone,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.otp) {
        setDemoOtp(data.otp);
      }

      toast.success('OTP resent successfully!');
      setOtpRequestError(null);
      setResendTimer(60);
    } catch (error: unknown) {
      const errorMessage = getOtpRequestErrorMessage(error, 'Failed to resend OTP');
      setOtpRequestError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetRegistration = () => {
    setRegStep('form');
    setRegPhone('');
    setRegEmail('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegFullName('');
    setRegAvatar(null);
    setRegAvatarPreview(null);
    setRegOtp('');
    setDemoOtp(null);
    setOtpRequestError(null);
  };

  const resetLogin = () => {
    setLoginIdentifier('');
    setLoginPassword('');
  };

  const resetForgotPassword = () => {
    setForgotStep('phone');
    setForgotPhone('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotUserId('');
    setForgotEmail('');
    setDemoOtp(null);
    setOtpRequestError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-secondary/5">
      <div className="flex min-h-screen">
        {/* Desktop Left Panel - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
          <div 
            className="absolute inset-0 opacity-60"
            style={{ 
              backgroundImage: `url(${sambalpuriPattern})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-primary/40" />
          <div className="relative z-10 text-center px-12">
            <h1 className="text-5xl font-bold tracking-wide mb-4">
              <span className="bg-gradient-to-r from-secondary via-yellow-300 to-secondary bg-clip-text text-transparent drop-shadow-lg">
                Agharia Samaj
              </span>
            </h1>
            <p className="text-primary-foreground/90 text-lg font-medium mb-2">
              अघरिया समाज • ଅଘରିଆ ସମାଜ
            </p>
            <p className="text-primary-foreground/70 text-sm max-w-sm mx-auto mt-6">
              Connect with the Agharia community. Share moments, stories, and stay connected.
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="w-full lg:w-1/2 flex flex-col">
          {/* Mobile Header */}
          <div className="relative overflow-hidden lg:hidden">
            <div 
              className="absolute inset-0 opacity-60"
              style={{ 
                backgroundImage: `url(${sambalpuriPattern})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/50 to-primary/30" />
            <div className="relative z-10 px-6 pt-10 pb-16 text-center">
              <h1 className="text-4xl font-bold tracking-wide mb-2">
                <span className="bg-gradient-to-r from-secondary via-yellow-300 to-secondary bg-clip-text text-transparent drop-shadow-lg">
                  Agharia Samaj
                </span>
              </h1>
              <p className="text-primary-foreground/90 text-sm font-medium">
                अघरिया समाज • ଅଘରିଆ ସମାଜ
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0">
              <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-8">
                <path d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 25C1200 20 1320 10 1380 5L1440 0V60H1380C1320 60 1200 60 1080 60C960 60 840 60 720 60C600 60 480 60 360 60C240 60 120 60 60 60H0Z" fill="transparent"/>
              </svg>
            </div>
          </div>

    {/* Auth Form */}
    <div className="px-4 -mt-4 lg:mt-0 pb-8 flex-1 flex flex-col justify-center lg:max-w-lg lg:mx-auto lg:w-full">
      <Card className="shadow-lg border-2 border-primary/10 bg-transparent backdrop-blur-md">
          {/* Decorative Top Border */}
          <div className="h-1 bg-gradient-to-r from-primary via-secondary to-primary rounded-t-lg" />
          
          <CardHeader className="text-center pb-4 pt-6">
            <div className="mb-2 inline-flex mx-auto items-center gap-2">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-secondary" />
              <span className="text-secondary text-lg">✦</span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-secondary" />
            </div>
            <CardTitle className="text-xl font-semibold text-foreground">
              {authMode === 'register' 
                ? (regStep === 'form' ? 'Create Account' : 'Verify Mobile')
                : authMode === 'forgot'
                  ? (forgotStep === 'phone' 
                      ? 'Forgot Password' 
                      : forgotStep === 'otp' 
                        ? 'Verify Mobile' 
                        : 'Set New Password')
                  : 'Welcome Back'
              }
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {authMode === 'register'
                ? (regStep === 'form' 
                    ? 'Join the Agharia community' 
                    : `Enter the 6-digit code sent to +91 ${regPhone}`)
                : authMode === 'forgot'
                  ? (forgotStep === 'phone' 
                      ? 'Enter your registered mobile number' 
                      : forgotStep === 'otp'
                        ? `Enter the 6-digit code sent to +91 ${forgotPhone}`
                        : 'Create a new password for your account')
                  : 'Login to your account'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="px-5 pb-6">
            {authMode === 'forgot' ? (
              // Forgot Password Flow
              <div className="space-y-4">
                {forgotStep === 'phone' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="forgotPhone" className="text-sm font-medium">Mobile Number</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          +91
                        </span>
                        <Input
                          id="forgotPhone"
                          type="tel"
                          placeholder="Enter 10 digit number"
                          value={forgotPhone}
                          onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="pl-12 h-12 rounded-xl border-2 focus:border-primary/50"
                          maxLength={10}
                        />
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                      onClick={handleForgotSendOtp}
                      disabled={isLoading || forgotPhone.length !== 10}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Send OTP
                    </Button>

                    {otpRequestError && (
                      <p className="text-sm text-destructive text-center">{otpRequestError}</p>
                    )}

                    <Button 
                      variant="ghost" 
                      className="w-full text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setOtpRequestError(null);
                        resetForgotPassword();
                        setAuthMode('login');
                      }}
                    >
                      Back to Login
                    </Button>
                  </>
                )}

                {forgotStep === 'otp' && (
                  <>
                    {demoOtp && (
                      <div className="p-4 bg-secondary/20 rounded-xl border border-secondary/30 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Your OTP is</p>
                        <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">{demoOtp}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="forgotOtp" className="text-sm font-medium">Enter OTP</Label>
                      <div className="relative">
                        <Input
                          id="forgotOtp"
                          type="text"
                          placeholder="000000"
                          value={forgotOtp}
                          onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="text-center text-2xl tracking-[0.5em] font-mono h-14 rounded-xl border-2 focus:border-primary/50"
                          maxLength={6}
                        />
                        <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                      onClick={handleForgotVerifyOtp}
                      disabled={isLoading || forgotOtp.length !== 6}
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Verify OTP
                    </Button>

                    <div className="text-center space-y-2">
                      <Button 
                        variant="ghost" 
                        className="text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => setForgotStep('phone')}
                      >
                        Change phone number
                      </Button>
                      {resendTimer > 0 ? (
                        <p className="text-sm text-muted-foreground">Resend OTP in {resendTimer}s</p>
                      ) : (
                        <Button 
                          variant="ghost" 
                          className="text-sm text-primary hover:text-primary/80"
                          onClick={() => handleResendOtp(forgotPhone)}
                          disabled={isLoading}
                        >
                          Resend OTP
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {forgotStep === 'newPassword' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="forgotNewPassword" className="text-sm font-medium">New Password</Label>
                      <div className="relative">
                        <Input
                          id="forgotNewPassword"
                          type={showForgotPassword ? 'text' : 'password'}
                          placeholder="Enter new password"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          className="pl-10 pr-10 h-12 rounded-xl border-2 focus:border-primary/50"
                        />
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(!showForgotPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showForgotPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="forgotConfirmPassword" className="text-sm font-medium">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="forgotConfirmPassword"
                          type={showForgotConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm new password"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          className="pl-10 pr-10 h-12 rounded-xl border-2 focus:border-primary/50"
                        />
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <button
                          type="button"
                          onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                      onClick={handleForgotSetPassword}
                      disabled={isLoading || !forgotNewPassword || !forgotConfirmPassword}
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Reset Password
                    </Button>

                    <Button 
                      variant="ghost" 
                      className="w-full text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        resetForgotPassword();
                        setAuthMode('login');
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            ) : (
              // Login/Register Tabs
              <Tabs value={authMode} onValueChange={(v) => {
                setAuthMode(v as 'register' | 'login');
                setOtpRequestError(null);
                resetRegistration();
                resetLogin();
              }}>
                <TabsList className="grid w-full grid-cols-2 mb-6 h-12 p-1 bg-muted/50 rounded-xl">
                  <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm font-medium">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm font-medium">
                    Register
                  </TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginIdentifier" className="text-sm font-medium">Username or Email</Label>
                    <div className="relative">
                      <Input
                        id="loginIdentifier"
                        type="text"
                        placeholder="Enter username or email"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        className="pl-10 h-12 rounded-xl border-2 focus:border-primary/50"
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loginPassword" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="loginPassword"
                        type={showLoginPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10 pr-10 h-12 rounded-xl border-2 focus:border-primary/50"
                      />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                    onClick={handleLoginSubmit}
                    disabled={isLoading || !loginIdentifier.trim() || !loginPassword}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="w-4 h-4 mr-2" />
                    )}
                    Login
                  </Button>

                  <Button 
                    variant="ghost" 
                    className="w-full text-sm text-primary hover:text-primary/80"
                    onClick={() => {
                      resetLogin();
                      setAuthMode('forgot');
                    }}
                  >
                    Forgot Password?
                  </Button>
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register" className="space-y-4">
                  {regStep === 'form' ? (
                    <>
                      {/* Avatar Upload */}
                      <div className="flex justify-center">
                        <div className="relative">
                          <Avatar className={`w-24 h-24 border-4 ${regAvatarPreview ? 'border-secondary/50' : 'border-destructive/50'} shadow-lg`}>
                            {regAvatarPreview ? (
                              <AvatarImage src={regAvatarPreview} alt="Avatar preview" />
                            ) : (
                              <AvatarFallback className="bg-muted">
                                <User className="w-8 h-8 text-muted-foreground" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <label 
                            htmlFor="avatarUpload" 
                            className="absolute bottom-0 right-0 bg-secondary text-secondary-foreground rounded-full p-2.5 cursor-pointer hover:bg-secondary/90 transition-colors shadow-md"
                          >
                            <Camera className="w-4 h-4" />
                          </label>
                          <input 
                            id="avatarUpload" 
                            type="file" 
                            accept="image/*" 
                            onChange={handleAvatarChange}
                            className="hidden" 
                          />
                        </div>
                      </div>
                      <p className="text-center text-xs text-muted-foreground">
                        Upload Profile Picture * <span className="text-muted-foreground/70">(max 5MB)</span>
                      </p>

                      {/* Avatar Crop Dialog */}
                      {cropImageSrc && (
                        <AvatarCropDialog
                          open={cropDialogOpen}
                          onClose={() => {
                            setCropDialogOpen(false);
                            if (cropImageSrc) {
                              URL.revokeObjectURL(cropImageSrc);
                              setCropImageSrc(null);
                            }
                          }}
                          imageSrc={cropImageSrc}
                          onCropComplete={handleCropComplete}
                        />
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="regFullName" className="text-sm font-medium">Full Name *</Label>
                        <Input
                          id="regFullName"
                          type="text"
                          placeholder="Enter your full name"
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          className="h-12 rounded-xl border-2 focus:border-primary/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regUsername" className="text-sm font-medium">Username *</Label>
                        <div className="relative">
                          <Input
                            id="regUsername"
                            type="text"
                            placeholder="Choose a username"
                            value={regUsername}
                            onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="pl-10 h-12 rounded-xl border-2 focus:border-primary/50"
                          />
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regEmail" className="text-sm font-medium">Email *</Label>
                        <div className="relative">
                          <Input
                            id="regEmail"
                            type="email"
                            placeholder="Enter your email"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="pl-10 h-12 rounded-xl border-2 focus:border-primary/50"
                          />
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regPhone" className="text-sm font-medium">Mobile Number *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                            +91
                          </span>
                          <Input
                            id="regPhone"
                            type="tel"
                            placeholder="Enter 10 digit number"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="pl-12 h-12 rounded-xl border-2 focus:border-primary/50"
                            maxLength={10}
                          />
                          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regPassword" className="text-sm font-medium">Password *</Label>
                        <div className="relative">
                          <Input
                            id="regPassword"
                            type={showRegPassword ? 'text' : 'password'}
                            placeholder="Create a password"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className="pl-10 pr-10 h-12 rounded-xl border-2 focus:border-primary/50"
                          />
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="regConfirmPassword" className="text-sm font-medium">Confirm Password *</Label>
                        <div className="relative">
                          <Input
                            id="regConfirmPassword"
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm your password"
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            className="pl-10 pr-10 h-12 rounded-xl border-2 focus:border-primary/50"
                          />
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <Button 
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                        onClick={handleRegisterSubmit}
                        disabled={isLoading || !regFullName.trim() || !regUsername || !regEmail || !regPhone || !regPassword || !regConfirmPassword}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <ArrowRight className="w-4 h-4 mr-2" />
                        )}
                        Send Verification OTP
                      </Button>

                      {otpRequestError && (
                        <p className="text-sm text-destructive text-center">{otpRequestError}</p>
                      )}

                      <div className="p-3 bg-secondary/30 rounded-xl border border-border text-center">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          ⚠️ If the verification OTP is taking too long, you can complete your registration using{' '}
                          <a
                            href="https://aghariasamaj.netlify.app"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              setTimeout(() => {
                                window.location.reload();
                              }, 500);
                            }}
                            className="text-primary font-semibold underline underline-offset-2 inline-flex items-center gap-1"
                          >
                            this link <ExternalLink className="w-3 h-3 inline" />
                          </a>
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {demoOtp && (
                        <div className="p-4 bg-secondary/20 rounded-xl border border-secondary/30 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Your OTP is</p>
                          <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">{demoOtp}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="regOtp" className="text-sm font-medium">Enter OTP</Label>
                        <div className="relative">
                          <Input
                            id="regOtp"
                            type="text"
                            placeholder="000000"
                            value={regOtp}
                            onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="text-center text-2xl tracking-[0.5em] font-mono h-14 rounded-xl border-2 focus:border-primary/50"
                            maxLength={6}
                          />
                          <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>

                      <Button 
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                        onClick={handleRegisterVerifyOtp}
                        disabled={isLoading || regOtp.length !== 6}
                      >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Verify & Create Account
                      </Button>

                      <div className="text-center space-y-2">
                        <Button 
                          variant="ghost" 
                          className="text-sm text-muted-foreground hover:text-foreground"
                          onClick={resetRegistration}
                        >
                          Back to form
                        </Button>
                        {resendTimer > 0 ? (
                          <p className="text-sm text-muted-foreground">Resend OTP in {resendTimer}s</p>
                        ) : (
                          <Button 
                            variant="ghost" 
                            className="text-sm text-primary hover:text-primary/80"
                            onClick={() => handleResendOtp(regPhone)}
                            disabled={isLoading}
                          >
                            Resend OTP
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={lookupFallbackOpen} onOpenChange={(open) => {
          setLookupFallbackOpen(open);
          if (!open) {
            // Mark device as incompatible so next visit auto-redirects
            safeStorage.setItem('device_incompatible', 'true');
            window.location.href = 'https://aghariasamaj.netlify.app';
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Device Compatibility Notice</AlertDialogTitle>
              <AlertDialogDescription>
                We are from Agharia Samaj AI, and after checking your device, it appears that it is not fully compatible to run this app.
                You will now be redirected to our trusted website where you can access all features smoothly.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <a
                href="https://aghariasamaj.netlify.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              >
                https://aghariasamaj.netlify.app
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => {
                safeStorage.setItem('device_incompatible', 'true');
                window.location.href = 'https://aghariasamaj.netlify.app';
              }}>
                Continue to Website
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground px-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
