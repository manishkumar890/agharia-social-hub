import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import sambalpuriPattern from '@/assets/sambalpuri-pattern.jpg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Phone, Shield, ArrowRight, Loader2, Mail, Lock, User, Camera, Eye, EyeOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('login');
  
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
  const [regOtp, setRegOtp] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  
  // Login state
  const [loginStep, setLoginStep] = useState<'form' | 'otp'>('form');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // OTP state
  const [resendTimer, setResendTimer] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

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

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Avatar image must be less than 2MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setRegAvatar(file);
      setRegAvatarPreview(URL.createObjectURL(file));
    }
  };

  // Registration Step 1: Submit form and send OTP
  const handleRegisterSubmit = async () => {
    // Validate all fields
    try {
      usernameSchema.parse(regUsername);
      emailSchema.parse(regEmail);
      passwordSchema.parse(regPassword);
      phoneSchema.parse(regPhone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    if (!regFullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setDemoOtp(null);

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
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: regPhone }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.otp) {
        setDemoOtp(data.otp);
      }

      toast.success(data?.message || 'OTP sent successfully!');
      setRegStep('otp');
      setResendTimer(60);
    } catch (error: unknown) {
      console.error('Registration Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Registration Step 2: Verify OTP and create account
  const handleRegisterVerifyOtp = async () => {
    try {
      otpSchema.parse(regOtp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-otp', {
        body: { phone: regPhone, otp: regOtp }
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

  // Store email for login OTP verification
  const [loginEmail, setLoginEmail] = useState('');

  // Login Step 1: Verify credentials
  const handleLoginSubmit = async () => {
    if (!loginIdentifier.trim()) {
      toast.error('Please enter your username or email');
      return;
    }

    try {
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);
    setDemoOtp(null);

    try {
      // Determine if identifier is email or username
      const isEmail = loginIdentifier.includes('@');
      let email = loginIdentifier.toLowerCase();
      let phone = '';

      if (!isEmail) {
        // It's a username, find the email and phone
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, phone')
          .eq('username', loginIdentifier.toLowerCase())
          .maybeSingle();

        if (!profile || !profile.email) {
          toast.error('User not found');
          setIsLoading(false);
          return;
        }
        email = profile.email;
        phone = profile.phone;
      } else {
        // It's an email, find the phone
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('email', loginIdentifier.toLowerCase())
          .maybeSingle();

        if (!profile) {
          toast.error('User not found');
          setIsLoading(false);
          return;
        }
        phone = profile.phone;
      }

      // Verify password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword
      });

      if (signInError) {
        toast.error('Invalid credentials');
        setIsLoading(false);
        return;
      }

      // Password is correct, sign out and send OTP for verification
      await supabase.auth.signOut();

      // Store phone and email for OTP verification step
      setLoginPhone(phone);
      setLoginEmail(email);

      // Send OTP
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set all state updates together to ensure they persist
      const otpCode = data?.otp;
      
      setDemoOtp(otpCode || null);
      setResendTimer(60);
      setLoginStep('otp');
      
      toast.success('OTP sent for verification');
    } catch (error: unknown) {
      console.error('Login Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Login Step 2: Verify OTP and complete login
  const handleLoginVerifyOtp = async () => {
    try {
      otpSchema.parse(loginOtp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-otp', {
        body: { phone: loginPhone, otp: loginOtp }
      });

      if (verifyError) throw verifyError;
      if (verifyData?.error) throw new Error(verifyData.error);

      // OTP verified, use stored email to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });

      if (signInError) {
        throw new Error('Authentication failed');
      }

      toast.success('Welcome back!');
      navigate('/');
    } catch (error: unknown) {
      console.error('Login Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid OTP';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async (phone: string) => {
    setIsLoading(true);
    setDemoOtp(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.otp) {
        setDemoOtp(data.otp);
      }

      toast.success('OTP resent successfully!');
      setResendTimer(60);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend OTP';
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
  };

  const resetLogin = () => {
    setLoginStep('form');
    setLoginIdentifier('');
    setLoginPassword('');
    setLoginPhone('');
    setLoginEmail('');
    setLoginOtp('');
    setDemoOtp(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <div 
        className="h-40 w-full bg-cover bg-center relative"
        style={{ backgroundImage: `url(${sambalpuriPattern})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/40 to-background" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center">
          <h1 className="text-4xl font-display font-bold text-gold drop-shadow-lg tracking-wide mb-2">
            Agharia Samaj
          </h1>
          <p className="text-primary-foreground/90 text-sm font-medium">
            अघरिया समाज
          </p>
        </div>
      </div>

      {/* Auth Form */}
      <div className="px-4 -mt-8 pb-8">
        <Card className="max-w-md mx-auto shadow-elegant">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-xl">
              {authMode === 'register' 
                ? (regStep === 'form' ? 'Create Account' : 'Verify Mobile')
                : (loginStep === 'form' ? 'Welcome Back' : 'Verify Mobile')
              }
            </CardTitle>
            <CardDescription>
              {authMode === 'register'
                ? (regStep === 'form' 
                    ? 'Join the Agharia community' 
                    : `Enter the 6-digit code sent to +91 ${regPhone}`)
                : (loginStep === 'form' 
                    ? 'Login to your account' 
                    : `Enter the 6-digit code sent to +91 ${loginPhone}`)
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={authMode} onValueChange={(v) => {
              setAuthMode(v as 'register' | 'login');
              resetRegistration();
              resetLogin();
            }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-4">
                {loginStep === 'form' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="loginIdentifier">Username or Email</Label>
                      <div className="relative">
                        <Input
                          id="loginIdentifier"
                          type="text"
                          placeholder="Enter username or email"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          className="pl-10"
                        />
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="loginPassword">Password</Label>
                      <div className="relative">
                        <Input
                          id="loginPassword"
                          type={showLoginPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10 pr-10"
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
                      className="w-full gradient-maroon text-primary-foreground"
                      onClick={handleLoginSubmit}
                      disabled={isLoading || !loginIdentifier.trim() || !loginPassword}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Continue
                    </Button>
                  </>
                ) : (
                  <>
                    {demoOtp && (
                      <div className="p-3 bg-secondary/50 rounded-lg border border-secondary text-center">
                        <p className="text-xs text-muted-foreground mb-1">Demo OTP</p>
                        <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">{demoOtp}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="loginOtp">Enter OTP</Label>
                      <div className="relative">
                        <Input
                          id="loginOtp"
                          type="text"
                          placeholder="000000"
                          value={loginOtp}
                          onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="text-center text-2xl tracking-[0.5em] font-mono"
                          maxLength={6}
                        />
                        <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <Button 
                      className="w-full gradient-maroon text-primary-foreground"
                      onClick={handleLoginVerifyOtp}
                      disabled={isLoading || loginOtp.length !== 6}
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Verify & Login
                    </Button>

                    <div className="text-center space-y-2">
                      <Button 
                        variant="link" 
                        className="text-sm text-muted-foreground"
                        onClick={resetLogin}
                      >
                        Change credentials
                      </Button>
                      {resendTimer > 0 ? (
                        <p className="text-sm text-muted-foreground">Resend OTP in {resendTimer}s</p>
                      ) : (
                        <Button 
                          variant="link" 
                          className="text-sm text-primary"
                          onClick={() => handleResendOtp(loginPhone)}
                          disabled={isLoading}
                        >
                          Resend OTP
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="space-y-4">
                {regStep === 'form' ? (
                  <>
                    {/* Avatar Upload */}
                    <div className="flex justify-center">
                      <div className="relative">
                        <Avatar className="w-24 h-24 border-4 border-primary/20">
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
                          className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors"
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
                      Upload avatar (max 2MB)
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="regFullName">Full Name *</Label>
                      <Input
                        id="regFullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="regUsername">Username *</Label>
                      <div className="relative">
                        <Input
                          id="regUsername"
                          type="text"
                          placeholder="Choose a username"
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className="pl-10"
                        />
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="regEmail">Email *</Label>
                      <div className="relative">
                        <Input
                          id="regEmail"
                          type="email"
                          placeholder="Enter your email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="pl-10"
                        />
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="regPhone">Mobile Number *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          +91
                        </span>
                        <Input
                          id="regPhone"
                          type="tel"
                          placeholder="Enter 10 digit number"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="pl-12"
                          maxLength={10}
                        />
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="regPassword">Password *</Label>
                      <div className="relative">
                        <Input
                          id="regPassword"
                          type={showRegPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="pl-10 pr-10"
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
                      <Label htmlFor="regConfirmPassword">Confirm Password *</Label>
                      <div className="relative">
                        <Input
                          id="regConfirmPassword"
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          className="pl-10 pr-10"
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
                      className="w-full gradient-maroon text-primary-foreground"
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
                  </>
                ) : (
                  <>
                    {demoOtp && (
                      <div className="p-3 bg-secondary/50 rounded-lg border border-secondary text-center">
                        <p className="text-xs text-muted-foreground mb-1">Demo OTP</p>
                        <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">{demoOtp}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="regOtp">Enter OTP</Label>
                      <div className="relative">
                        <Input
                          id="regOtp"
                          type="text"
                          placeholder="000000"
                          value={regOtp}
                          onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="text-center text-2xl tracking-[0.5em] font-mono"
                          maxLength={6}
                        />
                        <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    <Button 
                      className="w-full gradient-maroon text-primary-foreground"
                      onClick={handleRegisterVerifyOtp}
                      disabled={isLoading || regOtp.length !== 6}
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Verify & Create Account
                    </Button>

                    <div className="text-center space-y-2">
                      <Button 
                        variant="link" 
                        className="text-sm text-muted-foreground"
                        onClick={resetRegistration}
                      >
                        Back to form
                      </Button>
                      {resendTimer > 0 ? (
                        <p className="text-sm text-muted-foreground">Resend OTP in {resendTimer}s</p>
                      ) : (
                        <Button 
                          variant="link" 
                          className="text-sm text-primary"
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
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Auth;