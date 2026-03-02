import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, profileApi, uploadApi, setToken, getToken } from '@/lib/api';
import sambalpuriPattern from '@/assets/sambalpuri-pattern.jpg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Phone, Shield, ArrowRight, Loader2, Mail, Lock, User, Camera, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AvatarCropDialog from '@/components/AvatarCropDialog';

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
  const { user, loading, setRegistrationInProgress, setUserAndProfile, refreshProfile } = useAuth();
  
  // Common state
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login' | 'forgot'>('login');
  
  // Registration state
  const [regStep, setRegStep] = useState<'info' | 'password' | 'phone' | 'otp' | 'avatar'>('info');
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  
  // OTP state
  const [resendTimer, setResendTimer] = useState(0);
  const [otpRequestError, setOtpRequestError] = useState<string | null>(null);

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

  // Registration Step 1: Validate info and check uniqueness
  const handleRegInfoNext = async () => {
    if (!regFullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
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

    setIsLoading(true);
    try {
      const usernameCheck = await profileApi.checkUsername(regUsername.toLowerCase());
      if (!usernameCheck.available) {
        toast.error('Username already taken');
        return;
      }
      
      const emailCheck = await profileApi.checkEmail(regEmail.toLowerCase());
      if (!emailCheck.available) {
        toast.error('Email already registered');
        return;
      }
      
      setRegStep('password');
    } catch (error: unknown) {
      toast.error('Failed to validate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Registration Step 2: Validate password
  const handleRegPasswordNext = () => {
    const passwordResult = passwordSchema.safeParse(regPassword);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.errors[0].message);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setRegStep('phone');
  };

  // Registration Step 3: Validate phone and send OTP
  const handleRegPhoneSendOtp = async () => {
    const phoneResult = phoneSchema.safeParse(regPhone);
    if (!phoneResult.success) {
      toast.error(phoneResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    setOtpRequestError(null);

    try {
      const phoneCheck = await profileApi.checkPhone(regPhone);
      if (!phoneCheck.available) {
        toast.error('Phone number already registered');
        setIsLoading(false);
        return;
      }

      await authApi.sendOtp(regPhone);
      toast.success('OTP sent successfully!');
      setOtpRequestError(null);
      setRegStep('otp');
      setResendTimer(60);
    } catch (error: unknown) {
      console.error('Registration Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      setOtpRequestError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Registration Step 4: Verify OTP only — then go to avatar step
  const handleRegisterVerifyOtp = async () => {
    const otpResult = otpSchema.safeParse(regOtp);
    if (!otpResult.success) {
      toast.error(otpResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.verifyOtp(regPhone, regOtp, 'register');
      toast.success('Phone verified! Now add your profile photo.');
      setRegStep('avatar');
    } catch (error: unknown) {
      console.error('OTP Verification Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid OTP';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Registration Step 5: Upload avatar and create account
  const handleAvatarSubmitAndCreateAccount = async () => {
    if (!regAvatar) {
      toast.error('Please upload a profile picture');
      return;
    }

    setIsLoading(true);
    setRegistrationInProgress(true);

    try {
      // Register user
      const result = await authApi.register({
        phone: regPhone,
        email: regEmail.toLowerCase(),
        username: regUsername.toLowerCase(),
        password: regPassword,
        full_name: regFullName.trim(),
      });

      // Upload avatar
      if (regAvatar) {
        try {
          const uploadResult = await uploadApi.uploadFile('avatars', regAvatar);
          // Avatar URL is automatically updated in profile by the backend
        } catch (uploadError) {
          console.warn('Avatar upload failed:', uploadError);
        }
      }

      // Refresh profile to get latest data including avatar
      await refreshProfile();

      toast.success('Welcome! Account created successfully.');
      navigate('/');
    } catch (error: unknown) {
      console.error('Registration Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      toast.error(errorMessage);
    } finally {
      setRegistrationInProgress(false);
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

    try {
      const identifier = loginIdentifier.trim().toLowerCase();
      await authApi.login(identifier, loginPassword);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: unknown) {
      console.error('Login Error:', error);
      const msg = error instanceof Error ? error.message : 'Login failed';
      toast.error(msg || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
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
    setOtpRequestError(null);

    try {
      // Check if phone exists
      const phoneCheck = await profileApi.checkPhone(forgotPhone);
      if (phoneCheck.available) {
        toast.error('No account found with this phone number');
        setIsLoading(false);
        return;
      }

      await authApi.sendOtp(forgotPhone);
      toast.success('OTP sent to your phone');
      setOtpRequestError(null);
      setForgotStep('otp');
      setResendTimer(60);
    } catch (error: unknown) {
      console.error('Forgot Password Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
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
      await authApi.verifyOtp(forgotPhone, forgotOtp);
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
      await authApi.resetPassword(forgotPhone, forgotNewPassword);
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
    setOtpRequestError(null);

    try {
      await authApi.sendOtp(phone);
      toast.success('OTP resent successfully!');
      setOtpRequestError(null);
      setResendTimer(60);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend OTP';
      setOtpRequestError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetRegistration = () => {
    setRegStep('info');
    setRegPhone('');
    setRegEmail('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegFullName('');
    setRegAvatar(null);
    setRegAvatarPreview(null);
    setRegOtp('');
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
                    ? regStep === 'info' ? 'Create Account'
                      : regStep === 'password' ? 'Set Password'
                      : regStep === 'phone' ? 'Verify Mobile'
                      : regStep === 'otp' ? 'Enter OTP'
                      : 'Profile Photo'
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
                    ? regStep === 'info'
                        ? 'Join the Agharia community' 
                        : regStep === 'password'
                        ? 'Create a secure password'
                        : regStep === 'phone'
                        ? 'Enter your mobile number for verification'
                        : regStep === 'otp'
                        ? `Enter the 6-digit code sent to +91 ${regPhone}`
                        : 'Add a profile photo to complete setup'
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
                      {/* Step indicator */}
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {['info', 'password', 'phone', 'otp', 'avatar'].map((step, i) => (
                          <div key={step} className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                              ['info', 'password', 'phone', 'otp', 'avatar'].indexOf(regStep) >= i 
                                ? 'bg-primary' : 'bg-muted'
                            }`} />
                            {i < 4 && <div className={`w-6 h-0.5 transition-colors ${
                              ['info', 'password', 'phone', 'otp', 'avatar'].indexOf(regStep) > i 
                                ? 'bg-primary' : 'bg-muted'
                            }`} />}
                          </div>
                        ))}
                      </div>

                      {/* Step 1: Basic Info */}
                      {regStep === 'info' && (
                        <>
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

                          <Button 
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                            onClick={handleRegInfoNext}
                            disabled={isLoading || !regFullName.trim() || !regUsername || !regEmail}
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                            Next
                          </Button>
                        </>
                      )}

                      {/* Step 2: Password */}
                      {regStep === 'password' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="regPassword" className="text-sm font-medium">Password *</Label>
                            <div className="relative">
                              <Input
                                id="regPassword"
                                type={showRegPassword ? 'text' : 'password'}
                                placeholder="Create a password (min 6 chars)"
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

                          <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setRegStep('info')}>
                              Back
                            </Button>
                            <Button 
                              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                              onClick={handleRegPasswordNext}
                              disabled={!regPassword || !regConfirmPassword}
                            >
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Next
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Step 3: Phone Number */}
                      {regStep === 'phone' && (
                        <>
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

                          {otpRequestError && (
                            <p className="text-sm text-destructive text-center">{otpRequestError}</p>
                          )}

                          <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setRegStep('password')}>
                              Back
                            </Button>
                            <Button 
                              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                              onClick={handleRegPhoneSendOtp}
                              disabled={isLoading || regPhone.length !== 10}
                            >
                              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                              Send OTP
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Step 4: OTP Verification */}
                      {regStep === 'otp' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="regOtp" className="text-sm font-medium">Enter OTP sent to +91 {regPhone}</Label>
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
                            Verify OTP
                          </Button>

                          <div className="text-center space-y-2">
                            <Button 
                              variant="ghost" 
                              className="text-sm text-muted-foreground hover:text-foreground"
                              onClick={() => { setRegStep('phone'); setRegOtp(''); }}
                            >
                              Change number
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

                      {/* Step 5: Avatar Upload */}
                      {regStep === 'avatar' && (
                        <>
                          <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                              <Avatar className="w-32 h-32 border-4 border-primary/20">
                                {regAvatarPreview ? (
                                  <AvatarImage src={regAvatarPreview} alt="Avatar preview" />
                                ) : (
                                  <AvatarFallback className="bg-muted text-4xl">
                                    {regFullName.charAt(0).toUpperCase() || <User className="w-12 h-12" />}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <label 
                                htmlFor="avatarInput"
                                className="absolute bottom-0 right-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors"
                              >
                                <Camera className="w-5 h-5 text-primary-foreground" />
                              </label>
                              <input
                                id="avatarInput"
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="hidden"
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Tap the camera icon to upload your photo
                            </p>
                          </div>

                          <Button 
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium shadow-md"
                            onClick={handleAvatarSubmitAndCreateAccount}
                            disabled={isLoading || !regAvatar}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Creating Account...
                              </>
                            ) : (
                              <>
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Create Account
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our{' '}
                <button className="text-primary hover:underline">Terms of Service</button>
                {' '}and{' '}
                <button className="text-primary hover:underline">Privacy Policy</button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Crop Dialog */}
      {cropImageSrc && (
        <AvatarCropDialog
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default Auth;
