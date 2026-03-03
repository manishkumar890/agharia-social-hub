import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type DeleteStep = 'initial' | 'confirm' | 'otp' | 'final';

const DeleteAccountDialog = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<DeleteStep>('initial');
  const [isOpen, setIsOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const resetDialog = () => {
    setStep('initial');
    setOtp('');
    setIsLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetDialog();
  };

  const handleFirstWarning = () => {
    setStep('confirm');
  };

  const handleSecondWarning = async () => {
    if (!profile?.phone) {
      toast.error('Phone number not found');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.sendOtp(profile.phone);
      toast.success('OTP sent to your registered mobile number');
      setStep('otp');
      setResendTimer(60);
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || !profile?.phone) return;

    setIsLoading(true);
    try {
      await authApi.sendOtp(profile.phone);
      toast.success('OTP resent successfully');
      setResendTimer(60);
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndShowFinal = () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setStep('final');
  };

  const handleDeleteAccount = async () => {
    if (!user || !profile?.phone) return;

    setIsLoading(true);
    try {
      // Verify OTP first
      await authApi.verifyOtp(profile.phone, otp);
      
      // Note: Full account deletion would require admin API
      // For now, just sign out
      toast.success('Account deletion requested. Please contact support to complete.');
      await signOut();
      navigate('/auth');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to verify. Please try again.');
      setStep('otp');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Your Account?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>This action will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Your profile and personal information</li>
                <li>All your posts and photos</li>
                <li>All your comments and likes</li>
                <li>Your followers and following list</li>
              </ul>
              <p className="font-semibold text-destructive">
                This action cannot be undone!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setIsOpen(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              I Understand, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          {step === 'initial' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Are You Absolutely Sure?
                </DialogTitle>
                <DialogDescription>
                  You are about to permanently delete your account. All your data will be lost forever.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="outline" onClick={handleClose}>
                  No, Keep My Account
                </Button>
                <Button variant="destructive" onClick={handleFirstWarning}>
                  Yes, Delete My Account
                </Button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Final Confirmation Required
                </DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>For your security, we need to verify your identity via OTP.</p>
                  <p>An OTP will be sent to: <span className="font-semibold">+91 {profile?.phone}</span></p>
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button variant="destructive" onClick={handleSecondWarning} disabled={isLoading}>
                  {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : 'Send OTP'}
                </Button>
              </div>
            </>
          )}

          {step === 'otp' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Enter Verification Code
                </DialogTitle>
                <DialogDescription>
                  Enter the 6-digit OTP sent to +91 {profile?.phone}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="text-center">
                  <Button variant="link" onClick={handleResendOtp} disabled={resendTimer > 0 || isLoading} className="text-sm">
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button variant="destructive" onClick={handleVerifyAndShowFinal} disabled={otp.length !== 6}>
                  Verify & Continue
                </Button>
              </div>
            </>
          )}

          {step === 'final' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Last Chance!
                </DialogTitle>
                <DialogDescription>
                  <p className="font-semibold text-destructive">This is your FINAL warning!</p>
                  <p>Clicking "Delete Forever" will permanently delete your account.</p>
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="outline" onClick={handleClose}>No, Keep My Account</Button>
                <Button variant="destructive" onClick={handleDeleteAccount} disabled={isLoading}>
                  {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : 'Delete Forever'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeleteAccountDialog;
