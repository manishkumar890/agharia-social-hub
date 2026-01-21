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
import { toast } from 'sonner';
import { Phone, Shield, ArrowRight, Loader2 } from 'lucide-react';

const phoneSchema = z.string()
  .length(10, 'Phone number must be exactly 10 digits')
  .regex(/^\d+$/, 'Phone number must contain only digits');

const otpSchema = z.string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d+$/, 'OTP must contain only digits');

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [verifyData, setVerifyData] = useState<{
    userId?: string;
    token?: string;
    tokenType?: string;
    email?: string;
    phone?: string;
  } | null>(null);

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

  const handleSendOtp = async () => {
    try {
      phoneSchema.parse(phone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Call the send-otp edge function
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone }
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('OTP sent to your phone!');
      setStep('otp');
      setResendTimer(data?.expiresIn ? Math.floor(data.expiresIn / 10) : 60);
    } catch (error: unknown) {
      console.error('OTP Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      otpSchema.parse(otp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Call the verify-otp edge function
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, otp }
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        setVerifyData(data);
        setIsNewUser(data.isNewUser);

        // Use the magic link token to sign in
        if (data.token && data.email) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: data.token,
            type: data.tokenType || 'magiclink',
          });

          if (verifyError) {
            // Try alternative sign in method
            const { error: signInError } = await supabase.auth.signInWithOtp({
              email: data.email,
              options: {
                shouldCreateUser: false,
              }
            });
            
            if (signInError) {
              console.error('Sign in error:', signInError);
            }
          }

          // Wait a moment for auth to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if user is now logged in
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          if (currentUser) {
            if (data.isNewUser) {
              setStep('profile');
            } else {
              // Check if profile exists
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', currentUser.id)
                .maybeSingle();

              if (!profile) {
                setStep('profile');
              } else {
                navigate('/');
              }
            }
          } else {
            // If still not logged in, try one more approach
            if (data.isNewUser) {
              setStep('profile');
            } else {
              toast.error('Authentication failed. Please try again.');
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error('Verify Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid OTP';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error('Username can only contain letters, numbers, and underscores');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      let userId = currentUser?.id || verifyData?.userId;
      
      if (!userId) {
        throw new Error('No user found. Please try again.');
      }

      const { error } = await supabase.from('profiles').insert({
        user_id: userId,
        phone: phone,
        full_name: fullName.trim(),
        username: username.trim() || null,
      });

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('username')) {
            toast.error('Username already taken');
          } else if (error.message.includes('phone')) {
            toast.error('Phone number already registered');
          }
          return;
        }
        throw error;
      }

      toast.success('Profile created successfully!');
      
      // Refresh to trigger auth state update
      window.location.href = '/';
    } catch (error: unknown) {
      console.error('Profile Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create profile';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
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
      <div className="px-4 -mt-8">
        <Card className="max-w-md mx-auto shadow-elegant">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-xl">
              {step === 'phone' && 'Welcome'}
              {step === 'otp' && 'Verify OTP'}
              {step === 'profile' && 'Create Profile'}
            </CardTitle>
            <CardDescription>
              {step === 'phone' && 'Enter your mobile number to continue'}
              {step === 'otp' && `Enter the 6-digit code sent to +91 ${phone}`}
              {step === 'profile' && 'Complete your profile to get started'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 'phone' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      +91
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter 10 digit number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="pl-12"
                      maxLength={10}
                    />
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <Button 
                  className="w-full gradient-maroon text-primary-foreground"
                  onClick={handleSendOtp}
                  disabled={isLoading || phone.length !== 10}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  Send OTP
                </Button>
              </>
            )}

            {step === 'otp' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <div className="relative">
                    <Input
                      id="otp"
                      type="text"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      maxLength={6}
                    />
                    <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <Button 
                  className="w-full gradient-maroon text-primary-foreground"
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Verify & Continue
                </Button>

                <div className="text-center">
                  <Button 
                    variant="link" 
                    className="text-sm text-muted-foreground"
                    onClick={() => setStep('phone')}
                  >
                    Change number
                  </Button>
                  {resendTimer > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Resend OTP in {resendTimer}s
                    </p>
                  ) : (
                    <Button 
                      variant="link" 
                      className="text-sm text-primary"
                      onClick={handleSendOtp}
                      disabled={isLoading}
                    >
                      Resend OTP
                    </Button>
                  )}
                </div>
              </>
            )}

            {step === 'profile' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username (optional)</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only letters, numbers, and underscores
                  </p>
                </div>

                <Button 
                  className="w-full gradient-maroon text-primary-foreground"
                  onClick={handleCreateProfile}
                  disabled={isLoading || !fullName.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Create Profile
                </Button>
              </>
            )}
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
